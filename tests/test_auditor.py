"""Tests for NAS Auditor, Shard Inventory, and Bit-Rot Quarantine."""
import os
import json
import pytest
from nautilus_rs_codec.encoder import encode_file
from nas_auditor.scanner import scan_mission_inventory
from nas_auditor.quarantine import audit_and_quarantine, InsufficientShardsAuditError


def setup_test_mission(tmp_path, corrupt_shard_idx=None, missing_shard_indices=None):
    if missing_shard_indices is None:
        missing_shard_indices = []

    ingest_dir = tmp_path / "incoming"
    mission_id = "SUBSEA-AUDIT-TEST"
    mission_dir = ingest_dir / mission_id

    # Create dummy source payload
    payload_file = tmp_path / "payload.tar"
    payload_file.write_bytes(b"Acoustic subsea mission stream" * 200)

    encode_file(
        input_path=str(payload_file),
        output_dir=str(mission_dir),
        mission_id=mission_id,
        k=6,
        m=4,
    )

    # Delete missing shards
    for idx in missing_shard_indices:
        p = mission_dir / f"shard_{idx}.bin"
        if p.exists():
            p.unlink()

    # Corrupt shard
    if corrupt_shard_idx is not None:
        p = mission_dir / f"shard_{corrupt_shard_idx}.bin"
        if p.exists():
            data = bytearray(p.read_bytes())
            data[len(data) // 2] ^= 0xFF
            p.write_bytes(data)

    return str(ingest_dir), mission_id, str(mission_dir)


def test_scanner_clean_mission(tmp_path):
    ingest_dir, mission_id, _ = setup_test_mission(tmp_path)
    inventory = scan_mission_inventory(ingest_dir, mission_id)

    assert inventory.mission_id == mission_id
    assert inventory.valid_count == 10
    assert inventory.missing_count == 0
    assert inventory.corrupt_count == 0


def test_audit_quarantine_bitrot(tmp_path):
    ingest_dir, mission_id, mission_dir = setup_test_mission(
        tmp_path,
        corrupt_shard_idx=2,
        missing_shard_indices=[8, 9],
    )

    result = audit_and_quarantine(ingest_dir, mission_id, auto_quarantine=True)

    assert result.status == "AUDIT_PASSED"
    assert result.can_reconstruct is True
    assert result.valid_count == 7  # 10 - 2 missing - 1 corrupt = 7 (>= 6)
    assert result.quarantined_count == 1
    assert 2 in result.quarantined_indices
    assert set(result.missing_indices) == {8, 9}

    # Verify corrupt shard was moved to quarantine folder
    quarantine_path = os.path.join(mission_dir, "quarantine", "shard_2.bin")
    assert os.path.exists(quarantine_path)
    assert not os.path.exists(os.path.join(mission_dir, "shard_2.bin"))


def test_insufficient_shards_quarantine(tmp_path):
    # 5 missing shards -> only 5 valid shards (< k=6)
    ingest_dir, mission_id, _ = setup_test_mission(
        tmp_path,
        missing_shard_indices=[0, 1, 2, 3, 4],
    )

    result = audit_and_quarantine(ingest_dir, mission_id, auto_quarantine=True)
    assert result.status == "ERR_INSUFFICIENT_SHARDS"
    assert result.can_reconstruct is False
    assert result.valid_count == 5

    with pytest.raises(InsufficientShardsAuditError):
        audit_and_quarantine(ingest_dir, mission_id, raise_on_insufficient=True)
