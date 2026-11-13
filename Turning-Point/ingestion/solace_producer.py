"""
EventInsight AI — Solace Test Event Producer
Publishes representative aviation events (JSON Flight, JSON Weather, and actual
mentor-provided FAA FIXM / AIXM XML files) to your configured Solace PubSub+
Cloud broker so you can test the real-time end-to-end pipeline.
"""

import json
import os
import sys
import time
import uuid

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from solace.messaging.resources.topic import Topic

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from ingestion.solace_config import build_messaging_service, load_solace_settings


def build_sample_events() -> list:
    """Build a mixed batch of JSON and real mentor-provided XML payloads."""
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dataset_dir = os.path.join(base_dir, "Turning point apps canada", "dataset")

    events = [
        {
            "topic": "eventinsight/events/flight",
            "label": "Flight JSON (Live Solace Test)",
            "payload": json.dumps(
                {
                    "flight": "AI203",
                    "gufi": f"solace-test-{uuid.uuid4().hex[:12]}",
                    "icaoModelIdentifier": "A320",
                    "from": "BOM",
                    "to": "DEL",
                    "status": "DELAYED",
                    "delayMinutes": 25,
                    "centre": "VABB",
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                }
            ),
        },
        {
            "topic": "eventinsight/events/weather",
            "label": "Weather Advisory JSON (Live Solace Test)",
            "payload": json.dumps(
                {
                    "airport": "CYYZ",
                    "condition": "Crosswind gusting 32kt with light freezing rain",
                    "severity": "HIGH",
                    "windSpeed": "32kt",
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                }
            ),
        },
    ]

    # Attach real mentor XML files if present
    xml_samples = [
        ("message (7).xml", "eventinsight/events/flight", "FIXM 4.0 Flight XML"),
        ("message (1).xml", "eventinsight/events/notam", "AIXM 5.1 NOTAM XML"),
    ]
    for fname, topic, label in xml_samples:
        fpath = os.path.join(dataset_dir, fname)
        if os.path.isfile(fpath):
            with open(fpath, "r", encoding="utf-8") as f:
                events.append({"topic": topic, "label": f"{label} ({fname})", "payload": f.read()})

    return events


def publish_sample_batch() -> None:
    """Connect to Solace broker and publish representative events."""
    settings = load_solace_settings()
    service = build_messaging_service(settings)

    print(f"[..] Connecting publisher to Solace: {settings['host']}...")
    service.connect()
    print("[OK] Publisher connected.")

    publisher = service.create_direct_message_publisher_builder().build()
    publisher.start()

    try:
        samples = build_sample_events()
        for idx, item in enumerate(samples, start=1):
            msg = (
                service.message_builder()
                .with_application_message_id(f"pub-{uuid.uuid4().hex[:10]}")
                .build(item["payload"])
            )
            publisher.publish(destination=Topic.of(item["topic"]), message=msg)
            print(f"  [{idx}/{len(samples)}] Published '{item['label']}' -> topic '{item['topic']}'")
            time.sleep(0.2)
    finally:
        publisher.terminate()
        service.disconnect()
        print("[OK] Publisher disconnected cleanly.")


if __name__ == "__main__":
    publish_sample_batch()

