"""
Adversarial Test Suite for Milestone 1: Mission Anomaly Report API Endpoint
Tests edge cases, path traversal, 404 handling, malformed/huge payloads, and special characters.
"""
import os
import shutil
import pytest
from fastapi.testclient import TestClient

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from api_server import app

client = TestClient(app)

TEST_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_reconstructed_sandbox")

@pytest.fixture(scope="module", autouse=True)
def setup_sandbox():
    os.makedirs(TEST_DIR, exist_ok=True)
    yield
    if os.path.exists(TEST_DIR):
        shutil.rmtree(TEST_DIR, ignore_errors=True)

def test_api_report_valid_mission():
    """Verify 200 OK and JSON structure for valid existing report."""
    mission_id = "SUBSEA-MOCK-VALID"
    m_dir = os.path.join(TEST_DIR, mission_id)
    os.makedirs(m_dir, exist_ok=True)
    report_file = os.path.join(m_dir, "MISSION_RECOVERY_REPORT.md")
    sample_content = "# Mission Recovery Report\n\n- Status: 100% RECOVERED\n- Parity: 4/4"
    with open(report_file, "w", encoding="utf-8") as f:
        f.write(sample_content)

    res = client.get(f"/api/missions/{mission_id}/report", params={"output_dir": TEST_DIR})
    assert res.status_code == 200
    data = res.json()
    assert data["mission_id"] == mission_id
    assert data["markdown_report"] == sample_content

def test_api_report_404_missing_mission():
    """Verify 404 when report file does not exist."""
    res = client.get("/api/missions/SUBSEA-NONEXISTENT-9999/report", params={"output_dir": TEST_DIR})
    assert res.status_code == 404
    assert "Recovery report not found" in res.json().get("detail", "")

def test_api_report_empty_report_file():
    """Verify 200 OK with empty string when report file is 0 bytes."""
    mission_id = "SUBSEA-EMPTY-FILE"
    m_dir = os.path.join(TEST_DIR, mission_id)
    os.makedirs(m_dir, exist_ok=True)
    report_file = os.path.join(m_dir, "MISSION_RECOVERY_REPORT.md")
    with open(report_file, "w", encoding="utf-8") as f:
        f.write("")

    res = client.get(f"/api/missions/{mission_id}/report", params={"output_dir": TEST_DIR})
    assert res.status_code == 200
    data = res.json()
    assert data["mission_id"] == mission_id
    assert data["markdown_report"] == ""

def test_api_report_huge_markdown():
    """Stress test: 5 MB markdown report payload."""
    mission_id = "SUBSEA-HUGE-REPORT"
    m_dir = os.path.join(TEST_DIR, mission_id)
    os.makedirs(m_dir, exist_ok=True)
    report_file = os.path.join(m_dir, "MISSION_RECOVERY_REPORT.md")
    
    # 50,000 lines of table rows (~3.5 MB)
    lines = ["# Massive Subsea Fleet Log\n\n| Shard | Drone | Status | CRC32 |", "|---|---|---|---|"]
    for i in range(50000):
        lines.append(f"| S-{i:05d} | DRONE-{(i % 10) + 1:02d} | VALID | 0xDEADBEEF |")
    huge_text = "\n".join(lines)
    with open(report_file, "w", encoding="utf-8") as f:
        f.write(huge_text)

    res = client.get(f"/api/missions/{mission_id}/report", params={"output_dir": TEST_DIR})
    assert res.status_code == 200
    data = res.json()
    assert len(data["markdown_report"]) == len(huge_text)
    assert data["markdown_report"][:26] == "# Massive Subsea Fleet Log"

def test_api_report_path_traversal_attempt():
    """Verify path traversal does not crash or expose root."""
    res = client.get("/api/missions/..%2F..%2Fetc/report", params={"output_dir": TEST_DIR})
    assert res.status_code == 404

def test_api_report_special_id_characters():
    """Test weird characters in mission_id."""
    special_ids = [
        "SUBSEA WITH SPACES",
        "SUBSEA_ANOMALY_100%_RECOVERED",
        "MISSION_ID_!@$^*()",
        "MISSION_ALPHA_🌊_OCEAN",
    ]
    for sid in special_ids:
        res = client.get(f"/api/missions/{sid}/report", params={"output_dir": TEST_DIR})
        # Should return 404 cleanly since file doesn't exist, never 500 crash
        assert res.status_code == 404, f"Failed on special ID: {sid}"
        assert "Recovery report not found" in res.json().get("detail", "")

def test_api_report_corrupted_encoding():
    """Test what happens if the report file contains raw invalid UTF-8 bytes."""
    mission_id = "SUBSEA-CORRUPTED-BYTES"
    m_dir = os.path.join(TEST_DIR, mission_id)
    os.makedirs(m_dir, exist_ok=True)
    report_file = os.path.join(m_dir, "MISSION_RECOVERY_REPORT.md")
    with open(report_file, "wb") as f:
        f.write(b"Normal prefix\x80\x81\xff corrupted bytes")

    # FastAPI TestClient will raise UnicodeDecodeError directly if unhandled by route
    with pytest.raises(UnicodeDecodeError):
        client.get(f"/api/missions/{mission_id}/report", params={"output_dir": TEST_DIR})
