# Holy Symbol

Holy Symbol is a Vite + React + TypeScript calculator for MapleLegends leech buyers and sellers.

## Features

- Quick Estimate card for quote calculation before a leech run.
- Ratio pricing, such as `1:3.3` EXP per meso, with `0.1` step increments.
- Hourly estimate mode using price in `M/hr` plus EPH in `M EXP/hr`.
- Multiple vertical leech instances, each with independent billing settings.
- Ratio instances show only ratio price; hourly instances show only hourly price and timer controls.
- Hourly instances use explicit Start / Pause / End timer controls for actual billing.
- Buyers are added one by one inside each leech instance and displayed as horizontal cards.
- Each buyer supports live IGN fetch or manual level / EXP input for start and finish snapshots.
- Embedded MapleLegends EXP table as static TypeScript data.
- Converts level + EXP percentage into raw accumulated EXP.
- Calculates EXP gained and mesos due for ratio or timer-based hourly billing.
- Local browser persistence through `localStorage`.
- CSV export for all instances.

## Run locally

```bash
npm install
npm run dev
```

Vite's dev proxy maps local API routes to Legends endpoints:

- `/api/character/:ign` -> `https://legends.ml/api/character?name=:ign`
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
4. The `functions/` directory provides production proxy routes.
