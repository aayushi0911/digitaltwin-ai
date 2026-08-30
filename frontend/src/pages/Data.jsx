import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api, clock } from "../api.js";
import { Bar, Card, PageHead, item, stagger } from "../components/bits.jsx";

/** Where the twin's picture comes from — shown as a living pipeline, not a form. */
export default function Data({ snap }) {
  const [sources, setSources] = useState([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    api.sources().then((r) => { setSources(r.sources); setNote(r.note); }).catch(() => {});
  }, []);

  // The sensing mix is counted from the live plant, not hardcoded.
  const all = snap.lines.flatMap((l) => l.stations);
  const total = all.length;
  const mix = {
    full: all.filter((s) => s.sensing === "full").length,
    shadow: all.filter((s) => s.sensing === "shadow").length,
    manual: all.filter((s) => s.sensing === "manual").length,
  };

  return (
    <div className="page">
      <PageHead title="What the twin can see" />

      <div className="grid" style={{ gridTemplateColumns: "1.2fr 1fr", gap: 18 }}>
        <Card className="pad0">
          <div className="card-head">
            <span className="eyebrow">Ingest pipeline</span>
            <span className="chip ok">
              <span className="dot" style={{ background: "var(--ok)" }} /> Streaming
            </span>
          </div>

          <div style={{ padding: 18, position: "relative" }}>
            <motion.div variants={stagger} initial="hidden" animate="show">
              {sources.map((s, i) => (
                <motion.div key={s.id} variants={item}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 0" }}>
                  {/* animated feed line */}
                  <div style={{ position: "relative", width: 56, height: 2, background: "var(--line)",
                                borderRadius: 2, flexShrink: 0, overflow: "hidden" }}>
                    <motion.div
                      style={{ position: "absolute", width: 16, height: "100%",
                               background: "var(--violet)", borderRadius: 2 }}
                      animate={{ x: [-16, 56] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: "linear", delay: i * 0.22 }}
                    />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="spread">
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</span>
                      <span className="mono small muted">{s.coverage}%</span>
                    </div>
                    <div className="small muted" style={{ marginTop: 3 }}>{s.detail}</div>
                    <div style={{ marginTop: 7 }}>
                      <Bar value={s.coverage} tone={s.coverage === 100 ? "ok" : "violet"} />
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </Card>

        <div className="stack" style={{ gap: 18 }}>
          <Card delay={0.1}>
            <div className="eyebrow">Simulation clock</div>
            <div className="mono" style={{ fontSize: 34, fontWeight: 500, marginTop: 10,
                                           letterSpacing: "-0.03em" }}>
              {clock(snap.clock.seconds)}
            </div>
            <div className="muted small" style={{ marginTop: 6 }}>
              {snap.clock.day} · Shift {snap.clock.shift}
            </div>
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
              <div className="spread small">
                <span className="muted">Line running</span>
                <span className="mono">24 h / day, 6 days</span>
              </div>
              <div className="spread small" style={{ marginTop: 8 }}>
                <span className="muted">Service windows</span>
                <span className="mono">18:00 · Sunday</span>
              </div>
            </div>
          </Card>

          <Card delay={0.18}>
            <div className="eyebrow">Sensing mix — {total} stations</div>
            <div style={{ marginTop: 16 }}>
              {[
                ["Fully instrumented", mix.full, "ok"],
                ["Shadow sensed", mix.shadow, "violet"],
                ["Manual checklist", mix.manual, "warn"],
              ].map(([label, n, tone], i) => (
                <motion.div key={label}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + i * 0.08 }}
                  style={{ marginBottom: 14 }}>
                  <div className="spread small" style={{ marginBottom: 6 }}>
                    <span>{label}</span><span className="mono muted">{n}</span>
                  </div>
                  <Bar value={(n / total) * 100} tone={tone} />
                </motion.div>
              ))}
            </div>
            <p className="small muted" style={{ margin: "4px 0 0", lineHeight: 1.55 }}>
              {note}
            </p>
          </Card>
        </div>
      </div>

      <Card className="pad0" delay={0.26} style={{ marginTop: 18 }}>
        <div className="card-head"><span className="eyebrow">Live events</span></div>
        <div className="scroll" style={{ maxHeight: 200 }}>
          {snap.events.map((e, i) => (
            <motion.div key={`${e.t}-${i}`} className={`evt ${e.kind}`}
              initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}>
              <time>{clock(e.t)}</time><i /><p>{e.text}</p>
            </motion.div>
          ))}
        </div>
      </Card>
    </div>
  );
}
