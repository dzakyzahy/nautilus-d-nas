"""
Nautilus RS Codec - Reed-Solomon Erasure Coding Engine over GF(2^8).
Decentralized Marine Drone Swarm Storage for UGREEN AI NAS.
"""

from nautilus_rs_codec.galois import GaloisField256, GF
from nautilus_rs_codec.matrix import (
    MatrixInversionError,
    gauss_jordan_invert,
    build_vandermonde_matrix,
    build_cauchy_matrix,
    get_generator_matrix,
)
from nautilus_rs_codec.encoder import encode_bytes, encode_file, compute_sha256
from nautilus_rs_codec.decoder import (
    decode_shards,
    decode_mission,
    InsufficientShardsError,
    ChecksumMismatchError,
)

__version__ = "1.0.0"
__all__ = [
    "GaloisField256",
    "GF",
    "MatrixInversionError",
    "gauss_jordan_invert",
    "build_vandermonde_matrix",
    "build_cauchy_matrix",
    "get_generator_matrix",
    "encode_bytes",
    "encode_file",
    "decode_shards",
    "decode_mission",
    "InsufficientShardsError",
    "ChecksumMismatchError",
    "compute_sha256",
]
