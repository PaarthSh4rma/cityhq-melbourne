# Deployment review

## Local container topology

`docker compose up --build` starts a non-root Next standalone server and one non-root FastAPI worker. Named volume `cityhq-data` stores SQLite and model artifacts. Backend startup runs Alembic and exposes `/health`; frontend waits for readiness. Training is explicit via `docker compose exec backend python -m app.ml.pipeline --mode synthetic`.

`NEXT_PUBLIC_API_URL` must be a URL reachable by the user's browser, not the internal Docker service name. Set it as a frontend build arg. Build-time map style may carry only a browser-safe public token. Backend credentials are runtime environment variables; do not bake secrets into images.

## Before a public release

1. Choose a hosting environment with persistent disk or migrate to a durable managed database. A free web process does not imply durable storage.
2. Use HTTPS, exact allowed CORS origins, an access/rate-limit gateway and backups. The application is currently designed for trusted local use.
3. Keep one backend worker or separate the ingestion scheduler and cache before adding replicas.
4. Verify PTV/Ticketmaster credentials, upstream response contracts and applicable data licences. Never infer crowds from listing counts.
5. Review tile-provider usage for expected traffic and retain visible attribution. The default is OpenFreeMap vector geography; configurable styles must support the desired sources/layers. Tile availability is not an application SLA.
6. Run observed-data backtests before making real forecast claims. Keep demo labels visible until then.
7. Re-run dependency audits. The implementation upgraded Next to 16.4.0 to remove a critical advisory. Remaining development lint-tool advisories and patched Python dependencies are documented in OVERDRIVE_DELIVERY.md; no force downgrade to an incompatible Next 14 lint stack was applied.

No cloud account, paid resource, push or deployment is part of this implementation. CI is supplied but its hosted execution is not claimed until pushed and run.

## Overdrive local production preview

The build-time public API address must match the browser-visible API. For the review ports, run from `backend`:

```sh
CORS_ORIGINS=http://127.0.0.1:3105 WEATHER_ADAPTER=wttr TRANSPORT_ADAPTER=demo EVENTS_ADAPTER=demo venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8105
```

After migrations and optional synthetic training, run from `frontend`:

```sh
NEXT_PUBLIC_API_URL=http://127.0.0.1:8105 npm run build
cp -R .next/static .next/standalone/.next/
cp -R public .next/standalone/
PORT=3105 HOSTNAME=127.0.0.1 node .next/standalone/server.js
```

The verified review process uses the same build via standalone output, with `public` and `.next/static` copied into `.next/standalone`, and `PORT=3105 HOSTNAME=127.0.0.1 node .next/standalone/server.js`. Do not overwrite existing environment files. Development remains `NEXT_PUBLIC_API_URL=http://127.0.0.1:8105 npm run dev -- --hostname 127.0.0.1 --port 3105`.

Before exposing the Operator publicly, configure authentication, shared request limits, request body caps, TLS and deliberate proxy address handling. The current in-process guard limits query count/concurrency but is not a distributed security boundary. Retain one ingestion worker until scheduling/cache are separated. WebGL and tile failure leave signal lists usable; a compatible provider style and connectivity remain necessary for real geography. No deployment has occurred.
