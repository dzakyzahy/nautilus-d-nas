"""
Mission Directory Scanner & Shard Inventory for UGREEN AI NAS.
Scans incoming mission directories, parses manifest.json, and inventories
all uploaded .bin shards from docked / surfaced marine drones.
"""

import json
import os
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional
from nautilus_rs_codec.encoder import compute_file_sha256


@dataclass
class ShardAuditItem:
    index: int
    filename: str
    drone_id: str
    expected_sha256: str
    found: bool
    actual_size_bytes: int = 0
    actual_sha256: Optional[str] = None
    is_valid: bool = False
    is_corrupt: bool = False


@dataclass
class MissionInventory:
    mission_id: str
    manifest_path: str
    ingest_dir: str
    k_required: int
    m_parity: int
    total_n: int
    master_filename: str
    master_size_bytes: int
    master_sha256: str
    matrix_type: str
    shards: List[ShardAuditItem]
    valid_count: int
    missing_count: int
    corrupt_count: int

    def to_dict(self) -> dict:
        return asdict(self)


def scan_mission_inventory(ingest_dir: str, mission_id: str) -> MissionInventory:
    """
    Scans {ingest_dir}/{mission_id} for manifest.json and discovered shards.
    Computes cryptographic hashes and classifies each shard as valid, missing, or corrupt.
    """
    mission_dir = os.path.join(ingest_dir, mission_id)
    if not os.path.exists(mission_dir):
        raise FileNotFoundError(f"Mission directory does not exist: {mission_dir}")

    manifest_file = os.path.join(mission_dir, "manifest.json")
    if not os.path.exists(manifest_file):
        raise FileNotFoundError(f"manifest.json missing in mission directory: {mission_dir}")

    with open(manifest_file, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    k = manifest["reed_solomon"]["data_shards_k"]
    m = manifest["reed_solomon"]["parity_shards_m"]
    total_n = manifest["reed_solomon"]["total_shards_n"]
    matrix_type = manifest.get("matrix_type", "vandermonde")

    master_meta = manifest["master_payload"]
    expected_shards = {s["index"]: s for s in manifest.get("shards", [])}

    shard_items: List[ShardAuditItem] = []
    valid_count = 0
    missing_count = 0
    corrupt_count = 0

    for idx in range(total_n):
        expected_meta = expected_shards.get(idx, {})
        drone_id = expected_meta.get("drone_id", f"AUV-{idx+1:02d}")
        expected_sha = expected_meta.get("sha256", "")
        filename = expected_meta.get("filename", f"shard_{idx}.bin")

        shard_path = os.path.join(mission_dir, filename)

        if not os.path.exists(shard_path):
            missing_count += 1
            shard_items.append(
                ShardAuditItem(
                    index=idx,
                    filename=filename,
                    drone_id=drone_id,
                    expected_sha256=expected_sha,
                    found=False,
                )
            )
            continue

        size = os.path.getsize(shard_path)
        actual_sha = compute_file_sha256(shard_path)
        is_valid = (actual_sha == expected_sha)
        is_corrupt = not is_valid

        if is_valid:
            valid_count += 1
        else:
            corrupt_count += 1

        shard_items.append(
            ShardAuditItem(
                index=idx,
                filename=filename,
                drone_id=drone_id,
                expected_sha256=expected_sha,
                found=True,
                actual_size_bytes=size,
                actual_sha256=actual_sha,
                is_valid=is_valid,
                is_corrupt=is_corrupt,
            )
        )

    return MissionInventory(
        mission_id=mission_id,
        manifest_path=manifest_file,
        ingest_dir=mission_dir,
        k_required=k,
        m_parity=m,
        total_n=total_n,
        master_filename=master_meta.get("filename", f"{mission_id}.tar"),
        master_size_bytes=master_meta.get("size_bytes", 0),
        master_sha256=master_meta.get("sha256", ""),
        matrix_type=matrix_type,
        shards=shard_items,
        valid_count=valid_count,
        missing_count=missing_count,
        corrupt_count=corrupt_count,
    )
