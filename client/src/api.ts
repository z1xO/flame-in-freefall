import type { Answer, FastResult, FlammabilityMap, Inputs, Job, Study, Test, Validation } from "../../shared/types";

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
  map: (inputs: Inputs) => post<FlammabilityMap>("/api/map", inputs),
  startDetailed: (inputs: Inputs) => post<Job>("/api/detailed", inputs),
  job: (id: string, since: number) => call<Job>(`/api/detailed/${id}?since=${since}`),
  cancel: (id: string) => call<Job>(`/api/detailed/${id}`, { method: "DELETE" }),
  validation: () => call<Validation>("/api/validation"),
  ask: (question: string) => post<Answer>("/api/ask", { question }),
};

export const inputsOf = (t: Test): Inputs => ({ gravity: t.gravity, o2: t.o2, pressure: t.pressure, flow: t.kind === "limit" ? t.crit! : t.flow, thickness: t.thickness });

export const DETAILED_LIMITS = { thickness: [0.05, 0.4], flow: [0, 50] } as const;
export function detailedProblem(i: Inputs): string | null {
  if (i.thickness < DETAILED_LIMITS.thickness[0] || i.thickness > DETAILED_LIMITS.thickness[1]) return "The detailed solver treats the sheet as thin: use 0.05–0.4 mm.";
  if (i.flow > DETAILED_LIMITS.flow[1]) return "The detailed solver supports opposed flow up to 50 cm/s.";
  return null;
}

export const fmt = (v: number | null | undefined, d = 3) => (v == null || !isFinite(v) ? "—" : String(+v.toPrecision(d)));
