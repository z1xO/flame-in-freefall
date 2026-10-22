import { useEffect, useState } from "react";
import type { Study, Test } from "../../shared/types";
import { api, inputsOf } from "./api";
import { StoreProvider, TABS, useStore } from "./store";
import Library from "./pages/Library";
import Simulate from "./pages/Simulate";
import Compare from "./pages/Compare";
import Physics from "./pages/Physics";
import Ask from "./pages/Ask";

const scrollTo = (id: string) => setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);

function DemoBar() {
  const { tests, setTab, pickBaseline, setInputs, det, setQuestion } = useStore();
  const [done, setDone] = useState<number[]>([]);
  const b03 = tests.find((t) => t.id === "B03-SPREAD")!;
  const steps: [string, () => void][] = [
    ["Find BASS-II", () => setTab("Library")],
    ["Inspect the evidence", () => { setTab("Library"); scrollTo("lib-tests"); }],
    ["Simulate B03 live", () => { pickBaseline(b03.id); setTab("Simulate"); det.start(inputsOf(b03)); }],
    ["Lower the flow", () => { setTab("Simulate"); setInputs({ flow: 0.8 }); }],
    ["Where can it burn?", () => { setTab("Simulate"); scrollTo("flam-card"); }],
    ["Compare to the limit", () => { pickBaseline("XV-21-THIN"); setTab("Compare"); }],
    ["See the physics", () => setTab("Physics")],
    ["Ask why", () => { setQuestion("Why does the flame go out at low flow?"); setTab("Ask"); }],
  ];
  return (
    <div className="demo">
      <div className="inner">
        <span className="k">Guided demo</span>
        <ol>{steps.map(([label, run], i) => (
          <li key={label}><button className={done.includes(i) ? "done" : ""} onClick={() => { run(); setDone((d) => [...new Set([...d, i])]); }}><b>{i + 1}</b>{label}</button></li>
        ))}</ol>
      </div>
    </div>
  );
}

function Shell() {
  const { tab, setTab, det } = useStore();
  return (
    <>
      <header>
        <div className="inner">
          <div className="brand"><span className="logo" aria-hidden="true" /><h1>Flame in Freefall</h1></div>
          <nav role="tablist">
            {TABS.map((t) => (
              <button key={t} role="tab" aria-selected={t === tab} className={t === tab ? "on" : ""} onClick={() => setTab(t)}>
                {t}{t === "Simulate" && det.running && <span className="dot" title="Detailed run in progress" />}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <DemoBar />
      <main key={tab} className="page">
        {tab === "Library" && <Library />}
        {tab === "Simulate" && <Simulate />}
        {tab === "Compare" && <Compare />}
        {tab === "Physics" && <Physics />}
        {tab === "Ask" && <Ask />}
      </main>
    </>
  );
}

export default function App() {
  const [data, setData] = useState<{ studies: Study[]; tests: Test[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.library().then(setData, (e) => setError(e.message)); }, []);
  if (error) return <main><p className="error">Could not reach the server: {error}. Is it running on port 3001?</p></main>;
  if (!data) return <main><p className="empty">Loading…</p></main>;
  return <StoreProvider {...data}><Shell /></StoreProvider>;
}
