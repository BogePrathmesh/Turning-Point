"""
Unit tests for EventInsight AI Rule-Based Intelligence Engine
Deterministic, grounded tests with real MongoDB connection & sandbox mock fallback.
"""

import sys
import os
import re
import pytest
from pymongo import MongoClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from server.ai_rule_engine import process_ai_query


class MockCursor:
    def __init__(self, docs):
        self.docs = list(docs)

    def sort(self, *args, **kwargs):
        return self

    def limit(self, n):
        self.docs = self.docs[:n]
        return self

    def __iter__(self):
        return iter(self.docs)

    def __len__(self):
        return len(self.docs)

    def __getitem__(self, index):
        return self.docs[index]


class MockCollection:
    def __init__(self, docs=None):
        self._docs = list(docs or [])

    def _matches_filter(self, doc, f):
        if not f:
            return True
        for k, v in f.items():
            if k == "$or":
                sub_matches = any(self._matches_filter(doc, sub_f) for sub_f in v)
                if not sub_matches:
                    return False
                continue

            # Nested key resolution, e.g. "normalized.flightNumber"
            parts = k.split(".")
            curr = doc
            for p in parts:
                if isinstance(curr, dict) and p in curr:
                    curr = curr[p]
                else:
                    curr = None
                    break

            if isinstance(v, dict):
                if "$regex" in v:
                    pattern = v["$regex"]
                    flags = re.IGNORECASE if "i" in v.get("$options", "") else 0
                    if curr is None or not re.search(pattern, str(curr), flags):
                        return False
                elif "$ne" in v:
                    if curr == v["$ne"]:
                        return False
                elif "$in" in v:
                    if curr not in v["$in"]:
                        return False
            elif curr != v:
                return False
        return True

    def count_documents(self, filter_query=None):
        matched = [d for d in self._docs if self._matches_filter(d, filter_query)]
        return len(matched)

    def find(self, filter_query=None, projection=None):
        matched = [d for d in self._docs if self._matches_filter(d, filter_query)]
        return MockCursor(matched)

    def find_one(self, filter_query=None, sort=None):
        matched = [d for d in self._docs if self._matches_filter(d, filter_query)]
        return matched[0] if matched else None


class MockDatabase:
    def __init__(self):
        seed_events = [
            {
                "_id": "mock_f1",
                "eventId": "evt_flight_ai203",
                "organizationId": "org_turning_point_default",
                "entityType": "Flight",
                "format": "JSON",
                "status": "DELAYED",
                "eventTimestamp": "2026-10-21T18:30:00Z",
                "receivedAt": "2026-10-21T18:30:05Z",
                "summary": "Flight AI203 (A320) BOM -> DEL DELAYED",
                "normalized": {
                    "flightNumber": "AI203",
                    "aircraftModel": "A320",
                    "departureAirport": "BOM",
                    "arrivalAirport": "DEL",
                    "departureTime": "2026-10-21T18:30:00Z",
                    "arrivalTime": "2026-10-21T20:45:00Z",
                    "flightStatus": "DELAYED",
                    "controlCenter": "VABB",
                    "gufi": "gufi-ai203-del"
                },
                "rawPayload": {"delayMinutes": 25}
            },
            {
                "_id": "mock_f2",
                "eventId": "evt_flight_eny3544",
                "organizationId": "org_turning_point_default",
                "entityType": "Flight",
                "format": "XML",
                "status": "ACTIVE",
                "eventTimestamp": "2026-10-21T19:48:00Z",
                "receivedAt": "2026-10-21T19:48:02Z",
                "summary": "Flight ENY3544 (E75L) KPHX -> KTUL ACTIVE",
                "normalized": {
                    "flightNumber": "ENY3544",
                    "aircraftModel": "E75L",
                    "departureAirport": "KPHX",
                    "arrivalAirport": "KTUL",
                    "departureTime": "2026-10-21T19:48:00Z",
                    "arrivalTime": "2026-10-21T22:15:00Z",
                    "flightStatus": "ACTIVE",
                    "controlCenter": "ZAB",
                    "gufi": "gufi-eny3544"
                },
                "rawPayload": {}
            },
            {
                "_id": "mock_n1",
                "eventId": "evt_notam_10058",
                "organizationId": "org_turning_point_default",
                "entityType": "NOTAM",
                "format": "XML",
                "status": "ACTIVE",
                "eventTimestamp": "2026-10-21T18:00:00Z",
                "receivedAt": "2026-10-21T18:00:02Z",
                "summary": "NOTAM 10/058: AIRSPACE UNMANNED ROCKET LAUNCH IN EFFECT",
                "normalized": {
                    "notamId": "10/058",
                    "location": "ZLA",
                    "condition": "Airspace Caution - Rocket Activity",
                    "effectiveStart": "2026-10-21T18:00:00Z",
                    "effectiveEnd": "2026-10-22T02:00:00Z"
                },
                "rawPayload": {}
            },
            {
                "_id": "mock_w1",
                "eventId": "evt_weather_cyyz",
                "organizationId": "org_turning_point_default",
                "entityType": "Weather",
                "format": "JSON",
                "status": "ACTIVE",
                "eventTimestamp": "2026-10-21T19:00:00Z",
                "receivedAt": "2026-10-21T19:00:01Z",
                "summary": "Weather CYYZ: Heavy freezing rain warning",
                "normalized": {
                    "airport": "CYYZ",
                    "condition": "Heavy freezing rain",
                    "severity": "HIGH",
                    "temperature": -2
                },
                "rawPayload": {}
            }
        ]
        self._collections = {
            "events": MockCollection(seed_events),
            "system_activity": MockCollection([
                {
                    "component": "Solace Broker Consumer",
                    "status": "SUCCESS",
                    "action": "BROKER_STREAM_HEALTHY",
                    "details": "Solace broker TLS handshake verified.",
                    "timestamp": "2026-10-21T20:00:00Z"
                }
            ])
        }

    def __getitem__(self, name):
        if name not in self._collections:
            self._collections[name] = MockCollection()
        return self._collections[name]


@pytest.fixture(scope="module")
def mongo_db():
    try:
        client = MongoClient("mongodb://127.0.0.1:27017", serverSelectionTimeoutMS=400)
        client.admin.command('ping')
        return client["eventinsight_ai"]
    except Exception:
        # Loopback socket restricted by sandbox or DB offline; fallback to deterministic mock
        return MockDatabase()


def test_greeting_intent(mongo_db):
    res = process_ai_query("Hello", mongo_db)
    assert res["intent"] == "GREETING_AND_CAPABILITIES"
    assert "EventInsight AI Operational Assistant" in res["answer"]
    assert res["grounded"] is True


def test_when_my_flight_is_going_schedule(mongo_db):
    # This is the exact query from the user's screenshot
    res = process_ai_query("When my flight is going", mongo_db)
    assert res["intent"] == "FLIGHT_SCHEDULE_TIMINGS"
    assert "Active Flight Schedule" in res["answer"]
    assert res["recordsCount"] > 0
    assert "Route" in res["answer"]


def test_specific_flight_lookup(mongo_db):
    res = process_ai_query("Where is flight AI203 going?", mongo_db)
    assert res["intent"] == "SPECIFIC_FLIGHT_LOOKUP"
    assert "AI203" in res["answer"]
    assert "BOM" in res["answer"]
    assert "DEL" in res["answer"]


def test_flight_delays_query(mongo_db):
    res = process_ai_query("Which flights are delayed?", mongo_db)
    assert res["intent"] == "FLIGHT_DELAYS"
    assert "delayed" in res["answer"].lower()
    assert res["recordsCount"] > 0


def test_airport_activity_query(mongo_db):
    res = process_ai_query("Show flights at KPHX", mongo_db)
    assert res["intent"] == "AIRPORT_ACTIVITY"
    assert "KPHX" in res["answer"]


def test_notam_advisories_query(mongo_db):
    res = process_ai_query("Show all NOTAM airspace cautions", mongo_db)
    assert res["intent"] == "NOTAM_ADVISORIES"
    assert "NOTAM" in res["answer"]
    assert res["recordsCount"] > 0


def test_weather_advisories_query(mongo_db):
    res = process_ai_query("What is the weather at CYYZ?", mongo_db)
    assert res["intent"] == "WEATHER_ADVISORIES"
    assert "Weather" in res["answer"]


def test_counts_and_metrics_query(mongo_db):
    res = process_ai_query("How many flights are there?", mongo_db)
    assert res["intent"] == "VOLUME_AND_COMPARISON"
    assert "Flight Messages" in res["answer"]
    assert res["recordsCount"] > 0


def test_system_status_query(mongo_db):
    res = process_ai_query("Is the broker connected?", mongo_db)
    assert res["intent"] == "SYSTEM_HEALTH"
    assert "MongoDB" in res["answer"]
    assert "Solace" in res["answer"]
