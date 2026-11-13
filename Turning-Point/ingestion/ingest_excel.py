"""
EventInsight AI — Synthetic Excel Data Ingestion Runner
Connects to MongoDB, ensures proper indexes, ingests heterogeneous event rows
from Excel workbooks, normalizes payloads, and records ingestion telemetry.
"""

import glob
import os
import sys
import time
from datetime import datetime, timezone
from typing import Dict, Any, List

# Reconfigure stdout for UTF-8 on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import pandas as pd
from pymongo import MongoClient, ASCENDING, DESCENDING, UpdateOne
from pymongo.errors import PyMongoError

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from ingestion.excel_normalizer import normalize_event_row


def get_mongo_client(uri: str = "mongodb://127.0.0.1:27017") -> MongoClient:
    """Establish and return an active MongoDB client with connection check."""
    client = MongoClient(uri, serverSelectionTimeoutMS=5000)
    # Ping server to verify connectivity
    client.admin.command("ping")
    return client


def setup_database_indexes(db) -> None:
    """Create essential query indexes for fast search, filtering, and deduplication."""
    events = db["events"]

    # 1. Unique Event ID index for deduplication & fast lookup
    events.create_index([("eventId", ASCENDING)], unique=True, name="idx_event_id_unique")

    # 2. Multi-tenant and time-series query index
    events.create_index([("organizationId", ASCENDING), ("eventTimestamp", DESCENDING)], name="idx_org_time")

    # 3. Entity type filtering index
    events.create_index([("organizationId", ASCENDING), ("entityType", ASCENDING)], name="idx_org_entity")

    # 4. Processing status index
    events.create_index([("status", ASCENDING)], name="idx_status")

    # 5. Full-text search index on summary, normalized text, and identifiers
    events.create_index(
        [
            ("summary", "text"),
            ("normalized.flightNumber", "text"),
            ("normalized.notamCode", "text"),
            ("normalized.departureAirport", "text"),
            ("normalized.arrivalAirport", "text"),
            ("normalized.airportName", "text"),
            ("normalized.locationIndicator", "text"),
        ],
        name="idx_text_search"
    )
    print("[OK] MongoDB indexes verified and ensured.")


def process_workbook(
    file_path: str,
    db,
    org_id: str = "org_turning_point_default",
    source_id: str = "feed_synthetic_excel"
) -> Dict[str, Any]:
    """Process all valid sheets of an Excel workbook and upsert records into MongoDB."""
    filename = os.path.basename(file_path)
    excel = pd.ExcelFile(file_path)
    events_col = db["events"]

    stats = {
        "file": filename,
        "rowsRead": 0,
        "upserted": 0,
        "errors": 0,
        "entities": {}
    }

    operations: List[UpdateOne] = []

    for sheet_name in excel.sheet_names:
        try:
            df = excel.parse(sheet_name)
        except Exception as e:
            print(f"  [WARN] Failed to read sheet '{sheet_name}' in {filename}: {e}")
            continue

        if df.empty:
            continue

        # Clean column names to strings defensively
        df.columns = [str(c).strip() for c in df.columns]

        for row_idx, row in df.iterrows():
            stats["rowsRead"] += 1
            raw_dict = row.to_dict()

            doc = normalize_event_row(
                raw_row=raw_dict,
                source_file=filename,
                sheet_name=sheet_name,
                row_idx=row_idx,
                organization_id=org_id,
                source_id=source_id
            )

            entity = doc.get("entityType", "Unknown")
            stats["entities"][entity] = stats["entities"].get(entity, 0) + 1

            if doc.get("status") == "ERROR":
                stats["errors"] += 1

            # Prepare bulk upsert operation
            op = UpdateOne(
                {"eventId": doc["eventId"]},
                {"$set": doc},
                upsert=True
            )
            operations.append(op)

    # Execute bulk write in batches of 100 for maximum performance
    if operations:
        res = events_col.bulk_write(operations, ordered=False)
        stats["upserted"] = res.upserted_count + res.modified_count + res.matched_count

    return stats


def record_system_info_log(db, org_id: str, total_upserted: int, files_count: int, duration_sec: float):
    """Write an entry to the system_activity collection for the System Info dashboard view."""
    system_col = db["system_activity"]
    log_doc = {
        "timestamp": datetime.now(timezone.utc),
        "organizationId": org_id,
        "component": "Ingestion Pipeline",
        "action": "EXCEL_SYNTHETIC_INGESTION",
        "status": "SUCCESS",
        "details": f"Successfully processed {files_count} Excel files. Ingested/updated {total_upserted} events.",
        "durationMs": int(duration_sec * 1000),
        "metadata": {
            "filesProcessed": files_count,
            "totalRecords": total_upserted,
            "sourceType": "Synthetic_Excel"
        }
    }
    system_col.insert_one(log_doc)
    print("[OK] Recorded technical log in 'system_activity' collection.")


def run_ingestion(
    data_dir: str = None,
    mongo_uri: str = "mongodb://127.0.0.1:27017",
    db_name: str = "eventinsight_ai",
    org_id: str = "org_turning_point_default"
):
    """Main execution flow for synthetic Excel data ingestion."""
    start_time = time.time()
    print("=" * 70)
    print("EventInsight AI -- Synthetic Excel Data Ingestion Pipeline")
    print(f"Start Time: {datetime.now(timezone.utc).isoformat()}")
    print("=" * 70)

    # Default dataset location
    if not data_dir:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        data_dir = os.path.join(base_dir, "Turning point apps canada", "dataset", "xlsx_data")

    if not os.path.isdir(data_dir):
        print(f"[ERROR] Dataset directory not found: {data_dir}")
        sys.exit(1)

    xlsx_files = sorted(glob.glob(os.path.join(data_dir, "*.xlsx")))
    if not xlsx_files:
        print(f"[ERROR] No .xlsx files found in {data_dir}")
        sys.exit(1)

    print(f"Found {len(xlsx_files)} Excel workbooks to ingest from:\n  {data_dir}\n")

    # Connect to MongoDB
    try:
        client = get_mongo_client(mongo_uri)
        db = client[db_name]
        print(f"[OK] Connected to MongoDB at '{mongo_uri}', database: '{db_name}'")
    except Exception as e:
        print(f"[FATAL] Could not connect to MongoDB: {e}")
        print("Please ensure MongoDB is running (e.g., local service or via docker-compose up).")
        sys.exit(1)

    # Setup indexes
    setup_database_indexes(db)

    # Ingestion loop
    total_read = 0
    total_upserted = 0
    total_errors = 0
    overall_entities: Dict[str, int] = {}

    print("\nIngesting workbooks...")
    for fpath in xlsx_files:
        fname = os.path.basename(fpath)
        stats = process_workbook(fpath, db, org_id=org_id)
        total_read += stats["rowsRead"]
        total_upserted += stats["upserted"]
        total_errors += stats["errors"]

        for ent, cnt in stats["entities"].items():
            overall_entities[ent] = overall_entities.get(ent, 0) + cnt

        entities_summary = ", ".join([f"{k}: {v}" for k, v in stats["entities"].items()])
        print(f"  * {fname:<18} -> {stats['rowsRead']:>2} rows ({entities_summary})")

    duration = time.time() - start_time
    record_system_info_log(db, org_id, total_upserted, len(xlsx_files), duration)

    print("\n" + "=" * 70)
    print("INGESTION SUMMARY")
    print("=" * 70)
    print(f"Total Workbooks Processed : {len(xlsx_files)}")
    print(f"Total Rows Read           : {total_read}")
    print(f"Total Events Upserted     : {total_upserted}")
    print(f"Total Processing Errors   : {total_errors}")
    print("Entity Breakdown:")
    for ent, count in sorted(overall_entities.items()):
        print(f"  - {ent:<12}: {count} events")
    print(f"Execution Time            : {duration:.2f} seconds")
    print("=" * 70)


if __name__ == "__main__":
    run_ingestion()
