"""DIGITALTWIN.AI API.

REST for actions, one WebSocket for the live stream.
Run:  uvicorn app.main:app --port 8000 --reload
"""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .state import (CAUSES, EVIDENCE, LINES, PLANTS, SCENARIOS, THRESHOLD, twin)

clients: set[asyncio.Queue] = set()


async def ticker() -> None:
    while True:
        await asyncio.sleep(0.5)
        twin.step()
        payload = twin.snapshot()
        for q in list(clients):
            if not q.full():
                q.put_nowait(payload)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(ticker())
    yield
    task.cancel()


app = FastAPI(title="DIGITALTWIN.AI", version="2.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class Speed(BaseModel):
    running: bool | None = None
    speed: int | None = None


class Decision(BaseModel):
    scenario_id: str
    verdict: str          # approved | modified | rejected


class Feedback(BaseModel):
    correct: bool


@app.get("/api/health")
def health():
    return {"ok": True, "simulated": True}


@app.get("/api/snapshot")
def snapshot():
    return twin.snapshot()


@app.get("/api/plants")
def plants():
    return {"plants": PLANTS}


@app.get("/api/sources")
def sources():
    """What feeds the twin, for the DATA page."""
    return {"sources": [
        {"id": "production", "name": "Production counts", "detail": "Units in and out per station",
         "status": "live", "coverage": 100},
        {"id": "machine", "name": "Machine signals", "detail": "Cycle time from PLC tags",
         "status": "live", "coverage": 71},
        {"id": "downtime", "name": "Downtime logs", "detail": "Stop reasons and durations",
         "status": "live", "coverage": 100},
        {"id": "quality", "name": "Quality checks", "detail": "Inspection results at gates",
         "status": "live", "coverage": 100},
        {"id": "camera", "name": "Cameras", "detail": "Queue depth and process timing",
         "status": "live", "coverage": 64},
        {"id": "manual", "name": "Manual checklists", "detail": "Operator entries on paper stations",
         "status": "periodic", "coverage": 100},
        {"id": "maintenance", "name": "Maintenance records", "detail": "Service dates and parts",
         "status": "live", "coverage": 100},
    ], "note": "No PLC is written to. The twin only reads."}


@app.get("/api/evidence")
def evidence():
    return {
        "confidence": twin.confidence,
        "threshold": THRESHOLD,
        "ready": twin.ready,
        "taken": twin.evidence,
        "options": [{**e, "taken": e["id"] in twin.evidence} for e in EVIDENCE],
    }


@app.post("/api/evidence/{eid}")
def collect(eid: str):
    try:
        return {"finding": twin.collect(eid), "confidence": twin.confidence, "ready": twin.ready}
    except KeyError:
        raise HTTPException(404, "No such evidence source")


@app.get("/api/causes")
def causes():
    if not twin.ready:
        raise HTTPException(409, f"Confidence {twin.confidence}% is under the {THRESHOLD}% bar. "
                                 "Collect evidence first.")
    return {"confidence": twin.confidence, "causes": twin.causes()}


@app.get("/api/scenarios")
def scenarios():
    if not twin.ready:
        raise HTTPException(409, f"Confidence {twin.confidence}% is under the {THRESHOLD}% bar.")
    m = twin.metrics()
    return {
        "risk_now": m["defect_risk"],
        "scenarios": [{**s, "risk_before": m["defect_risk"]} for s in SCENARIOS],
        "recommended": "adjust",
        "why": ["Biggest risk drop for zero downtime", "Reversible if the trend does not respond",
                "Buys the line safely to the 18:00 service window"],
        "timing": "Apply now, book service for the 18:00 maintenance window.",
        "shift_pattern": "24 h/day, 6 days/week, Sunday maintenance.",
    }


@app.post("/api/decision")
def decision(body: Decision):
    return twin.decide(body.scenario_id, body.verdict)


@app.get("/api/outcome")
def outcome():
    if twin.phase not in ("acting", "done"):
        raise HTTPException(409, "Nothing has been actioned yet.")
    return twin.outcome()


@app.post("/api/feedback")
def feedback(body: Feedback):
    twin.feedback = body.correct
    twin.log("Outcome confirmed by a person. Added to history.", "good")
    return {"accuracy_before": 87, "accuracy_after": 89 if body.correct else 86,
            "learned": [
                "This evidence order gets suggested first next time.",
                "Station 17's wear signature is now a known pattern.",
                "Confidence calibration nudged for this station.",
            ]}


@app.post("/api/sim")
def sim(body: Speed):
    if body.running is not None:
        twin.running = body.running
    if body.speed is not None:
        twin.speed = max(1, min(5, body.speed))
    return {"running": twin.running, "speed": twin.speed}


@app.post("/api/trigger")
def trigger():
    twin.trigger()
    return {"phase": twin.phase}


@app.post("/api/reset")
def reset():
    twin.reset()
    return {"phase": twin.phase}


@app.websocket("/ws")
async def ws(sock: WebSocket):
    await sock.accept()
    q: asyncio.Queue = asyncio.Queue(maxsize=3)
    clients.add(q)
    try:
        await sock.send_json(twin.snapshot())
        while True:
            await sock.send_json(await q.get())
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        clients.discard(q)
