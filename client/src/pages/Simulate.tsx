import { useEffect, useState } from "react";
import type { Inputs, Test } from "../../../shared/types";
import { inputsOf, useDetailedRun, useFast } from "../api";
import LineChart from "../components/LineChart";
import FieldMap from "../components/FieldMap";
import FlameScene from "../components/FlameScene";

const FIELDS: { key: keyof Inputs; label: string; unit: string; step: number; hint: string }[] = [
  { key: "gravity", label: "Gravity", unit: "g₀", step: 0.01, hint: "0 = microgravity, 1 = Earth" },
  { key: "o2", label: "Oxygen", unit: "%", step: 0.1, hint: "documented 15–40" },
  { key: "pressure", label: "Pressure", unit: "kPa", step: 0.1, hint: "documented 30–101.3" },
  { key: "flow", label: "Opposed flow", unit: "cm/s", step: 0.1, hint: "documented 0–100; detailed ≤ 50" },
  { key: "thickness", label: "Sheet thickness", unit: "mm", step: 0.01, hint: "documented 0.05–25; detailed 0.05–0.4" },
];
const f = (v: number | null | undefined, d = 3) => (v == null || !isFinite(v) ? "—" : String(+v.toPrecision(d)));

export default function Simulate({ tests, baseline }: { tests: Test[]; baseline: string }) {
  const [inputs, setInputs] = useState<Inputs>(() => inputsOf(tests.find((t) => t.id === baseline) ?? tests[0]));
  const [from, setFrom] = useState(baseline);
  const fast = useFast(inputs);
  const det = useDetailedRun();
  const [frameIdx, setFrameIdx] = useState(0);
  const res = det.job?.result;

  useEffect(() => { if (res) setFrameIdx(Math.floor(res.frames.length * 0.55)); }, [res]);

  const pick = (id: string) => { setFrom(id); const t = tests.find((x) => x.id === id); if (t) setInputs(inputsOf(t)); };
  const fr = fast.result;
  const matching = tests.filter((t) => t.spread != null && t.gravity === inputs.gravity && Math.abs(t.o2 - inputs.o2) < 0.6 && Math.abs(t.thickness - inputs.thickness) < 0.02);
  const frame = res?.frames[Math.min(frameIdx, res.frames.length - 1)];

  return (
    <div className="cols">
      <section className="card">
        <h2>Scenario</h2>
        <label className="field"><span>Start from test</span>
          <select value={from} onChange={(e) => pick(e.target.value)} style={{ gridColumn: "1 / -1" }}>
            {tests.map((t) => <option key={t.id} value={t.id}>{t.id}</option>)}
          </select>
        </label>
        {FIELDS.map((fd) => (
          <label className="field" key={fd.key}>
            <span>{fd.label} <span className="muted small">({fd.unit})</span></span>
            <input type="number" step={fd.step} value={inputs[fd.key]} onChange={(e) => setInputs({ ...inputs, [fd.key]: e.target.value === "" ? NaN : +e.target.value })} />
            <span className="hint">{fd.hint}</span>
          </label>
        ))}
        <p className="small muted">Fuel: PMMA sheet, both faces burning, opposed flow.</p>
        <div className="row">
          <button className="primary" disabled={det.running} onClick={() => det.start(inputs)}>Run detailed model</button>
          {det.running && <button onClick={det.cancel}>Cancel</button>}
        </div>
        {det.error && <p className="error">{det.error}</p>}
      </section>

      <div className="stack">
        <section className="card">
          <div className="row"><h2>Fast model · FFR-1</h2><span className="tag sim">simulated</span><span className="small muted">instant · calibrated on one 1 g test · not validated</span></div>
          {fast.error && <p className="error">{fast.error}</p>}
          {fr && <>
            <div className="stats">
              <div className="stat"><div className="k">Outcome</div><div className="v" style={{ fontSize: 16, color: fr.outcome === "extinction" ? "var(--bad)" : "var(--good)" }}>{fr.outcome}</div><div className="k">{fr.cause || fr.regime}</div></div>
              <div className="stat"><div className="k">Spread rate</div><div className="v">{f(fr.spread)}</div><div className="k">mm/s · 90% band {f(fr.p05)}–{f(fr.p95)}</div></div>
              <div className="stat"><div className="k">Flame temperature</div><div className="v">{Math.round(fr.flameTemp)}</div><div className="k">K (lumped estimate)</div></div>
              <div className="stat"><div className="k">Effective flow</div><div className="v">{f(fr.flowEff)}</div><div className="k">cm/s incl. buoyancy</div></div>
            </div>
            {fr.warnings.map((w) => <p key={w} className="warn">{w}</p>)}
            <h3>Spread rate vs opposed flow</h3>
            <LineChart x={[0.3, 100]} xLog y={[0, Math.max(0.5, ...fr.sweep.map((p) => p.p95), ...matching.map((t) => t.spread! + t.unc!)) * 1.1]}
              xLabel="opposed flow (cm/s)" yLabel="spread (mm/s)"
              band={{ points: fr.sweep.map((p) => [p.flow, p.p05, p.p95]), color: "var(--sim)" }}
              lines={[{ points: fr.sweep.map((p) => [p.flow, p.spread]), color: "var(--sim)", dash: "6 3", label: "FFR-1" }]}
              dots={[...matching.map((t) => ({ x: Math.max(0.3, t.flow), y: t.spread!, err: t.unc!, color: "var(--pub)", label: t.id })),
                ...(res && res.spread != null && res.outcome === "sustained spread" ? [{ x: Math.max(0.3, res.inputs.flow), y: res.spread, color: "var(--sim)", label: "FFR-2D" }] : [])]}
              markers={[{ x: Math.max(0.3, inputs.flow), color: "var(--accent)", label: "current" }]} />
          </>}
        </section>

        <section className="card">
          <div className="row"><h2>Detailed model · FFR-2D</h2><span className="tag sim">simulated</span><span className="small muted">2D combustion solver · not calibrated or validated</span></div>
          {!det.job && <p className="note">Press <b>Run detailed model</b> to solve the gas and sheet equations. The spread rate comes out of the solution. Takes 10–20 s.</p>}
          {det.job?.status === "running" && <>
            <div className="progress"><span style={{ width: `${det.job.progress * 100}%` }} /></div>
            <p className="note">Solving… {det.job.simTime.toFixed(1)} s of flame time computed.</p>
          </>}
          {det.job?.status === "canceled" && <p className="note">Canceled.</p>}
          {det.job?.status === "error" && <p className="error">{det.job.error}</p>}
          {res && frame && <>
            <div className="stats">
              <div className="stat"><div className="k">Outcome</div><div className="v" style={{ fontSize: 16, color: res.outcome === "extinction" ? "var(--bad)" : "var(--good)" }}>{res.outcome}</div><div className="k">{res.cause || `fit r² ${f(res.r2)}`}</div></div>
              <div className="stat"><div className="k">Spread rate</div><div className="v">{f(res.spread)}</div><div className="k">mm/s from the front fit</div></div>
              <div className="stat"><div className="k">Peak gas temperature</div><div className="v">{Math.round(res.peakTemp)}</div><div className="k">K, computed</div></div>
              <div className="stat"><div className="k">Simulated</div><div className="v">{f(res.simTime)}</div><div className="k">s · {res.steps.toLocaleString()} steps</div></div>
            </div>
            {res.warnings.map((w) => <p key={w} className="small muted">{w}</p>)}
            <FlameScene result={res} frame={frame} />
            <div className="row">
              <input type="range" min={0} max={res.frames.length - 1} value={frameIdx} onChange={(e) => setFrameIdx(+e.target.value)} style={{ flex: 1 }} aria-label="Time" />
              <span className="mono small">t = {frame.t.toFixed(1)} s</span>
            </div>
            <div className="two">
              <div><h3>Gas temperature above the sheet</h3><FieldMap result={res} frame={frame} /></div>
              <div><h3>Flame front position</h3>
                <LineChart x={[0, Math.max(2, res.simTime)]} y={[0, 40]} xLabel="time (s)" yLabel="position (mm)" height={260}
                  lines={[{ points: res.front.map((p) => [p.t, p.xf]), color: "var(--sim)", label: "leading edge" },
                    { points: res.front.map((p) => [p.t, p.xp]), color: "var(--pub)", dash: "5 3", label: "pyrolysis" },
                    ...(res.fit ? [{ points: [[res.fit.t0, res.fit.b0 + res.fit.V * res.fit.t0], [res.fit.t1, res.fit.b0 + res.fit.V * res.fit.t1]] as [number, number][], color: "var(--fg)", dash: "2 2" }] : [])]}
                  markers={[{ x: frame.t, color: "var(--accent)" }]} />
              </div>
            </div>
          </>}
        </section>
      </div>
    </div>
  );
}
