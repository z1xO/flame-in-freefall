import { useState } from "react";

// Small SVG chart: lines, an optional shaded band, shaded x-regions, dots with error bars and
// vertical markers. Hovering shows a crosshair with every line's value at that x.
export interface Line { points: [number, number][]; color: string; dash?: string; label?: string }
export interface Dot { x: number; y: number; color: string; err?: number; label?: string }
export interface Region { x0: number; x1: number; color: string; label?: string }

interface Props {
  x: [number, number]; y: [number, number]; xLog?: boolean;
  xLabel: string; yLabel: string; unit?: string;
  lines?: Line[]; band?: { points: [number, number, number][]; color: string };
  regions?: Region[]; dots?: Dot[]; markers?: { x: number; color: string; label?: string }[];
  width?: number; height?: number;
}

function ticks(lo: number, hi: number, log?: boolean) {
  if (log) {
    const out: number[] = [];
    for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) for (const m of [1, 2, 5]) { const v = m * 10 ** e; if (v >= lo && v <= hi) out.push(+v.toPrecision(3)); }
    return out;
  }
  const raw = (hi - lo) / 5, mag = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toPrecision(6));
  return out;
}

function valueAt(points: [number, number][], x: number) {
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1], [x1, y1] = points[i];
    if ((x >= x0 && x <= x1) || (x <= x0 && x >= x1)) return x1 === x0 ? y0 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return null;
}

export default function LineChart({ x, y, xLog, xLabel, yLabel, unit = "", lines = [], band, regions = [], dots = [], markers = [], width = 560, height = 240 }: Props) {
  const [hx, setHx] = useState<number | null>(null);
  const L = 52, R = 12, T = 12, B = 38, pw = width - L - R, ph = height - T - B;
  const sx = (v: number) => L + pw * (xLog ? Math.log(v / x[0]) / Math.log(x[1] / x[0]) : (v - x[0]) / (x[1] - x[0]));
  const ix = (px: number) => { const f = (px - L) / pw; return xLog ? x[0] * Math.pow(x[1] / x[0], f) : x[0] + f * (x[1] - x[0]); };
  const sy = (v: number) => T + ph * (1 - (v - y[0]) / (y[1] - y[0]));
  const path = (pts: [number, number][]) => pts.map((p, i) => `${i ? "L" : "M"}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join("");
  const clip = `clip-${width}-${height}-${xLabel.length}`;
  const readouts = hx == null ? [] : lines.map((l) => ({ l, v: valueAt(l.points, hx) })).filter((r) => r.v != null);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={`${yLabel} vs ${xLabel}`} className="chart"
      onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * width; setHx(px >= L && px <= L + pw ? ix(px) : null); }}
      onMouseLeave={() => setHx(null)}>
      <defs><clipPath id={clip}><rect x={L} y={T} width={pw} height={ph} /></clipPath></defs>
      {regions.map((r, i) => (
        <g key={"r" + i}>
          <rect x={sx(Math.max(x[0], r.x0))} y={T} width={Math.max(0, sx(Math.min(x[1], r.x1)) - sx(Math.max(x[0], r.x0)))} height={ph} fill={r.color} fillOpacity={0.1} />
          {r.label && <text x={(sx(Math.max(x[0], r.x0)) + sx(Math.min(x[1], r.x1))) / 2} y={T + ph - 6} textAnchor="middle" style={{ fill: r.color }}>{r.label}</text>}
        </g>
      ))}
      {ticks(y[0], y[1]).map((v) => (
        <g key={"y" + v}><line x1={L} x2={width - R} y1={sy(v)} y2={sy(v)} stroke="var(--line)" /><text x={L - 6} y={sy(v) + 4} textAnchor="end">{v}</text></g>
      ))}
      {ticks(x[0], x[1], xLog).map((v) => <text key={"x" + v} x={sx(v)} y={T + ph + 15} textAnchor="middle">{v}</text>)}
      <text x={L + pw / 2} y={height - 4} textAnchor="middle">{xLabel}</text>
      <text x={12} y={T + ph / 2} textAnchor="middle" transform={`rotate(-90 12 ${T + ph / 2})`}>{yLabel}</text>
      <g clipPath={`url(#${clip})`}>
        {band && <polygon fill={band.color} fillOpacity={0.15}
          points={[...band.points.map((p) => `${sx(p[0])},${sy(p[2])}`), ...[...band.points].reverse().map((p) => `${sx(p[0])},${sy(p[1])}`)].join(" ")} />}
        {lines.map((l, i) => <path key={i} className="draw" d={path(l.points)} fill="none" stroke={l.color} strokeWidth={2} strokeDasharray={l.dash} />)}
        {markers.map((m, i) => <g key={i}><line x1={sx(m.x)} x2={sx(m.x)} y1={T} y2={T + ph} stroke={m.color} strokeOpacity={0.7} />{m.label && <text x={sx(m.x) + 4} y={T + 12} style={{ fill: m.color }}>{m.label}</text>}</g>)}
        {dots.map((d, i) => (
          <g key={i}>
            {d.err != null && <line x1={sx(d.x)} x2={sx(d.x)} y1={sy(d.y - d.err)} y2={sy(d.y + d.err)} stroke={d.color} strokeWidth={1.5} />}
            <circle cx={sx(d.x)} cy={sy(d.y)} r={4.5} fill="var(--panel)" stroke={d.color} strokeWidth={2}><title>{d.label}</title></circle>
            {d.label && <text x={sx(d.x) + 7} y={sy(d.y) - 6} style={{ fill: d.color }}>{d.label}</text>}
          </g>
        ))}
        {hx != null && <>
          <line x1={sx(hx)} x2={sx(hx)} y1={T} y2={T + ph} stroke="var(--fg)" strokeOpacity={0.35} strokeDasharray="3 3" />
          {readouts.map((r, i) => <circle key={i} cx={sx(hx)} cy={sy(r.v!)} r={3.5} fill={r.l.color} />)}
        </>}
      </g>
      <line x1={L} x2={L + pw} y1={T + ph} y2={T + ph} stroke="var(--muted)" />
      {lines.filter((l) => l.label).map((l, i) => (
        <g key={"lg" + i} transform={`translate(${L + 10 + i * 150},${T + 10})`}><line x1={0} x2={16} y1={0} y2={0} stroke={l.color} strokeWidth={2} strokeDasharray={l.dash} /><text x={20} y={4}>{l.label}</text></g>
      ))}
      {hx != null && readouts.length > 0 && (() => {
        const bx = Math.min(sx(hx) + 10, L + pw - 170), by = T + 26;
        return (
          <g className="readout" transform={`translate(${bx},${by})`}>
            <rect width={168} height={18 + readouts.length * 16} rx={4} />
            <text x={8} y={14}>{xLabel.split(" (")[0]} {+hx.toPrecision(3)}</text>
            {readouts.map((r, i) => <text key={i} x={8} y={30 + i * 16} style={{ fill: r.l.color }}>{r.l.label ?? "value"}: {+r.v!.toPrecision(3)} {unit}</text>)}
          </g>
        );
      })()}
    </svg>
  );
}
