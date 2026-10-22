# Flame in Freefall

Explore NASA microgravity combustion tests (BASS-II), run a flame-spread model, and compare it with the published results.

- **client/**: React + TypeScript (Vite). Library, Simulate, Compare, Physics and Ask pages, plus a guided demo. Three.js 3D view of the computed flame that updates live while the solver runs, with play/pause once it finishes.
- **server/**: Express + TypeScript. Holds the curated data and runs the physics.
- **shared/types.ts**: API types used by both.

## Run

Needs Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:5173. The API runs on http://localhost:3001 and Vite proxies `/api` to it.

To serve the built app from the server alone: `npm run build`, then `npm start`, then open http://localhost:3001.

`npm run typecheck` checks both packages.

## Models

| | FFR-1 (fast) | FFR-2D (detailed) |
|---|---|---|
| What | de Ris thin/thick spread rate with blowoff (Damköhler) and radiative-loss corrections | Transient 2D gas energy, fuel and O₂ equations with one-step chemistry and gas radiation, coupled to a burning thin sheet |
| Spread rate | Formula | Fitted to the computed flame front |
| Speed | Instant, with a 300-sample uncertainty band | 10–20 s, run as a background job |
| Status | Calibrated on one 1 g record (SDSU-1G-100). Not validated. | Not calibrated. Not validated. |

## API

| Method | Path | Body / result |
|---|---|---|
| GET | `/api/library` | studies and curated tests |
| POST | `/api/fast` | `Inputs` → `FastResult` |
| POST | `/api/map` | `Inputs` → `FlammabilityMap` (spread rate over oxygen × flow) |
| POST | `/api/detailed` | `Inputs` → `Job` (202) |
| GET | `/api/detailed/:id?since=n` | `Job` with progress and snapshots from index `n` while running; `result` when done |
| DELETE | `/api/detailed/:id` | cancel |
| GET | `/api/validation` | FFR-1 residuals before and after calibration |
| POST | `/api/ask` | `{ question }` → `Answer` with citations |

`Inputs` = `{ gravity (g₀), o2 (%), pressure (kPa), flow (cm/s), thickness (mm) }`.

## Data

Test values come from the text and Table 2.1 of the
[BASS-II Summary Report, NASA/TM-20210011385](https://ntrs.nasa.gov/citations/20210011385).
They are published values, not raw measurements from the NASA PSI files.
