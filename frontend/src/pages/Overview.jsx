import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * The landing view. A live 3D plant you can drill into:
 *   plant  -> every line, all clickable
 *   line   -> every station in that line, listed and on the floor
 *   station-> a card pinned to the 3D block
 *
 * The station strip is always rendered at line level, so there is never an
 * empty screen even while the camera is still moving.
 */
export default function Overview({ snap, factory, go }) {
  const [level, setLevel] = useState("plant");
  const [lineId, setLineId] = useState(null);
  const [picked, setPicked] = useState(null);
  const [cardPos, setCardPos] = useState(null);
  const posRef = useRef(null);
  const stripRef = useRef(null);

  const lines = snap.lines;
  const line = lines.find((l) => l.id === lineId) ?? null;
  const station = line?.stations.find((s) => s.code === picked) ?? null;
  const isFocus = picked === snap.focus;

  const openLine = (id) => {
    setLineId(id);
    setLevel("line");
    setPicked(null);
    factory?.setShadow(false);
    factory?.highlight(null);
    factory?.setMode("line", id);
  };

  const openStation = (code, ln) => {
    const id = ln ?? lineId;
    if (id && id !== lineId) setLineId(id);
    setPicked(code);
    setLevel("station");
    factory?.highlight(code);
    const s = lines.find((l) => l.id === id)?.stations.find((x) => x.code === code);
    factory?.setShadow(s?.sensing === "shadow", code);
    factory?.setMode("focus", id);
  };

  const back = () => {
    if (level === "station") {
      setPicked(null);
      setLevel("line");
      factory?.setShadow(false);
      factory?.highlight(null);
      factory?.setMode("line", lineId);
    } else {
      setLineId(null);
      setLevel("plant");
      factory?.setMode("plant");
    }
  };

  // 3D click handlers
  useEffect(() => {
    if (!factory) return;
    factory.onZone((id) => openLine(id));
    factory.onStation((hit) => openStation(hit.code, hit.zone));
  }, [factory, lineId, lines]);

  // keep the floating card glued to its block
  useEffect(() => {
    if (!factory || !picked) { setCardPos(null); posRef.current = null; return; }
    let raf;
    const loop = () => {
      const p = factory.screenPos(picked);
      if (p && (!posRef.current || Math.abs(p.x - posRef.current.x) > 0.5 ||
                Math.abs(p.y - posRef.current.y) > 0.5)) {
        posRef.current = p;
        setCardPos(p);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [factory, picked]);

  // scroll the strip to whatever is selected
  useEffect(() => {
    if (!picked || !stripRef.current) return;
    stripRef.current.querySelector(`[data-code="${picked}"]`)
      ?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [picked]);

  return (
    <>
      {/* ------------------------------------------------- plant: line cards -- */}
      <AnimatePresence>
        {level === "plant" && (
          <motion.div key="cards"
            initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }}
            style={{ position: "absolute", top: 20, left: 20, right: 20, display: "flex", gap: 12 }}>
            {lines.map((l, i) => (
              <motion.button key={l.id} onClick={() => openLine(l.id)}
                initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }} whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }}
                className="line-card" data-status={l.status}>
                <div className="spread">
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{l.name}</span>
                  <span className="dot" style={{
                    background: `var(--${tone(l.status)})`,
                    boxShadow: `0 0 10px var(--${tone(l.status)})`,
                  }} />
                </div>

                <div className="row" style={{ gap: 16, marginTop: 12 }}>
                  <Stat n={l.count} k="stations" />
                  <Stat n={`${l.coverage}%`} k="sensed" />
                  <Stat n={l.alerts} k="alerts" tone={l.alerts ? "crit" : undefined} />
                </div>

                {/* miniature of the line: one tick per station */}
                <div className="mini" style={{ marginTop: 14 }}>
                  {l.stations.map((s) => (
                    <i key={s.code} data-sensing={s.sensing}
                      style={{ background: `var(--${tone(s.status)})` }} />
                  ))}
                </div>

                <div className="open-cue">
                  {l.alerts ? `${l.alerts} need attention` : "All healthy"} →
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------ line: header -- */}
      <AnimatePresence>
        {level !== "plant" && line && (
          <motion.div key="head"
            initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
            style={{ position: "absolute", top: 20, left: 20, right: 20 }}>
            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <button className="btn sm" onClick={back}>← Back</button>
              <div className="line-title">
                <span style={{ fontSize: 15, fontWeight: 700 }}>{line.name}</span>
                <span className="muted small">{line.count} stations</span>
              </div>
              <span className="chip">{line.coverage}% measured</span>
              {line.shadow > 0 && <span className="chip vio">{line.shadow} shadow sensed</span>}
              {line.manual > 0 && <span className="chip warn">{line.manual} manual</span>}
              {line.alerts === 0 && <span className="chip ok">No alerts</span>}

              <span style={{ flex: 1 }} />
              <div className="row" style={{ gap: 6 }}>
                {lines.map((l) => (
                  <button key={l.id} onClick={() => openLine(l.id)}
                    className={`tab ${l.id === lineId ? "on" : ""}`}>
                    {l.name}
                    {l.alerts > 0 && <i className="tab-dot" />}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------ line: station strip -- */}
      <AnimatePresence>
        {level !== "plant" && line && (
          <motion.div key="strip"
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
            transition={{ type: "spring", stiffness: 200, damping: 26 }}
            className="strip-wrap">
            <div className="strip-head">
              <span className="eyebrow">Every station on this line</span>
              <div className="row" style={{ gap: 14 }}>
                <Key c="ok" t="Healthy" /><Key c="warn" t="Warning" /><Key c="crit" t="Critical" />
                <span className="key"><i className="ring" />Inferred</span>
              </div>
            </div>
            <div className="strip" ref={stripRef}>
              {line.stations.map((s, i) => (
                <motion.button key={s.code} data-code={s.code}
                  onClick={() => openStation(s.code, line.id)}
                  className={`cell ${picked === s.code ? "on" : ""}`}
                  data-status={s.status}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.012, 0.35) }}>
                  <span className="cell-code">{s.code}</span>
                  <span className="cell-dot" style={{ background: `var(--${tone(s.status)})` }} />
                  <span className="cell-name">{s.name}</span>
                  <span className="cell-cycle">{s.cycle}s</span>
                  <span className={`cell-sense ${s.sensing}`}>
                    {s.sensing === "full" ? "measured"
                      : s.sensing === "shadow" ? "inferred" : "manual"}
                  </span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --------------------------------------------------- station detail --- */}
      <AnimatePresence>
        {station && cardPos && (
          <motion.div key={station.code} className="float-card"
            initial={{ opacity: 0, scale: 0.9, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 12 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            style={{
              left: Math.max(16, Math.min(cardPos.x - 134, window.innerWidth - 520)),
              top: Math.max(84, Math.min(cardPos.y - 40, window.innerHeight - 400)),
            }}>
            <div className="spread">
              <div>
                <div className="eyebrow">{station.code}</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>{station.name}</div>
              </div>
              <span className={`chip ${tone(station.status)}`}>
                {station.status === "critical" ? "At risk"
                  : station.status === "warning" ? "Watch" : "Healthy"}
              </span>
            </div>

            <div className="grid g2" style={{ marginTop: 16, gap: 12 }}>
              <Big label="Cycle" value={`${station.cycle}s`} sub={`target ${snap.metrics.target}s`}
                tone={station.cycle > 68 ? "crit" : station.cycle > 62 ? "warn" : null} />
              {isFocus
                ? <Big label="Defect risk" value={`${snap.metrics.defect_risk}%`}
                    sub="rising" tone={snap.metrics.defect_risk > 55 ? "crit" : "warn"} />
                : <Big label="Measured" value={`${station.coverage}%`}
                    sub={station.sensing === "full" ? "direct sensors" : "partial"} />}
            </div>

            {station.sensing !== "full" && (
              <div className="shadow-note">
                <div className="row" style={{ gap: 8 }}>
                  <span className="ring" />
                  <span className="mono" style={{ fontSize: 10.5, color: "var(--violet)" }}>
                    {station.sensing === "shadow" ? "SHADOW SENSOR" : "MANUAL CHECKS ONLY"}
                  </span>
                </div>
                <p className="small muted" style={{ margin: "8px 0 0", lineHeight: 1.5 }}>
                  {station.sensing === "shadow"
                    ? `Only ${station.coverage}% instrumented. Health is estimated from the camera, neighbouring stations and past behaviour.`
                    : "No live feed. The twin relies on operator entries and the stations either side."}
                </p>
              </div>
            )}

            {isFocus && snap.sim.phase === "alert" && (
              <button className="btn primary wide" style={{ marginTop: 14 }}
                onClick={() => go("inference")}>Investigate →</button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------- hint --- */}
      <AnimatePresence mode="wait">
        <motion.div key={level} className="hint"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
          {level === "plant" ? "Click any line to open it"
            : level === "line" ? "Pick a station below, or click a block on the floor"
            : "Use the strip to move along the line"}
        </motion.div>
      </AnimatePresence>
    </>
  );
}

const tone = (s) => (s === "critical" ? "crit" : s === "warning" ? "warn" : "ok");

const Stat = ({ n, k, tone: t }) => (
  <div className="stack">
    <span className="mono" style={{ fontSize: 15, color: t ? `var(--${t})` : undefined }}>{n}</span>
    <span className="eyebrow" style={{ fontSize: 9 }}>{k}</span>
  </div>
);

const Key = ({ c, t }) => (
  <span className="key"><i className="dot" style={{ background: `var(--${c})` }} />{t}</span>
);

const Big = ({ label, value, unit, sub, tone: t }) => (
  <div>
    <div className="eyebrow">{label}</div>
    <div className="mono" style={{
      fontSize: 22, fontWeight: 500, marginTop: 6, letterSpacing: "-0.02em",
      color: t ? `var(--${t})` : undefined,
    }}>{value}{unit}</div>
    {sub && <div className="small muted" style={{ marginTop: 4 }}>{sub}</div>}
  </div>
);
