// Retrieval-only Q&A: answers are sentences quoted from the indexed passages, each with a citation.
import type { Answer } from "../../shared/types";
import { CORPUS } from "./data";

const STOP = new Set("the and of to in a an is are for on with at by from this that it as be or what why how does do which".split(" "));
const tokens = (s: string) => s.toLowerCase().replace(/[^a-z0-9\-\s]/g, " ").split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w));

export function ask(question: string): Answer {
  const q = tokens(question);
  let gap: string | null = null;
  const scored = CORPUS.map((c) => {
    const words = tokens(c.title + " " + c.text);
    let s = 0;
    for (const w of q) { const n = words.filter((x) => x.startsWith(w.slice(0, 5))).length; if (n) s += 1 + Math.log(n); }
    return { c, s: q.length ? s / q.length : 0 };
  }).sort((a, b) => b.s - a.s);
  let top = scored.filter((x) => x.s >= 0.34).slice(0, 3).map((x) => x.c);
  if (/safe|hazard|danger|certif/i.test(question)) {
    top = [CORPUS.find((c) => c.id === "c7")!, ...top.filter((c) => c.id !== "c7")].slice(0, 3);
    gap = "This tool can't answer safety or certification questions.";
  }
  if (!top.length) return { question, gap: "The indexed sources don't cover this. Try asking about flow, oxygen, gravity, extinction or the models.", points: [], sources: [] };
  const points = top.flatMap((c, i) =>
    c.text.split(/(?<=\.)\s+/)
      .map((s) => ({ s, k: q.filter((w) => s.toLowerCase().includes(w.slice(0, 5))).length }))
      .sort((a, b) => b.k - a.k).slice(0, 2)
      .map((x) => ({ text: x.s, cite: i + 1 })));
  return { question, gap, points, sources: top.map((c, i) => ({ n: i + 1, title: c.title, url: c.url, prov: c.prov })) };
}
