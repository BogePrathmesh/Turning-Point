"""
EventInsight AI — Excel Normalization Engine
Converts heterogeneous tabular event rows from synthetic Excel workbooks
into standardized, enterprise-ready MongoDB event documents.
"""

import hashlib
import json
import math
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple


def is_null_or_nan(val: Any) -> bool:
    """Check if a value is None, NaN, NaT, or empty string."""
    if val is None:
        return True
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return True
    val_str = str(val).strip().lower()
    return val_str in ("nan", "nat", "none", "null", "")


def clean_cell_value(val: Any) -> Any:
    """Clean and sanitize individual cell values for MongoDB serialization."""
    if is_null_or_nan(val):
        return None
    # Convert whole number floats (e.g. 451.0 -> 451)
    if isinstance(val, float) and val.is_integer():
        return int(val)
    if isinstance(val, datetime):
        return val.isoformat()
    return val


def sanitize_row_dict(raw_dict: Dict[Any, Any]) -> Dict[str, Any]:
    """Sanitize keys and values of a raw row dictionary."""
    clean_dict: Dict[str, Any] = {}
    for k, v in raw_dict.items():
        key_str = str(k).strip()
        cleaned_val = clean_cell_value(v)
        if cleaned_val is not None:
            clean_dict[key_str] = cleaned_val
    return clean_dict


def detect_entity_type(row: Dict[str, Any]) -> str:
    """
    Intelligently classify the business entity represented by the row.
    Inspects both column names and cell contents.
    """
    keys_lower = " ".join([k.lower() for k in row.keys()])
    values_sample = " ".join([str(v).lower() for v in list(row.values())[:10]])
    combined = f"{keys_lower} {values_sample}"

    # Flight Detection
    flight_indicators = [
        "aircraftidentification", "fdpsflightstatus", "gufi", "icaomodelidentifier",
        "arrivalpoint", "departurepoint", "tfdmflighttype", "flightmessagetype",
        "nasflighttype", "coordinationtime"
    ]
    if any(ind in combined for ind in flight_indicators):
        return "Flight"

    # NOTAM Detection
    notam_indicators = [
        "notam", "ns3:text", "ns3:scenario", "affectedfir", "ns6:qline",
        "ns6:airportname", "aixmbasicmessage", "selectioncode"
    ]
    if any(ind in combined for ind in notam_indicators):
        return "NOTAM"

    # Weather Detection (for future feeds)
    weather_indicators = ["metar", "taf", "windspeed", "barometer", "visibility"]
    if any(ind in combined for ind in weather_indicators):
        return "Weather"

    return "GeneralEvent"


def extract_event_timestamp(row: Dict[str, Any]) -> datetime:
    """
    Attempt to extract the original event timestamp.
    Falls back to current UTC time if not found or unparseable.
    """
    candidate_keys = [
        "timestamp", "time", "time2", "ns3:issued", "ns2:beginPosition",
        "ns6:lastUpdated", "coordinationTime"
    ]
    for key in candidate_keys:
        for rk, rv in row.items():
            if key.lower() == rk.lower() and rv is not None:
                val_str = str(rv).strip()
                # Try ISO format
                try:
                    if val_str.endswith("Z"):
                        val_str = val_str[:-1] + "+00:00"
                    return datetime.fromisoformat(val_str)
                except Exception:
                    pass

    return datetime.now(timezone.utc)


def normalize_flight_record(row: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    """Normalize a Flight event row into standard domain fields and a summary."""
    flight_num = row.get("aircraftIdentification") or row.get("computerId")
    model = row.get("icaoModelIdentifier")
    dep = row.get("departurePoint")
    arr = row.get("arrivalPoint")
    status = row.get("fdpsFlightStatus", "UNKNOWN")
    center = row.get("centre") or row.get("system")
    gufi = row.get("gufi")
    dep_time = row.get("time2") or row.get("coordinationTime")
    arr_time = row.get("time")

    # Fallback search if standard keys weren't exact
    if not flight_num:
        for k, v in row.items():
            if "aircraft" in k.lower() or "flight" in k.lower():
                flight_num = str(v)
                break

    normalized = {
        "flightNumber": str(flight_num) if flight_num else "UNKNOWN",
        "gufi": str(gufi) if gufi else None,
        "aircraftModel": str(model) if model else None,
        "departureAirport": str(dep) if dep else None,
        "arrivalAirport": str(arr) if arr else None,
        "departureTime": str(dep_time) if dep_time else None,
        "arrivalTime": str(arr_time) if arr_time else None,
        "flightStatus": str(status).upper() if status else "UNKNOWN",
        "controlCenter": str(center) if center else None,
    }

    # Build concise human-readable summary
    flight_display = normalized["flightNumber"]
    model_str = f" ({normalized['aircraftModel']})" if normalized['aircraftModel'] else ""
    route_str = ""
    if normalized["departureAirport"] and normalized["arrivalAirport"]:
        route_str = f" {normalized['departureAirport']} -> {normalized['arrivalAirport']}"
    elif normalized["arrivalAirport"]:
        route_str = f" inbound {normalized['arrivalAirport']}"
    elif normalized["departureAirport"]:
        route_str = f" outbound {normalized['departureAirport']}"

    summary = f"Flight {flight_display}{model_str}{route_str} [{normalized['flightStatus']}]"
    return normalized, summary


def normalize_notam_record(row: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    """Normalize a NOTAM (Notice to Air Missions) event row into standard domain fields."""
    series = row.get("ns3:series", "")
    number = row.get("ns3:number", "")
    notam_type = row.get("ns3:type", "")
    notam_code = f"{series}{number}".strip() if (series or number) else "NOTAM"

    fir = row.get("ns3:affectedFIR")
    location = row.get("ns6:icaoLocation") or row.get("ns3:location")
    airport_name = row.get("ns6:airportname")
    text = row.get("ns3:text") or row.get("ns5:div", "")
    start_time = row.get("ns2:beginPosition")
    end_time = row.get("ns2:endPosition")
    classification = row.get("ns6:classification")
    qline = row.get("ns6:qline")
    uuid = row.get("ns2:identifier")

    normalized = {
        "notamCode": notam_code,
        "uuid": str(uuid) if uuid else None,
        "notamType": str(notam_type) if notam_type else None,
        "affectedFIR": str(fir) if fir else None,
        "locationIndicator": str(location) if location else None,
        "airportName": str(airport_name) if airport_name else None,
        "effectiveStart": str(start_time) if start_time else None,
        "effectiveEnd": str(end_time) if end_time else None,
        "text": str(text).strip() if text else None,
        "qLine": str(qline) if qline else None,
        "classification": str(classification) if classification else None,
    }

    # Build concise human-readable summary
    loc_str = location or (airport_name[:25] if airport_name else "Airspace")
    text_snippet = (normalized["text"] or "").replace("\n", " ").strip()
    if len(text_snippet) > 80:
        text_snippet = text_snippet[:77] + "..."
    summary = f"NOTAM {notam_code} ({loc_str}): {text_snippet or 'Advisory notice'}"
    return normalized, summary


def generate_event_id(
    entity_type: str,
    row: Dict[str, Any],
    source_file: str,
    row_idx: int
) -> str:
    """
    Generate a deterministic, unique internal event ID for deduplication.
    Prefers domain identifiers (GUFI, NOTAM UUID) if present;
    otherwise generates a SHA-256 fingerprint from the payload and location.
    """
    # 1. Flight GUFI
    if entity_type == "Flight" and row.get("gufi"):
        return f"evt_flight_{row['gufi']}"

    # 2. NOTAM UUID
    if entity_type == "NOTAM" and row.get("ns2:identifier"):
        return f"evt_notam_{row['ns2:identifier']}"

    # 3. Deterministic SHA-256 hash of payload + file metadata
    payload_repr = json.dumps(row, sort_keys=True, default=str)
    raw_key = f"{source_file}:{row_idx}:{payload_repr}"
    digest = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()[:16]
    return f"evt_syn_{entity_type.lower()}_{digest}"


def normalize_event_row(
    raw_row: Dict[Any, Any],
    source_file: str,
    sheet_name: str,
    row_idx: int,
    organization_id: str = "org_turning_point_default",
    source_id: str = "feed_synthetic_excel"
) -> Dict[str, Any]:
    """
    Main normalization entry point.
    Takes a raw row from an Excel spreadsheet and transforms it into the
    canonical EventInsight AI MongoDB document schema.
    """
    errors: List[str] = []
    status = "PROCESSED"

    # 1. Clean row dictionary
    sanitized_row = sanitize_row_dict(raw_row)

    if not sanitized_row:
        errors.append("Row is completely empty or all cells were NaN")
        status = "ERROR"
        return {
            "eventId": f"evt_empty_{hashlib.md5(f'{source_file}_{row_idx}'.encode()).hexdigest()[:12]}",
            "organizationId": organization_id,
            "sourceId": source_id,
            "receivedAt": datetime.now(timezone.utc),
            "eventTimestamp": datetime.now(timezone.utc),
            "format": "EXCEL_ROW",
            "entityType": "Unknown",
            "summary": f"Empty record at {source_file}:{row_idx}",
            "status": status,
            "normalized": {},
            "rawPayload": {},
            "ingestionMetadata": {
                "sourceFile": source_file,
                "sheetName": sheet_name,
                "rowIndex": row_idx
            },
            "processingErrors": errors
        }

    # 2. Classify Entity
    entity_type = detect_entity_type(sanitized_row)

    # 3. Extract Timestamps
    event_ts = extract_event_timestamp(sanitized_row)

    # 4. Domain Normalization
    normalized: Dict[str, Any] = {}
    summary = ""
    try:
        if entity_type == "Flight":
            normalized, summary = normalize_flight_record(sanitized_row)
        elif entity_type == "NOTAM":
            normalized, summary = normalize_notam_record(sanitized_row)
        else:
            summary = f"Event from {source_file} (Row {row_idx})"
            normalized = sanitized_row
    except Exception as e:
        errors.append(f"Normalization failed: {str(e)}")
        status = "WARNING"
        summary = f"Partial event ({entity_type}) at {source_file}:{row_idx}"

    # 5. Generate Deduplication Event ID
    event_id = generate_event_id(entity_type, sanitized_row, source_file, row_idx)

    # 6. Build Final Canonical Document
    return {
        "eventId": event_id,
        "organizationId": organization_id,
        "sourceId": source_id,
        "receivedAt": datetime.now(timezone.utc),
        "eventTimestamp": event_ts,
        "format": "EXCEL_ROW",
        "entityType": entity_type,
        "summary": summary,
        "status": status,
        "normalized": normalized,
        "rawPayload": sanitized_row,
        "ingestionMetadata": {
            "sourceFile": source_file,
            "sheetName": sheet_name,
            "rowIndex": row_idx
        },
        "processingErrors": errors if errors else None
    }
