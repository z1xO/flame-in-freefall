// In-memory job runner for detailed (FFR-2D) runs. Each job advances the solver in ~20 ms slices
// so the server keeps answering other requests; clients poll for progress and can cancel.
import { randomUUID } from "node:crypto";
import type { Inputs, Job } from "../../shared/types";
import { ffr2d } from "./ffr2d";

const jobs = new Map<string, Job>();

export function startJob(inputs: Inputs): Job {
  const job: Job = { id: randomUUID().slice(0, 8), status: "running", progress: 0, simTime: 0, inputs };
  jobs.set(job.id, job);
  const solver = ffr2d(inputs);
  const tick = () => {
    if (job.status !== "running") return;
    try {
      const until = Date.now() + 20;
      while (Date.now() < until) {
        const r = solver.next();
        if (r.done) { job.result = r.value; job.status = "done"; job.progress = 1; return; }
        job.progress = r.value.progress; job.simTime = r.value.simTime;
      }
      setImmediate(tick);
    } catch (e) {
      job.status = "error"; job.error = String(e);
    }
  };
  setImmediate(tick);
  // forget old jobs after 30 minutes
  setTimeout(() => jobs.delete(job.id), 30 * 60 * 1000).unref();
  return job;
}

export const getJob = (id: string) => jobs.get(id);

export function cancelJob(id: string) {
  const job = jobs.get(id);
  if (job && job.status === "running") job.status = "canceled";
  return job;
}
