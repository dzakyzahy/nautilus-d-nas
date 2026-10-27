"""
CLI Interface for Nautilus RS Codec.
Usage:
    python -m nautilus_rs_codec encode --input <file> --out <dir> [--k 6] [--m 4] [--mission-id <id>]
    python -m nautilus_rs_codec decode --manifest <path> --shards <dir> --out <dir>
    python -m nautilus_rs_codec benchmark [--size-kb 1024] [--k 6] [--m 4]
"""

import argparse
import json
import os
import sys
import time
from nautilus_rs_codec.encoder import encode_file, encode_bytes, compute_sha256
from nautilus_rs_codec.decoder import decode_mission, decode_shards
from nautilus_rs_codec.galois import GF


def cmd_encode(args):
    print(f"[*] Encoding payload: {args.input}")
    print(f"[*] Reed-Solomon scheme: (k={args.k}, m={args.m}) -> n={args.k + args.m} shards")
    print(f"[*] Matrix type: {args.matrix_type}")

    manifest = encode_file(
        input_path=args.input,
        output_dir=args.out,
        mission_id=args.mission_id,
        k=args.k,
        m=args.m,
        matrix_type=args.matrix_type,
    )

    print(f"[+] Successfully generated {manifest['reed_solomon']['total_shards_n']} shards in {args.out}")
    print(f"[+] Master SHA-256: {manifest['master_payload']['sha256']}")
    print(f"[+] Manifest saved to {os.path.join(args.out, 'manifest.json')}")


def cmd_decode(args):
    print(f"[*] Scanning shards from: {args.shards}")
    print(f"[*] Reading manifest from: {args.manifest}")

    result = decode_mission(
        manifest_source=args.manifest,
        shards_dir=args.shards,
        output_dir=args.out,
        output_filename=args.output_filename,
    )

    if result.get("status") == "100% RECOVERED":
        print(f"[+] 100% RECONSTRUCTION SUCCESSFUL!")
        print(f"[+] Mission ID: {result['mission_id']}")
        print(f"[+] Surviving Shards: {result['valid_shards_count']}/{result['total_shards_n']}")
        print(f"[+] Drones Lost/Sunken: {result['drones_lost']}")
        print(f"[+] Payload Reconstructed: {result['output_path']}")
        print(f"[+] Verified Master SHA-256: {result['sha256']}")
    else:
        print(f"[-] ERROR: {result.get('status')}")
        print(f"[-] {result.get('message')}")
        print(f"[-] Missing Indices: {result.get('missing_indices')}")
        sys.exit(1)


def cmd_benchmark(args):
    size_bytes = args.size_kb * 1024
    print(f"[*] Benchmarking Nautilus RS Codec with {args.size_kb} KB payload")
    print(f"[*] RS parameters: k={args.k}, m={args.m} (n={args.k + args.m}), matrix={args.matrix_type}")

    # Generate test payload
    test_data = os.urandom(size_bytes)
    original_sha = compute_sha256(test_data)

    # Measure encoding
    t0 = time.perf_counter()
    shards, manifest = encode_bytes(
        payload=test_data,
        k=args.k,
        m=args.m,
        matrix_type=args.matrix_type,
        mission_id="BENCHMARK-RUN",
    )
    t_enc = time.perf_counter() - t0
    enc_speed_mb = (size_bytes / (1024 * 1024)) / t_enc

    print(f"[+] Encode time: {t_enc*1000:.2f} ms ({enc_speed_mb:.2f} MB/s)")

    # Simulate drone loss: keep only k random/first shards (lost m shards)
    surviving_shards = {i: shards[i] for i in range(args.k)}
    print(f"[*] Simulating drone failure: lost {args.m} drones (keeping {args.k}/{args.k + args.m} shards)")

    # Measure decoding
    t0 = time.perf_counter()
    recovered_data = decode_shards(
        available_shards=surviving_shards,
        original_size=size_bytes,
        k=args.k,
        m=args.m,
        matrix_type=args.matrix_type,
    )
    t_dec = time.perf_counter() - t0
    dec_speed_mb = (size_bytes / (1024 * 1024)) / t_dec

    rec_sha = compute_sha256(recovered_data)
    assert original_sha == rec_sha, "Benchmark checksum mismatch!"

    print(f"[+] Decode time: {t_dec*1000:.2f} ms ({dec_speed_mb:.2f} MB/s)")
    print(f"[+] Integrity Verification: 100% BIT-EXACT MATCH ({rec_sha[:16]}...)")


def main():
    parser = argparse.ArgumentParser(
        prog="nautilus_rs_codec",
        description="Nautilus D-NAS Reed-Solomon Erasure Coding Engine",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Encode parser
    p_enc = subparsers.add_parser("encode", help="Encode payload into RS shards")
    p_enc.add_argument("--input", "-i", required=True, help="Input payload file")
    p_enc.add_argument("--out", "-o", required=True, help="Output directory for shards")
    p_enc.add_argument("--mission-id", default="MISSION-ALPHA", help="Mission ID")
    p_enc.add_argument("-k", type=int, default=6, help="Data shards (default: 6)")
    p_enc.add_argument("-m", type=int, default=4, help="Parity shards (default: 4)")
    p_enc.add_argument("--matrix-type", choices=["vandermonde", "cauchy"], default="vandermonde")
    p_enc.set_defaults(func=cmd_encode)

    # Decode parser
    p_dec = subparsers.add_parser("decode", help="Decode shards into original payload")
    p_dec.add_argument("--manifest", required=True, help="Path to manifest.json")
    p_dec.add_argument("--shards", required=True, help="Directory containing shard binaries")
    p_dec.add_argument("--out", required=True, help="Output directory for payload")
    p_dec.add_argument("--output-filename", default=None, help="Optional output filename override")
    p_dec.set_defaults(func=cmd_decode)

    # Benchmark parser
    p_bench = subparsers.add_parser("benchmark", help="Benchmark encode/decode speed")
    p_bench.add_argument("--size-kb", type=int, default=1024, help="Payload size in KB (default: 1024)")
    p_bench.add_argument("-k", type=int, default=6, help="Data shards (default: 6)")
    p_bench.add_argument("-m", type=int, default=4, help="Parity shards (default: 4)")
    p_bench.add_argument("--matrix-type", choices=["vandermonde", "cauchy"], default="vandermonde")
    p_bench.set_defaults(func=cmd_benchmark)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
