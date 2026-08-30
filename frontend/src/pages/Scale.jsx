import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../api.js";
import { Card, PageHead } from "../components/bits.jsx";

/**
 * The business case. One twin, three factories with very different
 * instrumentation - shown as a branch diagram, then the numbers each
 * stakeholder actually cares about.
 */
export default function Scale({ role, setRole }) {
  const [plants, setPlants] = useState([]);
  const [sel, setSel] = useState("A");
  useEffect(() => { api.plants().then((r) => setPlants(r.plants)).catch(() => {}); }, []);

  const current = plants.find((p) => p.id === sel);

  return (
    <div className="page">
      <PageHead title="Scale" />

      {/* ------------------------------------------------------ branch map -- */}
      <Card className="pad0">
        <div style={{ padding: "10px 10px 0" }}>
          <svg viewBox="0 0 760 190" style={{ width: "100%", height: 190 }}>
            <defs>
              <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7C5CFF" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#7C5CFF" stopOpacity="0.25" />
              </linearGradient>
            </defs>

            {/* hub */}
            <motion.g initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
              <rect x="278" y="14" width="204" height="46" rx="12"
                fill="#1C2133" stroke="#7C5CFF" strokeWidth="1.5" />
              <text x="380" y="43" textAnchor="middle" fill="#EEF1F8"
                style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em" }}>
                DIGITALTWIN.AI
              </text>
            </motion.g>

            {[150, 380, 610].map((x, i) => {
              const p = plants[i];
              const on = p && p.id === sel;
              return (
                <g key={x}>
                  <motion.path
                    d={`M380,60 C380,100 ${x},90 ${x},124`}
                    fill="none" stroke={on ? "url(#beam)" : "#333B54"} strokeWidth={on ? 2.5 : 1.5}
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                    transition={{ duration: 0.7, delay: 0.2 + i * 0.12 }} />
                  {on && (
                    <motion.circle r="4" fill="#7C5CFF"
                      animate={{ cx: [380, x], cy: [60, 124], opacity: [0, 1, 0] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }} />
                  )}
                  {p && (
                    <motion.g style={{ cursor: "pointer" }} onClick={() => setSel(p.id)}
                      initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5 + i * 0.12, type: "spring", stiffness: 200 }}>
                      <rect x={x - 88} y="124" width="176" height="50" rx="12"
                        fill={on ? "#1C2133" : "#161A28"}
                        stroke={on ? "#7C5CFF" : "#262C40"} strokeWidth={on ? 2 : 1} />
                      <text x={x - 72} y="147" fill="#EEF1F8"
                        style={{ fontSize: 12.5, fontWeight: 600 }}>{p.name}</text>
                      <text x={x - 72} y="163" fill="#5F6883" style={{ fontSize: 10 }}>
                        {p.city} · {p.age}
                      </text>
                      <text x={x + 72} y="156" textAnchor="end"
                        fill={p.coverage > 80 ? "#34D399" : p.coverage > 60 ? "#FBBF24" : "#FB5D5D"}
                        style={{ fontSize: 19, fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>
                        {p.coverage}%
                      </text>
                    </motion.g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </Card>

      {/* ------------------------------------------------------ plant cards -- */}
      <div className="grid g3" style={{ marginTop: 16 }}>
        {plants.map((p, i) => {
          const measured = p.coverage;
          const inferred = p.shadow_pct;
          const manual = Math.max(0, 100 - measured - inferred);
          return (
            <motion.div key={p.id} className={`plant-card ${p.id === sel ? "on" : ""}`}
              onClick={() => setSel(p.id)}
              initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.09, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -4 }}>
              <div className="row" style={{ gap: 18, position: "relative" }}>
                <Ring value={p.coverage} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>{p.name}</div>
                  <div className="small muted" style={{ marginTop: 3 }}>{p.city}</div>
                  <div className="row" style={{ gap: 14, marginTop: 12 }}>
                    <div className="stack">
                      <span className="mono" style={{ fontSize: 14 }}>{p.lines}</span>
                      <span className="eyebrow" style={{ fontSize: 9 }}>lines</span>
                    </div>
                    <div className="stack">
                      <span className="mono" style={{ fontSize: 14 }}>{p.stations}</span>
                      <span className="eyebrow" style={{ fontSize: 9 }}>stations</span>
                    </div>
                    <div className="stack">
                      <span className="mono" style={{ fontSize: 14 }}>{p.age}</span>
                      <span className="eyebrow" style={{ fontSize: 9 }}>age</span>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 18 }}>
                <div className="split">
                  <motion.i style={{ background: "var(--ok)" }}
                    initial={{ width: 0 }} animate={{ width: `${measured}%` }}
                    transition={{ delay: 0.2 + i * 0.09, type: "spring", stiffness: 90 }} />
                  <motion.i style={{ background: "var(--violet)" }}
                    initial={{ width: 0 }} animate={{ width: `${inferred}%` }}
                    transition={{ delay: 0.3 + i * 0.09, type: "spring", stiffness: 90 }} />
                  <motion.i style={{ background: "var(--line-2)" }}
                    initial={{ width: 0 }} animate={{ width: `${manual}%` }}
                    transition={{ delay: 0.4 + i * 0.09, type: "spring", stiffness: 90 }} />
                </div>
                <div className="row" style={{ gap: 12, marginTop: 9 }}>
                  <span className="key"><i className="dot" style={{ background: "var(--ok)" }} />measured</span>
                  <span className="key"><i className="dot" style={{ background: "var(--violet)" }} />inferred</span>
                  <span className="key"><i className="dot" style={{ background: "var(--line-2)" }} />manual</span>
                </div>
              </div>

              <p className="small muted" style={{ margin: "14px 0 0", lineHeight: 1.55 }}>{p.note}</p>
            </motion.div>
          );
        })}
      </div>

      {/* -------------------------------------------------------- role view -- */}
      <div className="spread" style={{ marginTop: 22, marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
        <div className="seg">
          {[["supervisor", "Floor supervisor"], ["manager", "Plant manager"],
            ["leadership", "Leadership"]].map(([k, v]) => (
            <button key={k} className={role === k ? "on" : ""} onClick={() => setRole(k)}>{v}</button>
          ))}
        </div>
        <span className="chip vio">{current ? current.name : "—"} · same twin, different view</span>
      </div>

      <motion.div key={role + sel} className="grid g4"
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {roleTiles(role, current).map((t, i) => (
          <motion.div key={t[0]} className="tile"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}>
            <div className="eyebrow">{t[0]}</div>
            <div className="mono" style={{
              fontSize: 26, fontWeight: 600, marginTop: 8, letterSpacing: "-0.03em",
              color: t[3] ? `var(--${t[3]})` : undefined,
            }}>{t[1]}</div>
            <div className="small muted" style={{ marginTop: 6 }}>{t[2]}</div>
          </motion.div>
        ))}
      </motion.div>

      <Card delay={0.3} style={{ marginTop: 18, textAlign: "center", padding: 32 }}>
        <p style={{ margin: "0 auto", fontSize: 17, fontWeight: 500, maxWidth: 680, lineHeight: 1.65 }}>
          Plant C runs at half the instrumentation of Plant A. The twin traces the same problem to
          the same cause — it just leans harder on inference to get there.
        </p>
        <div className="row" style={{ justifyContent: "center", gap: 8, marginTop: 24, flexWrap: "wrap" }}>
          {["Collect", "Mirror", "Infer", "Reason", "Rehearse", "Decide", "Learn"].map((s, i, a) => (
            <React.Fragment key={s}>
              <motion.span className="chip vio"
                animate={{ opacity: [0.45, 1, 0.45] }}
                transition={{ duration: 3.4, repeat: Infinity, delay: i * 0.45 }}>{s}</motion.span>
              {i < a.length - 1 && <span className="muted">→</span>}
            </React.Fragment>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Ring({ value }) {
  const R = 40, C = 2 * Math.PI * R;
  const col = value > 80 ? "#34D399" : value > 60 ? "#FBBF24" : "#FB5D5D";
  return (
    <div className="ring-wrap">
      <svg viewBox="0 0 96 96" style={{ width: 96, height: 96, transform: "rotate(-90deg)" }}>
        <circle cx="48" cy="48" r={R} fill="none" stroke="#262C40" strokeWidth="7" />
        <motion.circle cx="48" cy="48" r={R} fill="none" stroke={col} strokeWidth="7"
          strokeLinecap="round" strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C - (value / 100) * C }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} />
      </svg>
      <span style={{ color: col }}>{value}%</span>
    </div>
  );
}

function roleTiles(role, p) {
  if (role === "supervisor") return [
    ["Right now", "Station 17", "machine wear, 61% likely", "crit"],
    ["Do this", "Adjust", "no downtime, reversible", "ok"],
    ["Then book", "18:00", "bearing service, 15 min", "warn"],
    ["Line status", "3 alerts", "across 68 stations", null],
  ];
  if (role === "manager") return [
    ["Weekly output", "8,412", "units, +3% week on week", "ok"],
    ["Downtime", "182 min", "−31% vs baseline", "ok"],
    ["Defects / 100", "1.7", "was 3.1", "ok"],
    ["Repeat offenders", "S17, S04", "7 and 4 events", "warn"],
  ];
  return [
    ["Annual benefit", "₹14.2 Cr", "modelled across 6 lines", "violet"],
    ["Payback", "7.5 mo", "including retrofit sensing", null],
    ["Downtime", "−31%", "vs 12-month baseline", "ok"],
    ["Next rollout", p ? p.name : "—", p ? `${p.stations} stations` : "", null],
  ];
}
