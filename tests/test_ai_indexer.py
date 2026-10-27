"""Tests for AI Indexer and Markdown Mission Recovery Report Builder."""
import os
from ai_indexer.anomaly_tagger import LocalMultimodalTagger, DetectedAnomaly
from ai_indexer.report_builder import build_mission_recovery_report, calculate_theoretical_r_swarm
from swarm_simulator.sample_telemetry import build_synthetic_mission_bundle


def test_r_swarm_calculation():
    # n=10, m=4, p=0.30 -> R_swarm is ~85.0% (0.8497)
    r = calculate_theoretical_r_swarm(n=10, m=4, p_fail=0.30)
    assert 0.84 < r < 0.86

    # If m=0 (no parity), R = (1-p)^n = 0.7^10 ~ 0.028 (2.8%)
    r_no_parity = calculate_theoretical_r_swarm(n=10, m=0, p_fail=0.30)
    assert 0.02 < r_no_parity < 0.04


def test_anomaly_tagger_with_synthetic_bundle(tmp_path):
    bundle_bytes, _ = build_synthetic_mission_bundle(
        mission_id="TEST-BUNDLE",
        anomaly_types=["pipeline_crack", "galvanic_corrosion"],
    )
    tar_path = tmp_path / "bundle.tar"
    tar_path.write_bytes(bundle_bytes)

    tagger = LocalMultimodalTagger()
    anomalies = tagger.inspect_reconstructed_tar(str(tar_path))

    assert len(anomalies) >= 2
    types = [a.anomaly_type for a in anomalies]
    assert any("Crack" in t or "Fracture" in t for t in types)
    assert any("Corrosion" in t for t in types)


def test_report_builder(tmp_path):
    out_dir = str(tmp_path / "reconstructed" / "TEST-MISSION")
    decode_result = {
        "status": "100% RECOVERED",
        "mission_id": "TEST-MISSION",
        "master_sha256_match": True,
        "sha256": "abcdef1234567890abcdef1234567890",
        "output_path": os.path.join(out_dir, "payload.tar"),
        "total_shards_n": 10,
        "valid_shards_count": 8,
        "drones_lost": 2,
        "surviving_shard_indices": [0, 1, 2, 4, 5, 6, 7, 8],
        "reed_solomon": {"data_shards_k": 6, "parity_shards_m": 4},
        "matrix_type": "vandermonde",
    }
    audit_result = {
        "quarantined_indices": [3],
    }
    anomalies = [
        DetectedAnomaly(
            anomaly_id="ANOM-001",
            anomaly_type="Subsea Pipeline Micro-Fracture",
            severity="CRITICAL",
            confidence=0.97,
            source_file="sonar_001.bin",
            depth_m=850.5,
            coordinates={"lat": -8.1234, "lon": 115.5678},
            description="High backscatter anomaly along pipeline wall.",
            action_required="Deploy ROV clamp.",
        )
    ]

    report_path = build_mission_recovery_report(
        mission_id="TEST-MISSION",
        output_dir=out_dir,
        decode_result=decode_result,
        audit_result=audit_result,
        anomalies=anomalies,
    )

    assert os.path.exists(report_path)
    with open(report_path, "r", encoding="utf-8") as f:
        content = f.read()

    assert "Nautilus D-NAS Mission Recovery Report" in content
    assert "100% RECOVERED" in content
    assert "ANOM-001" in content
    assert "Subsea Pipeline Micro-Fracture" in content
    assert "AUV-04" in content  # index 3
    assert "CORRUPT" in content
