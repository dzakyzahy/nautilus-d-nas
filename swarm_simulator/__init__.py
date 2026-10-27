"""Marine Swarm Simulator module for Nautilus D-NAS."""
from swarm_simulator.generate_mission import generate_mission_dataset
from swarm_simulator.sample_telemetry import (
    generate_imu_log,
    generate_acoustic_packets,
    generate_mock_sonar_frame,
    build_synthetic_mission_bundle,
)

__all__ = [
    "generate_mission_dataset",
    "generate_imu_log",
    "generate_acoustic_packets",
    "generate_mock_sonar_frame",
    "build_synthetic_mission_bundle",
]
