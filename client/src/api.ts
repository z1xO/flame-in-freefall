import { useEffect, useRef, useState } from "react";
import type { Answer, FastResult, Inputs, Job, Study, Test, Validation } from "../../shared/types";

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
  const body = await res.json();
  if (!res.ok) throw new Error((body.errors ?? ["Request failed."]).join(" "));
  return body as T;
}
const post = <T,>(url: string, data: unknown) => call<T>(url, { method: "POST", body: JSON.stringify(data) });

export const api = {
  library: () => call<{ studies: Study[]; tests: Test[] }>("/api/library"),
  fast: (inputs: Inputs) => post<FastResult>("/api/fast", inputs),
  startDetailed: (inputs: Inputs) => post<Job>("/api/detailed", inputs),
  job: (id: string) => call<Job>(`/api/detailed/${id}`),
  cancel: (id: string) => call<Job>(`/api/detailed/${id}`, { method: "DELETE" }),
  validation: () => call<Validation>("/api/validation"),
  ask: (question: string) => post<Answer>("/api/ask", { question }),
};

export const inputsOf = (t: Test): Inputs => ({ gravity: t.gravity, o2: t.o2, pressure: t.pressure, flow: t.kind === "limit" ? t.crit! : t.flow, thickness: t.thickness });

/** Fast model result for the given inputs, refreshed shortly after they change. */
export function useFast(inputs: Inputs | null) {
  const [result, setResult] = useState<FastResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify(inputs);
  useEffect(() => {
    if (!inputs) return;
    let live = true;
    const t = setTimeout(() => api.fast(inputs).then((r) => live && (setResult(r), setError(null)), (e) => live && setError(e.message)), 200);
    return () => { live = false; clearTimeout(t); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return { result, error };
}

/** Starts a detailed run and polls it until it finishes. */
export function useDetailedRun() {
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number>();
  const stop = () => window.clearInterval(timer.current);
  useEffect(() => stop, []);
  const start = async (inputs: Inputs) => {
    stop(); setError(null);
    try {
      const j = await api.startDetailed(inputs);
      setJob(j);
      timer.current = window.setInterval(async () => {
        try {
          const next = await api.job(j.id);
          setJob(next);
          if (next.status !== "running") stop();
        } catch (e) { setError((e as Error).message); stop(); }
      }, 500);
    } catch (e) { setError((e as Error).message); }
  };
  const cancel = async () => { if (job) { stop(); setJob(await api.cancel(job.id)); } };
  return { job, error, start, cancel, running: job?.status === "running" };
}
