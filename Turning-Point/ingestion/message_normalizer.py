"""
EventInsight AI — Multi-Format Broker Message Normalizer
Detects format (JSON, XML, Plain Text), parses heterogeneous payloads received
from Solace PubSub+ Event Broker, classifies the business entity (Flight, NOTAM,
Weather, Airport), extracts normalized fields, and preserves the raw payload.
"""

import hashlib
import json
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from ingestion.excel_normalizer import (
    detect_entity_type,
    extract_event_timestamp,
    normalize_flight_record,
    normalize_notam_record,
)


def detect_payload_format(raw_text: str) -> str:
    """Detect whether an incoming broker payload is JSON, XML, or Plain Text."""
    stripped = raw_text.strip()
    if not stripped:
        return "EMPTY"
    if stripped.startswith("{") or stripped.startswith("["):
        return "JSON"
    if stripped.startswith("<"):
        return "XML"
    return "PLAIN_TEXT"


def _flatten_xml_element(elem: ET.Element, flat: Dict[str, Any]) -> None:
    """
    Namespace-agnostic XML flattener.
    Extracts attributes and leaf text values using short tag names so FIXM 3.0,
    FIXM 4.0, and AIXM 5.1 payloads map cleanly into normalized extractors.
    """
    local_tag = elem.tag.split("}")[-1] if "}" in elem.tag else elem.tag

    for attr_k, attr_v in elem.attrib.items():
        local_attr = attr_k.split("}")[-1] if "}" in attr_k else attr_k
        if local_attr not in ("schemaLocation", "type"):
            flat.setdefault(local_attr, attr_v)
        elif local_attr == "type":
            flat.setdefault("xmlType", attr_v)

    text = (elem.text or "").strip()
    if text:
        if local_tag == "nameValue" and "name" in elem.attrib and "value" in elem.attrib:
            flat[elem.attrib["name"]] = elem.attrib["value"]
        else:
            flat.setdefault(local_tag, text)

    # Special handling for FIXM nameValue pairs
    if local_tag == "nameValue" and "name" in elem.attrib and "value" in elem.attrib:
        flat[elem.attrib["name"]] = elem.attrib["value"]

    for child in elem:
        _flatten_xml_element(child, flat)


def parse_xml_to_dict(raw_text: str) -> Dict[str, Any]:
    """Parse XML payload into a flattened dictionary of domain fields."""
    root = ET.fromstring(raw_text)
    flat: Dict[str, Any] = {}
    root_tag = root.tag.split("}")[-1] if "}" in root.tag else root.tag
    flat["rootElement"] = root_tag
    _flatten_xml_element(root, flat)

    # Normalize common FIXM 4.0 / AIXM tag variations into standard keys
    if "destinationPointText" in flat and "arrivalPoint" not in flat:
        flat["arrivalPoint"] = flat["destinationPointText"]
    if "departurePointText" in flat and "departurePoint" not in flat:
        flat["departurePoint"] = flat["departurePointText"]
    if "tfdmId" in flat and "gufi" not in flat:
        flat["gufi"] = flat["tfdmId"]
    if "reportedTimestamp" in flat and "timestamp" not in flat:
        flat["timestamp"] = flat["reportedTimestamp"]
    if "value" in flat and "fdpsFlightStatus" not in flat and "tfdmFlightState" in raw_text:
        flat["fdpsFlightStatus"] = flat["value"]
    if "locationIndicator" in flat and "centre" not in flat:
        flat["centre"] = flat["locationIndicator"]
    if "identifier" in flat and "ns2:identifier" not in flat and "AIXMBasicMessage" in raw_text:
        flat["ns2:identifier"] = flat["identifier"]
    if "series" in flat and "ns3:series" not in flat:
        flat["ns3:series"] = flat["series"]
    if "number" in flat and "ns3:number" not in flat:
        flat["ns3:number"] = flat["number"]
    if "type" in flat and "ns3:type" not in flat:
        flat["ns3:type"] = flat["type"]
    if "affectedFIR" in flat and "ns3:affectedFIR" not in flat:
        flat["ns3:affectedFIR"] = flat["affectedFIR"]
    if "airportname" in flat and "ns6:airportname" not in flat:
        flat["ns6:airportname"] = flat["airportname"]
    if "icaoLocation" in flat and "ns6:icaoLocation" not in flat:
        flat["ns6:icaoLocation"] = flat["icaoLocation"]
    if "location" in flat and "ns3:location" not in flat:
        flat["ns3:location"] = flat["location"]
    if "text" in flat and "ns3:text" not in flat:
        flat["ns3:text"] = flat["text"]
    if "beginPosition" in flat and "ns2:beginPosition" not in flat:
        flat["ns2:beginPosition"] = flat["beginPosition"]
    if "endPosition" in flat and "ns2:endPosition" not in flat:
        flat["ns2:endPosition"] = flat["endPosition"]
    if "issued" in flat and "ns3:issued" not in flat:
        flat["ns3:issued"] = flat["issued"]
    if "div" in flat and "ns5:div" not in flat:
        flat["ns5:div"] = flat["div"]

    return flat


def _flatten_json_dict(obj: Any, flat: Dict[str, Any]) -> None:
    """Flatten nested JSON dictionaries safely for entity classification."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, (dict, list)):
                _flatten_json_dict(v, flat)
            else:
                flat.setdefault(str(k), v)
    elif isinstance(obj, list):
        for item in obj:
            _flatten_json_dict(item, flat)


def _normalize_weather_record(flat: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    """Normalize a Weather advisory payload."""
    airport = flat.get("airport") or flat.get("station") or flat.get("location") or "UNKNOWN"
    condition = flat.get("condition") or flat.get("metar") or flat.get("weather") or "Weather Advisory"
    severity = flat.get("severity") or "MODERATE"
    normalized = {
        "airport": str(airport),
        "condition": str(condition),
        "severity": str(severity).upper(),
        "temperature": flat.get("temperature") or flat.get("temp"),
        "wind": flat.get("wind") or flat.get("windSpeed"),
    }
    summary = f"Weather ({airport}): {condition} [{normalized['severity']}]"
    return normalized, summary


def normalize_broker_message(
    raw_payload_text: str,
    topic_or_queue: str,
    broker_message_id: Optional[str] = None,
    organization_id: str = "org_turning_point_default",
    source_id: str = "feed_solace_cloud",
) -> Dict[str, Any]:
    """
    Parse, classify, and normalize an incoming Solace message into the
    canonical EventInsight AI MongoDB document format.
    Malformed payloads are preserved with status='ERROR' rather than dropped.
    """
    errors: List[str] = []
    status = "PROCESSED"
    detected_format = detect_payload_format(raw_payload_text)
    flat_fields: Dict[str, Any] = {}
    parsed_raw: Any = raw_payload_text

    if detected_format == "EMPTY":
        errors.append("Received empty message payload from broker.")
        status = "ERROR"
    elif detected_format == "JSON":
        try:
            parsed_json = json.loads(raw_payload_text)
            parsed_raw = parsed_json
            _flatten_json_dict(parsed_json, flat_fields)
        except json.JSONDecodeError as exc:
            errors.append(f"Invalid JSON payload: {exc}")
            status = "ERROR"
    elif detected_format == "XML":
        try:
            flat_fields = parse_xml_to_dict(raw_payload_text)
        except ET.ParseError as exc:
            errors.append(f"Invalid XML payload: {exc}")
            status = "ERROR"
    else:
        flat_fields = {"text": raw_payload_text}

    # Map common JSON shortcuts into standard keys if present
    if "flight" in flat_fields and "aircraftIdentification" not in flat_fields:
        flat_fields["aircraftIdentification"] = flat_fields["flight"]
    if "from" in flat_fields and "departurePoint" not in flat_fields:
        flat_fields["departurePoint"] = flat_fields["from"]
    if "to" in flat_fields and "arrivalPoint" not in flat_fields:
        flat_fields["arrivalPoint"] = flat_fields["to"]
    if "status" in flat_fields and "fdpsFlightStatus" not in flat_fields:
        flat_fields["fdpsFlightStatus"] = flat_fields["status"]

    # Entity classification (also check topic name hints)
    topic_lower = (topic_or_queue or "").lower()
    if flat_fields:
        entity_type = detect_entity_type(flat_fields)
        if entity_type == "GeneralEvent":
            if "weather" in topic_lower or "condition" in flat_fields or "severity" in flat_fields:
                entity_type = "Weather"
            elif "flight" in topic_lower:
                entity_type = "Flight"
            elif "notam" in topic_lower:
                entity_type = "NOTAM"
    else:
        entity_type = "Unknown"

    event_ts = extract_event_timestamp(flat_fields) if flat_fields else datetime.now(timezone.utc)

    # Domain normalization
    normalized: Dict[str, Any] = {}
    summary = ""
    try:
        if status == "ERROR":
            summary = f"Malformed {detected_format} message on {topic_or_queue}"
        elif entity_type == "Flight":
            normalized, summary = normalize_flight_record(flat_fields)
        elif entity_type == "NOTAM":
            normalized, summary = normalize_notam_record(flat_fields)
        elif entity_type == "Weather":
            normalized, summary = _normalize_weather_record(flat_fields)
        else:
            snippet = raw_payload_text.strip().replace("\n", " ")[:90]
            summary = f"Solace {detected_format} event on {topic_or_queue}: {snippet}"
            normalized = flat_fields
    except Exception as exc:
        errors.append(f"Normalization warning: {exc}")
        status = "WARNING"
        summary = f"Partial {entity_type} message on {topic_or_queue}"

    # Deterministic deduplication ID
    if entity_type == "Flight" and flat_fields.get("gufi"):
        event_id = f"evt_flight_{flat_fields['gufi']}"
    elif entity_type == "NOTAM" and flat_fields.get("ns2:identifier"):
        event_id = f"evt_notam_{flat_fields['ns2:identifier']}"
    elif broker_message_id:
        event_id = f"evt_solace_{broker_message_id}"
    else:
        digest = hashlib.sha256(f"{topic_or_queue}:{raw_payload_text}".encode("utf-8")).hexdigest()[:16]
        event_id = f"evt_solace_{entity_type.lower()}_{digest}"

    return {
        "eventId": event_id,
        "organizationId": organization_id,
        "sourceId": source_id,
        "receivedAt": datetime.now(timezone.utc),
        "eventTimestamp": event_ts,
        "format": detected_format,
        "entityType": entity_type,
        "summary": summary,
        "status": status,
        "normalized": normalized,
        "rawPayload": parsed_raw,
        "ingestionMetadata": {
            "broker": "Solace PubSub+",
            "destination": topic_or_queue,
            "brokerMessageId": broker_message_id,
        },
        "processingErrors": errors if errors else None,
    }
