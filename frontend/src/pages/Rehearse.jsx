import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../api.js";
import { Card, Metric, PageHead, Tick } from "../components/bits.jsx";

/**
 * Four futures, rehearsed on the twin. Picking one animates the predicted
 * downstream queue so the trade-off is visible, not just tabulated.
 */
export default function Rehearse({ snap, go, setPreview }) {
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);
  const [picked, setPicked] = useState("adjust");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    api.scenarios().then((r) => { setPlan(r); setError(null); })
      .catch((e) => setError(e.message));
  }, []);

  // Feed the 3D scene a "what would happen" flow speed while previewing.
  useEffect(() => {
    if (!plan) return;
    const sc = plan.scenarios.find((s) => s.id === picked);
    setPreview?.(sc ? (sc.throughput > 0 ? 1.5 : sc.throughput < -10 ? 0.3 : 0.8) : null);
    return () => setPreview?.(null);
  }, [picked, plan, setPreview]);

  if (error) {
    return (
      <div className="page">
        <PageHead title="Nothing to rehearse yet" />
      <p className="lead">{error}</p>
        <button className="btn primary" onClick={() => go("inference")}>Collect evidence →</button>
      </div>
    );
  }
  if (!plan) return <div className="page"><PageHead title="Running the options…" /></div>;

  const sc = plan.scenarios.find((s) => s.id === picked);
  const rec = plan.scenarios.find((s) => s.id === plan.recommended);

  const send = async (verdict) => {
    await api.decide(picked, verdict);
    setSent(true);
    setTimeout(() => go("learn"), 700);
  };

  return (
    <div className="page">
      <PageHead title="What should we do?" />

      <div className="grid g4">
        {plan.scenarios.map((s, i) => {
          const best = s.id === plan.recommended;
          const on = s.id === picked;
          const drop = s.risk_before - s.risk_after;
          return (
            <motion.div key={s.id}
              className={`scenario ${on ? "on" : ""} ${best ? "star" : ""}`}
              onClick={() => setPicked(s.id)}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}>
              <div className="spread">
                <span className="mono small muted">0{i + 1}</span>
                {best && <span className="chip vio">★ Best</span>}
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, marginTop: 10 }}>{s.name}</div>

              <div style={{ marginTop: 16 }}>
                <div className="eyebrow">Defect risk</div>
                <div className="row" style={{ gap: 8, marginTop: 7 }}>
                  <span className="mono muted" style={{ fontSize: 14,
                    textDecoration: "line-through" }}>{s.risk_before}%</span>
                  <span className="muted">→</span>
                  <motion.span className="mono" style={{ fontSize: 22, fontWeight: 600,
                    color: drop > 0 ? "var(--ok)" : "var(--crit)" }}
                    key={s.risk_after} initial={{ scale: 1.25 }} animate={{ scale: 1 }}>
                    {s.risk_after}%
                  </motion.span>
                </div>
              </div>

              <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                {[["Vehicles at risk", s.vehicles], ["Downtime", s.downtime],
                  ["Throughput", `${s.throughput > 0 ? "+" : ""}${s.throughput}%`]].map(([k, v]) => (
                  <div key={k} className="spread small" style={{ padding: "4px 0" }}>
                    <span className="muted">{k}</span>
                    <span className="mono">{v}</span>
                  </div>
                ))}
              </div>
              <p className="small muted" style={{ margin: "14px 0 0", lineHeight: 1.5 }}>{s.note}</p>
            </motion.div>
          );
        })}
      </div>

      {/* -------------------------------------------------- queue preview -- */}
      <Card className="pad0" delay={0.35} style={{ marginTop: 18 }}>
        <div className="card-head">
          <span className="eyebrow">Predicted queue behind Station 17 — {sc.name}</span>
          <span className="mono small muted">{plan.shift_pattern}</span>
        </div>
        <div style={{ padding: "26px 18px", display: "flex", alignItems: "flex-end",
                      gap: 6, height: 130 }}>
          {Array.from({ length: 18 }).map((_, i) => {
            const grow = sc.throughput < -10 ? 1 : sc.throughput > 0 ? -1 : -0.35;
            const h = Math.max(8, 34 + grow * i * (grow > 0 ? 3.4 : 1.6));
            return (
              <motion.div key={i}
                style={{ flex: 1, borderRadius: 5,
                  background: grow > 0 ? "var(--crit)" : "var(--ok)", opacity: 0.28 + i * 0.04 }}
                animate={{ height: Math.max(8, Math.min(96, h)) }}
                transition={{ type: "spring", stiffness: 150, damping: 18, delay: i * 0.025 }} />
            );
          })}
        </div>
        <div className="spread small muted" style={{ padding: "0 18px 16px" }}>
          <span>now</span>
          <span>{sc.throughput < -10 ? "queue keeps growing" : "queue drains"}</span>
          <span>end of shift</span>
        </div>
      </Card>

      {/* ----------------------------------------------- recommendation --- */}
      <Card delay={0.45} style={{ marginTop: 18, borderColor: "rgba(124,92,255,.45)" }}>
        <div className="grid" style={{ gridTemplateColumns: "1.3fr 1fr", gap: 24 }}>
          <div>
            <span className="chip vio">★ Recommended</span>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 12 }}>{rec.name}</div>
            <div style={{ marginTop: 14 }}>
              {plan.why.map((w, i) => (
                <motion.div key={w} className="row" style={{ gap: 10, padding: "5px 0" }}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.07 }}>
                  <Tick /><span className="small">{w}</span>
                </motion.div>
              ))}
            </div>
            <p className="small" style={{ marginTop: 16, paddingLeft: 13,
              borderLeft: "2px solid var(--violet)", color: "var(--text-2)", lineHeight: 1.6 }}>
              {plan.timing} Stopping now would cut risk further, but 15 minutes of certain line stop
              costs more today than the defects it would prevent.
            </p>
          </div>

          <div>
            <div className="eyebrow">Human decision required</div>
            <p className="small muted" style={{ margin: "9px 0 18px", lineHeight: 1.6 }}>
              The twin never writes to the line. It reads, reasons and recommends — a person
              always makes the call.
            </p>
            <div className="grid g2" style={{ gap: 12, marginBottom: 12 }}>
              <Metric label="Applying" value={sc.name === rec.name ? "Recommended" : "Your pick"} />
              <Metric label="Risk after" value={`${sc.risk_after}%`}
                tone={sc.risk_after < 40 ? "ok" : "crit"} />
            </div>

            <AnimatePresence mode="wait">
              {sent ? (
                <motion.div key="sent" className="chip ok" style={{ width: "100%",
                  justifyContent: "center", padding: 14 }}
                  initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                  Approved — applying on the twin…
                </motion.div>
              ) : (
                <motion.div key="btns" className="stack" style={{ gap: 9 }} exit={{ opacity: 0 }}>
                  <button className="btn ok wide" onClick={() => send("approved")}>
                    ✓ Approve “{sc.name}”
                  </button>
                  <div className="row" style={{ gap: 9 }}>
                    <button className="btn" style={{ flex: 1 }} onClick={() => send("modified")}>
                      Modify
                    </button>
                    <button className="btn danger" style={{ flex: 1 }} onClick={() => send("rejected")}>
                      ✕ Reject
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </Card>
    </div>
  );
}
