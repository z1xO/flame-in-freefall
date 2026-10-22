import { fmt } from "../api";
import { useStore } from "../store";
import { Stat } from "../components/ui";
import LineChart from "../components/LineChart";

function Bars({ items, unit }: { items: { label: string; value: number; color: string }[]; unit: string }) {
  const max = Math.max(1e-9, ...items.map((i) => i.value));
  return (
    <div className="bars">
      {items.map((i) => (
        <div key={i.label} className="bar">
          <span className="bar-label">{i.label}</span>
          <span className="bar-track"><span style={{ width: `${(i.value / max) * 100}%`, background: i.color }} /></span>
          <span className="mono small">{fmt(i.value)} {unit}</span>
        </div>
      ))}
    </div>
  );
}

const LIMIT_COLOR = { radiative: "var(--bad)", kinetic: "var(--warn)", thermal: "var(--good)" } as const;

export default function Physics() {
  const { fast, det, frameIdx, inputs, tests } = useStore();
  const frame = det.frames.length ? det.frames[Math.min(frameIdx, det.frames.length - 1)] : null;

  // collapse the per-flow regime labels into contiguous shaded regions
  const regions: { x0: number; x1: number; color: string; label: string }[] = [];
  fast?.regimes.forEach((p, i, a) => {
    const x0 = i ? Math.sqrt(a[i - 1].flow * p.flow) : p.flow, last = regions.at(-1);
    if (last && last.label === p.limit) last.x1 = i < a.length - 1 ? Math.sqrt(p.flow * a[i + 1].flow) : p.flow;
    else { if (last) last.x1 = x0; regions.push({ x0, x1: p.flow, color: LIMIT_COLOR[p.limit], label: p.limit }); }
  });
  const b = frame?.budget;

  return (
    <>
      <div className="two">
        <section className="card">
          <div className="row"><h2>At the flame's leading edge</h2><span className="tag sim">FFR-1</span></div>
          <p className="small muted">The flame spreads by conducting heat forward into unburnt fuel. If the fuel loses heat faster than it gains it, or the flow outruns the chemistry, the flame goes out.</p>
          {fast && <>
            <Bars unit="kW/m²" items={[{ label: "heat conducted into fuel", value: fast.heatFeedback, color: "var(--sim)" }, { label: "re-radiated by the surface", value: fast.surfaceLoss, color: "var(--bad)" }]} />
            <div className="stats">
              <Stat label="Loss ratio χ" value={fast.lossRatio} sub="goes out at ≥ 1" tone={fast.lossRatio >= 1 ? "bad" : undefined} />
              <Stat label="Damköhler Da" value={fast.damkohler} sub="blows off at ≤ 1" tone={fast.damkohler <= 1 ? "bad" : undefined} />
              <Stat label="Regime" value={fast.regime} sub={`${fmt(inputs.thickness * 1000)} µm sheet`} />
            </div>
          </>}
        </section>
        <section className="card">
          <div className="row"><h2>Where the computed flame's energy goes</h2><span className="tag sim">FFR-2D</span></div>
          {b && frame ? <>
            <p className="small muted">Integrated over the domain at t = {frame.t.toFixed(1)} s, per metre of sheet width, one face. Scrub the time slider on Simulate to see it change.</p>
            <Bars unit="W/m" items={[
              { label: "chemical heat release", value: b.heatRelease, color: "var(--warn)" },
              { label: "gas radiation loss", value: b.gasRadiation, color: "var(--bad)" },
              { label: "conducted into the sheet", value: b.toSheet, color: "var(--sim)" },
              { label: "sheet re-radiation", value: b.sheetRadiation, color: "var(--pub)" },
              { label: "spent vaporizing fuel", value: b.vaporizing, color: "var(--good)" }]} />
            <p className="small">Only {fmt((100 * b.toSheet) / Math.max(b.heatRelease, 1e-9))}% of the heat released returns to the sheet, and that small share drives the spread. Gas radiation takes {fmt((100 * b.gasRadiation) / Math.max(b.heatRelease, 1e-9))}%.</p>
          </> : <p className="empty">Run the detailed model on Simulate to see the energy budget.</p>}
        </section>
      </div>

      <section className="card">
        <div className="row"><h2>Spread regimes</h2><span className="tag sim">FFR-1</span></div>
        <p className="small muted">Spread rate vs opposed flow at the current oxygen, pressure, gravity and thickness. The dashed line ignores losses (de Ris limit). Shading shows which loss limits the flame.</p>
        {fast && (
          <LineChart x={[0.3, 100]} xLog y={[0, Math.max(0.5, ...fast.regimes.map((p) => p.lossless)) * 1.1]} xLabel="opposed flow (cm/s)" yLabel="spread (mm/s)" unit="mm/s" width={1000} height={300}
            regions={regions}
            lines={[{ points: fast.regimes.map((p) => [p.flow, p.spread]), color: "var(--sim)", label: "with losses" }, { points: fast.regimes.map((p) => [p.flow, p.lossless]), color: "var(--muted)", dash: "4 3", label: "no losses" }]}
            dots={tests.filter((t) => t.kind === "limit" && Math.abs(t.o2 - inputs.o2) < 1).map((t) => ({ x: t.crit!, y: 0.05, color: "var(--pub)", label: t.id }))}
            markers={[{ x: Math.max(0.3, inputs.flow), color: "var(--accent)", label: "now" }]} />
        )}
      </section>

      <div className="two">
        <section className="card">
          <h2>FFR-1 · reduced-order model</h2>
          <pre className="eq">{`V_thin  = (π/4) λg (Tf − Tv) / (ρs cs τ (Tv − T∞))
V_thick = U (ρλc)g (Tf − Tv)² / ((ρλc)s (Tv − T∞)²)
V       = √(V_thin² + V_thick²) · (1 − 1/Da) · (1 − χ)

U  = (U_forced³ + U_buoyant³)^⅓
Da = (αg/U²) A P² Y_O2 exp(−Ta/Tf)       blowoff at Da ≤ 1
χ  = εσ(Tv⁴ − T∞⁴) / (λg (Tf − Tv) U/αg)  quench at χ ≥ 1
Tf = T∞ + k_Tf Y_O2                      k_Tf calibrated on 1 g`}</pre>
        </section>
        <section className="card">
          <h2>FFR-2D · detailed solver</h2>
          <pre className="eq">{`∂T/∂t − U ∂T/∂x = α∇²T + (Q/cp) ω − 4σκ(T⁴ − T∞⁴)/(ρcp)
∂Yf/∂t − U ∂Yf/∂x = α∇²Yf − ω
∂Yo/∂t − U ∂Yo/∂x = α∇²Yo − s ω
ω = B ρ Yf Yo exp(−Ta/T)

sheet:  m cs dTs/dt = λ ∂T/∂y − εσ(Ts⁴ − T∞⁴) − ṁ″ Lv
        ṁ″ = m As exp(−Es/Ts)`}</pre>
          <p className="small muted">0.5 mm grid over 40 × 12 mm, explicit time steps of about 0.3 ms. Constant density, plug flow, unity Lewis number. Assumed cp = 1300 J/kg·K and κ = 0.5 m⁻¹·atm⁻¹. Not calibrated.</p>
        </section>
      </div>
    </>
  );
}
