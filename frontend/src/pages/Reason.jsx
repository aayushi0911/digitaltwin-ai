import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../api.js";
import { Bar, Card, PageHead, Tick, Cross } from "../components/bits.jsx";

/**
 * The cause map. Branches draw themselves outward from Station 17, then the
 * nodes pop in. Clicking a branch opens the evidence for and against it.
 */
export default function Reason({ snap, go }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState("machine");

  useEffect(() => {
    api.causes().then((r) => { setData(r); setError(null); })
      .catch((e) => setError(e.message));
  }, [snap.confidence]);

  if (error) {
    return (
      <div className="page">
        <PageHead title="Not ready to blame anything yet" />
      <p className="lead">{error}</p>
        <button className="btn primary" onClick={() => go("inference")}>
          Go collect evidence →
        </button>
      </div>
    );
  }
  if (!data) return <div className="page"><PageHead title="Working it out…" /></div>;

  const cur = data.causes.find((c) => c.id === open) ?? data.causes[0];

  // Four branches: up, left, right, down.
  const CX = 300, CY = 190, R = 132;
  const layout = [
    { id: "machine",     ax: CX,       ay: CY - R, anchor: "center" },
    { id: "part",        ax: CX - R - 24, ay: CY,  anchor: "end" },
    { id: "operator",    ax: CX + R + 24, ay: CY,  anchor: "start" },
    { id: "environment", ax: CX,       ay: CY + R, anchor: "center" },
  ];

  return (
    <div className="page">
      <PageHead title="Why is it happening?" />

      <div className="grid" style={{ gridTemplateColumns: "1.15fr 1fr", gap: 18 }}>
        {/* ------------------------------------------------------- the map -- */}
        <Card className="pad0">
          <div className="card-head">
            <span className="eyebrow">Cause map</span>
            <span className="chip vio">{data.confidence}% confident</span>
          </div>
          <div style={{ padding: 10 }}>
            <svg viewBox="0 0 600 380" style={{ width: "100%", height: 380 }}>
              {/* branches draw outward */}
              {layout.map((l, i) => {
                const c = data.causes.find((x) => x.id === l.id);
                const on = open === l.id;
                return (
                  <motion.line key={l.id}
                    x1={CX} y1={CY} x2={l.ax} y2={l.ay}
                    stroke={on ? "#7C5CFF" : "#333B54"}
                    strokeWidth={on ? 2.5 : 1.5}
                    strokeDasharray={c.verdict === "rejected" ? "5 5" : undefined}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.25 + i * 0.13, ease: "easeOut" }}
                  />
                );
              })}

              {/* travelling pulse along the open branch */}
              {layout.filter((l) => l.id === open).map((l) => (
                <motion.circle key={`p-${l.id}`} r="4" fill="#7C5CFF"
                  animate={{ cx: [CX, l.ax], cy: [CY, l.ay], opacity: [0, 1, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }} />
              ))}

              {/* centre node */}
              <motion.g initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 18 }}
                style={{ transformOrigin: `${CX}px ${CY}px` }}>
                <motion.circle cx={CX} cy={CY} r="58" fill="rgba(251,93,93,.09)"
                  animate={{ r: [58, 66, 58] }} transition={{ duration: 2.4, repeat: Infinity }} />
                <circle cx={CX} cy={CY} r="46" fill="#161A28" stroke="#FB5D5D" strokeWidth="2" />
                <text x={CX} y={CY - 8} textAnchor="middle" fill="#EEF1F8"
                  style={{ fontSize: 13, fontWeight: 700 }}>STATION 17</text>
                <text x={CX} y={CY + 12} textAnchor="middle" fill="#FB5D5D"
                  style={{ fontSize: 17, fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>
                  {snap.metrics.defect_risk}%
                </text>
                <text x={CX} y={CY + 27} textAnchor="middle" fill="#5F6883"
                  style={{ fontSize: 9, letterSpacing: "0.1em" }}>DEFECT RISK</text>
              </motion.g>

              {/* cause nodes */}
              {layout.map((l, i) => {
                const c = data.causes.find((x) => x.id === l.id);
                const on = open === l.id;
                const rejected = c.verdict === "rejected";
                const w = 152, h = 58;
                const bx = l.anchor === "end" ? l.ax - w : l.anchor === "start" ? l.ax : l.ax - w / 2;
                const by = l.ay - h / 2;
                return (
                  <motion.g key={l.id} style={{ cursor: "pointer" }} onClick={() => setOpen(l.id)}
                    initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 220, damping: 20, delay: 0.6 + i * 0.13 }}>
                    <rect x={bx} y={by} width={w} height={h} rx="12"
                      fill={on ? "#1C2133" : "#161A28"}
                      stroke={on ? "#7C5CFF" : rejected ? "#333B54" : "#3E4664"}
                      strokeWidth={on ? 2 : 1}
                      opacity={rejected && !on ? 0.55 : 1} />
                    <text x={bx + 14} y={by + 23} fill={rejected && !on ? "#5F6883" : "#EEF1F8"}
                      style={{ fontSize: 11.5, fontWeight: 600 }}>{c.name}</text>
                    <text x={bx + 14} y={by + 44}
                      fill={rejected ? "#5F6883" : "#34D399"}
                      style={{ fontSize: 18, fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>
                      {c.value}%
                    </text>
                    <text x={bx + w - 14} y={by + 44} textAnchor="end"
                      fill={rejected ? "#5F6883" : "#34D399"} style={{ fontSize: 9.5 }}>
                      {rejected ? "ruled out" : "supported"}
                    </text>
                  </motion.g>
                );
              })}
            </svg>
          </div>
        </Card>

        {/* ------------------------------------------------- evidence panel -- */}
        <Card className="pad0">
          <div className="card-head">
            <span className="eyebrow">Evidence — {cur.name}</span>
            <span className={`chip ${cur.verdict === "supported" ? "ok" : "crit"}`}>
              {cur.verdict === "supported" ? "Supported" : "Ruled out"}
            </span>
          </div>
          <div style={{ padding: 18 }}>
            <div className="spread" style={{ marginBottom: 6 }}>
              <span className="small muted">Probability</span>
              <span className="mono" style={{ fontSize: 22, fontWeight: 500 }}>{cur.value}%</span>
            </div>
            <Bar value={cur.value} tone={cur.verdict === "supported" ? "ok" : "line-2"} />

            <AnimatePresence mode="wait">
              <motion.div key={cur.id}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28 }} style={{ marginTop: 22 }}>

                {cur.for.length > 0 && (
                  <>
                    <div className="eyebrow" style={{ marginBottom: 10 }}>Points toward it</div>
                    {cur.for.map((f, i) => (
                      <motion.div key={f} className="row" style={{ gap: 10, padding: "7px 0" }}
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06 }}>
                        <Tick /><span className="small">{f}</span>
                      </motion.div>
                    ))}
                  </>
                )}

                {cur.against.length > 0 && (
                  <>
                    <div className="eyebrow" style={{ margin: "20px 0 10px" }}>Points against it</div>
                    {cur.against.map((f, i) => (
                      <motion.div key={f} className="row" style={{ gap: 10, padding: "7px 0" }}
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06 }}>
                        <Cross /><span className="small muted">{f}</span>
                      </motion.div>
                    ))}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </Card>
      </div>

      <Card delay={0.5} style={{ marginTop: 18 }}>
        <div className="spread" style={{ flexWrap: "wrap", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 300 }}>
            <div className="eyebrow">Working conclusion</div>
            <p style={{ margin: "9px 0 0", fontSize: 14, lineHeight: 1.6 }}>
              <b>Machine wear</b> at Station 17, {data.causes[0].value}% likely. Part quality and
              environment are ruled out on evidence. The extra operator movement is real, but it
              started <i>after</i> the tool slowed — a symptom, not the cause.
            </p>
          </div>
          <button className="btn primary" onClick={() => go("rehearse")}>
            Test the options →
          </button>
        </div>
      </Card>
    </div>
  );
}
