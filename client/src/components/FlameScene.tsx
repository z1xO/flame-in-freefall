import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Frame } from "../../../shared/types";
import { colorFor, maxOf, normalize } from "./colormap";
import type { Field } from "../store";

// 3D view of the computed field: the 2D solution is drawn on stacked translucent slices across the
// 20 mm sheet width, mirrored below the sheet because both faces burn. Scale: 1 unit = 5 mm.
// Hovering reads the gas values on the centre plane or the sheet state underneath the cursor.
interface Props { nx: number; ny: number; frame: Frame | null; field: Field; flow: number; live: boolean }

export default function FlameScene({ nx, ny, frame, field, flow, live }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const three = useRef<{ field: THREE.DataTexture; sheet: THREE.DataTexture; pick: (x: number, y: number) => { gas?: [number, number]; sheet?: number } | null } | null>(null);
  const flowRef = useRef(flow); flowRef.current = flow;
  const [probe, setProbe] = useState<string | null>(null);
  const frameRef = useRef(frame); frameRef.current = frame;

  useEffect(() => {
    const el = host.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor(0x0a0e16);
    el.prepend(renderer.domElement);

    const s = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(36, 2, 0.1, 100);
    cam.position.set(1.4, 3.2, 8.4);
    const controls = new OrbitControls(cam, renderer.domElement);
    controls.target.set(4, 0.2, 0);
    controls.enableDamping = true;
    controls.minDistance = 3; controls.maxDistance = 20;

    const grid = new THREE.GridHelper(16, 32, 0x24304a, 0x151c2b);
    grid.position.set(4, -1.6, 0);
    s.add(grid);

    const fieldTex = new THREE.DataTexture(new Uint8Array(nx * ny * 4), nx, ny, THREE.RGBAFormat);
    fieldTex.magFilter = fieldTex.minFilter = THREE.LinearFilter;
    const sheetTex = new THREE.DataTexture(new Uint8Array(nx * 4), nx, 1, THREE.RGBAFormat);

    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), new THREE.MeshBasicMaterial({ map: sheetTex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    sheet.rotation.x = -Math.PI / 2; sheet.position.x = 4;
    s.add(sheet);
    const rail = new THREE.MeshBasicMaterial({ color: 0x3a4660 });
    for (const z of [-2.1, 2.1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(8.3, 0.06, 0.16), rail); b.position.set(4, 0, z); s.add(b); }

    const sliceMat = new THREE.MeshBasicMaterial({ map: fieldTex, transparent: true, opacity: 0.24, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    for (let k = 0; k < 13; k++) for (const side of [1, -1]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(8, 2.4), sliceMat);
      m.position.set(4, side * 1.2, -1.8 + (3.6 * k) / 12);
      m.scale.y = side;
      s.add(m);
    }
    const pickPlane = new THREE.Mesh(new THREE.PlaneGeometry(8, 4.8), new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
    pickPlane.position.x = 4; s.add(pickPlane);

    // ruler and labels
    const label = (text: string, x: number, y: number, z: number, h = 0.32, color = "#93a3bf") => {
      const c = document.createElement("canvas"); c.width = 256; c.height = 64;
      const g = c.getContext("2d")!; g.font = "500 30px ui-monospace, Consolas, monospace"; g.fillStyle = color; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, 128, 32);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
      sp.scale.set(h * 4, h, 1); sp.position.set(x, y, z); s.add(sp);
    };
    for (const mm of [0, 10, 20, 30, 40]) label(`${mm} mm`, mm / 5, -0.05, 2.75);
    label("← opposed flow", 7, 2.8, 0, 0.3, "#c7d0df");

    // flow tracers, moving at a speed proportional to the opposed flow
    const NS = 240, pos = new Float32Array(NS * 3);
    for (let i = 0; i < NS; i++) { pos[i * 3] = Math.random() * 10 - 1; pos[i * 3 + 1] = (Math.random() - 0.5) * 4.6; pos[i * 3 + 2] = (Math.random() - 0.5) * 4.4; }
    const tg = new THREE.BufferGeometry(); tg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    s.add(new THREE.Points(tg, new THREE.PointsMaterial({ color: 0x9fb6e0, size: 0.045, transparent: true, opacity: 0.5 })));

    const ray = new THREE.Raycaster();
    three.current = {
      field: fieldTex, sheet: sheetTex,
      pick: (x, y) => {
        ray.setFromCamera(new THREE.Vector2(x, y), cam);
        const hs = ray.intersectObject(sheet)[0], hp = ray.intersectObject(pickPlane)[0];
        if (hp && (!hs || hp.distance < hs.distance)) {
          const i = Math.floor((hp.point.x * 5) / 0.5), j = Math.floor((Math.abs(hp.point.y) * 5) / 0.5);
          if (i >= 0 && i < nx && j >= 0 && j < ny) return { gas: [i, j] };
        }
        if (hs) return { sheet: Math.min(nx - 1, Math.max(0, Math.floor((hs.point.x * 5) / 0.5))) };
        return null;
      },
    };

    const resize = () => { const w = el.clientWidth, h = el.clientHeight; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
    const ro = new ResizeObserver(resize); ro.observe(el); resize();
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!reduce) {
        const u = Math.min(6, Math.max(0.15, flowRef.current * 0.3)), a = tg.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < NS; i++) { let x = a.getX(i) - u * dt; if (x < -1) x += 10; a.setX(i, x); }
        a.needsUpdate = true;
      }
      controls.update(); renderer.render(s, cam); raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); renderer.dispose(); renderer.domElement.remove(); three.current = null; };
  }, [nx, ny]);

  useEffect(() => {
    const sc = three.current; if (!sc) return;
    const f = sc.field.image.data as Uint8Array, sh = sc.sheet.image.data as Uint8Array;
    if (!frame) { f.fill(0); sh.fill(0); for (let i = 0; i < nx; i++) sh.set([170, 205, 225, 140], i * 4); }
    else {
      const hmax = maxOf(frame.H), oMax = maxOf(frame.O);
      for (let k = 0; k < frame.T.length; k++) {
        // Opacity follows temperature so the flame shows as a glowing volume whatever field colors it.
        const glow = Math.max(0, (frame.T[k] - 500) / 2200), a = field === "O" ? Math.min(1, 1 - frame.O[k] / Math.max(oMax, 1e-6)) : field === "H" ? Math.sqrt(frame.H[k] / Math.max(hmax, 1e-6)) : glow;
        const t = field === "T" ? 0.25 + 0.75 * glow : normalize(field, frame, k, hmax, oMax);
        f.set([...colorFor(field, t), Math.round(255 * Math.min(1, a) ** 1.6)], k * 4);
      }
      for (let i = 0; i < nx; i++) {
        const heat = Math.min(1, Math.max(0, (frame.Ts[i] - 298) / 450));
        sh.set(frame.m[i] > 0 ? [170 + 85 * heat, 205 - 110 * heat, 225 - 190 * heat, 140 + 115 * heat] : [0, 0, 0, 0], i * 4);
      }
    }
    sc.field.needsUpdate = sc.sheet.needsUpdate = true;
  }, [frame, field, nx]);

  const onMove = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect(), fr = frameRef.current;
    const hit = three.current?.pick(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    if (!hit || !fr) return setProbe(null);
    if (hit.gas) {
      const [i, j] = hit.gas, k = i + j * nx;
      setProbe(`gas at x ${(i * 0.5 + 0.25).toFixed(1)} mm, ${(j * 0.5 + 0.25).toFixed(1)} mm off the sheet · ${fr.T[k]} K · ${fr.H[k].toFixed(2)} MW/m³ · O₂ ${fr.O[k].toFixed(3)}`);
    } else if (hit.sheet != null) {
      const i = hit.sheet;
      setProbe(`sheet at x ${(i * 0.5 + 0.25).toFixed(1)} mm · ${fr.Ts[i]} K · fuel left ${Math.round(fr.m[i] * 100)}%`);
    }
  };

  return (
    <div className="scene" ref={host} onPointerMove={onMove} onPointerLeave={() => setProbe(null)}>
      <div className="cap">
        <span className="tag sim">simulated</span>
        {live && <span className="live"><i />live</span>}
        <span>FFR-2D · 2D solution extruded across the 20 mm width</span>
      </div>
      {probe && <div className="probe">{probe}</div>}
      {!frame && <div className="scene-empty">Run the detailed model to see the computed flame.</div>}
    </div>
  );
}
