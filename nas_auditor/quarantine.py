"""
Automatic Bit-Rot Quarantine & Shard Integrity Enforcement.
Moves corrupted shards to /quarantine/ to protect the RS reconstruction engine
from poisoned matrix inputs, and enforces ERR_INSUFFICIENT_SHARDS threshold.
"""

import os
import shutil
from dataclasses import dataclass, asdict
from typing import List, Optional
from nas_auditor.scanner import scan_mission_inventory, MissionInventory


class InsufficientShardsAuditError(Exception):
    """Raised when available valid shards S_valid < k."""
    def __init__(self, message: str, missing_indices: List[int], quarantined_indices: List[int], valid_count: int, k_required: int):
        super().__init__(message)
        self.missing_indices = missing_indices
        self.quarantined_indices = quarantined_indices
        self.valid_count = valid_count
        self.k_required = k_required


@dataclass
class QuarantineResult:
    mission_id: str
    status: str  # "AUDIT_PASSED" or "ERR_INSUFFICIENT_SHARDS"
    k_required: int
    total_n: int
    valid_count: int
    quarantined_count: int
    missing_count: int
    valid_indices: List[int]
    quarantined_indices: List[int]
    missing_indices: List[int]
    quarantine_dir: Optional[str]
    can_reconstruct: bool
    message: str

    def to_dict(self) -> dict:
        return asdict(self)


def audit_and_quarantine(
    ingest_dir: str,
    mission_id: str,
    auto_quarantine: bool = True,
    raise_on_insufficient: bool = False,
) -> QuarantineResult:
    """
    Performs Step 1 of Nautilus D-NAS workflow:
    1. Scans mission directory and audits SHA-256 for all shards.
    2. Quarantines bit-rotted/corrupt shards to mission_dir/quarantine/.
    3. Verifies if valid shards >= k.

    Returns:
        QuarantineResult object.
    """
    inventory = scan_mission_inventory(ingest_dir, mission_id)
    mission_dir = os.path.join(ingest_dir, mission_id)
    quarantine_dir = os.path.join(mission_dir, "quarantine")

    valid_indices: List[int] = []
    quarantined_indices: List[int] = []
    missing_indices: List[int] = []

    for shard in inventory.shards:
        if not shard.found:
            missing_indices.append(shard.index)
        elif shard.is_corrupt:
            quarantined_indices.append(shard.index)
            if auto_quarantine:
                os.makedirs(quarantine_dir, exist_ok=True)
                source_path = os.path.join(mission_dir, shard.filename)
                target_path = os.path.join(quarantine_dir, shard.filename)
                # Safely move or copy to quarantine
                if os.path.exists(source_path):
                    shutil.move(source_path, target_path)
        else:
            valid_indices.append(shard.index)

    can_reconstruct = (len(valid_indices) >= inventory.k_required)
    status = "AUDIT_PASSED" if can_reconstruct else "ERR_INSUFFICIENT_SHARDS"

    if can_reconstruct:
        message = (
            f"Audit passed: {len(valid_indices)}/{inventory.total_n} valid shards available "
            f"(k={inventory.k_required} required). Ready for RS reconstruction."
        )
    else:
        message = (
            f"ERR_INSUFFICIENT_SHARDS: Only {len(valid_indices)}/{inventory.k_required} valid shards survived. "
            f"Lost/missing: {missing_indices}, Quarantined corrupt: {quarantined_indices}."
        )

    result = QuarantineResult(
        mission_id=mission_id,
        status=status,
        k_required=inventory.k_required,
        total_n=inventory.total_n,
        valid_count=len(valid_indices),
        quarantined_count=len(quarantined_indices),
        missing_count=len(missing_indices),
        valid_indices=valid_indices,
        quarantined_indices=quarantined_indices,
        missing_indices=missing_indices,
        quarantine_dir=quarantine_dir if quarantined_indices else None,
        can_reconstruct=can_reconstruct,
        message=message,
    )

    if raise_on_insufficient and not can_reconstruct:
        raise InsufficientShardsAuditError(
            message=message,
            missing_indices=missing_indices,
            quarantined_indices=quarantined_indices,
            valid_count=len(valid_indices),
            k_required=inventory.k_required,
        )

    return result
