// In-memory job runner for detailed (FFR-2D) runs. Each job advances the solver in ~20 ms slices
// so the server keeps answering other requests. Snapshots are kept as they are produced, so a client
// polling with `since` can draw the flame while it is still being computed, and can cancel.
import { randomUUID } from "node:crypto";
import type { Frame, FrontPoint, Inputs, Job } from "../../shared/types";
import { ffr2d, GRID } from "./ffr2d";

interface Entry { job: Job; frames: Frame[]; front: FrontPoint[] }
const jobs = new Map<string, Entry>();

export function startJob(inputs: Inputs): Job {
  const job: Job = { id: randomUUID().slice(0, 8), status: "running", progress: 0, simTime: 0, inputs, grid: GRID };
  const entry: Entry = { job, frames: [], front: [] };
  jobs.set(job.id, entry);
  const solver = ffr2d(inputs);
  const tick = () => {
    if (job.status !== "running") return;
    try {
      const until = Date.now() + 20;
      while (Date.now() < until) {
        const r = solver.next();
        if (r.done) { job.result = r.value; job.status = "done"; job.progress = 1; return; }
        job.progress = r.value.progress; job.simTime = r.value.simTime;
        if (r.value.frame) { entry.frames.push(r.value.frame); entry.front.push(r.value.point!); }
      }
      setImmediate(tick);
    } catch (e) {
      job.status = "error"; job.error = String(e);
    }
  };
  setImmediate(tick);
  setTimeout(() => jobs.delete(job.id), 30 * 60 * 1000).unref(); // forget old jobs after 30 minutes
  return job;
}

/** The job, plus snapshots from index `since` onward while it is still running. */
export function getJob(id: string, since = 0): Job | undefined {
  const e = jobs.get(id);
  if (!e) return undefined;
  if (e.job.status === "done") return e.job;
  return { ...e.job, from: since, frames: e.frames.slice(since), front: e.front };
}

export function cancelJob(id: string) {
  const e = jobs.get(id);
  if (e && e.job.status === "running") e.job.status = "canceled";
  return e?.job;
}
