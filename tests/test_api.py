"""Tests for FastAPI REST API endpoints."""
import os
import pytest
from fastapi.testclient import TestClient
from api_server import app

client = TestClient(app)


def test_root_endpoint():
    res = client.get("/")
    assert res.status_code == 200
    data = res.json()
    assert data["system"] == "Nautilus D-NAS"
    assert data["status"] == "ONLINE"


def test_health_endpoint():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "HEALTHY"
    assert data["galois_field"] == "GF(2^8)"


def test_analytics_r_swarm():
    res = client.get("/api/analytics/r-swarm?n=10&m=4&p=0.30")
    assert res.status_code == 200
    data = res.json()
    assert data["n_drones"] == 10
    assert data["m_parity_tolerance"] == 4
    assert 0.84 < data["swarm_survival_probability_r"] < 0.86


def test_end_to_end_api_pipeline(tmp_path):
    incoming_dir = str(tmp_path / "incoming")
    reconstructed_dir = str(tmp_path / "reconstructed")
    mission_id = "API-TEST-MISSION"

    # 1. Simulate mission via API
    sim_res = client.post(
        "/api/simulator/generate",
        json={
            "mission_id": mission_id,
            "base_dir": incoming_dir,
            "k": 6,
            "m": 4,
            "sunken_drones": 2,
            "corrupt_drones": 1,
            "matrix_type": "vandermonde",
        },
    )
    assert sim_res.status_code == 200
    sim_data = sim_res.json()
    assert sim_data["mission_id"] == mission_id
    assert sim_data["valid_shards_count"] == 7

    # 2. Run full pipeline via API
    pipe_res = client.post(
        "/api/pipeline/run-all",
        json={
            "mission_id": mission_id,
            "ingest_dir": incoming_dir,
            "output_dir": reconstructed_dir,
            "data_shards_k": 6,
            "parity_shards_m": 4,
            "enable_ai_index": True,
        },
    )
    assert pipe_res.status_code == 200
    pipe_data = pipe_res.json()
    assert pipe_data["pipeline_status"] == "SUCCESS_100_PERCENT_RECOVERED"
    assert pipe_data["decode"]["status"] == "100% RECOVERED"
    assert pipe_data["ai_indexed"] is True
    assert pipe_data["anomalies_count"] >= 1

    # 3. Retrieve report via API
    report_res = client.get(f"/api/missions/{mission_id}/report?output_dir={reconstructed_dir}")
    assert report_res.status_code == 200
    report_data = report_res.json()
    assert "Nautilus D-NAS Mission Recovery Report" in report_data["markdown_report"]
