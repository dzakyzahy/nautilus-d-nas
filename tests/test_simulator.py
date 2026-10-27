"""Tests for Swarm Simulator and Mock Telemetry Generator."""
import os
import json
from swarm_simulator.sample_telemetry import (
    generate_imu_log,
    generate_acoustic_packets,
    generate_mock_sonar_frame,
    build_synthetic_mission_bundle,
)
from swarm_simulator.generate_mission import generate_mission_dataset


def test_sensor_generators():
    imu_csv = generate_imu_log(duration_points=20)
    assert "timestamp,depth_m" in imu_csv
    lines = imu_csv.strip().split("\n")
    assert len(lines) == 21  # 1 header + 20 rows

    packets = generate_acoustic_packets(count=15)
    assert len(packets) == 15
    assert packets[0]["frequency_khz"] == 12.5

    sonar_frame = generate_mock_sonar_frame(anomaly_type="pipeline_crack")
    assert len(sonar_frame) > 4
    header_len = int.from_bytes(sonar_frame[:4], byteorder="big")
    meta = json.loads(sonar_frame[4 : 4 + header_len].decode("utf-8"))
    assert meta["anomaly_signature"] == "pipeline_crack"


def test_build_synthetic_bundle():
    bundle_bytes, name = build_synthetic_mission_bundle(mission_id="SIM-TEST")
    assert len(bundle_bytes) > 0
    assert name.endswith(".tar")


def test_generate_mission_dataset(tmp_path):
    out_dir = str(tmp_path / "incoming")
    summary = generate_mission_dataset(
        mission_id="SIM-RUN-01",
        output_base_dir=out_dir,
        k=6,
        m=4,
        sunken_drones_count=2,
        corrupt_drones_count=1,
    )

    assert summary["mission_id"] == "SIM-RUN-01"
    assert summary["total_shards_n"] == 10
    assert len(summary["sunken_drone_indices"]) == 2
    assert len(summary["corrupted_shard_indices"]) == 1
    assert summary["valid_shards_count"] == 7
    assert summary["recovery_guaranteed"] is True

    # Check files on disk
    mission_dir = summary["mission_dir"]
    assert os.path.exists(os.path.join(mission_dir, "manifest.json"))
