"""
Unit tests for EventInsight AI Excel Normalizer
"""

import math
import sys
import os
from datetime import datetime

# Add root directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from ingestion.excel_normalizer import (
    clean_cell_value,
    detect_entity_type,
    generate_event_id,
    is_null_or_nan,
    normalize_event_row,
    normalize_flight_record,
    normalize_notam_record,
    sanitize_row_dict,
)


def test_is_null_or_nan():
    assert is_null_or_nan(None) is True
    assert is_null_or_nan(float("nan")) is True
    assert is_null_or_nan("nan") is True
    assert is_null_or_nan("") is True
    assert is_null_or_nan("   ") is True
    assert is_null_or_nan("ACTIVE") is False
    assert is_null_or_nan(451) is False


def test_clean_cell_value():
    assert clean_cell_value(451.0) == 451
    assert clean_cell_value(451.5) == 451.5
    assert clean_cell_value(float("nan")) is None
    assert clean_cell_value(" KPHX ") == " KPHX "


def test_flight_normalization():
    sample_flight_row = {
        "aircraftIdentification": "N773TP",
        "icaoModelIdentifier": "BE20",
        "departurePoint": "KIWA",
        "arrivalPoint": "KSLC",
        "fdpsFlightStatus": "ACTIVE",
        "centre": "ZAB",
        "gufi": "b807504b-26ef-40da-949b-32e60b092d1c",
        "time": "2026-10-21T21:19:00Z",
        "time2": "2026-10-21T19:55:00Z",
    }
    entity = detect_entity_type(sample_flight_row)
    assert entity == "Flight"

    doc = normalize_event_row(
        sample_flight_row,
        source_file="Workbook8.xlsx",
        sheet_name="Sheet1",
        row_idx=0
    )

    assert doc["eventId"] == "evt_flight_b807504b-26ef-40da-949b-32e60b092d1c"
    assert doc["entityType"] == "Flight"
    assert doc["status"] == "PROCESSED"
    assert doc["normalized"]["flightNumber"] == "N773TP"
    assert doc["normalized"]["aircraftModel"] == "BE20"
    assert doc["normalized"]["departureAirport"] == "KIWA"
    assert doc["normalized"]["arrivalAirport"] == "KSLC"
    assert doc["normalized"]["flightStatus"] == "ACTIVE"
    assert "Flight N773TP" in doc["summary"]
    assert "KIWA -> KSLC" in doc["summary"]


def test_notam_normalization():
    sample_notam_row = {
        "ns2:identifier": "5592fb65-5ea2-4b2f-b834-39c7ef726583",
        "ns3:series": "M",
        "ns3:number": 498.0,
        "ns3:type": "N",
        "ns3:affectedFIR": "ZLA",
        "ns6:airportname": "POINT MUGU NAS (NAVAL BASE VENTURA CO)",
        "ns6:icaoLocation": "KNTD",
        "ns3:text": "AERODROME CAUTION UAS OPERATIONS WILL BE CONDUCTED IN THE IMMEDIATE VICINITY",
        "ns2:beginPosition": "2026-10-28T15:00:00.000Z",
        "ns2:endPosition": "2026-10-28T23:00:00.000Z",
    }
    entity = detect_entity_type(sample_notam_row)
    assert entity == "NOTAM"

    doc = normalize_event_row(
        sample_notam_row,
        source_file="Workbook9.xlsx",
        sheet_name="Sheet1",
        row_idx=0
    )

    assert doc["eventId"] == "evt_notam_5592fb65-5ea2-4b2f-b834-39c7ef726583"
    assert doc["entityType"] == "NOTAM"
    assert doc["status"] == "PROCESSED"
    assert doc["normalized"]["notamCode"] == "M498"
    assert doc["normalized"]["affectedFIR"] == "ZLA"
    assert doc["normalized"]["locationIndicator"] == "KNTD"
    assert "UAS OPERATIONS" in doc["summary"]


def test_empty_row_handling():
    empty_row = {
        "col1": float("nan"),
        "col2": None,
        "col3": "   "
    }
    doc = normalize_event_row(empty_row, "Empty.xlsx", "Sheet1", 4)
    assert doc["status"] == "ERROR"
    assert doc["processingErrors"] is not None
    assert doc["rawPayload"] == {}
