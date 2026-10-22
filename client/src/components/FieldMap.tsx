import { useEffect, useRef } from "react";
import type { DetailedResult, Frame } from "../../../shared/types";
import { inferno, T_RANGE } from "./colormap";

// 2D gas-temperature map above the sheet with isotherms at 800/1200/1600/2000 K.
export default function FieldMap({ result, frame }: { result: DetailedResult; frame: Frame }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d")!, { nx, ny } = result;
    const W = cv.width, H = cv.height, L = 40, R = 56, T = 8, B = 36, pw = W - L - R, ph = H - T - B;
    const muted = getComputedStyle(document.documentElement).getPropertyValue("--muted");
    ctx.clearRect(0, 0, W, H);

    const img = ctx.createImageData(nx, ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const c = inferno((frame.T[i + j * nx] - T_RANGE[0]) / (T_RANGE[1] - T_RANGE[0])), o = (i + (ny - 1 - j) * nx) * 4;
      img.data.set([...c, 255], o);
    }
    const off = document.createElement("canvas"); off.width = nx; off.height = ny; off.getContext("2d")!.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, L, T, pw, ph);

    const X = (i: number) => L + ((i + 0.5) / nx) * pw, Y = (j: number) => T + ph - ((j + 0.5) / ny) * ph;
    ctx.strokeStyle = "rgba(255,255,255,.7)";
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
    // sheet: grey where fuel remains
    for (let i = 0; i < nx; i++) { ctx.fillStyle = frame.m[i] > 0 ? "#9fb2c8" : "transparent"; ctx.fillRect(L + (i / nx) * pw, T + ph + 1, pw / nx + 0.5, 4); }

    ctx.fillStyle = muted; ctx.font = "11px ui-monospace, Consolas, monospace"; ctx.textAlign = "center";
    for (const mm of [0, 10, 20, 30, 40]) ctx.fillText(String(mm), L + (mm / 40) * pw, T + ph + 18);
    ctx.fillText("x along sheet (mm) · flow enters from the right", L + pw / 2, H - 4);
    ctx.textAlign = "right"; for (const mm of [0, 6, 12]) ctx.fillText(String(mm), L - 6, T + ph - (mm / 12) * ph + 4);
    const cx = W - R + 14;
    for (let k = 0; k < ph; k++) { ctx.fillStyle = `rgb(${inferno(1 - k / ph)})`; ctx.fillRect(cx, T + k, 10, 1); }
    ctx.fillStyle = muted; ctx.textAlign = "left";
    for (const v of [300, 1500, 2700]) ctx.fillText(String(v), cx + 13, T + ph - ((v - T_RANGE[0]) / (T_RANGE[1] - T_RANGE[0])) * ph + 4);
    ctx.fillText("K", cx + 2, T + ph + 18);
  }, [result, frame]);

  return <canvas ref={ref} className="plot" width={640} height={260} aria-label="Gas temperature field" />;
}
