// Types shared by the server API and the React client.

export interface Inputs {
  gravity: number; // multiples of g0 (0 = microgravity)
  o2: number; // % by volume
  pressure: number; // kPa
  flow: number; // opposed flow, cm/s
  thickness: number; // total sheet thickness, mm
}

export type Provenance = "observed" | "published" | "simulated" | "illustrative";
export type Outcome = "sustained spread" | "extinction" | "indeterminate";

export interface Study {
  id: string;
  title: string;
  summary: string;
  url: string;
  platform: string;
  gravity: "micro" | "earth";
}

export interface Test extends Inputs {
  id: string;
  study: string;
  sample: string;
  kind: "spread" | "limit"; // limit = critical flow below which the flame went out
  spread: number | null; // mm/s
  unc: number | null; // mm/s
  crit: number | null; // cm/s
  critUnc: number | null; // cm/s
  outcome: Outcome | "extinction limit";
  role: "calibration" | "validation";
  prov: Provenance;
  source: string;
  cite: string;
  note: string;
}

export interface SweepPoint { flow: number; spread: number; p05: number; p95: number }

/** Which loss limits the flame at a given flow: surface radiation, finite-rate chemistry, or neither. */
export interface RegimePoint { flow: number; spread: number; lossless: number; limit: "radiative" | "kinetic" | "thermal" }

export interface FastResult {
  model: "FFR-1";
  version: string;
  inputs: Inputs;
  spread: number; // mm/s, nominal
  p05: number;
  p95: number;
  pExtinction: number;
  outcome: Outcome;
  cause: string;
  regime: string;
  flameTemp: number; // K
  flowEff: number; // cm/s including buoyancy
  damkohler: number;
  lossRatio: number;
  heatFeedback: number; // kW/m^2 conducted from flame to fuel
  surfaceLoss: number; // kW/m^2 re-radiated by the fuel surface
  warnings: string[];
  sweep: SweepPoint[];
  regimes: RegimePoint[];
}

/** Fast-model spread rate on an oxygen × flow grid. spread[j][i] is at o2[j], flow[i]; 0 = no sustained spread. */
export interface FlammabilityMap { flow: number[]; o2: number[]; spread: number[][] }

export interface FrontPoint { t: number; xf: number; xp: number; Tmax: number } // xf, xp in mm

/** Energy flows per metre of sheet width, one face, W/m. */
export interface Budget { heatRelease: number; gasRadiation: number; toSheet: number; sheetRadiation: number; vaporizing: number }

export interface Frame {
  t: number;
  T: number[]; // gas temperature, K, nx*ny row-major from the sheet upward
  H: number[]; // heat-release rate, MW/m^3
  O: number[]; // oxygen mass fraction
  Ts: number[]; // sheet surface temperature, K
  m: number[]; // fuel remaining, fraction 0..1
  budget: Budget;
}

export interface DetailedResult {
  model: "FFR-2D";
  version: string;
  inputs: Inputs;
  spread: number | null; // mm/s, fitted to the leading edge
  r2: number | null;
  outcome: Outcome;
  cause: string;
  peakTemp: number;
  nx: number;
  ny: number;
  dx: number; // mm
  steps: number;
  simTime: number; // s
  front: FrontPoint[];
  fit: { t0: number; t1: number; V: number; b0: number } | null; // V mm/s, b0 mm
  frames: Frame[];
  warnings: string[];
}

export interface Job {
  id: string;
  status: "running" | "done" | "canceled" | "error";
  progress: number; // 0..1
  simTime: number;
  inputs: Inputs;
  grid: { nx: number; ny: number; dx: number };
  /** While running: frames produced since the `since` index the client asked for, starting at `from`. */
  frames?: Frame[];
  from?: number;
  front?: FrontPoint[];
  result?: DetailedResult;
  error?: string;
}

export interface Residual { pred: string; z: number | null; agree?: boolean }
export interface ValidationRow { testId: string; role: Test["role"]; reported: string; prior: Residual; calibrated: Residual }
export interface Validation { rows: ValidationRow[]; calibration: { prior: number; value: number; sigmaRel: number; record: string } }

export interface Answer {
  question: string;
  gap: string | null;
  points: { text: string; cite: number }[];
  sources: { n: number; title: string; url?: string; prov: Provenance }[];
}
