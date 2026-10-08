from alembic import context

from app.persistence import Base, engine

with engine.begin() as connection:
    # SQLite otherwise autocommits some DDL, leaving a partial schema on failure.
    if engine.dialect.name == "sqlite":
        connection.exec_driver_sql("BEGIN IMMEDIATE")
    context.configure(connection=connection, target_metadata=Base.metadata, render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()
