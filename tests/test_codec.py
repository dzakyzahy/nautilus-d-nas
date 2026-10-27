"""Tests for Reed-Solomon Encoder and Decoder."""
import os
import pytest
from nautilus_rs_codec.encoder import encode_bytes, encode_file, compute_sha256
from nautilus_rs_codec.decoder import decode_shards, decode_mission, InsufficientShardsError, ChecksumMismatchError


@pytest.mark.parametrize("matrix_type", ["vandermonde", "cauchy"])
def test_encode_and_decode_all_surviving(matrix_type):
    payload = b"Hello Nautilus D-NAS deep-sea drone swarm storage on UGREEN AI NAS!" * 50
    k, m = 6, 4
    shards, manifest = encode_bytes(payload, k=k, m=m, matrix_type=matrix_type)

    assert len(shards) == 10
    assert manifest["master_payload"]["sha256"] == compute_sha256(payload)

    # All shards present
    available = {i: shards[i] for i in range(10)}
    reconstructed = decode_shards(available, original_size=len(payload), k=k, m=m, matrix_type=matrix_type)
    assert reconstructed == payload


@pytest.mark.parametrize("lost_indices", [
    [0],               # 1 drone lost
    [0, 1],            # 2 drones lost
    [1, 3, 5],         # 3 drones lost
    [0, 1, 2, 3],      # 4 drones lost (maximum fault tolerance m=4)
    [6, 7, 8, 9],      # all 4 parity lost (data intact)
    [2, 3, 7, 8],      # 2 data and 2 parity lost
])
def test_encode_and_decode_with_lost_drones(lost_indices):
    payload = os.urandom(8192)
    k, m = 6, 4
    shards, manifest = encode_bytes(payload, k=k, m=m, matrix_type="vandermonde")

    available = {i: shards[i] for i in range(10) if i not in lost_indices}
    assert len(available) >= k

    reconstructed = decode_shards(available, original_size=len(payload), k=k, m=m, matrix_type="vandermonde")
    assert reconstructed == payload
    assert compute_sha256(reconstructed) == compute_sha256(payload)


def test_insufficient_shards_error():
    payload = b"Sample small payload"
    k, m = 6, 4
    shards, _ = encode_bytes(payload, k=k, m=m)

    # Keep only 5 shards (less than k=6)
    available = {0: shards[0], 1: shards[1], 2: shards[2], 3: shards[3], 4: shards[4]}
    with pytest.raises(InsufficientShardsError):
        decode_shards(available, original_size=len(payload), k=k, m=m)


def test_encode_decode_file_roundtrip(tmp_path):
    input_file = tmp_path / "test_telemetry.tar"
    content = b"Subsea Bathymetry inspection data payload\x00\xFF\xAA\x55" * 1000
    input_file.write_bytes(content)

    shards_dir = tmp_path / "shards"
    out_dir = tmp_path / "reconstructed"

    manifest = encode_file(
        input_path=str(input_file),
        output_dir=str(shards_dir),
        mission_id="TEST-MISSION-01",
        k=6,
        m=4,
    )

    assert os.path.exists(shards_dir / "manifest.json")
    assert os.path.exists(shards_dir / "shard_0.bin")
    assert os.path.exists(shards_dir / "shard_9.bin")

    # Simulate deleting 3 shards
    os.remove(shards_dir / "shard_1.bin")
    os.remove(shards_dir / "shard_3.bin")
    os.remove(shards_dir / "shard_7.bin")

    res = decode_mission(
        manifest_source=str(shards_dir / "manifest.json"),
        shards_dir=str(shards_dir),
        output_dir=str(out_dir),
    )

    assert res["status"] == "100% RECOVERED"
    assert res["master_sha256_match"] is True
    reconstructed_path = res["output_path"]
    with open(reconstructed_path, "rb") as f:
        reconstructed_data = f.read()

    assert reconstructed_data == content
