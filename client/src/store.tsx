// One shared store for the scenario, model results, the live detailed run and playback,
// so every tab and the guided demo act on the same state.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { DetailedResult, FastResult, FlammabilityMap, Frame, FrontPoint, Inputs, Job, Study, Test } from "../../shared/types";
import { api, detailedProblem, inputsOf } from "./api";

export const TABS = ["Library", "Simulate", "Compare", "Physics", "Ask"] as const;
export type Tab = (typeof TABS)[number];
export type Field = "T" | "H" | "O";
const FRAME_DT = 0.4; // seconds of flame time between solver snapshots

interface Detailed {
  job: Job | null;
  frames: Frame[];
  front: FrontPoint[];
  result: DetailedResult | null;
  running: boolean;
  error: string | null;
  start: (inputs?: Inputs) => void;
  cancel: () => void;
}

interface Store {
  studies: Study[];
  tests: Test[];
  tab: Tab; setTab: (t: Tab) => void;
  inputs: Inputs; setInputs: (patch: Partial<Inputs>) => void;
  baseline: string; pickBaseline: (id: string) => void;
  fast: FastResult | null; fastError: string | null;
  map: FlammabilityMap | null;
  det: Detailed;
  autoRun: boolean; setAutoRun: (v: boolean) => void;
  field: Field; setField: (f: Field) => void;
  frameIdx: number; setFrameIdx: (i: number) => void;
  playing: boolean; setPlaying: (p: boolean) => void;
  speed: number; setSpeed: (s: number) => void;
  question: string; setQuestion: (q: string) => void;
}

const Ctx = createContext<Store | null>(null);
export const useStore = () => useContext(Ctx)!;

export function StoreProvider({ studies, tests, children }: { studies: Study[]; tests: Test[]; children: ReactNode }) {
  const [tab, setTab] = useState<Tab>("Simulate");
  const [baseline, setBaseline] = useState("B03-SPREAD");
  const [inputs, setInputsState] = useState<Inputs>(() => inputsOf(tests.find((t) => t.id === "B03-SPREAD") ?? tests[0]));
  const [fast, setFast] = useState<FastResult | null>(null);
  const [fastError, setFastError] = useState<string | null>(null);
  const [map, setMap] = useState<FlammabilityMap | null>(null);
  const [autoRun, setAutoRun] = useState(true);
  const [field, setField] = useState<Field>("T");
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [question, setQuestion] = useState("");

  const setInputs = useCallback((patch: Partial<Inputs>) => setInputsState((cur) => ({ ...cur, ...patch })), []);
  const pickBaseline = useCallback((id: string) => {
    const t = tests.find((x) => x.id === id);
    if (t) { setBaseline(id); setInputsState(inputsOf(t)); }
  }, [tests]);

  // Fast model: re-runs a moment after any input changes.
  const key = JSON.stringify(inputs);
  useEffect(() => {
    if (Object.values(inputs).some((v) => !Number.isFinite(v))) return;
    let live = true;
    const t = setTimeout(() => api.fast(inputs).then((r) => live && (setFast(r), setFastError(null)), (e) => live && setFastError(e.message)), 60);
    return () => { live = false; clearTimeout(t); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Flammability map: oxygen and flow are its axes, so it only depends on the other three inputs.
  const mapKey = JSON.stringify([inputs.gravity, inputs.pressure, inputs.thickness]);
  useEffect(() => {
    if (Object.values(inputs).some((v) => !Number.isFinite(v))) return;
    let live = true;
    const t = setTimeout(() => api.map(inputs).then((m) => live && setMap(m), () => {}), 150);
    return () => { live = false; clearTimeout(t); };
  }, [mapKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detailed run: streams snapshots while the server solves.
  const [job, setJob] = useState<Job | null>(null);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [front, setFront] = useState<FrontPoint[]>([]);
  const [result, setResult] = useState<DetailedResult | null>(null);
  const [detError, setDetError] = useState<string | null>(null);
  const poll = useRef<number>();
  const jobRef = useRef<Job | null>(null);
  const framesRef = useRef<Frame[]>([]);
  const inputsRef = useRef(inputs); inputsRef.current = inputs;
  const startedKey = useRef("");
  const startToken = useRef(0); // only the latest start may own the job; older ones are canceled on arrival

  const stopPolling = () => window.clearTimeout(poll.current);
  const cancel = useCallback(() => {
    stopPolling();
    const j = jobRef.current;
    if (j && j.status === "running") { api.cancel(j.id).catch(() => {}); setJob({ ...j, status: "canceled" }); jobRef.current = null; }
  }, []);

  const start = useCallback((override?: Inputs) => {
    const inp = override ?? inputsRef.current;
    const problem = detailedProblem(inp);
    if (problem) { setDetError(problem); return; }
    cancel();
    startedKey.current = JSON.stringify(inp);
    setDetError(null); setResult(null); setFrames([]); setFront([]); framesRef.current = []; setPlaying(false); setFrameIdx(0);
    const token = ++startToken.current;
    api.startDetailed(inp).then((j) => {
      if (token !== startToken.current) { api.cancel(j.id).catch(() => {}); return; }
      jobRef.current = j; setJob(j);
      const tick = async () => {
        if (jobRef.current?.id !== j.id) return;
        try {
          const next = await api.job(j.id, framesRef.current.length);
          if (jobRef.current?.id !== j.id) return;
          setJob(next);
          if (next.status === "done" && next.result) {
            framesRef.current = next.result.frames;
            setFrames(next.result.frames); setFront(next.result.front); setResult(next.result);
            setFrameIdx(Math.floor(next.result.frames.length * 0.55));
            jobRef.current = null;
            return;
          }
          if (next.frames?.length) {
            framesRef.current = [...framesRef.current.slice(0, next.from ?? framesRef.current.length), ...next.frames];
            setFrames(framesRef.current); setFrameIdx(framesRef.current.length - 1);
          }
          if (next.front) setFront(next.front);
          if (next.status === "running") poll.current = window.setTimeout(tick, 350);
          else jobRef.current = null;
        } catch (e) { setDetError((e as Error).message); jobRef.current = null; }
      };
      poll.current = window.setTimeout(tick, 250);
    }, (e) => setDetError(e.message));
  }, [cancel]);
  useEffect(() => () => stopPolling(), []);

  // Auto re-run the detailed solver after the inputs settle.
  const seenKey = useRef(key); // the inputs at mount don't trigger a run
  useEffect(() => {
    if (key === seenKey.current) return;
    seenKey.current = key;
    if (!autoRun || key === startedKey.current || detailedProblem(inputs) || Object.values(inputs).some((v) => !Number.isFinite(v))) return;
    const t = setTimeout(() => start(), 700);
    return () => clearTimeout(t);
  }, [key, autoRun]); // eslint-disable-line react-hooks/exhaustive-deps

  // Playback of a finished run.
  useEffect(() => {
    if (!playing || !result) return;
    let raf = 0, last = performance.now(), pos = frameIdx >= result.frames.length - 1 ? 0 : frameIdx;
    const step = (now: number) => {
      pos += ((now - last) / 1000) * speed / FRAME_DT; last = now;
      if (pos >= result.frames.length - 1) { setFrameIdx(result.frames.length - 1); setPlaying(false); return; }
      setFrameIdx(Math.floor(pos));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, result]); // eslint-disable-line react-hooks/exhaustive-deps

  const det: Detailed = { job, frames, front, result, running: job?.status === "running", error: detError, start, cancel };

  return (
    <Ctx.Provider value={{ studies, tests, tab, setTab, inputs, setInputs, baseline, pickBaseline, fast, fastError, map, det, autoRun, setAutoRun,
      field, setField, frameIdx, setFrameIdx, playing, setPlaying, speed, setSpeed, question, setQuestion }}>
      {children}
    </Ctx.Provider>
  );
}
