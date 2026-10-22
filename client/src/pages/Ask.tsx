import { useEffect, useState } from "react";
import type { Answer } from "../../../shared/types";
import { api } from "../api";
import { useStore } from "../store";

const SUGGEST = ["Why does the flame go out at low flow?", "How does oxygen affect spread rate?", "What is the difference between the two models?", "Is PMMA safe for spacecraft?"];

export default function Ask() {
  const { question, setQuestion } = useStore();
  const [q, setQ] = useState(question);
  const [a, setA] = useState<Answer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const go = (text: string) => { setQ(text); setQuestion(text); api.ask(text).then((r) => { setA(r); setError(null); }, (e) => setError(e.message)); };
  useEffect(() => { if (question) go(question); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="card">
      <h2>Ask the evidence</h2>
      <p className="note">Answers are sentences quoted from the indexed sources, each with a citation. Nothing is generated.</p>
      <form className="row" onSubmit={(e) => { e.preventDefault(); if (q.trim()) go(q); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask a question" style={{ flex: 1 }} aria-label="Question" />
        <button className="primary">Ask</button>
      </form>
      <div className="row">{SUGGEST.map((s) => <button key={s} className="chip" onClick={() => go(s)}>{s}</button>)}</div>
      {error && <p className="error">{error}</p>}
      {a && <div className="answer" key={a.question}>
        {a.gap && <p className="warn">{a.gap}</p>}
        <ol>{a.points.map((p, i) => <li key={i}>{p.text} <sup className="mono">[{p.cite}]</sup></li>)}</ol>
        <div className="small">{a.sources.map((s) => (
          <div key={s.n}>[{s.n}] <span className={`tag ${s.prov === "simulated" ? "sim" : "pub"}`}>{s.prov}</span> {s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> : s.title}</div>
        ))}</div>
      </div>}
    </section>
  );
}
