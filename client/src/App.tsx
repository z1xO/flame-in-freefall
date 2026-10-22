import { useEffect, useState } from "react";
import type { Study, Test } from "../../shared/types";
import { api } from "./api";
import Library from "./pages/Library";
import Simulate from "./pages/Simulate";
import Compare from "./pages/Compare";
import Ask from "./pages/Ask";

const TABS = ["Library", "Simulate", "Compare", "Ask"] as const;
type Tab = (typeof TABS)[number];

export default function App() {
  const [tab, setTab] = useState<Tab>("Simulate");
  const [data, setData] = useState<{ studies: Study[]; tests: Test[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [baseline, setBaseline] = useState("B03-SPREAD");

  useEffect(() => { api.library().then(setData, (e) => setError(e.message)); }, []);

  return (
    <>
      <header>
        <div className="inner">
          <h1>Flame in Freefall</h1>
          <nav>
            {TABS.map((t) => <button key={t} className={t === tab ? "on" : ""} onClick={() => setTab(t)}>{t}</button>)}
          </nav>
        </div>
      </header>
      <main>
        {error && <p className="error">Could not reach the server: {error}</p>}
        {data && tab === "Library" && <Library {...data} onSimulate={(id) => { setBaseline(id); setTab("Simulate"); }} />}
        {data && tab === "Simulate" && <Simulate tests={data.tests} baseline={baseline} />}
        {data && tab === "Compare" && <Compare tests={data.tests} />}
        {tab === "Ask" && <Ask />}
      </main>
    </>
  );
}
