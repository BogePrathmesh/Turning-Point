"""
EventInsight AI — Shared Solace PubSub+ Connection Builder
Loads broker credentials securely from environment variables (.env) and builds
a TLS-validated Solace MessagingService instance.
"""

import os
from typing import Any, Dict

import certifi
from dotenv import load_dotenv
from solace.messaging.config.transport_security_strategy import TLS
from solace.messaging.messaging_service import MessagingService


def load_solace_settings() -> Dict[str, str]:
    """Load Solace configuration from environment variables (never hardcoded)."""
    load_dotenv()
    return {
        "host": os.getenv("SOLACE_HOST", "").strip(),
        "vpn": os.getenv("SOLACE_VPN", "").strip(),
        "username": os.getenv("SOLACE_USERNAME", "").strip(),
        "password": os.getenv("SOLACE_PASSWORD", "").strip(),
        "topic": os.getenv("SOLACE_TOPIC", "eventinsight/events/>").strip(),
        "queue": os.getenv("SOLACE_QUEUE", "").strip(),
        "mongo_uri": os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017").strip(),
        "db_name": os.getenv("MONGODB_DB_NAME", "eventinsight_ai").strip(),
        "org_id": os.getenv("DEFAULT_ORG_ID", "org_turning_point_default").strip(),
        "source_id": os.getenv("DEFAULT_SOURCE_ID", "feed_solace_cloud").strip(),
    }


def validate_solace_settings(settings: Dict[str, str]) -> None:
    """Ensure required Solace connection parameters are present."""
    missing = [k for k in ("host", "vpn", "username", "password") if not settings.get(k)]
    if missing:
        raise ValueError(
            f"Missing Solace configuration in .env: {', '.join(k.upper() for k in missing)}"
        )


def build_messaging_service(settings: Dict[str, str]) -> MessagingService:
    """Create a configured Solace MessagingService with TLS certificate validation."""
    validate_solace_settings(settings)

    broker_props: Dict[str, Any] = {
        "solace.messaging.transport.host": settings["host"],
        "solace.messaging.service.vpn-name": settings["vpn"],
        "solace.messaging.authentication.scheme.basic.username": settings["username"],
        "solace.messaging.authentication.scheme.basic.password": settings["password"],
        "solace.messaging.transport.connection-retries": 3,
        "solace.messaging.transport.reconnection-attempts": 5,
    }

    tls_strategy = TLS.create().with_certificate_validation(
        True,
        validate_server_name=True,
        trust_store_file_path=os.path.dirname(certifi.where()),
    )

    return (
        MessagingService.builder()
        .from_properties(broker_props)
        .with_transport_security_strategy(tls_strategy)
        .build()
    )

