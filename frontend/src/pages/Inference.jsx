import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api, clock } from "../api.js";
import { Bar, Card, Chip, Metric, PageHead } from "../components/bits.jsx";

/** What is happening — detection, plus the evidence loop when confidence is low. */
export default function Inference({ snap, go }) {
  const [ev, setEv] = useState(null);
  const [last, setLast] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = () => api.evidence().then(setEv).catch(() => {});
  useEffect(() => { load(); }, [snap.sim.phase, snap.confidence]);

  const take = async (id) => {
    setBusy(id);
    try {
      const r = await api.collect(id);
      setLast(r.finding);
      await load();
    } finally { setBusy(null); }
  };

  const m = snap.metrics;
  const calm = snap.sim.phase === "calm" || snap.sim.phase === "rising";
  const low = snap.confidence < snap.threshold;

  if (calm) {
    return (
      <div className="page">
        <PageHead title="Nothing to investigate yet" />
        <p className="lead">Press <b>Trigger scenario</b> to watch a problem build at Station 17.</p>
        <Card>
          <div className="row" style={{ gap: 12 }}>
            <span className="dot" style={{ background: "var(--ok)" }} />
            <span className="small muted">
              Watching 42 stations · cycle {m.cycle_time}s · defect risk {m.defect_risk}%
            </span>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHead title="Something is building at Station 17" />

      <div className="grid g4" style={{ marginBottom: 18 }}>
        {[
          { label: "Cycle time", value: m.cycle_time, unit: "s", sub: `target ${m.target}s`, tone: "crit" },
          { label: "Defect risk", value: `${m.defect_risk}%`, sub: "rising", tone: "crit" },
          { label: "Bottleneck risk", value: `${m.bottleneck_risk}%`, sub: `${m.queue} waiting`, tone: "warn" },
          { label: "Confidence", value: `${snap.confidence}%`,
            sub: low ? `under the ${snap.threshold}% bar` : "clear to reason",
            tone: low ? "warn" : "ok" },
        ].map((x, i) => (
          <Card key={x.label} delay={i * 0.06}
            style={x.label === "Confidence"
              ? { borderColor: low ? "rgba(251,191,36,.45)" : "rgba(52,211,153,.45)" } : undefined}>
            <Metric {...x} />
            {x.label === "Confidence" && (
              <div style={{ marginTop: 12 }}>
                <Bar value={snap.confidence} tone={low ? "warn" : "ok"} />
              </div>
            )}
          </Card>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.35fr 1fr", gap: 18 }}>
        {/* -------------------------------------------------- evidence loop -- */}
        <Card className="pad0" delay={0.2}
          style={{ borderColor: low ? "rgba(251,191,36,.4)" : undefined }}>
          <div className="card-head" style={{ background: low ? "var(--warn-soft)" : "var(--ok-soft)" }}>
            <span className="eyebrow" style={{ color: low ? "var(--warn)" : "var(--ok)" }}>
              {low ? "More evidence needed" : "Enough to reason with"}
            </span>
            <span className="mono small">{snap.confidence}% confident</span>
          </div>

          <div style={{ padding: 18 }}>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
              {low
                ? "I can see the deviation clearly, but this station runs on only 20% sensor coverage. Rather than guess at a cause, tell me what to go and check."
                : "Confidence is above the bar. I can rank the causes now, or keep gathering if you want more certainty."}
            </p>

            <div className="eyebrow" style={{ marginTop: 22, marginBottom: 10 }}>
              Pick what to check
            </div>
            <div className="stack" style={{ gap: 9 }}>
              {(ev?.options ?? []).map((o, i) => (
                <motion.button key={o.id}
                  className={`opt ${o.taken ? "done" : ""}`}
                  onClick={() => take(o.id)} disabled={o.taken || busy === o.id}
                  initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + i * 0.06 }}
                  whileTap={o.taken ? undefined : { scale: 0.98 }}>
                  <span style={{ fontSize: 17, width: 24, textAlign: "center" }}>
                    {o.icon === "camera" ? "📷" : o.icon === "wrench" ? "🔧"
                      : o.icon === "chart" ? "📊" : "🧑‍🏭"}
                  </span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{o.label}</span>
                  <span className="mono" style={{ fontSize: 11,
                    color: o.taken ? "var(--ok)" : "var(--text-3)" }}>
                    {busy === o.id ? "…" : o.taken ? "done" : `+${o.gain}%`}
                  </span>
                </motion.button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {last && (
                <motion.div key={last.id}
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: "auto", marginTop: 18 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  style={{ overflow: "hidden" }}>
                  <div style={{ padding: 15, borderRadius: 12, background: "var(--panel-2)",
                                border: "1px solid var(--line-2)" }}>
                    <div className="spread">
                      <span className="eyebrow">Came back with</span>
                      <motion.span className="chip ok"
                        initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
                        {last.confidence_before}% → {last.confidence_after}%
                      </motion.span>
                    </div>
                    <p style={{ margin: "11px 0 0", fontSize: 13, lineHeight: 1.55 }}>{last.result}</p>
                    <p style={{ margin: "7px 0 0", fontSize: 13, fontWeight: 600,
                                color: "var(--violet)" }}>{last.verdict}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button className="btn primary wide" style={{ marginTop: 18 }}
              disabled={low} onClick={() => go("reason")}
              animate={low ? {} : { scale: [1, 1.02, 1] }}
              transition={{ duration: 1.6, repeat: low ? 0 : Infinity }}>
              {low ? `Locked until ${snap.threshold}% confident` : "Find the root cause →"}
            </motion.button>
            {low && (
              <p className="small muted" style={{ margin: "10px 0 0", textAlign: "center" }}>
                The API refuses this too, not just the button.
              </p>
            )}
          </div>
        </Card>

        {/* ------------------------------------------------------ live feed -- */}
        <div className="stack" style={{ gap: 18 }}>
          <Card className="pad0" delay={0.3}>
            <div className="card-head"><span className="eyebrow">Cycle time drift</span></div>
            <div style={{ padding: "18px 18px 12px" }}>
              <Sparkline data={snap.trend} target={m.target} />
              <div className="spread small muted" style={{ marginTop: 10 }}>
                <span>30 min ago</span><span>now</span>
              </div>
            </div>
          </Card>

          <Card className="pad0" delay={0.38}>
            <div className="card-head">
              <span className="eyebrow">Live events</span>
              <span className="dot" style={{ background: "var(--ok)" }} />
            </div>
            <div className="scroll" style={{ maxHeight: 232 }}>
              {snap.events.map((e, i) => (
                <motion.div key={`${e.t}-${i}`} className={`evt ${e.kind}`}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                  <time>{clock(e.t)}</time><i /><p>{e.text}</p>
                </motion.div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Tiny inline chart. No chart library needed for one line. */
function Sparkline({ data, target }) {
  const W = 320, H = 96;
  if (!data || data.length < 2) return <div style={{ height: H }} />;
  const ys = data.map((d) => d.cycle);
  const lo = Math.min(...ys, target) - 3, hi = Math.max(...ys, target) + 3;
  const px = (i) => (i / (data.length - 1)) * W;
  const py = (v) => H - ((v - lo) / (hi - lo)) * H;
  const path = data.map((d, i) => `${i ? "L" : "M"}${px(i).toFixed(1)},${py(d.cycle).toFixed(1)}`).join(" ");
  const area = `${path} L${W},${H} L0,${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, overflow: "visible" }}>
      <defs>
        <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7C5CFF" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#7C5CFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" y1={py(target)} x2={W} y2={py(target)}
        stroke="#5F6883" strokeDasharray="4 4" strokeWidth="1" />
      <text x="2" y={py(target) - 5} fill="#5F6883"
        style={{ fontSize: 9, fontFamily: "JetBrains Mono, monospace" }}>
        target {target}s
      </text>
      <path d={area} fill="url(#fade)" />
      <motion.path d={path} fill="none" stroke="#7C5CFF" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8 }} />
      <motion.circle cx={px(data.length - 1)} cy={py(ys[ys.length - 1])} r="4" fill="#FB5D5D"
        animate={{ r: [4, 6, 4], opacity: [1, 0.6, 1] }}
        transition={{ duration: 1.6, repeat: Infinity }} />
    </svg>
  );
}
