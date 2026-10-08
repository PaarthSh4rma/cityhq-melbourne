# Deployment review

## Local container topology

`docker compose up --build` starts a non-root Next standalone server and one non-root FastAPI worker. Named volume `cityhq-data` stores SQLite and model artifacts. Backend startup runs Alembic and exposes `/health`; frontend waits for readiness. Training is explicit via `docker compose exec backend python -m app.ml.pipeline --mode synthetic`.

`NEXT_PUBLIC_API_URL` must be a URL reachable by the user's browser, not the internal Docker service name. Set it as a frontend build arg. Build-time map style may carry only a browser-safe public token. Backend credentials are runtime environment variables; do not bake secrets into images.

## Before a public release

1. Choose a hosting environment with persistent disk or migrate to a durable managed database. A free web process does not imply durable storage.
2. Use HTTPS, exact allowed CORS origins, an access/rate-limit gateway and backups. The application is currently designed for trusted local use.
3. Keep one backend worker or separate the ingestion scheduler and cache before adding replicas.
4. Verify PTV/Ticketmaster credentials, upstream response contracts and applicable data licences. Never infer crowds from listing counts.
5. Review tile-provider usage for expected traffic and retain visible attribution. OSM standard tiles are best-effort community infrastructure, not a production SLA.
6. Run observed-data backtests before making real forecast claims. Keep demo labels visible until then.
7. Re-run dependency audits. The implementation upgraded Next to 16.4.0 to remove a critical advisory. Remaining development lint-tool advisories are documented in DELIVERY.md; no force downgrade to an incompatible Next 14 lint stack was applied.

No cloud account, paid resource, push or deployment is part of this implementation. CI is supplied but its hosted execution is not claimed until pushed and run.
