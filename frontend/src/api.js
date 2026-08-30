// Everything that talks to the backend lives here.
const base = "/api";

async function call(path, opts) {
  const res = await fetch(base + path, {
    headers: { "Content-Type": "application/json" }, ...opts,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).detail ?? msg; } catch {}
    const err = new Error(msg); err.status = res.status; throw err;
  }
  return res.json();
}
const get = (p) => call(p);
const post = (p, b) => call(p, { method: "POST", body: JSON.stringify(b ?? {}) });

export const api = {
  snapshot: () => get("/snapshot"),
  sources: () => get("/sources"),
  plants: () => get("/plants"),
  evidence: () => get("/evidence"),
  collect: (id) => post(`/evidence/${id}`),
  causes: () => get("/causes"),
  scenarios: () => get("/scenarios"),
  decide: (scenario_id, verdict) => post("/decision", { scenario_id, verdict }),
  outcome: () => get("/outcome"),
  feedback: (correct) => post("/feedback", { correct }),
  sim: (body) => post("/sim", body),
  trigger: () => post("/trigger"),
  reset: () => post("/reset"),
};

/** Live snapshot stream. Reconnects on its own so a backend restart is survivable. */
export function connect(onData, onStatus) {
  let ws = null, dead = false, timer = null;
  const open = () => {
    if (dead) return;
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(`${proto}//${location.host}/ws`);
    ws.onopen = () => onStatus?.("live");
    ws.onmessage = (e) => onData(JSON.parse(e.data));
    ws.onclose = () => { onStatus?.("down"); if (!dead) timer = setTimeout(open, 1500); };
    ws.onerror = () => ws.close();
  };
  open();
  return () => { dead = true; clearTimeout(timer); ws?.close(); };
}

export const clock = (s) => {
  const h = Math.floor(s / 3600) % 24, m = Math.floor(s / 60) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};
