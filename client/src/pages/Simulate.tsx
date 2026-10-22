import { detailedProblem, fmt } from "../api";
import { useStore, type Field } from "../store";
import { Segmented, Slider, Stat } from "../components/ui";
import LineChart from "../components/LineChart";
import FieldMap from "../components/FieldMap";
import FlameScene from "../components/FlameScene";
import FlammabilityMap from "../components/FlammabilityMap";
import { FIELDS } from "../components/colormap";

export default function Simulate() {
  const { tests, inputs, setInputs, baseline, pickBaseline, fast, fastError, map, det, autoRun, setAutoRun, field, setField, frameIdx, setFrameIdx, playing, setPlaying, speed, setSpeed } = useStore();
  const res = det.result;
  const frame = det.frames.length ? det.frames[Math.min(frameIdx, det.frames.length - 1)] : null;
  const grid = det.job?.grid ?? { nx: 80, ny: 24, dx: 0.5 };
  const problem = detailedProblem(inputs);
  const matching = tests.filter((t) => t.spread != null && t.gravity === inputs.gravity && Math.abs(t.o2 - inputs.o2) < 0.6 && Math.abs(t.thickness - inputs.thickness) < 0.02);
  const simEnd = res?.simTime ?? Math.max(2, det.front.at(-1)?.t ?? 0);

  return (
    <div className="sim">
      <aside className="card rail">
        <h2>Scenario</h2>
        <label className="stackfield"><span className="k">Start from a test</span>
          <select value={baseline} onChange={(e) => pickBaseline(e.target.value)}>
            {tests.map((t) => <option key={t.id} value={t.id}>{t.id}</option>)}
          </select>
        </label>
        <Slider label="Gravity" unit="g₀" value={inputs.gravity} min={0} max={1} step={0.01} hint="0 = microgravity · 1 = Earth" onChange={(v) => setInputs({ gravity: v })} />
        <Slider label="Oxygen" unit="%" value={inputs.o2} min={12} max={40} step={0.1} hint="documented 15–40" onChange={(v) => setInputs({ o2: v })} />
        <Slider label="Pressure" unit="kPa" value={inputs.pressure} min={20} max={110} step={0.1} hint="documented 30–101.3" onChange={(v) => setInputs({ pressure: v })} />
        <Slider label="Opposed flow" unit="cm/s" value={inputs.flow} min={0.3} max={100} step={0.1} log hint="log scale · detailed ≤ 50" onChange={(v) => setInputs({ flow: v })} />
        <Slider label="Sheet thickness" unit="mm" value={inputs.thickness} min={0.05} max={25} step={0.01} log hint="log scale · detailed 0.05–0.4" onChange={(v) => setInputs({ thickness: v })} />
        <p className="small muted">PMMA sheet, both faces burning, opposed flow.</p>

        <div className="divider" />
        <div className="row spread-row">
          <h3>Detailed solver</h3>
          <label className="switch"><input type="checkbox" checked={autoRun} onChange={(e) => setAutoRun(e.target.checked)} /><span />Auto re-run</label>
        </div>
        <div className="row">
          <button className="primary" disabled={!!problem} onClick={() => det.start()}>{det.running ? "Restart" : "Run detailed model"}</button>
          {det.running && <button onClick={det.cancel}>Cancel</button>}
        </div>
        {det.running && <>
          <div className="progress"><span style={{ width: `${(det.job?.progress ?? 0) * 100}%` }} /></div>
          <p className="small muted">Solving… {det.job?.simTime.toFixed(1)} s of flame time. The 3D view updates as it goes.</p>
        </>}
        {problem && <p className="small warn">{problem}</p>}
        {det.error && <p className="error">{det.error}</p>}
        {!det.job && !problem && <p className="small muted">{autoRun ? "Change any condition and the solver re-runs on its own, or press Run." : "Press Run to solve the gas and sheet equations."}</p>}
      </aside>

      <div className="stack">
        <div className="stats five">
          <Stat label="Fast · outcome" value={fast?.outcome ?? "…"} tone={fast?.outcome === "extinction" ? "bad" : "good"} sub={fast?.cause || fast?.regime} />
          <Stat label="Fast · spread rate" value={fast?.spread} unit="mm/s" sub={fast ? `90% band ${fmt(fast.p05)}–${fmt(fast.p95)}` : ""} />
          <Stat label="Flame temperature" value={fast?.flameTemp} digits={4} unit="K" sub="lumped estimate" />
          <Stat label="Detailed · spread rate" value={res ? res.spread : det.running ? "solving…" : "not run"} unit={res?.spread != null ? "mm/s" : undefined} sub={res ? `${res.outcome}${res.r2 != null ? ` · r² ${fmt(res.r2)}` : ""}` : ""} tone={res?.outcome === "extinction" ? "bad" : res ? "good" : undefined} />
          <Stat label="Detailed · peak gas T" value={frame ? frame.T.reduce((m, v) => Math.max(m, v), 0) : null} digits={4} unit="K" sub={frame ? `at t = ${frame.t.toFixed(1)} s` : ""} />
        </div>
        {fastError && <p className="error">{fastError}</p>}
        {fast?.warnings.map((w) => <p key={w} className="warn small">{w}</p>)}

        <section className="card">
          <div className="row spread-row">
            <div className="row"><h2>Computed flame</h2><span className="tag sim">FFR-2D</span></div>
            <Segmented label="Field" value={field} onChange={(f: Field) => setField(f)} options={(Object.keys(FIELDS) as Field[]).map((k) => ({ value: k, label: FIELDS[k].label }))} />
          </div>
          <FlameScene nx={grid.nx} ny={grid.ny} frame={frame} field={field} flow={(det.job?.inputs.flow ?? inputs.flow) + 1} live={det.running} />
          <div className="transport">
            <button className="play" disabled={!res} onClick={() => setPlaying(!playing)} aria-label={playing ? "Pause" : "Play"}>{playing ? "❚❚ Pause" : "▶ Play"}</button>
            <input type="range" min={0} max={Math.max(0, det.frames.length - 1)} value={Math.min(frameIdx, Math.max(0, det.frames.length - 1))} disabled={!det.frames.length}
              onChange={(e) => { setPlaying(false); setFrameIdx(+e.target.value); }} aria-label="Time" />
            <span className="mono small time">t = {frame ? frame.t.toFixed(1) : "0.0"} s</span>
            <Segmented label="Playback speed" value={String(speed)} onChange={(v) => setSpeed(+v)} options={[{ value: "1", label: "1×" }, { value: "2", label: "2×" }, { value: "4", label: "4×" }, { value: "8", label: "8×" }]} />
          </div>
          {res?.warnings.map((w) => <p key={w} className="small muted">{w}</p>)}
          {res?.cause && <p className="small warn">{res.cause}</p>}
        </section>

        <div className="two">
          <section className="card">
            <h3>{FIELDS[field].label} above the sheet</h3>
            {frame ? <FieldMap nx={grid.nx} ny={grid.ny} frame={frame} field={field} /> : <p className="empty">Appears while the detailed model runs.</p>}
          </section>
          <section className="card">
            <h3>Flame front position</h3>
            {det.front.length ? (
              <LineChart x={[0, simEnd]} y={[0, 40]} xLabel="time (s)" yLabel="position (mm)" unit="mm" height={260}
                lines={[{ points: det.front.map((p) => [p.t, p.xf]), color: "var(--sim)", label: "leading edge" },
                  { points: det.front.map((p) => [p.t, p.xp]), color: "var(--pub)", dash: "5 3", label: "pyrolysis" },
                  ...(res?.fit ? [{ points: [[res.fit.t0, res.fit.b0 + res.fit.V * res.fit.t0], [res.fit.t1, res.fit.b0 + res.fit.V * res.fit.t1]] as [number, number][], color: "var(--fg)", dash: "2 2", label: `fit ${fmt(res.fit.V)} mm/s` }] : [])]}
                markers={frame ? [{ x: frame.t, color: "var(--accent)" }] : []} />
            ) : <p className="empty">The front is tracked as the flame spreads.</p>}
          </section>
        </div>

        <div className="two">
          <section className="card" id="flam-card">
            <div className="row"><h3>Where can it burn?</h3><span className="tag sim">FFR-1</span></div>
            <p className="small muted">Spread rate over oxygen and flow at this gravity, pressure and thickness. Purple: BASS-II extinction limits. Click anywhere to try that condition.</p>
            {map ? <FlammabilityMap map={map} inputs={inputs} tests={tests} onPick={(o2, flow) => setInputs({ o2, flow })} /> : <p className="empty">Computing…</p>}
          </section>
          <section className="card">
            <div className="row"><h3>Spread rate vs opposed flow</h3><span className="tag sim">FFR-1</span></div>
            {fast && (
              <LineChart x={[0.3, 100]} xLog y={[0, Math.max(0.5, ...fast.sweep.map((p) => p.p95), ...matching.map((t) => t.spread! + t.unc!), res?.spread ?? 0) * 1.1]}
                xLabel="opposed flow (cm/s)" yLabel="spread (mm/s)" unit="mm/s" height={300}
                band={{ points: fast.sweep.map((p) => [p.flow, p.p05, p.p95]), color: "var(--sim)" }}
                lines={[{ points: fast.sweep.map((p) => [p.flow, p.spread]), color: "var(--sim)", dash: "6 3", label: "FFR-1" }]}
                dots={[...matching.map((t) => ({ x: Math.max(0.3, t.flow), y: t.spread!, err: t.unc!, color: "var(--pub)", label: t.id })),
                  ...(res && res.spread != null && res.outcome === "sustained spread" ? [{ x: Math.max(0.3, res.inputs.flow), y: res.spread, color: "var(--good)", label: "FFR-2D" }] : [])]}
                markers={[{ x: Math.max(0.3, inputs.flow), color: "var(--accent)", label: "now" }]} />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
