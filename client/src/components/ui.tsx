import { useEffect, useRef, useState } from "react";

/** A number that eases to its new value instead of jumping. */
export function AnimatedNumber({ value, digits = 3 }: { value: number | null | undefined; digits?: number }) {
  const [shown, setShown] = useState(value ?? 0);
  const from = useRef(value ?? 0);
  useEffect(() => {
    if (value == null || !isFinite(value)) return;
    const start = performance.now(), a = from.current, b = value;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(b); from.current = b; return; }
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 450), e = 1 - (1 - k) ** 3;
      const v = a + (b - a) * e; setShown(v); from.current = v;
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  if (value == null || !isFinite(value)) return <>—</>;
  return <>{Math.abs(shown) >= 1000 ? Math.round(shown) : +shown.toPrecision(digits)}</>;
}

export function Stat({ label, value, digits, unit, sub, tone }: { label: string; value: number | string | null | undefined; digits?: number; unit?: string; sub?: string; tone?: "good" | "bad" }) {
  return (
    <div className={`stat ${tone ?? ""}`}>
      <div className="k">{label}</div>
      <div className="v">{typeof value === "string" ? value : <AnimatedNumber value={value} digits={digits} />}{unit && <span className="unit">{unit}</span>}</div>
      {sub && <div className="k">{sub}</div>}
    </div>
  );
}

/** Range slider with a typed value box. Log sliders map the thumb position logarithmically. */
export function Slider({ label, unit, value, min, max, step, log, hint, onChange }: {
  label: string; unit: string; value: number; min: number; max: number; step: number; log?: boolean; hint?: string; onChange: (v: number) => void;
}) {
  const toPos = (v: number) => (log ? (Math.log(Math.max(v, min) / min) / Math.log(max / min)) * 1000 : v);
  const fromPos = (p: number) => (log ? +(min * Math.pow(max / min, p / 1000)).toPrecision(3) : p);
  const pct = log ? toPos(value) / 10 : ((value - min) / (max - min)) * 100;
  return (
    <div className="slider">
      <div className="slider-head"><span>{label}</span>
        <span className="val"><input type="number" step={step} value={Number.isFinite(value) ? value : ""} onChange={(e) => onChange(e.target.value === "" ? NaN : +e.target.value)} aria-label={`${label} value`} /><span className="muted">{unit}</span></span>
      </div>
      <input type="range" min={log ? 0 : min} max={log ? 1000 : max} step={log ? 1 : step} value={toPos(value)} onChange={(e) => onChange(fromPos(+e.target.value))}
        style={{ "--pct": `${Math.min(100, Math.max(0, pct))}%` } as React.CSSProperties} aria-label={label} />
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => <button key={o.value} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>)}
    </div>
  );
}
