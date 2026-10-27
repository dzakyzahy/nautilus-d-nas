"""
Reed-Solomon (n, k) Erasure Coding Encoder for Nautilus D-NAS.
Splits a master subsea telemetry payload into k data shards and m parity shards
distributed across n = k + m marine drone nodes, and generates manifest.json.
"""

import hashlib
import json
import os
import math
from datetime import datetime, timezone
from typing import Dict, List, Tuple, Union
from nautilus_rs_codec.galois import GF
from nautilus_rs_codec.matrix import get_generator_matrix


def compute_sha256(data: bytes) -> str:
    """Computes hexadecimal SHA-256 hash of a byte buffer."""
    h = hashlib.sha256()
    h.update(data)
    return h.hexdigest()


def compute_file_sha256(file_path: str) -> str:
    """Computes hexadecimal SHA-256 hash of a file streaming in chunks."""
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def encode_bytes(
    payload: bytes,
    k: int = 6,
    m: int = 4,
    matrix_type: str = "vandermonde",
    mission_id: str = "MISSION-ALPHA",
    payload_name: str = "subsea_inspection_bundle.tar",
    drone_prefix: str = "AUV",
) -> Tuple[List[bytes], Dict]:
    """
    Encodes raw payload bytes into k data shards and m parity shards.

    Returns:
        (shards_list, manifest_dict)
    """
    if k <= 0 or m <= 0:
        raise ValueError("k and m must be positive integers")
    n = k + m
    if n > 256:
        raise ValueError(f"Total shards n={n} cannot exceed 256")

    original_size = len(payload)
    master_sha256 = compute_sha256(payload)

    # Shard size: each shard has length ceil(original_size / k)
    shard_size = math.ceil(original_size / k) if original_size > 0 else 1
    total_padded_size = shard_size * k
    padding_needed = total_padded_size - original_size

    padded_payload = payload + (b"\x00" * padding_needed)

    # Partition into k data shards
    data_shards: List[bytes] = []
    for i in range(k):
        start = i * shard_size
        end = start + shard_size
        data_shards.append(padded_payload[start:end])

    # Retrieve systematic generator matrix G of size n x k
    G = get_generator_matrix(k, m, matrix_type=matrix_type)

    all_shards: List[bytes] = []

    # First k shards are identical to data shards (systematic code)
    for i in range(k):
        all_shards.append(data_shards[i])

    # Generate m parity shards: Row (k + p) of G * D
    for p in range(m):
        row_idx = k + p
        parity_buffer = bytearray(shard_size)
        for j in range(k):
            coeff = G[row_idx][j]
            if coeff != 0:
                GF.vec_mul_accumulate(parity_buffer, data_shards[j], coeff)
        all_shards.append(bytes(parity_buffer))

    # Build manifest
    shards_metadata = []
    for idx, shard_data in enumerate(all_shards):
        drone_number = idx + 1
        drone_id = f"{drone_prefix}-{drone_number:02d}"
        shards_metadata.append(
            {
                "index": idx,
                "filename": f"shard_{idx}.bin",
                "drone_id": drone_id,
                "type": "data" if idx < k else "parity",
                "size_bytes": len(shard_data),
                "sha256": compute_sha256(shard_data),
            }
        )

    manifest = {
        "mission_id": mission_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "matrix_type": matrix_type,
        "reed_solomon": {
            "data_shards_k": k,
            "parity_shards_m": m,
            "total_shards_n": n,
            "shard_size_bytes": shard_size,
        },
        "master_payload": {
            "filename": payload_name,
            "size_bytes": original_size,
            "padded_size_bytes": total_padded_size,
            "sha256": master_sha256,
        },
        "shards": shards_metadata,
    }

    return all_shards, manifest


def encode_file(
    input_path: str,
    output_dir: str,
    mission_id: str,
    k: int = 6,
    m: int = 4,
    matrix_type: str = "vandermonde",
    drone_prefix: str = "AUV",
) -> Dict:
    """
    Encodes an on-disk file into shard binaries and manifest.json.
    Writes:
      - output_dir/manifest.json
      - output_dir/shard_0.bin ... shard_{n-1}.bin
    """
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input payload not found: {input_path}")

    with open(input_path, "rb") as f:
        payload = f.read()

    filename = os.path.basename(input_path)
    shards, manifest = encode_bytes(
        payload=payload,
        k=k,
        m=m,
        matrix_type=matrix_type,
        mission_id=mission_id,
        payload_name=filename,
        drone_prefix=drone_prefix,
    )

    os.makedirs(output_dir, exist_ok=True)

    # Save manifest.json
    manifest_path = os.path.join(output_dir, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    # Save shard files
    for idx, shard_data in enumerate(shards):
        shard_filename = f"shard_{idx}.bin"
        shard_path = os.path.join(output_dir, shard_filename)
        with open(shard_path, "wb") as f:
            f.write(shard_data)

    return manifest
