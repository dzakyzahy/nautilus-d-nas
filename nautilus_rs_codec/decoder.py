"""
Reed-Solomon (n, k) Erasure Coding Decoder for Nautilus D-NAS.
Inverts the sub-matrix G_sub over GF(2^8) to reconstruct 100% of the
original telemetry payload from ANY surviving k shards.
"""

import json
import os
from typing import Dict, List, Optional, Union
from nautilus_rs_codec.galois import GF
from nautilus_rs_codec.matrix import gauss_jordan_invert, get_generator_matrix
from nautilus_rs_codec.encoder import compute_file_sha256, compute_sha256


class InsufficientShardsError(Exception):
    """Raised when the number of valid surviving shards is less than k."""
    pass


class ChecksumMismatchError(Exception):
    """Raised when the reconstructed payload hash does not match the manifest."""
    pass


def decode_shards(
    available_shards: Dict[int, bytes],
    original_size: int,
    k: int = 6,
    m: int = 4,
    matrix_type: str = "vandermonde",
) -> bytes:
    """
    Reconstructs master payload from at least k surviving shards.

    Args:
        available_shards: Map of shard_index -> shard bytes (at least k required)
        original_size: Exact byte length of the master unpadded payload
        k: Number of original data shards
        m: Number of parity shards
        matrix_type: 'vandermonde' or 'cauchy'

    Returns:
        Exact reconstructed payload bytes
    """
    if len(available_shards) < k:
        raise InsufficientShardsError(
            f"ERR_INSUFFICIENT_SHARDS: Have {len(available_shards)} valid shards, minimum k={k} required."
        )

    # Fast-Path: All original data shards (0 .. k-1) are intact
    all_data_present = all(i in available_shards for i in range(k))
    if all_data_present:
        reconstructed = b"".join(available_shards[i] for i in range(k))
        return reconstructed[:original_size]

    # Select the first k available shard indices
    selected_indices = sorted(available_shards.keys())[:k]

    # Shard size verification
    shard_size = len(available_shards[selected_indices[0]])
    for idx in selected_indices:
        if len(available_shards[idx]) != shard_size:
            raise ValueError(f"Inconsistent shard length at index {idx}")

    # Build full generator matrix G ((k + m) x k)
    G = get_generator_matrix(k, m, matrix_type=matrix_type)

    # Extract k x k submatrix G_sub corresponding to selected shard indices
    G_sub: List[List[int]] = [G[r] for r in selected_indices]

    # Invert G_sub over GF(2^8)
    G_sub_inv = gauss_jordan_invert(G_sub)

    # Reconstruct the k original data shards: D = G_sub_inv * S_sub
    # D_j = sum_{p=0}^{k-1} G_sub_inv[j][p] * S_{selected_indices[p]}
    reconstructed_data_shards: List[bytearray] = [bytearray(shard_size) for _ in range(k)]

    for j in range(k):
        for p, shard_idx in enumerate(selected_indices):
            coeff = G_sub_inv[j][p]
            if coeff != 0:
                GF.vec_mul_accumulate(
                    reconstructed_data_shards[j],
                    available_shards[shard_idx],
                    coeff,
                )

    # Concatenate data shards and truncate padding
    reconstructed = b"".join(bytes(buf) for buf in reconstructed_data_shards)
    return reconstructed[:original_size]


def decode_mission(
    manifest_source: Union[str, Dict],
    shards_dir: str,
    output_dir: str,
    output_filename: Optional[str] = None,
) -> Dict:
    """
    Decodes an entire mission directory from surviving shards.
    Scans shards_dir for valid shard_*.bin files, verifies integrity,
    executes matrix reconstruction, and writes payload to output_dir.

    Returns:
        Structured result dictionary.
    """
    if isinstance(manifest_source, str):
        with open(manifest_source, "r", encoding="utf-8") as f:
            manifest = json.load(f)
    else:
        manifest = manifest_source

    mission_id = manifest.get("mission_id", "UNKNOWN-MISSION")
    k = manifest["reed_solomon"]["data_shards_k"]
    m = manifest["reed_solomon"]["parity_shards_m"]
    total_n = manifest["reed_solomon"]["total_shards_n"]
    matrix_type = manifest.get("matrix_type", "vandermonde")

    master_payload_meta = manifest["master_payload"]
    original_size = master_payload_meta["size_bytes"]
    expected_master_sha256 = master_payload_meta["sha256"]
    payload_name = output_filename or master_payload_meta.get("filename", f"{mission_id}_payload.bin")

    # Discover and hash available shards
    expected_shards = {item["index"]: item for item in manifest.get("shards", [])}
    available_shards: Dict[int, bytes] = {}
    quarantined_shards: List[int] = []
    missing_shards: List[int] = []

    for idx in range(total_n):
        shard_filename = f"shard_{idx}.bin"
        shard_path = os.path.join(shards_dir, shard_filename)

        if not os.path.exists(shard_path):
            missing_shards.append(idx)
            continue

        with open(shard_path, "rb") as f:
            content = f.read()

        computed_sha = compute_sha256(content)
        expected_meta = expected_shards.get(idx)

        if expected_meta and computed_sha != expected_meta["sha256"]:
            # Corrupted / bit-rot shard
            quarantined_shards.append(idx)
        else:
            available_shards[idx] = content

    # Check sufficient shards
    if len(available_shards) < k:
        return {
            "status": "ERR_INSUFFICIENT_SHARDS",
            "mission_id": mission_id,
            "k_required": k,
            "valid_shards_count": len(available_shards),
            "missing_count": len(missing_shards),
            "quarantined_count": len(quarantined_shards),
            "missing_indices": missing_shards,
            "quarantined_indices": quarantined_shards,
            "message": f"Only {len(available_shards)}/{k} valid shards survived. Cannot guarantee 100% mathematical recovery.",
        }

    # Execute Reed-Solomon inversion
    reconstructed_bytes = decode_shards(
        available_shards=available_shards,
        original_size=original_size,
        k=k,
        m=m,
        matrix_type=matrix_type,
    )

    # Verify cryptographic integrity
    actual_master_sha256 = compute_sha256(reconstructed_bytes)
    if actual_master_sha256 != expected_master_sha256:
        raise ChecksumMismatchError(
            f"Master checksum mismatch! Expected {expected_master_sha256}, got {actual_master_sha256}"
        )

    # Write reconstructed payload
    os.makedirs(output_dir, exist_ok=True)
    out_file_path = os.path.join(output_dir, payload_name)
    with open(out_file_path, "wb") as f:
        f.write(reconstructed_bytes)

    return {
        "status": "100% RECOVERED",
        "mission_id": mission_id,
        "master_sha256_match": True,
        "output_path": out_file_path,
        "payload_size_bytes": len(reconstructed_bytes),
        "sha256": actual_master_sha256,
        "total_shards_n": total_n,
        "valid_shards_count": len(available_shards),
        "drones_lost": total_n - len(available_shards),
        "surviving_shard_indices": sorted(list(available_shards.keys())),
        "matrix_type": matrix_type,
    }
