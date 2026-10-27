"""
Mock Subsea Sensor & Telemetry Data Synthesizer for Nautilus D-NAS.
Generates realistic multi-sensor telemetry bundles (IMU, acoustic modem,
bathymetric depth logs, and simulated sonar frames with anomaly tags).
"""

import io
import json
import math
import random
import tarfile
import time
from typing import Dict, List, Tuple


def generate_imu_log(duration_points: int = 120, base_depth: float = 850.0) -> str:
    """Generates CSV telemetry of subsea IMU (depth, temperature, pressure, attitude)."""
    rows = ["timestamp,depth_m,pressure_bar,temperature_c,roll_deg,pitch_deg,yaw_deg,battery_pct"]
    curr_time = 1793100000.0  # Future timestamp (2026)
    depth = base_depth
    battery = 98.5

    for i in range(duration_points):
        curr_time += 1.0
        depth += random.uniform(-0.15, 0.25)
        pressure = (depth / 10.0) * 1.025 + 1.013  # Hydrostatic pressure
        temp = 4.2 - (depth - 500) * 0.003 + random.uniform(-0.05, 0.05)
        roll = math.sin(i * 0.1) * 2.5 + random.uniform(-0.2, 0.2)
        pitch = math.cos(i * 0.08) * 1.8 + random.uniform(-0.1, 0.1)
        yaw = (i * 0.5) % 360.0
        battery = max(10.0, battery - 0.05)
        rows.append(f"{curr_time:.2f},{depth:.2f},{pressure:.2f},{temp:.2f},{roll:.2f},{pitch:.2f},{yaw:.2f},{battery:.2f}")

    return "\n".join(rows)


def generate_acoustic_packets(count: int = 40) -> List[Dict]:
    """Generates acoustic mesh transmission log between drones."""
    packets = []
    base_t = 1793100000.0
    for i in range(count):
        src_id = f"AUV-{random.randint(1, 10):02d}"
        dst_id = f"AUV-{random.randint(1, 10):02d}"
        packets.append({
            "packet_id": f"PKT-{i:04d}",
            "timestamp": base_t + i * 2.5,
            "src": src_id,
            "dst": dst_id,
            "frequency_khz": 12.5,
            "snr_db": round(random.uniform(8.5, 24.0), 1),
            "bitrate_bps": 480,
            "status": "ACK_RECEIVED" if random.random() > 0.05 else "RETRY_TIMEOUT",
        })
    return packets


def generate_mock_sonar_frame(anomaly_type: str = "pipeline_crack") -> bytes:
    """
    Generates synthetic sonar waterfall plot binary frame with metadata header
    and injected structural anomaly patterns for UGREEN AI indexing.
    """
    header = {
        "sonar_type": "Synthetic Aperture Sonar (SAS)",
        "frequency_mhz": 0.45,
        "swath_width_m": 150.0,
        "anomaly_signature": anomaly_type,
        "confidence_prior": 0.94,
        "gps_approx": {"lat": -8.4521, "lon": 115.1245, "depth_m": 872.4},
    }
    header_json = json.dumps(header).encode("utf-8")
    header_len = len(header_json).to_bytes(4, byteorder="big")

    # Synthetic sonar scan raster (64x64 float matrix simulated as pseudo-random bytes)
    raw_sonar = bytearray(random.randbytes(4096))
    # Inject deterministic anomaly signature pattern
    if anomaly_type == "pipeline_crack":
        for idx in range(100, 300, 10):
            raw_sonar[idx : idx + 4] = b"\xFF\xEE\xDD\xCC"
    elif anomaly_type == "corrosion_patch":
        for idx in range(500, 800, 15):
            raw_sonar[idx : idx + 4] = b"\xAA\xBB\xCC\xDD"

    return header_len + header_json + bytes(raw_sonar)


def build_synthetic_mission_bundle(
    mission_id: str = "SUBSEA-2026-ALPHA",
    payload_name: str = "subsea_inspection_bundle.tar",
    anomaly_types: List[str] = None,
) -> Tuple[bytes, str]:
    """
    Builds a complete in-memory tar archive representing a deep-sea drone swarm mission.
    Contains sensor logs, acoustic packets, and sonar frames with subsea anomalies.

    Returns:
        (bundle_bytes, payload_name)
    """
    if anomaly_types is None:
        anomaly_types = ["pipeline_crack", "galvanic_corrosion", "gas_seepage"]

    tar_stream = io.BytesIO()
    with tarfile.open(fileobj=tar_stream, mode="w") as tar:
        # 1. Mission Meta JSON
        meta = {
            "mission_id": mission_id,
            "target": "Offshore Pipeline Segment Bravo-7",
            "environment": "Deep-sea abyssal plain (850m depth)",
            "swarm_fleet_size": 10,
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        meta_data = json.dumps(meta, indent=2).encode("utf-8")
        ti = tarfile.TarInfo(name=f"{mission_id}/mission_metadata.json")
        ti.size = len(meta_data)
        tar.addfile(ti, io.BytesIO(meta_data))

        # 2. IMU Telemetry CSV
        imu_csv = generate_imu_log().encode("utf-8")
        ti = tarfile.TarInfo(name=f"{mission_id}/telemetry/flight_imu_log.csv")
        ti.size = len(imu_csv)
        tar.addfile(ti, io.BytesIO(imu_csv))

        # 3. Acoustic Modem Log
        acoustic_json = json.dumps(generate_acoustic_packets(), indent=2).encode("utf-8")
        ti = tarfile.TarInfo(name=f"{mission_id}/telemetry/acoustic_mesh_log.json")
        ti.size = len(acoustic_json)
        tar.addfile(ti, io.BytesIO(acoustic_json))

        # 4. Sonar Inspection Frames
        for i, anomaly in enumerate(anomaly_types):
            frame_bytes = generate_mock_sonar_frame(anomaly)
            ti = tarfile.TarInfo(name=f"{mission_id}/sonar/sonar_frame_{i:03d}_{anomaly}.bin")
            ti.size = len(frame_bytes)
            tar.addfile(ti, io.BytesIO(frame_bytes))

    tar_bytes = tar_stream.getvalue()
    return tar_bytes, payload_name
