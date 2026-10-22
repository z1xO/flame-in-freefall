// FFR-2D: transient 2D opposed-flow flame spread over a thin PMMA sheet.
// Gas: constant-density plug flow; energy, fuel and O2 with one-step second-order Arrhenius chemistry
// and optically thin gas radiation. Sheet: half-thickness per face, Arrhenius pyrolysis, conduction
// from the gas, surface re-radiation. Explicit finite differences, upwind advection.
// The spread rate is an output: the flame front is tracked and a line is fitted to it.
// Written as a generator so the job runner can interleave it with other requests and cancel it.
import type { DetailedResult, Frame, FrontPoint, Inputs } from "../../shared/types";

export const VERSION = "0.1.0";
export const LIMITS = { thickness: [0.05, 0.4], flow: [0, 50] } as const;
export const SETTINGS = { cp: 1300, kap: 0.5 }; // assumed on physical grounds, not fitted

export const GRID = { nx: 80, ny: 24, dx: 0.5 }; // 40 × 12 mm at 0.5 mm

/** Yielded while solving; `frame` and `point` are set when a new snapshot has just been taken. */
export interface Progress { progress: number; simTime: number; frame?: Frame; point?: FrontPoint }

export function* ffr2d(inp: Inputs): Generator<Progress, DetailedResult, void> {
  const SIG = 5.67e-8;
  const P = inp.pressure / 101.325;
  const dx = GRID.dx / 1000, Lx = GRID.nx * dx, Ly = GRID.ny * dx;
  const nx = Math.round(Lx / dx), ny = Math.round(Ly / dx), N = nx * ny;
  const Tinf = 298, cp = SETTINGS.cp, rho = 0.35 * P, alpha = 1.6e-4 / P, lam = alpha * rho * cp;
  const xo = inp.o2 / 100, Yo = (xo * 32) / (xo * 32 + (1 - xo) * 28.01);
  const Q = 25.9e6, s = 1.92, B = 5e7, Ta = 15100, kap = SETTINGS.kap * P;
  const rhoS = 1190, cS = 1466, As = 2.82e9, Es = 15610, Lv = 1.0e6, eps = 0.9;
  const ms0 = rhoS * (inp.thickness / 2000);
  const Ub = Math.cbrt((inp.gravity * 9.80665 * alpha * 1700) / Tinf);
  const U = Math.cbrt((inp.flow / 100) ** 3 + Ub ** 3);
  const dt = Math.min((0.2 * dx * dx) / alpha, (0.4 * dx) / Math.max(U, 1e-6));
  const tIgn = 1.5, tMax = 40, frameDt = 0.4;
  const iIg0 = Math.round(0.002 / dx), iIg1 = Math.round(0.005 / dx);

  let T = new Float64Array(N).fill(Tinf), F = new Float64Array(N), O = new Float64Array(N).fill(Yo);
  let T2 = new Float64Array(N), F2 = new Float64Array(N), O2 = new Float64Array(N);
  const Ts = new Float64Array(nx).fill(Tinf), ms = new Float64Array(nx), md = new Float64Array(nx), hrr = new Float64Array(N);
  const qcIn = new Float64Array(nx), qrOut = new Float64Array(nx);
  for (let i = 0; i < nx; i++) { const x = (i + 0.5) * dx; ms[i] = x >= 0.001 && x <= 0.039 ? ms0 : 0; }

  const frames: Frame[] = [], front: FrontPoint[] = [];
  let t = 0, nextFrame = 0, step = 0, status: "running" | "extinction" | "reached end" | "time limit" = "running";

  while (t < tMax) {
    // sheet
    for (let i = 0; i < nx; i++) {
      if (ms[i] <= 0) { md[i] = 0; Ts[i] = T[i]; qcIn[i] = qrOut[i] = 0; continue; }
      const qc = (lam * (T[i] - Ts[i])) / (dx / 2), qr = eps * SIG * (Ts[i] ** 4 - Tinf ** 4);
      qcIn[i] = qc; qrOut[i] = qr;
      const m = ms[i] * As * Math.exp(-Es / Ts[i]);
      Ts[i] += (dt * (qc - qr - m * Lv)) / (Math.max(ms[i], 0.05 * ms0) * cS);
      const dm = Math.min(ms[i], m * dt);
      ms[i] -= dm; md[i] = dm / dt;
      if (ms[i] < 1e-4 * ms0) ms[i] = 0;
    }
    // gas transport: flow enters at the right (x = Lx), symmetry where the sheet has burned away
    const cx = (U * dt) / dx, cd = (alpha * dt) / (dx * dx);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = i + j * nx, last = i === nx - 1, top = j === ny - 1;
      const tR = last ? Tinf : T[k + 1], fR = last ? 0 : F[k + 1], oR = last ? Yo : O[k + 1];
      const tL = i > 0 ? T[k - 1] : T[k], fL = i > 0 ? F[k - 1] : F[k], oL = i > 0 ? O[k - 1] : O[k];
      const tU = top ? Tinf : T[k + nx], fU = top ? 0 : F[k + nx], oU = top ? Yo : O[k + nx];
      const tD = j > 0 ? T[k - nx] : ms[i] > 0 ? 2 * Ts[i] - T[k] : T[k];
      const fD = j > 0 ? F[k - nx] : F[k], oD = j > 0 ? O[k - nx] : O[k];
      T2[k] = T[k] + cx * (tR - T[k]) + cd * (tR + tL + tU + tD - 4 * T[k]);
      F2[k] = F[k] + cx * (fR - F[k]) + cd * (fR + fL + fU + fD - 4 * F[k]);
      O2[k] = O[k] + cx * (oR - O[k]) + cd * (oR + oL + oU + oD - 4 * O[k]);
    }
    for (let i = 0; i < nx; i++) F2[i] += (md[i] * dt) / (rho * dx);
    // chemistry and gas radiation
    for (let k = 0; k < N; k++) {
      let Tk = T2[k];
      hrr[k] = 0;
      if (Tk > 500 && F2[k] > 1e-7 && O2[k] > 1e-7) {
        const d = Math.min(B * rho * F2[k] * O2[k] * Math.exp(-Ta / Tk) * dt, F2[k], O2[k] / s);
        F2[k] -= d; O2[k] -= s * d; Tk += (Q / cp) * d; hrr[k] = (rho * Q * d) / dt;
      }
      if (Tk > 600) Tk -= (dt * 4 * SIG * kap * (Tk ** 4 - Tinf ** 4)) / (rho * cp);
      T2[k] = Tk;
    }
    // igniter near the left end
    if (t < tIgn) for (let j = 0; j < 4; j++) for (let i = iIg0; i <= iIg1; i++) T2[i + j * nx] = Math.max(T2[i + j * nx], 1500);
    [T, T2] = [T2, T]; [F, F2] = [F2, F]; [O, O2] = [O2, O];
    t += dt; step++;

    if (t >= nextFrame) {
      nextFrame += frameDt;
      let xf = 0, xp = 0, Tmax = 0, heat = 0, rad = 0, toSheet = 0, sheetRad = 0, vap = 0;
      for (let i = 0; i < nx; i++) {
        let cm = 0;
        for (let j = 0; j < ny; j++) {
          const k = i + j * nx;
          cm = Math.max(cm, T[k]);
          heat += hrr[k];
          if (T[k] > 600) rad += 4 * SIG * kap * (T[k] ** 4 - Tinf ** 4);
        }
        if (cm > 1200) xf = (i + 0.5) * dx * 1000;
        if (md[i] > 1e-4) xp = (i + 0.5) * dx * 1000;
        Tmax = Math.max(Tmax, cm);
        toSheet += qcIn[i]; sheetRad += qrOut[i]; vap += md[i] * Lv;
      }
      const point = { t, xf, xp, Tmax };
      const frame: Frame = {
        t,
        T: Array.from(T, Math.round),
        H: Array.from(hrr, (v) => Math.round(v / 1e3) / 1e3),
        O: Array.from(O, (v) => Math.round(v * 1000) / 1000),
        Ts: Array.from(Ts, Math.round),
        m: Array.from(ms, (v) => Math.round((v / ms0) * 1000) / 1000),
        budget: { heatRelease: heat * dx * dx, gasRadiation: rad * dx * dx, toSheet: toSheet * dx, sheetRadiation: sheetRad * dx, vaporizing: vap * dx },
      };
      front.push(point); frames.push(frame);
      if (t > tIgn + 1 && Tmax < 1000) { status = "extinction"; break; }
      if (xf > 34) { status = "reached end"; break; }
      yield { progress: t / tMax, simTime: t, frame, point };
    } else if (step % 400 === 0) yield { progress: t / tMax, simTime: t };
  }
  if (status === "running") status = "time limit";

  // fit the leading edge between 8 and 34 mm, after the igniter
  const pts = front.filter((p) => p.t > tIgn + 2 && p.xf > 8 && p.xf < 34);
  let fit: DetailedResult["fit"] = null, r2: number | null = null;
  if (pts.length >= 5) {
    const n = pts.length, mt = pts.reduce((a, p) => a + p.t, 0) / n, mx = pts.reduce((a, p) => a + p.xf, 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (const p of pts) { sxy += (p.t - mt) * (p.xf - mx); sxx += (p.t - mt) ** 2; syy += (p.xf - mx) ** 2; }
    const V = sxy / sxx;
    fit = { t0: pts[0].t, t1: pts[n - 1].t, V, b0: mx - V * mt };
    r2 = syy > 0 ? (sxy * sxy) / (sxx * syy) : 0;
  }
  const outcome = status === "extinction" ? "extinction" : fit && fit.V > 0.01 && (r2 ?? 0) > 0.8 ? "sustained spread" : "indeterminate";
  const cause = status === "extinction" ? "computed flame temperature fell below 1000 K after ignition" : outcome === "indeterminate" ? "no steady front within 40 s" : "";
  const warnings = [`Assumed cp = ${SETTINGS.cp} J/kg·K and gas absorption κ = ${SETTINGS.kap} m⁻¹·atm⁻¹. Not calibrated or validated.`];
  if ((alpha / Math.max(U, 1e-6)) * 1000 < 2) warnings.push("Flow is fast enough that the 0.5 mm grid under-resolves the flame.");
  return { model: "FFR-2D", version: VERSION, inputs: inp, spread: outcome === "extinction" ? 0 : fit ? fit.V : null, r2, outcome, cause,
    peakTemp: Math.max(...front.map((p) => p.Tmax)), nx, ny, dx: dx * 1000, steps: step, simTime: t, front, fit, frames, warnings };
}
