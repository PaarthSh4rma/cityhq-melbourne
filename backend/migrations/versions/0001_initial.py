"""Initial observations, features, predictions and ingestion audit tables."""

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    for name in (
        "weather_observations",
        "transport_snapshots",
        "event_snapshots",
        "model_predictions",
    ):
        op.create_table(
            name,
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("timestamp", sa.String, nullable=False),
            sa.Column("digest", sa.String, nullable=False),
            sa.Column("payload", sa.Text, nullable=False),
        )
        op.create_index(f"ix_{name}_timestamp", name, ["timestamp"])
        op.create_index(f"ix_{name}_digest", name, ["digest"])
    op.create_table(
        "activity_features",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("timestamp", sa.String, nullable=False),
        sa.Column("score", sa.Float, nullable=True),
        sa.Column("payload", sa.Text, nullable=False),
    )
    op.create_index(
        "ix_activity_features_timestamp", "activity_features", ["timestamp"], unique=True
    )
    op.create_table(
        "ingestion_runs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("timestamp", sa.String, nullable=False),
        sa.Column("source", sa.String, nullable=False),
        sa.Column("status", sa.String, nullable=False),
    )
    for field in ("timestamp", "source"):
        op.create_index(f"ix_ingestion_runs_{field}", "ingestion_runs", [field])


def downgrade():
    for name in (
        "ingestion_runs",
        "activity_features",
        "model_predictions",
        "event_snapshots",
        "transport_snapshots",
        "weather_observations",
    ):
        op.drop_table(name)
