// FFR-1: reduced-order opposed-flow flame spread model.
// de Ris thin/thick spread rates, corrected for finite-rate chemistry (Damköhler number)
// and surface radiative loss. Uncertainty from a seeded Monte Carlo over assumed parameters.
import type { FastResult, Inputs, Residual, Test, Validation } from "../../shared/types";
import { TESTS } from "./data";

export const VERSION = "0.2.0";
const P0 = 101.325;

interface Params { lamG: number; rhoG0: number; cG: number; Tinf: number; Tv: number; rhoS: number; cS: number; lamS: number; eps: number; kTf: number; Ta: number; A: number }
export const PRIOR: Params = { lamG: 0.05, rhoG0: 0.4, cG: 1100, Tinf: 298, Tv: 660, rhoS: 1190, cS: 1466, lamS: 0.19, eps: 0.9, kTf: 7600, Ta: 15000, A: 1.23e8 };
export const NOMINAL: Params = { ...PRIOR };
let kTfSigma = 0.05;

export function solve(inp: Inputs, pr: Params) {
  const P = inp.pressure / P0;
  const x = inp.o2 / 100;
  const Y = (x * 32) / (x * 32 + (1 - x) * 28.01);
  const Tf = pr.Tinf + pr.kTf * Y;
  const rhoG = pr.rhoG0 * P, alphaG = pr.lamG / (rhoG * pr.cG);
  const Ub = Math.cbrt((inp.gravity * 9.80665 * alphaG * (Tf - pr.Tinf)) / pr.Tinf);
  const tau = inp.thickness / 2000;
  const dT = Tf - pr.Tv, dS = pr.Tv - pr.Tinf;
  if (dT <= 0) return { V: 0, Tf, U: Ub, Da: 0, chi: Infinity, regime: "-", outcome: "extinction" as const, cause: "flame temperature below pyrolysis temperature" };
  const Vthin = ((Math.PI / 4) * pr.lamG * dT) / (pr.rhoS * pr.cS * tau * dS);
  const Ugas = Math.cbrt((inp.flow / 100) ** 3 + Ub ** 3);
  const VthickPerU = (rhoG * pr.lamG * pr.cG * dT * dT) / (pr.rhoS * pr.lamS * pr.cS * dS * dS);
  const U = Ugas + Math.hypot(Vthin, Ugas * VthickPerU); // flow relative to the moving flame
  const Vthick = U * VthickPerU;
  const V0 = Math.hypot(Vthin, Vthick);
  const Da = (alphaG / (U * U)) * pr.A * P * P * Y * Math.exp(-pr.Ta / Tf);
  const chi = (pr.eps * 5.67e-8 * (pr.Tv ** 4 - pr.Tinf ** 4)) / ((pr.lamG * dT * U) / alphaG);
  const fk = Da > 1 ? 1 - 1 / Da : 0;
  const fr = chi < 1 ? 1 - chi : 0;
  let outcome: "sustained spread" | "extinction" = "sustained spread", cause = "";
  if (fk === 0) { outcome = "extinction"; cause = "blowoff: flow too fast for the chemistry (Da ≤ 1)"; }
  else if (fr === 0) { outcome = "extinction"; cause = "radiative quench: heat loss exceeds heat feedback"; }
  return { V: V0 * fk * fr, Tf, U, Da, chi, regime: Vthin >= Vthick ? "thermally thin" : "thermally thick", outcome, cause };
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const quant = (a: number[], q: number) => { const s = [...a].sort((x, y) => x - y); const i = (s.length - 1) * q, lo = Math.floor(i); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo); };

function sample(r: () => number, b: Params): Params {
  const ks = b === PRIOR ? 0.05 : kTfSigma;
  return { ...b, lamG: b.lamG * (1 + 0.15 * gauss(r)), Tv: b.Tv + 20 * gauss(r), kTf: b.kTf * (1 + ks * gauss(r)), Ta: b.Ta * (1 + 0.1 * gauss(r)), A: b.A * Math.exp(0.5 * gauss(r)), eps: 0.8 + 0.15 * r() };
}

function band(inp: Inputs, n = 300, b = NOMINAL) {
  const r = rng(hash(JSON.stringify(inp)));
  const vs: number[] = []; let ext = 0;
  for (let i = 0; i < n; i++) { const o = solve(inp, sample(r, b)); vs.push(o.V * 1000); if (o.outcome !== "sustained spread") ext++; }
  return { p05: quant(vs, 0.05), p95: quant(vs, 0.95), pExt: ext / n };
}

function critFlow(inp: Inputs, pr: Params): number | null {
  const ok = (f: number) => solve({ ...inp, flow: f }, pr).outcome === "sustained spread";
  let lo = 0, hi = 50;
  if (ok(lo)) return 0;
  if (!ok(hi)) return null;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (ok(m)) hi = m; else lo = m; }
  return hi;
}
function critBand(inp: Inputs, b: Params) {
  const r = rng(hash("crit" + JSON.stringify(inp))); const v: number[] = [];
  for (let i = 0; i < 150; i++) { const c = critFlow(inp, sample(r, b)); if (c != null) v.push(c); }
  return { nom: critFlow(inp, b), p05: v.length ? quant(v, 0.05) : null, p95: v.length ? quant(v, 0.95) : null };
}

// Calibrate the flame-temperature coefficient on the single calibration record.
const calTest = TESTS.find((t) => t.role === "calibration")!;
function fitKtf(target: number) {
  let lo = 4000, hi = 15000;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (solve(calTest, { ...PRIOR, kTf: m }).V * 1000 < target) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
const kCal = fitKtf(calTest.spread!);
kTfSigma = (fitKtf(calTest.spread! + calTest.unc!) - fitKtf(calTest.spread! - calTest.unc!)) / 2 / kCal;
NOMINAL.kTf = kCal;

export const RANGES: Record<keyof Inputs, [number, number]> = { gravity: [0, 1], o2: [15, 40], pressure: [30, 101.3], flow: [0, 100], thickness: [0.05, 25] };

export function runFast(inp: Inputs): FastResult {
  const n = solve(inp, NOMINAL), b = band(inp);
  const sweep = Array.from({ length: 36 }, (_, i) => {
    const flow = 0.3 * Math.pow(100 / 0.3, i / 35), q = { ...inp, flow };
    const bb = band(q, 80);
    return { flow, spread: solve(q, NOMINAL).V * 1000, p05: bb.p05, p95: bb.p95 };
  });
  const warnings = (Object.keys(RANGES) as (keyof Inputs)[]).filter((k) => inp[k] < RANGES[k][0] || inp[k] > RANGES[k][1]).map((k) => `${k} is outside the documented range ${RANGES[k][0]}–${RANGES[k][1]}; result is exploratory.`);
  return { model: "FFR-1", version: VERSION, inputs: inp, spread: n.V * 1000, p05: b.p05, p95: b.p95, pExtinction: b.pExt, outcome: n.outcome, cause: n.cause, regime: n.regime,
    flameTemp: n.Tf, flowEff: n.U * 100, damkohler: n.Da, lossRatio: n.chi, warnings, sweep };
}

function residual(t: Test, b: Params): Residual {
  if (t.kind === "limit") {
    const c = critBand(t, b);
    if (c.nom == null) return { pred: "none ≤ 50 cm/s", z: null };
    const sig = Math.hypot(t.critUnc!, ((c.p95 ?? c.nom) - (c.p05 ?? c.nom)) / 3.29);
    return { pred: `${c.nom.toFixed(2)} cm/s`, z: (c.nom - t.crit!) / sig };
  }
  const o = solve(t, b);
  if (t.spread == null) return { pred: o.outcome, z: null, agree: o.outcome === t.outcome };
  const bb = band(t, 300, b), v = o.V * 1000;
  return { pred: `${v.toFixed(2)} mm/s`, z: (v - t.spread) / Math.hypot(t.unc!, (bb.p95 - bb.p05) / 3.29) };
}

export function validation(): Validation {
  return {
    calibration: { prior: PRIOR.kTf, value: kCal, sigmaRel: kTfSigma, record: calTest.id },
    rows: TESTS.map((t) => ({
      testId: t.id, role: t.role,
      reported: t.kind === "limit" ? `out below ${t.crit} ± ${t.critUnc} cm/s` : t.spread != null ? `${t.spread} ± ${t.unc} mm/s` : t.outcome,
      prior: residual(t, PRIOR), calibrated: residual(t, NOMINAL),
    })),
  };
}
