import { useEffect, useRef, useState } from "react";
import type { Frame } from "../../../shared/types";
import { colorFor, FIELDS, maxOf, normalize, T_RANGE } from "./colormap";
import type { Field } from "../store";

const G = { W: 640, H: 260, L: 40, R: 60, T: 8, B: 36 };

// 2D cross-section of the chosen gas field above the sheet, with isotherms at 800/1200/1600/2000 K.
export default function FieldMap({ nx, ny, frame, field }: { nx: number; ny: number; frame: Frame; field: Field }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const hmax = maxOf(frame.H), oMax = maxOf(frame.O);

  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d")!, { W, H, L, R, T, B } = G, pw = W - L - R, ph = H - T - B;
    const muted = getComputedStyle(document.documentElement).getPropertyValue("--muted");
    ctx.clearRect(0, 0, W, H);

    const img = ctx.createImageData(nx, ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      img.data.set([...colorFor(field, normalize(field, frame, i + j * nx, hmax, oMax)), 255], (i + (ny - 1 - j) * nx) * 4);
    }
    const off = document.createElement("canvas"); off.width = nx; off.height = ny; off.getContext("2d")!.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, L, T, pw, ph);

    const X = (i: number) => L + ((i + 0.5) / nx) * pw, Y = (j: number) => T + ph - ((j + 0.5) / ny) * ph;
    ctx.strokeStyle = field === "O" ? "rgba(255,190,90,.8)" : "rgba(255,255,255,.65)";
    for (const lv of [800, 1200, 1600, 2000]) {
      ctx.beginPath();
      for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
        const v = [frame.T[i + j * nx], frame.T[i + 1 + j * nx], frame.T[i + 1 + (j + 1) * nx], frame.T[i + (j + 1) * nx]];
        const c: [number, number][] = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]], pts: [number, number][] = [];
        for (let e = 0; e < 4; e++) { const a = v[e], b = v[(e + 1) % 4]; if ((a - lv) * (b - lv) < 0) { const k = (lv - a) / (b - a), p = c[e], q = c[(e + 1) % 4]; pts.push([p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k]); } }
        for (let p = 0; p + 1 < pts.length; p += 2) { ctx.moveTo(X(pts[p][0]), Y(pts[p][1])); ctx.lineTo(X(pts[p + 1][0]), Y(pts[p + 1][1])); }
      }
      ctx.stroke();
    }
    for (let i = 0; i < nx; i++) { ctx.fillStyle = frame.m[i] > 0 ? "#9fb2c8" : "transparent"; ctx.fillRect(L + (i / nx) * pw, T + ph + 1, pw / nx + 0.5, 4); }

    ctx.fillStyle = muted; ctx.font = "11px ui-monospace, Consolas, monospace"; ctx.textAlign = "center";
    for (const mm of [0, 10, 20, 30, 40]) ctx.fillText(String(mm), L + (mm / 40) * pw, T + ph + 18);
    ctx.fillText("x along sheet (mm) · flow enters from the right", L + pw / 2, H - 4);
    ctx.textAlign = "right"; for (const mm of [0, 6, 12]) ctx.fillText(String(mm), L - 6, T + ph - (mm / 12) * ph + 4);
    const cx = W - R + 14;
    for (let k = 0; k < ph; k++) { ctx.fillStyle = `rgb(${colorFor(field, 1 - k / ph)})`; ctx.fillRect(cx, T + k, 10, 1); }
    ctx.fillStyle = muted; ctx.textAlign = "left";
    const top = field === "T" ? T_RANGE[1] : field === "H" ? hmax : oMax, bottom = field === "T" ? T_RANGE[0] : 0;
    ctx.fillText(String(+top.toPrecision(3)), cx + 13, T + 8);
    ctx.fillText(String(bottom), cx + 13, T + ph);
    ctx.fillText(field === "T" ? "K" : field === "H" ? "MW/m³" : "Y O₂", cx - 2, T + ph + 18);
  }, [nx, ny, frame, field, hmax, oMax]);

  const hover = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect(), s = G.W / r.width;
    const x = (e.clientX - r.left) * s, y = (e.clientY - r.top) * s, pw = G.W - G.L - G.R, ph = G.H - G.T - G.B;
    const i = Math.floor(((x - G.L) / pw) * nx), j = Math.floor(((G.T + ph - y) / ph) * ny);
    if (i < 0 || i >= nx || j < 0 || j >= ny) return setTip(null);
    const k = i + j * nx;
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top, text: `x ${(i * 0.5 + 0.25).toFixed(1)} mm, y ${(j * 0.5 + 0.25).toFixed(1)} mm · ${frame.T[k]} K · ${frame.H[k].toFixed(2)} MW/m³ · O₂ ${frame.O[k].toFixed(3)}` });
  };

  return (
    <div className="plotwrap">
      <canvas ref={ref} className="plot" width={G.W} height={G.H} aria-label={`${FIELDS[field].label} field`} onMouseMove={hover} onMouseLeave={() => setTip(null)} />
      {tip && <div className="tip" style={{ left: tip.x, top: tip.y }}>{tip.text}</div>}
    </div>
  );
}
