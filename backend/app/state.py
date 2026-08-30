"""DIGITALTWIN.AI - the whole simulation, kept deliberately small.

One latent variable (`wear`) drives everything. Two numbers describe a station:
cycle time and defect risk. Every line in the plant is modelled, so any of them
can be opened and inspected - not just the one with the problem.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Dict, List

TAKT = 60          # target seconds per vehicle
FOCUS = "S17"      # the station the scenario happens at
THRESHOLD = 70     # below this confidence the twin will not recommend

# Sensing tiers. Coverage numbers are what the twin can physically measure.
FULL, SHADOW, MANUAL = "full", "shadow", "manual"
COVER = {FULL: 95, SHADOW: 20, MANUAL: 10}

LINE_DEFS = [
    {
        "id": "body", "name": "Body Shop", "prefix": "B",
        "names": ["Frame load", "Floor pan", "Side panel L", "Side panel R", "Roof set",
                  "Weld cell 1", "Weld cell 2", "Hem flange", "Door hang", "Bonnet fit",
                  "Boot fit", "Body scan"],
        "shadow": [7], "manual": [], "warning": [],
    },
    {
        "id": "paint", "name": "Paint", "prefix": "P",
        "names": ["Pre-treat", "E-coat", "Sealer", "Primer", "Base coat",
                  "Clear coat", "Bake oven", "Paint check"],
        "shadow": [3], "manual": [6], "warning": [5],
    },
    {
        "id": "final", "name": "Final Assembly", "prefix": "S",
        "names": ["Body drop", "Underbody", "Rear axle", "Front axle", "Brake lines",
                  "Exhaust", "Heat shield", "Harness", "Dashboard", "Steering",
                  "HVAC", "Windshield", "Rear glass", "Door trim L", "Door trim R",
                  "Seats", "Final torque", "Wheels", "Brake fill", "Coolant",
                  "Fuel fill", "Battery", "Bumper F", "Bumper R", "Headlamps",
                  "Door fit", "Roll test", "Water test", "Scan", "Sign-off",
                  "Badging", "Mirrors", "Wipers", "Carpet", "Console",
                  "Airbag", "Sunroof", "Spoiler", "Alignment", "Polish",
                  "Final scan", "Release"],
        "shadow": [4, 17, 21, 29, 35], "manual": [11, 26, 38], "warning": [4, 26],
    },
    {
        "id": "qc", "name": "Quality Check", "prefix": "Q",
        "names": ["Torque audit", "Leak test", "Brake test", "Light aim",
                  "Road test", "Final sign-off"],
        "shadow": [], "manual": [], "warning": [],
    },
]

EVIDENCE = [
    {"id": "camera", "label": "Run camera check", "icon": "camera", "gain": 16,
     "result": "Vision: operator movement up 18%, task sequence unchanged.",
     "verdict": "Rules out method error. Points at the tool."},
    {"id": "maintenance", "label": "Check maintenance history", "icon": "wrench", "gain": 14,
     "result": "Station 17 last serviced 41 days ago, against a 30-day interval.",
     "verdict": "Service overdue. Supports machine wear."},
    {"id": "cycles", "label": "Compare previous cycles", "icon": "chart", "gain": 13,
     "result": "Last 3 cycles: 68s, 71s, 74s. Steadily climbing, not a one-off.",
     "verdict": "Degradation is gradual. Supports machine wear."},
    {"id": "operator", "label": "Ask operator", "icon": "person", "gain": 10,
     "result": "Operator reports the tool 'feels heavier' than this morning.",
     "verdict": "Consistent with wear developing during the shift."},
]

CAUSES = [
    {"id": "machine", "name": "Machine wear", "start": 44, "end": 61},
    {"id": "part", "name": "Part quality", "start": 26, "end": 22},
    {"id": "operator", "name": "Operator / process", "start": 19, "end": 11},
    {"id": "environment", "name": "Environment", "start": 11, "end": 6},
]

CAUSE_DETAIL = {
    "machine": {
        "verdict": "supported",
        "for": ["Cycle time climbing steadily", "Service interval overdue by 11 days",
                "Matches a confirmed event from 24 April", "Only this station is affected"],
        "against": [],
    },
    "part": {
        "verdict": "rejected", "for": [],
        "against": ["Incoming quality checks normal", "Same batch running fine elsewhere",
                    "Problem is time-linked, not batch-linked"],
    },
    "operator": {
        "verdict": "rejected",
        "for": ["Operator movement increased 18%"],
        "against": ["Camera shows normal task sequence", "Same operator hit target this morning",
                    "Extra movement started after the tool slowed, not before"],
    },
    "environment": {
        "verdict": "rejected", "for": [],
        "against": ["Cell temperature normal", "Neighbouring stations unaffected"],
    },
}

SCENARIOS = [
    {"id": "nothing", "name": "Do nothing", "risk_after": 94, "vehicles": 12,
     "downtime": "0 min now", "throughput": -12, "tone": "bad",
     "note": "Wear keeps going. An unplanned stop becomes the likely end of the shift."},
    {"id": "adjust", "name": "Adjust parameter", "risk_after": 31, "vehicles": 3,
     "downtime": "0 min", "throughput": 6, "tone": "good",
     "note": "Recovers cycle time immediately. Manages the symptom, so pair it with service."},
    {"id": "repair", "name": "Repair now", "risk_after": 8, "vehicles": 1,
     "downtime": "15 min", "throughput": -3, "tone": "warn",
     "note": "Lowest risk, highest certain loss. 15 min of stop costs more than it saves today."},
    {"id": "wait", "name": "Wait for maintenance", "risk_after": 88, "vehicles": 9,
     "downtime": "Planned, 18:00", "throughput": -8, "tone": "warn",
     "note": "The window is 3 hours away. That is 3 hours of exposure at the current rate."},
]

PLANTS = [
    {"id": "A", "name": "Plant A", "city": "Pune", "coverage": 91, "age": "4 yrs",
     "lines": 4, "stations": 68, "shadow_pct": 6,
     "note": "Newest line. Almost everything is measured directly."},
    {"id": "B", "name": "Plant B", "city": "Chennai", "coverage": 74, "age": "9 yrs",
     "lines": 4, "stations": 64, "shadow_pct": 21,
     "note": "Mixed retrofit. A fifth of stations run on inference."},
    {"id": "C", "name": "Plant C", "city": "Sanand", "coverage": 52, "age": "17 yrs",
     "lines": 3, "stations": 51, "shadow_pct": 44,
     "note": "Legacy line. Most of the picture is inferred, and it still works."},
]


def build_lines() -> List[Dict[str, Any]]:
    """Every station in the plant, grouped by line. Deterministic."""
    out = []
    for d in LINE_DEFS:
        stations = []
        for i, name in enumerate(d["names"]):
            n = i + 1
            sensing = (SHADOW if n in d["shadow"] else
                       MANUAL if n in d["manual"] else FULL)
            stations.append({
                "code": f"{d['prefix']}{n:02d}",
                "n": n,
                "line": d["id"],
                "name": name,
                "sensing": sensing,
                "coverage": COVER[sensing],
                "base_status": "warning" if n in d["warning"] else "healthy",
                "base_cycle": round(56 + (n * 7 % 6) + (5 if n in d["warning"] else 0), 1),
            })
        coverage = round(sum(s["coverage"] for s in stations) / len(stations))
        out.append({"id": d["id"], "name": d["name"], "coverage": coverage,
                    "count": len(stations), "stations": stations})
    return out


LINES = build_lines()


@dataclass
class Twin:
    t: int = 14 * 3600 + 31 * 60
    tick: int = 0
    wear: float = 0.0
    fixed: float = 0.0
    phase: str = "calm"                 # calm | rising | alert | acting | done
    speed: int = 1
    running: bool = True
    evidence: List[str] = field(default_factory=list)
    decision: Dict[str, Any] | None = None
    feedback: bool | None = None
    events: List[Dict[str, Any]] = field(default_factory=list)
    trend: List[Dict[str, float]] = field(default_factory=list)
    seen: Dict[str, bool] = field(default_factory=dict)

    # ---------------------------------------------------------------- derived
    @property
    def confidence(self) -> int:
        if self.phase in ("calm", "rising"):
            return 92
        gained = sum(e["gain"] for e in EVIDENCE if e["id"] in self.evidence)
        return min(94, 54 + gained)

    @property
    def ready(self) -> bool:
        return self.confidence >= THRESHOLD

    def metrics(self) -> Dict[str, float]:
        wobble = math.sin(self.tick * 0.6) * 0.4
        effective = self.wear * (1 - 0.78 * self.fixed)
        cycle = 60 + 14 * effective + wobble
        # Fixing the symptom does not fully remove the underlying risk.
        risk = 4 + 78 * self.wear * (1 - 0.62 * self.fixed)
        return {
            "cycle_time": round(cycle, 1),
            "target": TAKT,
            "defect_risk": round(min(99, risk)),
            "bottleneck_risk": round(min(99, 5 + 71 * effective)),
            "queue": round(2 + 14 * effective),
            "throughput": round(3600 / max(cycle, 58)),
        }

    def causes(self) -> List[Dict[str, Any]]:
        p = max(0.0, min(1.0, (self.confidence - 54) / 40))
        return [{**c, "value": round(c["start"] + (c["end"] - c["start"]) * p),
                 **CAUSE_DETAIL[c["id"]]} for c in CAUSES]

    def lines(self) -> List[Dict[str, Any]]:
        """All lines with live station status folded in."""
        m = self.metrics()
        focus_status = ("healthy" if self.phase == "calm"
                        else "critical" if m["defect_risk"] > 55
                        else "warning" if m["defect_risk"] > 22 else "healthy")
        out = []
        for ln in LINES:
            stations = []
            for s in ln["stations"]:
                if s["code"] == FOCUS:
                    status, cycle = focus_status, m["cycle_time"]
                else:
                    status, cycle = s["base_status"], s["base_cycle"]
                stations.append({
                    "code": s["code"], "n": s["n"], "line": s["line"], "name": s["name"],
                    "sensing": s["sensing"], "coverage": s["coverage"],
                    "status": status, "cycle": cycle,
                })
            alerts = sum(1 for s in stations if s["status"] != "healthy")
            worst = ("critical" if any(s["status"] == "critical" for s in stations)
                     else "warning" if alerts else "healthy")
            out.append({
                "id": ln["id"], "name": ln["name"], "coverage": ln["coverage"],
                "count": ln["count"], "alerts": alerts, "status": worst,
                "shadow": sum(1 for s in stations if s["sensing"] == SHADOW),
                "manual": sum(1 for s in stations if s["sensing"] == MANUAL),
                "stations": stations,
            })
        return out

    # ----------------------------------------------------------------- ticking
    def log(self, text: str, kind: str = "info", once: str | None = None) -> None:
        if once:
            if self.seen.get(once):
                return
            self.seen[once] = True
        self.events.insert(0, {"t": self.t, "text": text, "kind": kind})
        del self.events[24:]

    def step(self) -> None:
        if not self.running:
            return
        self.tick += 1
        self.t += 20 * self.speed

        if self.phase == "calm" and self.tick > 40:
            self.phase = "rising"
        if self.phase == "rising":
            self.wear = min(1.0, self.wear + 0.035 * self.speed)
            if self.wear > 0.2:
                self.log("Station 17 cycle time creeping up.", "info", "e1")
            if self.wear > 0.45:
                self.log("Queue forming behind Station 17.", "warn", "e2")
            if self.wear > 0.7:
                self.log("Vision picks up hesitation at the station.", "warn", "e3")
            if self.wear >= 1.0:
                self.phase = "alert"
                self.log("Defect risk 82%. Confidence only 54%.", "alert", "e4")
                self.log("Holding back a recommendation until I know more.", "alert", "e5")
        if self.phase == "acting":
            self.fixed = min(1.0, self.fixed + 0.09 * self.speed)
            if self.fixed >= 0.82:
                self.phase = "done"
                self.log("Action applied. Station 17 settling.", "good", "e6")

        m = self.metrics()
        self.trend.append({"t": self.t, "cycle": m["cycle_time"], "risk": m["defect_risk"]})
        del self.trend[:-40]

    # ----------------------------------------------------------------- actions
    def trigger(self) -> None:
        keep = self.events
        self.__init__()
        self.events = keep
        self.phase = "rising"
        self.wear = 0.3
        self.speed = 3
        self.log("Scenario armed at Station 17.", "info")

    def reset(self) -> None:
        self.__init__()
        self.log("Line reset. Everything nominal.", "info")

    def collect(self, eid: str) -> Dict[str, Any]:
        item = next((e for e in EVIDENCE if e["id"] == eid), None)
        if item is None:
            raise KeyError(eid)
        before = self.confidence
        if eid not in self.evidence:
            self.evidence.append(eid)
        self.log(f"Evidence in: {item['label'].lower()}.", "good")
        return {**item, "confidence_before": before, "confidence_after": self.confidence}

    def decide(self, scenario_id: str, verdict: str) -> Dict[str, Any]:
        sc = next((s for s in SCENARIOS if s["id"] == scenario_id), SCENARIOS[1])
        self.decision = {"scenario": sc, "verdict": verdict}
        self.log(f"Human {verdict} - {sc['name'].lower()}.", "good")
        if verdict != "rejected":
            self.phase = "acting"
            self.speed = 3
        return self.decision

    def outcome(self) -> Dict[str, Any]:
        m = self.metrics()
        predicted, actual = 51, 82 - m["defect_risk"]
        return {
            "predicted_drop": predicted,
            "actual_drop": actual,
            "accuracy": max(0, round(100 - abs(predicted - actual) / predicted * 100)),
            "risk_before": 82, "risk_after": m["defect_risk"],
            "cycle_after": m["cycle_time"],
            "settled": self.phase == "done",
            "residual": "Underlying wear is still there. Service booked for the 18:00 window.",
        }

    def snapshot(self) -> Dict[str, Any]:
        lines = self.lines()
        return {
            "clock": {"seconds": self.t, "day": "Monday", "shift": "B"},
            "sim": {"running": self.running, "speed": self.speed, "phase": self.phase},
            "confidence": self.confidence,
            "threshold": THRESHOLD,
            "ready": self.ready,
            "metrics": self.metrics(),
            "focus": FOCUS,
            "lines": lines,
            "totals": {
                "stations": sum(l["count"] for l in lines),
                "alerts": sum(l["alerts"] for l in lines),
                "coverage": round(sum(l["coverage"] * l["count"] for l in lines) /
                                  sum(l["count"] for l in lines)),
            },
            "events": self.events,
            "trend": self.trend,
            "evidence_taken": self.evidence,
            "decision": self.decision,
            "feedback": self.feedback,
        }


twin = Twin()
