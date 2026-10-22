import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { DetailedResult, Frame } from "../../../shared/types";
import { inferno, T_RANGE } from "./colormap";

// 3D view of the computed field: the 2D temperature solution is drawn on stacked translucent
// slices across the 20 mm sheet width, mirrored below the sheet (both faces burn).
// Scale: 1 unit = 5 mm, so the 40 mm domain is 8 units long.
export default function FlameScene({ result, frame }: { result: DetailedResult; frame: Frame }) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<{ field: THREE.DataTexture; sheet: THREE.DataTexture } | null>(null);

  useEffect(() => {
    const el = host.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor(0x0b0f17);
    el.prepend(renderer.domElement);

    const s = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(38, 2, 0.1, 100);
    cam.position.set(1.6, 3.4, 8.2);
    const controls = new OrbitControls(cam, renderer.domElement);
    controls.target.set(4, 0.3, 0);
    controls.enableDamping = true;

    const grid = new THREE.GridHelper(16, 32, 0x253250, 0x161e30);
    grid.position.set(4, -1.6, 0);
    s.add(grid);

    const { nx, ny } = result;
    const field = new THREE.DataTexture(new Uint8Array(nx * ny * 4), nx, ny, THREE.RGBAFormat);
    field.magFilter = field.minFilter = THREE.LinearFilter;
    const sheet = new THREE.DataTexture(new Uint8Array(nx * 4), nx, 1, THREE.RGBAFormat);

    const sheetMesh = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), new THREE.MeshBasicMaterial({ map: sheet, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    sheetMesh.rotation.x = -Math.PI / 2;
    sheetMesh.position.x = 4;
    s.add(sheetMesh);

    const sliceMat = new THREE.MeshBasicMaterial({ map: field, transparent: true, opacity: 0.26, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    for (let k = 0; k < 13; k++) for (const side of [1, -1]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(8, 2.4), sliceMat);
      m.position.set(4, side * 1.2, -1.8 + (3.6 * k) / 12);
      m.scale.y = side;
      s.add(m);
    }
    scene.current = { field, sheet };

    const resize = () => { const w = el.clientWidth, h = el.clientHeight; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
    const ro = new ResizeObserver(resize); ro.observe(el); resize();
    let raf = 0;
    const loop = () => { controls.update(); renderer.render(s, cam); raf = requestAnimationFrame(loop); };
    loop();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); renderer.dispose(); renderer.domElement.remove(); scene.current = null; };
  }, [result]);

  useEffect(() => {
    const sc = scene.current; if (!sc) return;
    const f = sc.field.image.data as Uint8Array, s = sc.sheet.image.data as Uint8Array;
    for (let k = 0; k < frame.T.length; k++) {
      const tn = Math.max(0, (frame.T[k] - 500) / (T_RANGE[1] - 500)), c = inferno(0.25 + 0.75 * tn);
      f.set([...c, Math.round(255 * Math.min(1, tn) ** 1.8)], k * 4);
    }
    for (let i = 0; i < frame.m.length; i++) {
      const heat = Math.min(1, Math.max(0, (frame.Ts[i] - 298) / 450));
      s.set(frame.m[i] > 0 ? [170 + 85 * heat, 205 - 110 * heat, 225 - 190 * heat, 140 + 115 * heat] : [0, 0, 0, 0], i * 4);
    }
    sc.field.needsUpdate = sc.sheet.needsUpdate = true;
  }, [frame, result]);

  return (
    <div className="scene" ref={host}>
      <div className="cap"><span className="tag sim">simulated</span> FFR-2D gas temperature · drag to orbit, scroll to zoom</div>
    </div>
  );
}
