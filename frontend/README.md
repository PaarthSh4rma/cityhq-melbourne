# CITYHQ frontend

See the [root README](../README.md) for setup and the full platform architecture.

`npm run dev` starts Next.js. `NEXT_PUBLIC_API_URL` selects the CityHQ backend. `NEXT_PUBLIC_MAP_STYLE` optionally selects a permitted MapLibre style. Both are public build-time configuration; never put provider secrets here.

`npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run build` validate the client. Navigation uses shareable hash URLs (`#transit`, `#forecasting`, etc.) to retain polling and Operator session state.
