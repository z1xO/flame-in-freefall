import { useEffect, useRef, useState } from "react";
import type { FlammabilityMap as MapData, Inputs, Test } from "../../../shared/types";
import { inferno } from "./colormap";

const G = { W: 640, H: 360, L: 48, R: 64, T: 10, B: 42 };
const F0 = 0.3, F1 = 60, O0 = 12, O1 = 32;

// Where a flame survives: fast-model spread rate over oxygen and opposed flow. Grey = no sustained spread.
// Purple bars are BASS-II reported extinction flows; the diamond is the current scenario. Click to set the scenario.
export default function FlammabilityMap({ map, inputs, tests, onPick }: { map: MapData; inputs: Inputs; tests: Test[]; onPick: (o2: number, flow: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const pw = G.W - G.L - G.R, ph = G.H - G.T - G.B;
  const X = (f: number) => G.L + (pw * Math.log(f / F0)) / Math.log(F1 / F0), Y = (o: number) => G.T + ph * (1 - (o - O0) / (O1 - O0));
  const fromPx = (x: number, y: number) => ({ flow: F0 * Math.pow(F1 / F0, (x - G.L) / pw), o2: O0 + ((G.T + ph - y) / ph) * (O1 - O0) });

  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d")!, css = getComputedStyle(document.documentElement);
    const muted = css.getPropertyValue("--muted"), fg = css.getPropertyValue("--fg"), pub = css.getPropertyValue("--pub"), accent = css.getPropertyValue("--accent");
    const nx = map.flow.length, ny = map.o2.length, vmax = Math.max(1e-6, ...map.spread.flat());
    ctx.clearRect(0, 0, G.W, G.H);
    const img = ctx.createImageData(nx, ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const v = map.spread[j][i];
      img.data.set(v > 0 ? [...inferno(0.15 + 0.8 * Math.sqrt(v / vmax)), 255] : [70, 78, 92, 255], (i + (ny - 1 - j) * nx) * 4);
    }
    const off = document.createElement("canvas"); off.width = nx; off.height = ny; off.getContext("2d")!.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(off, G.L, G.T, pw, ph);

    // extinction boundary
    ctx.strokeStyle = fg; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const a = map.spread[j][i] > 0;
      if (i < nx - 1 && a !== map.spread[j][i + 1] > 0) { const x = G.L + ((i + 1) / nx) * pw; ctx.moveTo(x, G.T + ph - (j / ny) * ph); ctx.lineTo(x, G.T + ph - ((j + 1) / ny) * ph); }
      if (j < ny - 1 && a !== map.spread[j + 1][i] > 0) { const y = G.T + ph - ((j + 1) / ny) * ph; ctx.moveTo(G.L + (i / nx) * pw, y); ctx.lineTo(G.L + ((i + 1) / nx) * pw, y); }
    }
    ctx.stroke();

    for (const t of tests.filter((t) => t.kind === "limit")) {
      ctx.strokeStyle = ctx.fillStyle = pub; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(X(Math.max(F0, t.crit! - t.critUnc!)), Y(t.o2)); ctx.lineTo(X(t.crit! + t.critUnc!), Y(t.o2)); ctx.stroke();
      ctx.beginPath(); ctx.arc(X(t.crit!), Y(t.o2), 4, 0, 7); ctx.fill();
    }
    const cx = X(Math.min(F1, Math.max(F0, inputs.flow))), cy = Y(Math.min(O1, Math.max(O0, inputs.o2)));
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4); ctx.fillStyle = accent; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.fillRect(-6, -6, 12, 12); ctx.strokeRect(-6, -6, 12, 12); ctx.restore();

    ctx.fillStyle = muted; ctx.font = "11px ui-monospace, Consolas, monospace"; ctx.textAlign = "center";
    for (const v of [0.5, 1, 2, 5, 10, 20, 50]) ctx.fillText(String(v), X(v), G.T + ph + 15);
    ctx.fillText("opposed flow (cm/s, log scale)", G.L + pw / 2, G.H - 6);
    ctx.textAlign = "right"; for (const v of [12, 16, 20, 24, 28, 32]) ctx.fillText(String(v), G.L - 6, Y(v) + 4);
    ctx.save(); ctx.translate(12, G.T + ph / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = "center"; ctx.fillText("oxygen (%)", 0, 0); ctx.restore();
    ctx.fillStyle = "#e5e9ef"; ctx.font = "600 11px system-ui, sans-serif"; ctx.textAlign = "left"; ctx.fillText("RADIATIVE QUENCH", G.L + 6, G.T + ph - 8);
    ctx.textAlign = "right"; ctx.fillText("BLOWOFF", G.L + pw - 6, G.T + ph - 8);
    const bx = G.W - G.R + 16;
    for (let k = 0; k < ph; k++) { ctx.fillStyle = `rgb(${inferno(0.15 + 0.8 * Math.sqrt(1 - k / ph))})`; ctx.fillRect(bx, G.T + k, 10, 1); }
    ctx.fillStyle = muted; ctx.font = "11px ui-monospace, Consolas, monospace"; ctx.textAlign = "left";
    ctx.fillText(vmax.toFixed(1), bx + 13, G.T + 8); ctx.fillText("0", bx + 13, G.T + ph); ctx.fillText("mm/s", bx - 4, G.T + ph + 18);
  }, [map, inputs.o2, inputs.flow, tests]); // eslint-disable-line react-hooks/exhaustive-deps

  const locate = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect(), s = G.W / r.width, x = (e.clientX - r.left) * s, y = (e.clientY - r.top) * s;
    if (x < G.L || x > G.L + pw || y < G.T || y > G.T + ph) return null;
    return { ...fromPx(x, y), px: e.clientX - r.left, py: e.clientY - r.top };
  };
  const hover = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const p = locate(e); if (!p) return setTip(null);
    const i = Math.min(map.flow.length - 1, Math.floor(((Math.log(p.flow / F0) / Math.log(F1 / F0)) * map.flow.length)));
    const j = Math.min(map.o2.length - 1, Math.floor(((p.o2 - O0) / (O1 - O0)) * map.o2.length));
    const v = map.spread[j]?.[i] ?? 0;
    setTip({ x: p.px, y: p.py, text: `${p.flow.toFixed(2)} cm/s, ${p.o2.toFixed(1)}% O₂ → ${v > 0 ? v.toFixed(2) + " mm/s" : "no sustained spread"} · click to use` });
  };

  return (
    <div className="plotwrap">
      <canvas ref={ref} className="plot clickable" width={G.W} height={G.H} aria-label="Flammability map" onMouseMove={hover} onMouseLeave={() => setTip(null)}
        onClick={(e) => { const p = locate(e); if (p) onPick(+p.o2.toFixed(1), +p.flow.toFixed(2)); }} />
      {tip && <div className="tip" style={{ left: tip.x, top: tip.y }}>{tip.text}</div>}
    </div>
  );
}
