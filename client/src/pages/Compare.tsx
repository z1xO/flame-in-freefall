import { useEffect, useState } from "react";
import type { Residual, Validation } from "../../../shared/types";
import { api, fmt, inputsOf } from "../api";
import { useStore } from "../store";

const z = (r: Residual) => r.z != null ? <span style={{ color: Math.abs(r.z) > 2 ? "var(--bad)" : "var(--good)" }}>{r.z.toFixed(2)}</span> : r.agree == null ? "—" : r.agree ? "agrees" : "disagrees";

export default function Compare() {
  const { tests, baseline, pickBaseline, fast, det } = useStore();
  const [val, setVal] = useState<Validation | null>(null);
  useEffect(() => { api.validation().then(setVal); }, []);
  const test = tests.find((t) => t.id === baseline) ?? tests[0];
  const same = (i?: object) => JSON.stringify(i) === JSON.stringify(inputsOf(test));
  const f = same(fast?.inputs) ? fast : null;
  const dr = same(det.result?.inputs) ? det.result : null;
  const limit = test.kind === "limit";

  return (
    <>
      <section className="card">
        <h2>Test vs models</h2>
        <div className="row">
          <select value={test.id} onChange={(e) => pickBaseline(e.target.value)}>{tests.map((t) => <option key={t.id} value={t.id}>{t.id}</option>)}</select>
          <button className="primary" disabled={det.running || test.thickness > 0.4} onClick={() => det.start(inputsOf(test))}>
            {det.running ? `Solving… ${Math.round((det.job?.progress ?? 0) * 100)}%` : "Run detailed model at this test"}
          </button>
        </div>
        {det.running && <div className="progress"><span style={{ width: `${(det.job?.progress ?? 0) * 100}%` }} /></div>}
        <p className="note">{test.note} Source: <a href={test.source} target="_blank" rel="noreferrer">BASS-II Summary Report</a>, {test.cite}.</p>
        <div className="scroll">
          <table>
            <thead><tr><th /><th className="n">Reported <span className="tag pub">published</span></th><th className="n">FFR-1 <span className="tag sim">fast</span></th><th className="n">FFR-2D <span className="tag sim">detailed</span></th></tr></thead>
            <tbody>
              <tr><td>Conditions</td><td className="n" colSpan={3}>{Math.round(test.thickness * 1000)} µm · {test.o2}% O₂ · {test.pressure} kPa · {limit ? test.crit : test.flow} cm/s · {test.gravity} g₀</td></tr>
              <tr><td>Outcome</td><td className="n">{limit ? `goes out below ${test.crit} cm/s` : test.outcome}</td><td className="n">{f?.outcome ?? "…"}</td><td className="n">{dr?.outcome ?? "not run"}</td></tr>
              {!limit && <tr><td>Spread rate (mm/s)</td><td className="n">{test.spread != null ? `${test.spread} ± ${test.unc}` : "—"}</td>
                <td className="n">{f ? `${fmt(f.spread)} [${fmt(f.p05)}–${fmt(f.p95)}]` : "…"}</td><td className="n">{dr?.spread != null ? fmt(dr.spread) : "—"}</td></tr>}
            </tbody>
          </table>
        </div>
        {limit && <p className="small muted">For an extinction limit both models run at the reported critical flow, where the flame should be on the edge of going out. The FFR-1 critical-flow search is in the table below.</p>}
      </section>

      <section className="card">
        <h2>FFR-1 validation</h2>
        {!val ? <p className="empty">Computing…</p> : <>
          <p className="small">Calibration changes one parameter: flame-temperature coefficient {Math.round(val.calibration.prior)} → {Math.round(val.calibration.value)} K (±{(val.calibration.sigmaRel * 100).toFixed(1)}%), fitted to {val.calibration.record} only. z = residual ÷ combined uncertainty; |z| ≤ 2 in green. No acceptance threshold has been set by a domain expert yet.</p>
          <div className="scroll">
            <table>
              <thead><tr><th>Test</th><th>Role</th><th className="n">Reported</th><th className="n">Before calibration</th><th className="n">z</th><th className="n">After</th><th className="n">z</th></tr></thead>
              <tbody>{val.rows.map((r) => (
                <tr key={r.testId} className={r.testId === test.id ? "selected" : ""} onClick={() => pickBaseline(r.testId)}>
                  <td className="mono">{r.testId}</td><td>{r.role}</td><td className="n">{r.reported}</td>
                  <td className="n">{r.prior.pred}</td><td className="n">{z(r.prior)}</td><td className="n">{r.calibrated.pred}</td><td className="n">{z(r.calibrated)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </>}
      </section>
    </>
  );
}
