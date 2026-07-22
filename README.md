# Holy Symbol

Holy Symbol is a Vite + React + TypeScript calculator for MapleLegends leech buyers and sellers.

## Features

- Quick Estimate card for quote calculation before a leech run.
- Progressive ratio pricing with a base ratio and optional buyer-level tiers, such as `1:3.3` below level 120 and `1:4` from level 120 onward.
- Hourly estimate mode using price in `M/hr` plus EPH in `M EXP/hr`.
- A run rail for switching between independent leech runs and a selected run editor.
- Ratio runs show ratio pricing; hourly runs show hourly pricing and Start / Pause / Reset timer controls.
- Buyers are added inside each run and displayed as responsive cards.
- Each buyer supports live IGN refresh or manual level / EXP input for start and current snapshots.
- Embedded MapleLegends EXP table as static TypeScript data.
- Converts level + EXP percentage into raw accumulated EXP.
- Calculates EXP gained and mesos due for ratio or timer-based hourly billing.
- Local browser persistence through `localStorage`.
- CSV export for all runs.

## Run locally

```bash
npm install
npm run dev
```

For component-width responsive checks, open the development harness at:

```text
http://localhost:5173/?responsive-preview=1
```

Each preview can be resized horizontally so container-query behavior can be tested independently of the browser viewport.

The local development server provides the same character API surface as production:

- `POST /api/characters` accepts up to 50 character names. The application uses this endpoint for both single and batch refreshes and transparently chunks larger run-level requests.
- `GET /api/character/:ign` remains as a backward-compatible adapter for older callers.

The EXP table is embedded locally as TypeScript data; it is not fetched or generated at runtime.

## Build

```bash
npm run build
```

## Test

```bash
npm test
```

## Deploy on Cloudflare Pages

1. Connect the repository to Cloudflare Pages.
2. Build command: `npm run build`
3. Build output directory: `dist`
4. The `functions/` directory provides production character routes.
