"""
Unit tests for EventInsight AI Solace Multi-Format Message Normalizer
"""

import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from ingestion.message_normalizer import detect_payload_format, normalize_broker_message


def test_detect_payload_format():
    assert detect_payload_format('{"flight": "AI203"}') == "JSON"
    assert detect_payload_format("<NasMessage></NasMessage>") == "XML"
    assert detect_payload_format("RUNWAY 27 CLOSED") == "PLAIN_TEXT"
    assert detect_payload_format("   ") == "EMPTY"


def test_normalize_json_flight():
    payload = json.dumps({
        "flight": "AI203",
        "gufi": "solace-test-123",
        "icaoModelIdentifier": "A320",
        "from": "BOM",
        "to": "DEL",
        "status": "DELAYED",
    })
    doc = normalize_broker_message(payload, "eventinsight/events/flight")
    assert doc["format"] == "JSON"
    assert doc["entityType"] == "Flight"
    assert doc["status"] == "PROCESSED"
    assert doc["eventId"] == "evt_flight_solace-test-123"
    assert doc["normalized"]["departureAirport"] == "BOM"
    assert doc["normalized"]["arrivalAirport"] == "DEL"
    assert "AI203" in doc["summary"]


def test_normalize_json_weather():
    payload = json.dumps({
        "airport": "CYYZ",
        "condition": "Heavy freezing rain",
        "severity": "HIGH",
    })
    doc = normalize_broker_message(payload, "eventinsight/events/weather")
    assert doc["format"] == "JSON"
    assert doc["entityType"] == "Weather"
    assert doc["status"] == "PROCESSED"
    assert doc["normalized"]["airport"] == "CYYZ"
    assert "CYYZ" in doc["summary"]


def test_normalize_real_fixm_xml():
    xml_path = os.path.join(
        os.path.dirname(__file__),
        "..",
        "Turning point apps canada",
        "dataset",
        "message (7).xml",
    )
    with open(xml_path, "r", encoding="utf-8") as f:
        xml_text = f.read()

    doc = normalize_broker_message(xml_text, "eventinsight/events/flight")
    assert doc["format"] == "XML"
    assert doc["entityType"] == "Flight"
    assert doc["status"] == "PROCESSED"
    assert doc["normalized"]["flightNumber"] == "SKW5378"
    assert doc["normalized"]["departureAirport"] == "KDEN"
    assert doc["normalized"]["arrivalAirport"] == "KFSD"
    assert doc["rawPayload"] == xml_text


def test_normalize_real_aixm_notam_xml():
    xml_path = os.path.join(
        os.path.dirname(__file__),
        "..",
        "Turning point apps canada",
        "dataset",
        "message (1).xml",
    )
    with open(xml_path, "r", encoding="utf-8") as f:
        xml_text = f.read()

    doc = normalize_broker_message(xml_text, "eventinsight/events/notam")
    assert doc["format"] == "XML"
    assert doc["entityType"] == "NOTAM"
    assert doc["status"] == "PROCESSED"
    assert doc["normalized"]["notamCode"] == "A8255"
    assert doc["normalized"]["affectedFIR"] == "KZOB"


def test_malformed_json_preserved_as_error():
    bad_payload = '{"flight": "AI203", "broken": '
    doc = normalize_broker_message(bad_payload, "eventinsight/events/flight")
    assert doc["status"] == "ERROR"
    assert doc["rawPayload"] == bad_payload
    assert doc["processingErrors"] is not None

