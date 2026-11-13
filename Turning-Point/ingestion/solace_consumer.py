"""
EventInsight AI — Solace PubSub+ Event Consumer Service
Connects to Solace Cloud / PubSub+ Broker over TLS, subscribes to configured
topics or queues, normalizes heterogeneous payloads, and stores them in MongoDB
while logging broker health and reconnection events to system_activity.
"""

import argparse
import os
import signal
import sys
import time
from datetime import datetime, timezone
from typing import Any, Optional

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from pymongo import MongoClient
from solace.messaging.messaging_service import (
    MessagingService,
    ReconnectionAttemptListener,
    ReconnectionListener,
    ServiceEvent,
    ServiceInterruptionListener,
)
from solace.messaging.receiver.inbound_message import InboundMessage
from solace.messaging.receiver.message_receiver import MessageHandler
from solace.messaging.resources.queue import Queue
from solace.messaging.resources.topic_subscription import TopicSubscription

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from ingestion.ingest_excel import setup_database_indexes
from ingestion.message_normalizer import normalize_broker_message
from ingestion.solace_config import build_messaging_service, load_solace_settings


def log_system_event(
    db,
    org_id: str,
    action: str,
    status: str,
    details: str,
    metadata: Optional[dict] = None,
) -> None:
    """Persist Solace broker/consumer lifecycle events for the System Info UI."""
    try:
        db["system_activity"].insert_one(
            {
                "timestamp": datetime.now(timezone.utc),
                "organizationId": org_id,
                "component": "Solace Broker Consumer",
                "action": action,
                "status": status,
                "details": details,
                "durationMs": 0,
                "metadata": metadata or {},
            }
        )
    except Exception as exc:
        print(f"[WARN] Could not write system_activity log: {exc}")


class BrokerLifecycleListener(
    ReconnectionListener, ReconnectionAttemptListener, ServiceInterruptionListener
):
    """Tracks Solace connection drops and recoveries cleanly."""

    def __init__(self, db, org_id: str, host: str):
        self.db = db
        self.org_id = org_id
        self.host = host

    def on_reconnecting(self, e: ServiceEvent) -> None:
        print(f"[SOLACE] Reconnecting to {self.host}...")
        log_system_event(
            self.db,
            self.org_id,
            "SOLACE_RECONNECTING",
            "WARNING",
            f"Attempting reconnection to Solace broker ({self.host}).",
        )

    def on_reconnected(self, e: ServiceEvent) -> None:
        print(f"[SOLACE] Reconnected to {self.host}.")
        log_system_event(
            self.db,
            self.org_id,
            "SOLACE_RECONNECTED",
            "SUCCESS",
            f"Re-established connection to Solace broker ({self.host}).",
        )

    def on_service_interrupted(self, event: ServiceEvent) -> None:
        cause = getattr(event, "get_cause", lambda: "Unknown")()
        print(f"[SOLACE] Service interrupted: {cause}")
        log_system_event(
            self.db,
            self.org_id,
            "SOLACE_CONNECTION_INTERRUPTED",
            "ERROR",
            f"Broker connection interrupted ({self.host}): {cause}",
        )


class EventMessageHandler(MessageHandler):
    """Handles inbound Solace messages, normalizes them, and upserts to MongoDB."""

    def __init__(self, db, org_id: str, source_id: str, persistent_receiver=None):
        self.db = db
        self.events_col = db["events"]
        self.org_id = org_id
        self.source_id = source_id
        self.persistent_receiver = persistent_receiver
        self.processed_count = 0

    def on_message(self, message: InboundMessage) -> None:
        destination = message.get_destination_name() or "unknown"
        broker_msg_id = message.get_application_message_id()

        raw_str = message.get_payload_as_string()
        if raw_str is None:
            raw_bytes = message.get_payload_as_bytes()
            raw_str = raw_bytes.decode("utf-8", errors="replace") if raw_bytes else ""

        doc = normalize_broker_message(
            raw_payload_text=raw_str,
            topic_or_queue=destination,
            broker_message_id=broker_msg_id,
            organization_id=self.org_id,
            source_id=self.source_id,
        )

        try:
            self.events_col.update_one(
                {"eventId": doc["eventId"]}, {"$set": doc}, upsert=True
            )
            self.processed_count += 1
            print(
                f"[MSG #{self.processed_count}] {doc['entityType']:<8} | "
                f"{doc['format']:<5} | {doc['status']:<9} | {doc['summary'][:70]}"
            )
            if self.persistent_receiver is not None:
                self.persistent_receiver.ack(message)
        except Exception as exc:
            print(f"[ERROR] Failed to store Solace message: {exc}")
            log_system_event(
                self.db,
                self.org_id,
                "SOLACE_STORAGE_ERROR",
                "ERROR",
                f"Failed writing event {doc['eventId']} to MongoDB: {exc}",
            )


def run_consumer(max_messages: int = 0, timeout_sec: int = 0) -> int:
    """Start the Solace consumer loop and return count of processed messages."""
    settings = load_solace_settings()

    # 1. Connect to MongoDB
    mongo_client = MongoClient(settings["mongo_uri"], serverSelectionTimeoutMS=5000)
    mongo_client.admin.command("ping")
    db = mongo_client[settings["db_name"]]
    setup_database_indexes(db)
    print(f"[OK] Connected to MongoDB ({settings['db_name']})")

    # 2. Build & Connect Solace MessagingService
    service: MessagingService = build_messaging_service(settings)
    lifecycle = BrokerLifecycleListener(db, settings["org_id"], settings["host"])
    service.add_reconnection_attempt_listener(lifecycle)
    service.add_reconnection_listener(lifecycle)
    service.add_service_interruption_listener(lifecycle)

    print(f"[..] Connecting to Solace broker: {settings['host']} (VPN: {settings['vpn']})...")
    service.connect()
    print("[OK] Solace broker connection established.")

    log_system_event(
        db,
        settings["org_id"],
        "SOLACE_BROKER_CONNECTED",
        "SUCCESS",
        f"Connected to Solace PubSub+ broker at {settings['host']} (VPN: {settings['vpn']}).",
        {"host": settings["host"], "vpn": settings["vpn"]},
    )

    # 3. Start Queue (Persistent) or Topic (Direct) Receiver
    use_queue = bool(settings["queue"])
    receiver = None
    handler = None

    if use_queue:
        queue_name = settings["queue"]
        receiver = (
            service.create_persistent_message_receiver_builder()
            .build(Queue.durable_exclusive_queue(queue_name))
        )
        receiver.start()
        handler = EventMessageHandler(
            db, settings["org_id"], settings["source_id"], persistent_receiver=receiver
        )
        receiver.receive_async(handler)
        dest_label = f"Queue '{queue_name}'"
    else:
        topic_pattern = settings["topic"]
        receiver = (
            service.create_direct_message_receiver_builder()
            .with_subscriptions([TopicSubscription.of(topic_pattern)])
            .build()
        )
        receiver.start()
        handler = EventMessageHandler(db, settings["org_id"], settings["source_id"])
        receiver.receive_async(handler)
        dest_label = f"Topic '{topic_pattern}'"

    print(f"[OK] Consumer started on {dest_label}. Waiting for events (Ctrl+C to stop)...")
    log_system_event(
        db,
        settings["org_id"],
        "SOLACE_CONSUMER_STARTED",
        "SUCCESS",
        f"Active consumer listening on {dest_label}.",
        {"destination": dest_label, "mode": "Queue" if use_queue else "Topic"},
    )

    stop_requested = False

    def _handle_sig(signum, frame):
        nonlocal stop_requested
        stop_requested = True

    signal.signal(signal.SIGINT, _handle_sig)
    signal.signal(signal.SIGTERM, _handle_sig)

    start_ts = time.time()
    try:
        while not stop_requested:
            if max_messages > 0 and handler.processed_count >= max_messages:
                break
            if timeout_sec > 0 and (time.time() - start_ts) >= timeout_sec:
                break
            time.sleep(0.25)
    finally:
        print("\n[..] Stopping Solace consumer...")
        if receiver:
            receiver.terminate(grace_period=2000)
        service.disconnect()
        log_system_event(
            db,
            settings["org_id"],
            "SOLACE_CONSUMER_STOPPED",
            "SUCCESS",
            f"Solace consumer stopped cleanly. Processed {handler.processed_count} messages.",
            {"processedCount": handler.processed_count},
        )
        print(f"[OK] Disconnected cleanly. Total messages processed: {handler.processed_count}")

    return handler.processed_count


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="EventInsight AI Solace Consumer")
    parser.add_argument(
        "--max-messages",
        type=int,
        default=0,
        help="Stop after consuming N messages (0 = run continuously)",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=0,
        help="Stop after N seconds (0 = run continuously)",
    )
    args = parser.parse_args()
    run_consumer(max_messages=args.max_messages, timeout_sec=args.timeout)
