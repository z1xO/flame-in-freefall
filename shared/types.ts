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
  warnings: string[];
  sweep: SweepPoint[];
}

export interface FrontPoint { t: number; xf: number; xp: number; Tmax: number } // xf, xp in mm

export interface Frame {
  t: number;
  T: number[]; // gas temperature, K, nx*ny row-major from the sheet upward
  H: number[]; // heat-release rate, MW/m^3
  Ts: number[]; // sheet surface temperature, K
  m: number[]; // fuel remaining, fraction 0..1
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
