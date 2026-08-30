import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../api.js";
import { Bar, Card, Metric, PageHead } from "../components/bits.jsx";

/** Prediction vs reality, then a human verdict that the twin keeps. */
export default function Learn({ snap, go }) {
  const [out, setOut] = useState(null);
  const [error, setError] = useState(null);
  const [learned, setLearned] = useState(null);

  useEffect(() => {
    api.outcome().then((r) => { setOut(r); setError(null); }).catch((e) => setError(e.message));
  }, [snap.sim.phase, snap.metrics.defect_risk]);

  const answer = async (correct) => setLearned(await api.feedback(correct));

  if (error) {
    return (
      <div className="page">
        <PageHead title="Nothing has been actioned yet" />
      <p className="lead">{error}</p>
        <button className="btn primary" onClick={() => go("rehearse")}>Go decide →</button>
      </div>
    );
  }
  if (!out) return <div className="page"><PageHead title="Waiting for the outcome…" /></div>;

  return (
    <div className="page">
      <PageHead title={out.settled ? "How did it actually go?" : "Applying on the twin…"} />

      <div className="grid g4">
        {[
          ["Defect risk", `${out.risk_after}%`, `was ${out.risk_before}%`, out.risk_after < 40 ? "ok" : "crit"],
          ["Cycle time", `${out.cycle_after}s`, "was 74s", "ok"],
          ["Predicted drop", `${out.predicted_drop}pts`, "twin's forecast", null],
          ["Actual drop", `${out.actual_drop}pts`, "what happened", "ok"],
        ].map(([l, v, s, t], i) => (
          <Card key={l} delay={i * 0.07}><Metric label={l} value={v} sub={s} tone={t} /></Card>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1.2fr", gap: 18, marginTop: 18 }}>
        <Card delay={0.3}>
          <div className="eyebrow">Prediction accuracy</div>
          <motion.div className="mono"
            style={{ fontSize: 52, fontWeight: 600, marginTop: 12, letterSpacing: "-0.04em",
                     color: "var(--ok)" }}
            initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 160, damping: 16 }}>
            {out.accuracy}%
          </motion.div>
          <div style={{ marginTop: 16 }}><Bar value={out.accuracy} tone="ok" /></div>
          <p className="small muted" style={{ marginTop: 16, lineHeight: 1.6 }}>
            The twin slightly over-promised — it predicted a {out.predicted_drop} point drop and
            got {out.actual_drop}. Close, not perfect, and it says so.
          </p>
          <p className="small" style={{ marginTop: 14, padding: 12, borderRadius: 10,
            background: "var(--warn-soft)", color: "var(--warn)", lineHeight: 1.55 }}>
            {out.residual}
          </p>
        </Card>

        <Card delay={0.38}>
          <AnimatePresence mode="wait">
            {!learned ? (
              <motion.div key="ask" exit={{ opacity: 0, y: -10 }}>
                <div className="eyebrow">Your verdict</div>
                <div style={{ fontSize: 19, fontWeight: 700, marginTop: 10 }}>
                  Was the recommendation right?
                </div>
                <p className="small muted" style={{ margin: "10px 0 22px", lineHeight: 1.6 }}>
                  Not the accuracy score — your answer. That is what the twin actually stores, and
                  it is how false alarms get caught before they cost trust on the floor.
                </p>
                <div className="row" style={{ gap: 11 }}>
                  <button className="btn ok" style={{ flex: 1 }} onClick={() => answer(true)}>
                    ✓ Yes, it helped
                  </button>
                  <button className="btn danger" style={{ flex: 1 }} onClick={() => answer(false)}>
                    ✕ No, it did not
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="learned"
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
                <div className="spread">
                  <span className="eyebrow">Model updated</span>
                  <span className="chip vio">Prototype learning</span>
                </div>
                <div className="row" style={{ gap: 12, marginTop: 16 }}>
                  <span className="mono muted" style={{ fontSize: 18,
                    textDecoration: "line-through" }}>{learned.accuracy_before}%</span>
                  <span className="muted">→</span>
                  <motion.span className="mono" style={{ fontSize: 34, fontWeight: 600,
                    color: "var(--ok)" }}
                    initial={{ scale: 1.3 }} animate={{ scale: 1 }}>
                    {learned.accuracy_after}%
                  </motion.span>
                  <span className="small muted">running accuracy</span>
                </div>
                <div style={{ marginTop: 20 }}>
                  {learned.learned.map((l, i) => (
                    <motion.div key={l} className="row" style={{ gap: 11, padding: "9px 0",
                      borderBottom: "1px solid var(--line)" }}
                      initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}>
                      <span className="tick">✓</span><span className="small">{l}</span>
                    </motion.div>
                  ))}
                </div>
                <button className="btn primary wide" style={{ marginTop: 20 }}
                  onClick={() => go("scale")}>
                  See it across plants →
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </div>

      {/* the loop, always running */}
      <Card delay={0.5} style={{ marginTop: 18 }}>
        <div className="eyebrow" style={{ marginBottom: 18 }}>The loop</div>
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          {["Predict", "Investigate", "Rehearse", "Decide", "Observe", "Learn"].map((s, i, a) => (
            <React.Fragment key={s}>
              <motion.div className="chip vio"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 3.2, repeat: Infinity, delay: i * 0.5 }}>
                {s}
              </motion.div>
              {i < a.length - 1 && <span className="muted">→</span>}
            </React.Fragment>
          ))}
          <span className="muted">↻</span>
        </div>
      </Card>
    </div>
  );
}
