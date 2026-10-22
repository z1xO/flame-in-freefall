import type { Provenance, Study, Test } from "../../shared/types";

// Curated from the BASS-II Summary Report (values as stated in its text and Table 2.1).
export const TM = "https://ntrs.nasa.gov/citations/20210011385";
export const TM_REF = "Olson, Ferkul, Bhattacharjee et al., BASS-II Summary Report, NASA/TM-20210011385 (2021)";

export const STUDIES: Study[] = [
  {
    id: "PSI-25",
    title: "Burning and Suppression of Solids II (BASS-II)",
    url: "https://psi.nasa.gov/physci/repo/data/investigations/PSI-25",
    platform: "ISS Microgravity Science Glovebox",
    gravity: "micro",
    summary: "Ignition, flame spread and extinction of solid fuels in microgravity across flow, oxygen and fuel geometry. Thin PMMA sheets (100–400 µm, 2 cm × ~95 mm) burned in opposed flow in a 76 mm duct at 99.2–99.5 kPa.",
  },
  {
    id: "TM-2.3-1G",
    title: "Downward spread over thin PMMA at 1 g (SDSU ground tests)",
    url: TM,
    platform: "Ground laboratory",
    gravity: "earth",
    summary: "Normal-gravity downward-spread tests on 2 cm wide PMMA sheets, reported in §2.3 of the BASS-II Summary Report as the 1 g counterpart to the ISS tests.",
  },
];

const base = { prov: "published" as const, source: TM, role: "validation" as const, spread: null, unc: null, crit: null, critUnc: null };

export const TESTS: Test[] = [
  { ...base, id: "B03-SPREAD", study: "PSI-25", kind: "spread", sample: "BASS-II B03, 100 µm", thickness: 0.1, o2: 20.7, pressure: 99.3, flow: 3, gravity: 0, spread: 2.2, unc: 0.11, outcome: "sustained spread", cite: "§2.3.7, p. 40–41",
    note: "Highest microgravity spread rate for 100 µm sheets over flows of ~1–40 cm/s; Fig. 2.19 shows the run at 3 cm/s (curator's reading). ±5% stated reproducibility." },
  { ...base, id: "B100-CUTOFF", study: "PSI-25", kind: "spread", sample: "BASS-II, 100 µm", thickness: 0.1, o2: 20.7, pressure: 99.3, flow: 0, gravity: 0, outcome: "extinction", cite: "§2.2.5, p. 23",
    note: "Forced flow cut off after steady spread; the flame went out within 2 s." },
  { ...base, id: "XV-21-THIN", study: "PSI-25", kind: "limit", sample: "BASS-II, 100–300 µm", thickness: 0.1, o2: 20.7, pressure: 99.3, flow: 1, gravity: 0, crit: 1.0, critUnc: 0.5, outcome: "extinction limit", cite: "§2.2.5; Table 2.1",
    note: "Flame went out below about 1 cm/s for 100, 200 and 300 µm." },
  { ...base, id: "XV-21-400", study: "PSI-25", kind: "limit", sample: "BASS-II, 400 µm", thickness: 0.4, o2: 20.7, pressure: 99.3, flow: 1.5, gravity: 0, crit: 1.5, critUnc: 0.5, outcome: "extinction limit", cite: "§2.2.5, p. 23",
    note: "Flame went out below about 1.5 cm/s." },
  { ...base, id: "XV-16-100", study: "PSI-25", kind: "limit", sample: "BASS-II, 100 µm", thickness: 0.1, o2: 16, pressure: 99.3, flow: 2.6, gravity: 0, crit: 2.6, critUnc: 0.5, outcome: "extinction limit", cite: "§2.2.5; Table 2.1",
    note: "At about 16% O₂ the flame went out below about 2.6 cm/s." },
  { ...base, id: "XV-16-200", study: "PSI-25", kind: "limit", sample: "BASS-II, 200 µm, 10 mm wide", thickness: 0.2, o2: 16, pressure: 99.3, flow: 4.0, gravity: 0, crit: 4.0, critUnc: 0.5, outcome: "extinction limit", cite: "§2.2.5, p. 25",
    note: "At about 16% O₂ the flame went out below about 4 cm/s (narrower sample)." },
  { ...base, role: "calibration", id: "SDSU-1G-100", study: "TM-2.3-1G", kind: "spread", sample: "SDSU downward, 100 µm", thickness: 0.1, o2: 21, pressure: 101, flow: 0, gravity: 1, spread: 2.0, unc: 0.1, outcome: "sustained spread", cite: "§2.3.7, p. 40",
    note: "Average downward spread at 1 g. Used to calibrate FFR-1, so agreement with it is by construction." },
];

export interface Passage { id: string; title: string; url?: string; prov: Provenance; text: string }

export const CORPUS: Passage[] = [
  { id: "c1", title: "BASS-II Summary Report §2.2.5: extinction velocity", url: TM, prov: "published",
    text: "In BASS-II, a 100 µm PMMA sheet spread steadily at 2.2 mm/s in microgravity. When the forced flow was cut off, the flame went out within 2 s. When the flow was reduced gradually, the flame shrank, turned blue, and went out at about 1.1 cm/s, which the authors attribute to radiative losses growing with residence time. Extinction velocities were about 1 cm/s for 100 to 300 µm sheets and about 1.5 cm/s for 400 µm. At about 16% oxygen the extinction velocity rose to about 2.6 to 4 cm/s." },
  { id: "c2", title: "BASS-II Summary Report §2.3.7: microgravity versus 1 g", url: TM, prov: "published",
    text: "For 100 µm PMMA the highest microgravity spread rate was about 2.2 mm/s while the opposed flow was varied from about 40 cm/s to about 1 cm/s. Blowoff was observed at very high flow and radiative extinction at about 1 cm/s. Downward spread at 1 g averaged 2.0 mm/s. Spread rate was inversely proportional to fuel thickness, the signature of thermally thin fuel." },
  { id: "c3", title: "Model notes: low-flow extinction", prov: "simulated",
    text: "At low opposed flow the gas-phase length scale grows, so the heat conducted back to the fuel falls while radiative losses stay large. When losses outrun the heat feedback the flame goes out. In microgravity there is no buoyant flow, so a slow flow can extinguish a flame that would burn on Earth." },
  { id: "c4", title: "Model notes: high-flow extinction", prov: "simulated",
    text: "At high opposed flow the gas residence time becomes shorter than the chemical reaction time. The Damköhler number falls toward one and the flame blows off. Lower oxygen or pressure moves blowoff to lower flow speeds." },
  { id: "c5", title: "Model notes: oxygen", prov: "simulated",
    text: "Oxygen concentration sets the flame temperature. Higher oxygen raises flame temperature, which increases spread rate and widens the range of flow speeds that sustain burning." },
  { id: "c6", title: "Model notes: the two models", prov: "simulated",
    text: "FFR-1 is a reduced-order model built on the de Ris spread-rate formulas with blowoff and radiative-loss corrections; it is calibrated on one 1 g record. FFR-2D solves the transient two-dimensional energy, fuel and oxygen equations above a burning PMMA sheet; its spread rate is measured from the computed flame front and it is not calibrated. Neither model is validated." },
  { id: "c7", title: "Product boundaries", prov: "published",
    text: "This tool does not certify spacecraft materials or declare them safe or unsafe. It shows how modeled flame spread changes with conditions and how that compares with published tests." },
];
