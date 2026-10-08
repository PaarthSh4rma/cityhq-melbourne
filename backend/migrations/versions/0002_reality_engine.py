"""City isolation and air quality; existing records remain Melbourne."""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None
SNAPSHOTS = ("weather_observations", "transport_snapshots", "event_snapshots", "model_predictions")


def upgrade():
    for name in (*SNAPSHOTS, "activity_features", "ingestion_runs"):
        op.add_column(
            name, sa.Column("city_id", sa.String, nullable=False, server_default="melbourne")
        )
        op.create_index(f"ix_{name}_city_id", name, ["city_id"])
    for name in SNAPSHOTS:
        op.add_column(name, sa.Column("dedup_key", sa.String, nullable=True))
    op.drop_index("ix_activity_features_timestamp", table_name="activity_features")
    op.create_index("ix_activity_features_timestamp", "activity_features", ["timestamp"])
    op.create_index(
        "ix_activity_city_timestamp", "activity_features", ["city_id", "timestamp"], unique=True
    )
    for name in ("air_quality_observations", "provider_raw_payloads"):
        extra = (
            [
                sa.Column("source", sa.String, nullable=False),
                sa.Column("provider", sa.String, nullable=False),
            ]
            if name == "provider_raw_payloads"
            else []
        )
        op.create_table(
            name,
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("city_id", sa.String, nullable=False, server_default="melbourne"),
            sa.Column("timestamp", sa.String, nullable=False),
            sa.Column("digest", sa.String, nullable=False),
            sa.Column("dedup_key", sa.String, nullable=True),
            sa.Column("payload", sa.Text, nullable=False),
            *extra,
        )
        for field in ("timestamp", "digest", "city_id"):
            op.create_index(f"ix_{name}_{field}", name, [field])
    for name in (*SNAPSHOTS, "air_quality_observations", "provider_raw_payloads"):
        op.create_index(f"ix_{name}_city_timestamp", name, ["city_id", "timestamp"])
        op.create_index(f"ix_{name}_city_digest", name, ["city_id", "digest"])
        op.create_index(f"ix_{name}_city_dedup", name, ["city_id", "dedup_key"], unique=True)
    op.add_column("ingestion_runs", sa.Column("error_code", sa.String, nullable=True))
    op.add_column("ingestion_runs", sa.Column("latency_ms", sa.Float, nullable=True))


def downgrade():
    # Refuse a destructive downgrade once Delhi history exists. Export it first.
    connection = op.get_bind()
    if any(
        connection.execute(
            sa.text(f"SELECT COUNT(*) FROM {name} WHERE city_id != 'melbourne'")
        ).scalar()
        for name in (
            *SNAPSHOTS,
            "activity_features",
            "ingestion_runs",
            "air_quality_observations",
            "provider_raw_payloads",
        )
    ):
        raise RuntimeError(
            "Downgrade would discard city-scoped history; export Delhi records first."
        )
    op.drop_column("ingestion_runs", "latency_ms")
    op.drop_column("ingestion_runs", "error_code")
    for name in ("air_quality_observations", "provider_raw_payloads"):
        op.drop_table(name)
    for name in SNAPSHOTS:
        op.drop_index(f"ix_{name}_city_timestamp", table_name=name)
        op.drop_index(f"ix_{name}_city_digest", table_name=name)
        op.drop_index(f"ix_{name}_city_dedup", table_name=name)
        op.drop_column(name, "dedup_key")
    op.drop_index("ix_activity_city_timestamp", table_name="activity_features")
    op.drop_index("ix_activity_features_timestamp", table_name="activity_features")
    op.create_index(
        "ix_activity_features_timestamp", "activity_features", ["timestamp"], unique=True
    )
    for name in (*SNAPSHOTS, "activity_features", "ingestion_runs"):
        op.drop_index(f"ix_{name}_city_id", table_name=name)
        op.drop_column(name, "city_id")
