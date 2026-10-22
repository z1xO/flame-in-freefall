import { useEffect, useState } from "react";
import type { Residual, Test, Validation } from "../../../shared/types";
import { api, inputsOf, useDetailedRun, useFast } from "../api";

const z = (r: Residual) => r.z != null ? <span style={{ color: Math.abs(r.z) > 2 ? "var(--bad)" : "var(--good)" }}>{r.z.toFixed(2)}</span> : r.agree == null ? "—" : r.agree ? "agrees" : "disagrees";

export default function Compare({ tests }: { tests: Test[] }) {
  const [id, setId] = useState(tests[0].id);
  const test = tests.find((t) => t.id === id)!;
  const fast = useFast(inputsOf(test));
  const det = useDetailedRun();
  const [val, setVal] = useState<Validation | null>(null);
  useEffect(() => { api.validation().then(setVal); }, []);
  const dr = det.job?.result && JSON.stringify(det.job.inputs) === JSON.stringify(inputsOf(test)) ? det.job.result : null;
  const limit = test.kind === "limit";

  return (
    <>
      <section className="card">
        <h2>Test vs models</h2>
        <div className="row">
          <select value={id} onChange={(e) => setId(e.target.value)}>{tests.map((t) => <option key={t.id} value={t.id}>{t.id}</option>)}</select>
          <button disabled={det.running || test.thickness > 0.4} onClick={() => det.start(inputsOf(test))}>{det.running ? `Running… ${Math.round((det.job?.progress ?? 0) * 100)}%` : "Run detailed model at this test"}</button>
        </div>
        <p className="note">{test.note} Source: <a href={test.source} target="_blank" rel="noreferrer">BASS-II Summary Report</a>, {test.cite}.</p>
        {det.error && <p className="error">{det.error}</p>}
        <div className="scroll">
          <table>
            <thead><tr><th /><th className="n">Reported <span className="tag pub">published</span></th><th className="n">FFR-1 <span className="tag sim">simulated</span></th><th className="n">FFR-2D <span className="tag sim">simulated</span></th></tr></thead>
            <tbody>
              <tr><td>Conditions</td><td className="n" colSpan={3}>{Math.round(test.thickness * 1000)} µm · {test.o2}% O₂ · {test.pressure} kPa · {limit ? `${test.crit}` : test.flow} cm/s · {test.gravity} g₀</td></tr>
              <tr><td>Outcome</td><td className="n">{limit ? `goes out below ${test.crit} cm/s` : test.outcome}</td><td className="n">{fast.result?.outcome ?? "…"}</td><td className="n">{dr?.outcome ?? "not run"}</td></tr>
              {!limit && <tr><td>Spread rate (mm/s)</td><td className="n">{test.spread != null ? `${test.spread} ± ${test.unc}` : "—"}</td>
                <td className="n">{fast.result ? `${fast.result.spread.toFixed(2)} [${fast.result.p05.toFixed(2)}–${fast.result.p95.toFixed(2)}]` : "…"}</td>
                <td className="n">{dr?.spread != null ? dr.spread.toFixed(2) : "—"}</td></tr>}
            </tbody>
          </table>
        </div>
        {limit && <p className="small muted">For an extinction limit the models are run at the reported critical flow, where the flame should be on the edge of going out. The full FFR-1 critical-flow search is in the table below.</p>}
      </section>

      <section className="card">
        <h2>FFR-1 validation</h2>
        {!val ? <p className="note">Computing…</p> : <>
          <p className="small">Calibration changes one parameter: flame-temperature coefficient {Math.round(val.calibration.prior)} → {Math.round(val.calibration.value)} K (±{(val.calibration.sigmaRel * 100).toFixed(1)}%), fitted to {val.calibration.record} only. z = residual ÷ combined uncertainty; |z| ≤ 2 in green. No acceptance threshold has been set by a domain expert yet.</p>
          <div className="scroll">
            <table>
              <thead><tr><th>Test</th><th>Role</th><th className="n">Reported</th><th className="n">Before calibration</th><th className="n">z</th><th className="n">After</th><th className="n">z</th></tr></thead>
              <tbody>{val.rows.map((r) => (
                <tr key={r.testId}><td className="mono">{r.testId}</td><td>{r.role}</td><td className="n">{r.reported}</td>
                  <td className="n">{r.prior.pred}</td><td className="n">{z(r.prior)}</td><td className="n">{r.calibrated.pred}</td><td className="n">{z(r.calibrated)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </>}
      </section>
    </>
  );
}
