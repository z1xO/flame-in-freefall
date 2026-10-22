import type { Test } from "../../../shared/types";
import { useStore } from "../store";

export const result = (t: Test) =>
  t.kind === "limit" ? `out below ${t.crit} ± ${t.critUnc} cm/s` : t.spread != null ? `${t.spread} ± ${t.unc} mm/s` : t.outcome;

export default function Library() {
  const { studies, tests, pickBaseline, setTab, det } = useStore();
  const simulate = (t: Test) => { pickBaseline(t.id); setTab("Simulate"); };
  return (
    <>
      {studies.map((s) => (
        <section className="card" key={s.id}>
          <div className="row"><span className="mono muted">{s.id}</span><span className="tag pub">published</span><span className="small muted">{s.platform}</span></div>
          <h2>{s.title}</h2>
          <p>{s.summary}</p>
          <p className="small"><a href={s.url} target="_blank" rel="noreferrer">{s.url}</a></p>
          <div className="scroll" id={s.id === "PSI-25" ? "lib-tests" : undefined}>
            <table>
              <thead><tr><th>Test</th><th className="n">µm</th><th className="n">O₂ %</th><th className="n">kPa</th><th className="n">Flow cm/s</th><th className="n">g₀</th><th className="n">Reported</th><th>Role</th><th /></tr></thead>
              <tbody>
                {tests.filter((t) => t.study === s.id).map((t) => (
                  <tr key={t.id} className="hoverable">
                    <td><span className="mono">{t.id}</span><div className="small muted">{t.note} ({t.cite})</div></td>
                    <td className="n">{Math.round(t.thickness * 1000)}</td><td className="n">{t.o2}</td><td className="n">{t.pressure}</td>
                    <td className="n">{t.kind === "limit" ? "varied" : t.flow}</td><td className="n">{t.gravity}</td><td className="n">{result(t)}</td>
                    <td><span className={`tag ${t.role === "calibration" ? "" : "pub"}`}>{t.role}</span></td>
                    <td className="actions">
                      <button onClick={() => simulate(t)}>Simulate</button>
                      {t.thickness <= 0.4 && <button className="primary" disabled={det.running} onClick={() => { simulate(t); det.start({ gravity: t.gravity, o2: t.o2, pressure: t.pressure, flow: t.kind === "limit" ? t.crit! : t.flow, thickness: t.thickness }); }}>Run 2D</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}
