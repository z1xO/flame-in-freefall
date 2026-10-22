import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Inputs } from "../../shared/types";
import { STUDIES, TESTS } from "./data";
import { flammabilityMap, runFast, validation } from "./ffr1";
import { LIMITS } from "./ffr2d";
import { cancelJob, getJob, startJob } from "./jobs";
import { ask } from "./ask";

const app = express();
app.use(express.json());

// Hard limits: values outside these are rejected. Documented model ranges are checked by each model.
const ACCEPTED: Record<keyof Inputs, [number, number]> = { gravity: [0, 1.2], o2: [5, 100], pressure: [5, 150], flow: [0, 300], thickness: [0.01, 50] };

function parseInputs(body: unknown): { inputs?: Inputs; errors: string[] } {
  const b = (body ?? {}) as Record<string, unknown>;
  const errors: string[] = [];
  const out = {} as Inputs;
  for (const k of Object.keys(ACCEPTED) as (keyof Inputs)[]) {
    const v = Number(b[k]);
    const [lo, hi] = ACCEPTED[k];
    if (b[k] === undefined || b[k] === "" || !Number.isFinite(v)) errors.push(`${k} must be a number.`);
    else if (v < lo || v > hi) errors.push(`${k} must be between ${lo} and ${hi}.`);
    else out[k] = v;
  }
  return errors.length ? { errors } : { inputs: out, errors };
}

app.get("/api/library", (_req, res) => res.json({ studies: STUDIES, tests: TESTS }));

app.post("/api/fast", (req, res) => {
  const { inputs, errors } = parseInputs(req.body);
  if (!inputs) return res.status(400).json({ errors });
  res.json(runFast(inputs));
});

app.post("/api/map", (req, res) => {
  const { inputs, errors } = parseInputs(req.body);
  if (!inputs) return res.status(400).json({ errors });
  res.json(flammabilityMap(inputs));
});

app.post("/api/detailed", (req, res) => {
  const { inputs, errors } = parseInputs(req.body);
  if (!inputs) return res.status(400).json({ errors });
  if (inputs.thickness < LIMITS.thickness[0] || inputs.thickness > LIMITS.thickness[1])
    errors.push(`The detailed model treats the sheet as thin: thickness must be ${LIMITS.thickness[0]}–${LIMITS.thickness[1]} mm.`);
  if (inputs.flow > LIMITS.flow[1]) errors.push(`The detailed model supports opposed flow up to ${LIMITS.flow[1]} cm/s.`);
  if (errors.length) return res.status(400).json({ errors });
  res.status(202).json(startJob(inputs));
});

app.get("/api/detailed/:id", (req, res) => {
  const job = getJob(req.params.id, Number(req.query.since ?? 0) || 0);
  if (!job) return res.status(404).json({ errors: ["Run not found. Runs are kept for 30 minutes."] });
  res.json(job);
});

app.delete("/api/detailed/:id", (req, res) => {
  const job = cancelJob(req.params.id);
  if (!job) return res.status(404).json({ errors: ["Run not found."] });
  res.json(job);
});

let cachedValidation: ReturnType<typeof validation> | null = null;
app.get("/api/validation", (_req, res) => res.json((cachedValidation ??= validation())));

app.post("/api/ask", (req, res) => {
  const q = String(req.body?.question ?? "").trim();
  if (!q) return res.status(400).json({ errors: ["Ask a question."] });
  res.json(ask(q));
});

// In production, serve the built client.
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");
app.use(express.static(dist));
app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html"), (err) => err && res.status(404).end()));

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => console.log(`Flame in Freefall API on http://localhost:${port}`));
