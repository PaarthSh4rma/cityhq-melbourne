import numpy as np

from app.ml.pipeline import features, synthetic_data, train


def test_features_are_causal():
    data = synthetic_data(days=20)
    before = features(data)
    data.loc[300:, "temperature"] = 999
    after = features(data)
    assert before.iloc[:300].drop(columns="target").equals(after.iloc[:300].drop(columns="target"))
    assert before.iloc[25].lag24 == data.iloc[1].temperature


def test_training_reproducible_and_chronological(tmp_path):
    data = synthetic_data(days=25)
    report = train(data, output=tmp_path)
    again = train(data, output=tmp_path)
    assert report["metrics"] == again["metrics"]
    assert (
        report["splits"]["train"]["end"]
        < report["splits"]["validation"]["start"]
        < report["splits"]["test"]["start"]
    )
    for metric in report["metrics"].values():
        assert np.isfinite(metric["test"]["mae"])
    assert report["selected_model"] == min(
        report["metrics"], key=lambda x: report["metrics"][x]["validation"]["mae"]
    )


def test_inference_and_prediction_storage(tmp_path, monkeypatch):
    from types import SimpleNamespace

    from app.ml import inference

    train(synthetic_data(days=25), output=tmp_path)
    monkeypatch.setattr(inference, "settings", SimpleNamespace(artifact_dir=str(tmp_path)))
    result = inference.forecast("ridge", 3)
    assert result["available"] and len(result["predictions"]) == 3
    assert result["predictions"][0]["timestamp"] > result["observed"][-1]["timestamp"]
    assert result["metadata"]["mode"] == "synthetic"
