# DIGITALTWIN.AI

A decision twin for a mixed-model vehicle assembly line, built for the Accenture
Innovation Challenge 2026 by **clock_it**.

It demonstrates one complete loop on simulated production data:

> **predict → investigate → simulate → decide → learn**

The single idea worth remembering:

> When the twin is unsure, it does not guess. It says what it needs, asks you to fetch it,
> updates its confidence, and only then reasons.

This is enforced in the **API**, not just the interface — `/api/causes` and `/api/scenarios`
return **HTTP 409** while confidence sits below 70%.

---

## Run it

```bash
./run.sh          # macOS / Linux
run.bat           # Windows
```

Open **http://localhost:5173**.

Or manually, in two terminals:

```bash
# 1 — backend
cd backend
python3 -m venv .venv && source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000 --reload

# 2 — frontend
cd frontend && npm install && npm run dev
```

Needs **Python 3.10+** and **Node 18+**. Nothing else — no Docker, no database, no API keys.
API docs at http://localhost:8000/docs.

---

## The 3-minute demo

1. **Click ⚡ Trigger scenario** (bottom left). The 3D factory is already live — parts flow
   down the line as violet particles.
2. **Click Final Assembly**, then **click the red station block**. The camera pushes in and a
   card floats up beside it. Station 17 is on **20% sensor coverage**, so violet beads run
   inward showing what the twin is inferring from instead.
3. **Inference** — defect risk is 82%, but confidence is only **54%**. No recommendation
   appears. Instead the twin lists four things worth checking. Click them; confidence climbs
   **54 → 70 → 84 → 94%** and the next page unlocks at 70.
4. **Reason** — a cause map draws itself outward from Station 17. Machine wear at 61%,
   supported. Part quality and environment drawn as dashed, **ruled out on evidence**.
   Operator movement is real but started *after* the tool slowed — a symptom, not a cause.
5. **Rehearse** — four futures. Click each and the predicted queue animates: "Do nothing"
   grows it red, "Adjust" drains it green. Then **Approve**.
6. **Learn** — predicted a 51-point drop, got 48. **94% accurate**, not 100%. You mark whether
   the call was right, and that verdict is what the twin keeps.
7. **Scale** — the same twin across three plants at 91 / 74 / 52% coverage.

Use **1× / 3× / 5×** to fast-forward, **Reset line** to start over.

---

## Three choices worth defending

**Fixing the symptom doesn't fix the machine.** Adjusting the parameter recovers cycle time,
but defect risk settles at ~34% rather than zero, because the underlying wear is still there.
The twin says so and books service for the 18:00 window. This is why prediction-vs-reality
shows a genuine 94% instead of a suspicious 100%.

**Operator variation is never the verdict.** Camera evidence is framed as *process observation*.
It confirms movement went up, and simultaneously rules the operator out as the cause — with a
timing argument, not a hand-wave.

**Instrumentation honesty is visual.** Fully sensed stations look solid. Shadow-sensed stations
get dashed violet feeds from camera, neighbouring stations and history. They are never mixed up,
so "we can't measure this, we're inferring it" reads at a glance.

---

## What's inside

```
digitaltwin-ai/
├── run.sh / run.bat
├── backend/                    FastAPI — ~380 lines total
│   ├── requirements.txt
│   └── app/
│       ├── state.py            The whole simulation: one wear variable drives everything
│       └── main.py             REST + WebSocket
└── frontend/                   React 18 + Vite + three.js + framer-motion
    └── src/
        ├── App.jsx             Shell, rail, live clock, 3D stage
        ├── api.js              REST client + auto-reconnecting WebSocket
        ├── styles.css          Dark premium design system (no CSS framework)
        ├── three/factory.js    The 3D factory: boxes, particles, camera easing
        └── pages/              Overview · Data · Inference · Reason · Rehearse · Learn · Scale
```

**Simulation runs on the server.** The browser is a thin client rendering snapshots pushed over
`ws://localhost:8000/ws` twice a second. Refresh the page and nothing is lost. Open two windows
and they stay in sync.

**Deliberately small model.** One latent variable (`wear`) drives a real causal chain:

```
wear ─→ cycle time ─→ queue ─→ throughput
     └─→ defect risk
```

No torque, no vibration, no temperature. Two honest numbers per station — cycle time and defect
risk — because the demo is about the *decision process*, not sensor breadth.

### Key endpoints

| Method | Path | Notes |
| --- | --- | --- |
| `WS` | `/ws` | Live snapshot stream |
| `GET` | `/api/snapshot` | Full state |
| `GET` | `/api/evidence` | Options + what's been gathered |
| `POST` | `/api/evidence/{id}` | Fetch evidence, raise confidence |
| `GET` | `/api/causes` | Ranked causes — **409 below 70%** |
| `GET` | `/api/scenarios` | Four options — **409 below 70%** |
| `POST` | `/api/decision` | approve / modify / reject |
| `GET` | `/api/outcome` | Predicted vs actual |
| `POST` | `/api/feedback` | Human verdict closes the loop |

---

## Prototype boundaries

- **All data is simulated.** No plant, historian or camera is connected.
- **The learning layer is a simulation.** It records outcomes and human verdicts and adjusts a
  running accuracy figure. It does **not** train a model, and the UI labels it as such.
- **The twin only reads.** It never writes to a PLC. Every action needs human approval —
  which is exactly why the Rehearse page ends in Approve / Modify / Reject.
- **Numbers are illustrative** and stated inline (60s takt, 42 stations, 24h × 6 days with an
  18:00 service window).

## Troubleshooting

**"Backend not reachable"** — start it on port 8000; the page reconnects on its own, no refresh.

**Port in use** — run `uvicorn app.main:app --port 8001` and update the two proxy targets in
`frontend/vite.config.js`.

**Blank 3D area** — needs WebGL. Any browser from the last five years is fine.
