"""
Marine Swarm Telemetry Simulator & Mock Mission Generator.
Generates complete test missions, encodes them with Reed-Solomon (k, m) erasure coding,
and simulates real-world subsea drone failures (sunken drones, acoustic packet bit-rot).
"""

import argparse
import os
import random
from typing import Dict, List, Optional
from nautilus_rs_codec.encoder import encode_bytes
from swarm_simulator.sample_telemetry.mock_sensors import build_synthetic_mission_bundle


def generate_mission_dataset(
    mission_id: str = "SUBSEA-2026-ALPHA",
    output_base_dir: str = "./incoming",
    k: int = 6,
    m: int = 4,
    sunken_drones_count: int = 2,
    corrupt_drones_count: int = 1,
    explicit_sunken_indices: Optional[List[int]] = None,
    explicit_corrupt_indices: Optional[List[int]] = None,
    matrix_type: str = "vandermonde",
) -> Dict:
    """
    Generates a realistic marine mission incoming directory for UGREEN AI NAS.

    1. Builds synthetic mission payload (IMU, acoustic packets, sonar frames).
    2. Encodes into n = k + m shards using Reed-Solomon over GF(2^8).
    3. Simulates sunken drones by deleting corresponding shard files.
    4. Simulates bit-rot by mutating random bytes in designated shard files.
    5. Writes manifest.json and surviving shard files into {output_base_dir}/{mission_id}/.
    """
    mission_dir = os.path.join(output_base_dir, mission_id)
    os.makedirs(mission_dir, exist_ok=True)

    # 1. Synthesize subsea telemetry bundle
    payload_bytes, payload_name = build_synthetic_mission_bundle(mission_id=mission_id)

    # 2. RS Encode into k data + m parity shards
    shards, manifest = encode_bytes(
        payload=payload_bytes,
        k=k,
        m=m,
        matrix_type=matrix_type,
        mission_id=mission_id,
        payload_name=payload_name,
        drone_prefix="AUV",
    )

    n = k + m

    # 3. Determine sunken and corrupt drone indices
    all_indices = list(range(n))
    if explicit_sunken_indices is not None:
        sunken = list(set(explicit_sunken_indices))
    else:
        sunken_count = min(sunken_drones_count, n)
        sunken = random.sample(all_indices, sunken_count)

    remaining_indices = [idx for idx in all_indices if idx not in sunken]

    if explicit_corrupt_indices is not None:
        corrupt = [idx for idx in explicit_corrupt_indices if idx in remaining_indices]
    else:
        corrupt_count = min(corrupt_drones_count, len(remaining_indices))
        corrupt = random.sample(remaining_indices, corrupt_count) if corrupt_count > 0 else []

    # 4. Save manifest.json
    manifest_path = os.path.join(mission_dir, "manifest.json")
    import json
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    # 5. Write surviving shards (injecting bit-rot into corrupt shards)
    written_shards = []
    for idx in remaining_indices:
        shard_data = bytearray(shards[idx])
        is_corrupt = (idx in corrupt)

        if is_corrupt and len(shard_data) > 4:
            # Inject bit-rot (flip bits in the middle of shard)
            mid = len(shard_data) // 2
            shard_data[mid] ^= 0xFF
            shard_data[mid + 1] ^= 0xAA

        shard_filename = f"shard_{idx}.bin"
        shard_path = os.path.join(mission_dir, shard_filename)
        with open(shard_path, "wb") as f:
            f.write(bytes(shard_data))

        written_shards.append({
            "index": idx,
            "filename": shard_filename,
            "drone_id": f"AUV-{idx+1:02d}",
            "corrupt_injected": is_corrupt,
        })

    valid_surviving = len(remaining_indices) - len(corrupt)
    recovery_guaranteed = (valid_surviving >= k)

    summary = {
        "mission_id": mission_id,
        "mission_dir": mission_dir,
        "k_required": k,
        "m_parity": m,
        "total_shards_n": n,
        "master_payload_bytes": len(payload_bytes),
        "sunken_drone_indices": sorted(sunken),
        "corrupted_shard_indices": sorted(corrupt),
        "written_shards_count": len(written_shards),
        "valid_shards_count": valid_surviving,
        "recovery_guaranteed": recovery_guaranteed,
        "manifest_path": manifest_path,
    }

    return summary


def main():
    parser = argparse.ArgumentParser(description="Generate Marine Swarm Simulation Mission for Nautilus D-NAS")
    parser.add_argument("--mission-id", default="SUBSEA-2026-ALPHA", help="Mission ID")
    parser.add_argument("--out-dir", default="./incoming", help="Base output directory")
    parser.add_argument("-k", type=int, default=6, help="Data shards k (default: 6)")
    parser.add_argument("-m", type=int, default=4, help="Parity shards m (default: 4)")
    parser.add_argument("--sunken", type=int, default=2, help="Number of sunken/lost drones (default: 2)")
    parser.add_argument("--corrupt", type=int, default=1, help="Number of bit-rotted shards (default: 1)")
    parser.add_argument("--matrix-type", choices=["vandermonde", "cauchy"], default="vandermonde")

    args = parser.parse_args()

    print(f"[*] Simulating Marine Swarm Mission: {args.mission_id}")
    summary = generate_mission_dataset(
        mission_id=args.mission_id,
        output_base_dir=args.out_dir,
        k=args.k,
        m=args.m,
        sunken_drones_count=args.sunken,
        corrupt_drones_count=args.corrupt,
        matrix_type=args.matrix_type,
    )

    print(f"[+] Mission generated at: {summary['mission_dir']}")
    print(f"[+] Total drones: {summary['total_shards_n']} | k={summary['k_required']}, m={summary['m_parity']}")
    print(f"[+] Sunken drones (Lost): {summary['sunken_drone_indices']}")
    print(f"[+] Bit-rot shards (Corrupt): {summary['corrupted_shard_indices']}")
    print(f"[+] Valid surviving shards: {summary['valid_shards_count']}/{summary['k_required']}")
    print(f"[+] 100% Data Recovery Guaranteed: {summary['recovery_guaranteed']}")


if __name__ == "__main__":
    main()
