import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api, clock, connect } from "./api.js";
import { createFactory } from "./three/factory.js";

import Overview from "./pages/Overview.jsx";
import Data from "./pages/Data.jsx";
import Inference from "./pages/Inference.jsx";
import Reason from "./pages/Reason.jsx";
import Rehearse from "./pages/Rehearse.jsx";
import Learn from "./pages/Learn.jsx";
import Scale from "./pages/Scale.jsx";

const NAV = [
  { id: "overview",  label: "Overview",  hint: "3D" },
  { id: "data",      label: "Data" },
  { id: "inference", label: "Inference" },
  { id: "reason",    label: "Reason" },
  { id: "rehearse",  label: "Rehearse" },
  { id: "learn",     label: "Learn" },
  { id: "scale",     label: "Scale" },
];

export default function App() {
  const [snap, setSnap] = useState(null);
  const [link, setLink] = useState("…");
  const [page, setPage] = useState("overview");
  const [role, setRole] = useState("supervisor");
  const [preview, setPreview] = useState(null);

  const canvasRef = useRef(null);
  const [factory, setFactory] = useState(null);

  // live stream
  useEffect(() => connect(setSnap, setLink), []);

  // 3D scene lives for the whole session; only the overview shows it.
  useEffect(() => {
    if (!canvasRef.current) return;
    const f = createFactory(canvasRef.current);
    setFactory(f);
    return () => f.dispose();
  }, []);

  // push simulation state into the scene
  useEffect(() => {
    if (!factory || !snap) return;
    const congested = snap.metrics.bottleneck_risk > 45;
    factory.applyState({
      lines: snap.lines,
      focus: snap.focus,
      flow: preview ?? (congested ? 0.35 : 1),
    });
  }, [factory, snap, preview]);

  const go = (p) => setPage(p);
  const sim = (body) => api.sim(body).catch(() => {});

  const totals = snap?.totals ?? { stations: 0, alerts: 0, coverage: 0 };

  if (!snap) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100vh" }}>
        <div style={{ textAlign: "center" }}>
          <motion.h1 animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }}
            style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>
            DIGITALTWIN<span style={{ color: "var(--violet)" }}>.AI</span>
          </motion.h1>
          <p className="small muted" style={{ marginTop: 12 }}>
            {link === "down"
              ? "Backend not reachable. Start it on port 8000 — this page reconnects by itself."
              : "Connecting to the line…"}
          </p>
        </div>
      </div>
    );
  }

  const unlocked = { overview: true, data: true, inference: true, scale: true,
                     reason: snap.ready, rehearse: snap.ready,
                     learn: ["acting", "done"].includes(snap.sim.phase) };

  return (
    <div className="shell">
      {/* ------------------------------------------------------------ rail -- */}
      <nav className="rail">
        <div className="brand">
          <h1>DIGITALTWIN<span>.AI</span></h1>
          <p>Decision twin for assembly</p>
        </div>

        {NAV.map((n, i) => {
          const on = page === n.id;
          const open = unlocked[n.id];
          return (
            <button key={n.id} className={`nav-item ${on ? "on" : ""}`}
              onClick={() => open && go(n.id)} disabled={!open}
              title={open ? "" : "Unlocks as the investigation progresses"}>
              {on && <motion.span className="nav-pill" layoutId="pill"
                transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
              <span className="nav-num">{String(i + 1).padStart(2, "0")}</span>
              <span>{n.label}</span>
              {n.hint && <span className="nav-hint">{n.hint}</span>}
              {!open && <span className="nav-hint" style={{ color: "var(--text-3)" }}>🔒</span>}
            </button>
          );
        })}

        <div style={{ marginTop: "auto" }}>
          <button className="btn primary wide" onClick={() => { api.trigger(); go("overview"); }}>
            ⚡ Trigger scenario
          </button>
          <button className="btn wide sm" style={{ marginTop: 8 }}
            onClick={() => { api.reset(); go("overview"); }}>
            Reset line
          </button>
          <p className="small muted" style={{ marginTop: 14, lineHeight: 1.5, fontSize: 10.5 }}>
            All data simulated. The twin only reads — it never writes to plant equipment.
          </p>
        </div>
      </nav>

      {/* ------------------------------------------------------------ main -- */}
      <div className="main">
        <header className="topbar">
          <div className="crumb">
            <b>{NAV.find((n) => n.id === page)?.label}</b>
            <span>·</span>
            <span>Plant A — Pune</span>
          </div>

          <div style={{ flex: 1 }} />

          <div className="row" style={{ gap: 26 }}>
            <div className="stat"><span className="v">{totals.stations}</span><span className="k">Stations</span></div>
            <div className="stat"><span className="v">{totals.coverage}%</span><span className="k">Sensed</span></div>
            <div className="stat">
              <span className="v" style={{ color: totals.alerts ? "var(--crit)" : "var(--ok)" }}>
                {totals.alerts}
              </span>
              <span className="k">Active risks</span>
            </div>
            <div className="stat">
              <span className="v">{snap.metrics.throughput}</span><span className="k">Units/hr</span>
            </div>
          </div>

          <div className="row" style={{ gap: 12, marginLeft: 12 }}>
            <div className="row" style={{ gap: 7 }}>
              <motion.span className={`live-dot ${snap.sim.running ? "" : "paused"}`}
                animate={snap.sim.running ? { opacity: [1, 0.35, 1] } : { opacity: 1 }}
                transition={{ duration: 1.8, repeat: Infinity }} />
              <span className="mono" style={{ fontSize: 13 }}>{clock(snap.clock.seconds)}</span>
            </div>
            <div className="seg">
              <button onClick={() => sim({ running: !snap.sim.running })}>
                {snap.sim.running ? "❚❚" : "▶"}
              </button>
              {[1, 3, 5].map((s) => (
                <button key={s} className={snap.sim.speed === s ? "on" : ""}
                  onClick={() => sim({ speed: s })}>{s}×</button>
              ))}
            </div>
          </div>
        </header>

        {/* 3D stage is only mounted-visible on overview, but never destroyed */}
        <div className="stage" style={{ display: page === "overview" ? "block" : "none" }}>
          <canvas ref={canvasRef} />
          <div className="overlay">
            {page === "overview" && <Overview snap={snap} factory={factory} go={go} />}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {page !== "overview" && (
            <motion.div key={page} style={{ flex: 1, display: "flex", minHeight: 0 }}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28 }}>
              {page === "data"      && <Data snap={snap} />}
              {page === "inference" && <Inference snap={snap} go={go} />}
              {page === "reason"    && <Reason snap={snap} go={go} />}
              {page === "rehearse"  && <Rehearse snap={snap} go={go} setPreview={setPreview} />}
              {page === "learn"     && <Learn snap={snap} go={go} />}
              {page === "scale"     && <Scale role={role} setRole={setRole} />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
