
````md
# DIGITALTWIN.AI

DIGITALTWIN.AI is a decision twin for mixed-model vehicle assembly lines. It monitors production conditions, identifies emerging bottlenecks and defect risks, investigates possible causes using available evidence, simulates different corrective actions, and compares predicted outcomes with actual results. It also handles stations with limited sensor coverage by combining available sensor data with computer vision, neighbouring-station data, and historical information. When confidence is low, the twin does not make a recommendation. Instead, it identifies the evidence it needs, updates its confidence as that evidence is collected, and only then proceeds to causal reasoning and scenario simulation.

The complete decision loop is:

**Predict → Investigate → Simulate → Decide → Learn**

---

## Run it

### Quick start

```bash
./run.sh          # macOS / Linux
run.bat           # Windows
````

Open:

```text
http://localhost:5173
```

### Manual setup

#### 1. Start the backend

```bash
cd backend

python3 -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate

pip install -r requirements.txt

uvicorn app.main:app --port 8000 --reload
```

#### 2. Start the frontend

```bash
cd frontend

npm install
npm run dev
```

### Requirements

* Python 3.10+
* Node.js 18+
* No Docker
* No database
* No API keys

API documentation is available at:

[http://localhost:8000/docs](http://localhost:8000/docs)

---

## How the Demo Works

### 1. Trigger the scenario

Click **Trigger scenario** from the bottom-left corner.

The 3D factory starts running, with parts moving through the assembly line.

### 2. Investigate Station 17

Select **Final Assembly** and click the red station block.

The view focuses on Station 17 and displays its current production state.

Station 17 has only **20% sensor coverage**. The twin therefore combines the available information with inferred signals from computer vision, neighbouring stations, and historical data.

### 3. Gather evidence

The initial defect risk is **82%**, but the confidence in the diagnosis is only **54%**.

The twin does not provide a recommendation at this point. Instead, it identifies four pieces of evidence that can be checked.

As evidence is collected, confidence increases:

```text
54% → 70% → 84% → 94%
```

The reasoning stage becomes available once confidence reaches 70%.

This rule is enforced in the API as well. `/api/causes` and `/api/scenarios` return **HTTP 409** when confidence is below 70%.

### 4. Identify the cause

The cause map is generated around Station 17.

The demonstration identifies:

* **Machine wear — 61%:** supported by the available evidence
* **Part quality:** ruled out
* **Environment:** ruled out
* **Operator movement:** observed, but occurred after the tool slowed down

The operator activity is therefore treated as a process observation rather than the root cause.

### 5. Rehearse possible actions

The Rehearse page presents four possible actions.

Selecting a scenario shows how the predicted queue changes over time.

For example:

* **Do Nothing:** queue continues to increase
* **Adjust:** queue decreases and cycle time recovers

The selected action can then be **Approved, Modified, or Rejected** by the user.

### 6. Compare prediction with reality

The twin predicts a **51-point improvement** and the observed result is a **48-point improvement**.

This produces a **94% accuracy** for the prediction.

The user can then provide a human verdict on whether the decision was correct. This feedback is recorded by the learning layer.

### 7. Scale across plants

The Scale page shows the same twin operating across three plants with different levels of sensor coverage:

```text
Plant 1    91%
Plant 2    74%
Plant 3    52%
```

The interface also supports **1× / 3× / 5×** simulation speed and **Reset line** to restart the scenario.

---

## Key Design Principles

### Evidence before recommendation

When confidence is below the required threshold, the twin does not guess.

It identifies what additional evidence is needed, collects it, updates confidence, and only then generates causes and scenarios.

This behaviour is enforced at the API level rather than being limited to the UI.

### Root cause vs. symptom

Correcting a process parameter can recover cycle time without removing the underlying machine issue.

In the demonstration, adjusting the parameter reduces the defect risk to approximately **34%**, but does not eliminate it because machine wear remains.

The twin therefore separates immediate recovery from the underlying maintenance requirement and schedules service for the available **18:00 window**.

### Operator activity as process evidence

Computer vision is used to observe process behaviour.

An increase in operator movement is detected, but the timing shows that the movement increased only after the tool had already slowed down. The twin therefore does not classify the operator as the cause.

### Measured vs. inferred information

The interface clearly distinguishes between directly measured data and inferred information.

Fully instrumented stations use solid data connections.

Stations with limited sensor coverage use dashed violet connections to represent information inferred from:

* Computer vision
* Neighbouring stations
* Historical data

This makes sensor limitations visible instead of hiding them.

---

## Architecture

```text
digitaltwin-ai/
│
├── run.sh
├── run.bat
│
├── backend/
│   ├── requirements.txt
│   └── app/
│       ├── state.py
│       └── main.py
│
└── frontend/
    └── src/
        ├── App.jsx
        ├── api.js
        ├── styles.css
        │
        ├── three/
        │   └── factory.js
        │
        └── pages/
            ├── Overview
            ├── Data
            ├── Inference
            ├── Reason
            ├── Rehearse
            ├── Learn
            └── Scale
```

### Backend

The backend is built with **FastAPI** and manages the complete simulation state.

The simulation runs on the server and the frontend receives state snapshots through a WebSocket connection:

```text
ws://localhost:8000/ws
```

Snapshots are pushed twice per second.

Because the simulation state is maintained on the server, refreshing the browser does not reset the scenario. Multiple browser windows remain synchronized.

### Frontend

The frontend uses:

* React 18
* Vite
* Three.js
* Framer Motion
* Custom CSS

The 3D factory visualization is rendered using Three.js.

---

## Simulation Model

The simulation intentionally uses a small causal model.

A single latent variable, `wear`, drives the main production effects:

```text
                    ┌──> Cycle Time ──> Queue ──> Throughput
Wear ───────────────┤
                    └──> Defect Risk
```

The model focuses on two main station-level outputs:

* Cycle time
* Defect risk

This keeps the simulation focused on the decision process rather than attempting to reproduce a complete industrial control model.

---

## API

| Method | Endpoint             | Description                                                     |
| ------ | -------------------- | --------------------------------------------------------------- |
| `WS`   | `/ws`                | Live simulation snapshot stream                                 |
| `GET`  | `/api/snapshot`      | Returns the current simulation state                            |
| `GET`  | `/api/evidence`      | Returns available and collected evidence                        |
| `POST` | `/api/evidence/{id}` | Collects evidence and updates confidence                        |
| `GET`  | `/api/causes`        | Returns ranked causes; returns `409` below 70% confidence       |
| `GET`  | `/api/scenarios`     | Returns available scenarios; returns `409` below 70% confidence |
| `POST` | `/api/decision`      | Approves, modifies, or rejects a decision                       |
| `GET`  | `/api/outcome`       | Returns predicted and actual outcomes                           |
| `POST` | `/api/feedback`      | Records the human verdict                                       |

---

## Prototype Scope

* All production data is simulated.
* No real plant historian, PLC, or camera system is connected.
* The learning layer records outcomes and human feedback and updates a running accuracy measure.
* The learning layer does not train a machine-learning model.
* The twin is read-only and does not write to PLCs or other control systems.
* Every operational action requires human approval through **Approve / Modify / Reject**.
* Numerical values are illustrative.

The current simulation uses:

* 60-second takt time
* 42 assembly stations
* 24-hour × 6-day operating schedule
* 18:00 service window

---
```
