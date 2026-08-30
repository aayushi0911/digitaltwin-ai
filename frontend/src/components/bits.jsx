import React from "react";
import { motion } from "framer-motion";

export const Metric = ({ label, value, unit, sub, tone }) => (
  <div className="metric">
    <div className="eyebrow">{label}</div>
    <div style={{ marginTop: 8 }}>
      <span className="n" style={tone ? { color: `var(--${tone})` } : undefined}>{value}</span>
      {unit && <span className="u">{unit}</span>}
    </div>
    {sub && <div className="sub">{sub}</div>}
  </div>
);

export const Bar = ({ value, tone = "violet" }) => (
  <div className="bar">
    <motion.i
      style={{ background: `var(--${tone})` }}
      initial={{ width: 0 }}
      animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      transition={{ type: "spring", stiffness: 120, damping: 20 }}
    />
  </div>
);

export const Chip = ({ tone = "", children }) => (
  <span className={`chip ${tone}`}>{children}</span>
);

export const Card = ({ children, className = "", delay = 0, ...rest }) => (
  <motion.div
    className={`card ${className}`}
    initial={{ opacity: 0, y: 14 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
    {...rest}
  >
    {children}
  </motion.div>
);

export const PageHead = ({ title, children }) => (
  <motion.div
    className="page-head"
    initial={{ opacity: 0, y: -8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35 }}
  >
    <h2>{title}</h2>
    {children && <p>{children}</p>}
  </motion.div>
);

export const Tick = () => <span className="tick">✓</span>;
export const Cross = () => <span className="cross">✕</span>;

export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
export const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};
