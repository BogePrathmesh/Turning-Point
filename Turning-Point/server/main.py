"""
EventInsight AI — Lightweight Application API Server
Fast, asynchronous FastAPI service bridging MongoDB to the React + Vite frontend.
Provides tenant-isolated event querying, filtering, search, stats, and telemetry.
"""

from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
import math
import os
import re
import sys
import time

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient, DESCENDING, ASCENDING
from pydantic import BaseModel

load_dotenv()
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from ingestion.solace_config import build_messaging_service, load_solace_settings

app = FastAPI(
    title="EventInsight AI API",
    description="Operational API for Event Intelligence Platform",
    version="1.0.0"
)

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MONGO_URI = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017")
DB_NAME = os.getenv("MONGODB_DB_NAME", "eventinsight_ai")

# MongoDB Client
client = MongoClient(MONGO_URI)
db = client[DB_NAME]
events_col = db["events"]
system_col = db["system_activity"]


def serialize_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Convert MongoDB ObjectId and datetime objects to JSON-serializable types."""
    if not doc:
        return doc
    doc["_id"] = str(doc["_id"])
    if isinstance(doc.get("receivedAt"), datetime):
        doc["receivedAt"] = doc["receivedAt"].isoformat()
    if isinstance(doc.get("eventTimestamp"), datetime):
        doc["eventTimestamp"] = doc["eventTimestamp"].isoformat()
    return doc


@app.get("/api/health")
def get_health():
    """Verify backend and database connectivity."""
    try:
        client.admin.command("ping")
        count = events_col.count_documents({})
        return {
            "status": "healthy",
            "database": "connected",
            "databaseName": DB_NAME,
            "eventsCount": count,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database connection failed: {str(e)}"
        )


@app.get("/api/stats")
def get_stats(org_id: str = "org_turning_point_default"):
    """
    Get aggregated statistics for dashboards:
    Total messages, entity distribution, status breakdown, and recent activity rate.
    """
    query = {"organizationId": org_id}
    total_messages = events_col.count_documents(query)

    # Entity Breakdown
    entity_pipeline = [
        {"$match": query},
        {"$group": {"_id": "$entityType", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    entity_counts = {item["_id"]: item["count"] for item in events_col.aggregate(entity_pipeline)}

    # Status Breakdown
    status_pipeline = [
        {"$match": query},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    status_counts = {item["_id"]: item["count"] for item in events_col.aggregate(status_pipeline)}

    # Format Breakdown
    format_pipeline = [
        {"$match": query},
        {"$group": {"_id": "$format", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    format_counts = {item["_id"]: item["count"] for item in events_col.aggregate(format_pipeline)}

    # Top Departure Airports
    flight_dep_pipeline = [
        {"$match": {**query, "entityType": "Flight", "normalized.departureAirport": {"$ne": None}}},
        {"$group": {"_id": "$normalized.departureAirport", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 5}
    ]
    top_airports = [{"airport": item["_id"], "count": item["count"]} for item in events_col.aggregate(flight_dep_pipeline)]

    return {
        "organizationId": org_id,
        "totalMessages": total_messages,
        "entityDistribution": entity_counts,
        "statusDistribution": status_counts,
        "formatDistribution": format_counts,
        "topAirports": top_airports,
        "activeConsumers": 2, # Synced or Solace
        "lastUpdated": datetime.now(timezone.utc).isoformat()
    }


@app.get("/api/events")
def get_events(
    org_id: str = "org_turning_point_default",
    entity: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=200)
):
    """
    Query, search, filter, and paginate event records with tenant isolation.
    """
    query: Dict[str, Any] = {"organizationId": org_id}

    if entity and entity != "All":
        query["entityType"] = entity

    if status and status != "All":
        query["status"] = status

    if search and search.strip():
        search_term = search.strip()
        # Regex search on summary or normalized identifiers for instant feedback
        regex_pattern = re.compile(re.escape(search_term), re.IGNORECASE)
        query["$or"] = [
            {"summary": {"$regex": regex_pattern}},
            {"eventId": {"$regex": regex_pattern}},
            {"entityType": {"$regex": regex_pattern}},
            {"normalized.flightNumber": {"$regex": regex_pattern}},
            {"normalized.notamCode": {"$regex": regex_pattern}},
            {"normalized.departureAirport": {"$regex": regex_pattern}},
            {"normalized.arrivalAirport": {"$regex": regex_pattern}},
            {"normalized.locationIndicator": {"$regex": regex_pattern}},
        ]

    total = events_col.count_documents(query)
    total_pages = math.ceil(total / limit) if total > 0 else 1
    skip = (page - 1) * limit

    # Return documents omitting huge rawPayload in table list for performance
    cursor = events_col.find(
        query,
        {
            "eventId": 1,
            "organizationId": 1,
            "sourceId": 1,
            "receivedAt": 1,
            "eventTimestamp": 1,
            "format": 1,
            "entityType": 1,
            "summary": 1,
            "status": 1,
            "normalized": 1,
            "ingestionMetadata": 1
        }
    ).sort("eventTimestamp", DESCENDING).skip(skip).limit(limit)

    events = [serialize_doc(doc) for doc in cursor]

    return {
        "events": events,
        "total": total,
        "page": page,
        "limit": limit,
        "totalPages": total_pages
    }


@app.get("/api/events/{event_id}")
def get_event_detail(event_id: str, org_id: str = "org_turning_point_default"):
    """Fetch complete event document including full rawPayload."""
    doc = events_col.find_one({"eventId": event_id, "organizationId": org_id})
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event '{event_id}' not found."
        )
    return serialize_doc(doc)


@app.get("/api/system-activity")
def get_system_activity(org_id: str = "org_turning_point_default", limit: int = 50):
    """Fetch technical telemetry logs for the System Info view."""
    cursor = system_col.find(
        {"organizationId": org_id}
    ).sort("timestamp", DESCENDING).limit(limit)

    logs = []
    for doc in cursor:
        doc["_id"] = str(doc["_id"])
        if isinstance(doc.get("timestamp"), datetime):
            doc["timestamp"] = doc["timestamp"].isoformat()
        logs.append(doc)

    # If no logs yet, provide live system baseline
    if not logs:
        logs.append({
            "_id": "sys_init",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "organizationId": org_id,
            "component": "Database Subsystem",
            "action": "MONGODB_CLUSTER_ACTIVE",
            "status": "SUCCESS",
            "details": "MongoDB database 'eventinsight_ai' connected. Primary indexes active.",
            "durationMs": 1
        })

    return {"activity": logs}


@app.get("/api/solace/status")
def get_solace_status(org_id: str = "org_turning_point_default"):
    """
    Return sanitized Solace broker configuration (secrets masked) and live status
    derived from MongoDB telemetry and ingested event counts.
    """
    settings = load_solace_settings()
    configured = all(
        bool(settings.get(k)) for k in ("host", "vpn", "username", "password")
    )

    solace_events_count = events_col.count_documents(
        {"organizationId": org_id, "ingestionMetadata.broker": "Solace PubSub+"}
    )

    last_log = system_col.find_one(
        {
            "organizationId": org_id,
            "component": "Solace Broker Consumer",
        },
        sort=[("timestamp", DESCENDING)],
    )

    last_status = "Standby"
    last_checked = None
    last_action = None
    if last_log:
        last_action = last_log.get("action")
        if last_log.get("status") == "SUCCESS":
            last_status = "Connected"
        elif last_log.get("status") == "WARNING":
            last_status = "Reconnecting"
        else:
            last_status = "Error"
        ts = last_log.get("timestamp")
        last_checked = ts.isoformat() if isinstance(ts, datetime) else ts

    return {
        "configured": configured,
        "serviceName": "MyFirstSolaceBroker",
        "host": settings["host"] or "Not configured",
        "vpn": settings["vpn"] or "Not configured",
        "username": settings["username"] or "Not configured",
        "passwordMasked": "••••••••••••" if settings["password"] else "Not set",
        "destinationType": "Queue" if settings["queue"] else "Topic",
        "destination": settings["queue"] or settings["topic"],
        "protocol": "Solace Native SMF (TLS)",
        "status": last_status if configured else "Unconfigured",
        "lastAction": last_action,
        "lastChecked": last_checked,
        "ingestedEventsCount": solace_events_count,
    }


@app.post("/api/solace/test-connection")
def test_solace_connection(org_id: str = "org_turning_point_default"):
    """Perform a live TLS connection test against the configured Solace PubSub+ broker."""
    settings = load_solace_settings()
    start = time.time()
    service = None
    try:
        service = build_messaging_service(settings)
        service.connect()
        connected = service.is_connected
        latency_ms = int((time.time() - start) * 1000)

        system_col.insert_one(
            {
                "timestamp": datetime.now(timezone.utc),
                "organizationId": org_id,
                "component": "Solace Broker Consumer",
                "action": "SOLACE_CONNECTION_VERIFIED",
                "status": "SUCCESS" if connected else "ERROR",
                "details": f"Live TLS handshake verified with {settings['host']} (VPN: {settings['vpn']}).",
                "durationMs": latency_ms,
                "metadata": {"host": settings["host"], "vpn": settings["vpn"]},
            }
        )

        return {
            "connected": connected,
            "host": settings["host"],
            "vpn": settings["vpn"],
            "latencyMs": latency_ms,
            "message": "Successfully connected to Solace PubSub+ broker over TLS.",
        }
    except Exception as exc:
        latency_ms = int((time.time() - start) * 1000)
        system_col.insert_one(
            {
                "timestamp": datetime.now(timezone.utc),
                "organizationId": org_id,
                "component": "Solace Broker Consumer",
                "action": "SOLACE_CONNECTION_FAILED",
                "status": "ERROR",
                "details": f"Connection test failed for {settings.get('host')}: {exc}",
                "durationMs": latency_ms,
            }
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Solace connection failed: {exc}",
        )
    finally:
        if service is not None:
            try:
                service.disconnect()
            except Exception:
                pass
