"""Tests for Galois Field GF(2^8) arithmetic."""
import pytest
from nautilus_rs_codec.galois import GaloisField256, GF


def test_gf_addition_subtraction():
    # XOR addition and subtraction
    assert GF.add(0, 0) == 0
    assert GF.add(15, 15) == 0
    assert GF.add(0x5A, 0xA5) == 0xFF
    assert GF.sub(100, 50) == 100 ^ 50


def test_gf_multiplication_inversion():
    assert GF.mul(0, 42) == 0
    assert GF.mul(42, 0) == 0
    assert GF.mul(1, 42) == 42
    assert GF.mul(42, 1) == 42

    # Inversion: a * inv(a) == 1 for all a in 1..255
    for a in range(1, 256):
        inv_a = GF.inv(a)
        assert GF.mul(a, inv_a) == 1, f"Failed for a={a}"


def test_gf_division():
    for a in range(1, 256):
        for b in range(1, 256):
            prod = GF.mul(a, b)
            assert GF.div(prod, b) == a

    with pytest.raises(ZeroDivisionError):
        GF.div(10, 0)

    with pytest.raises(ZeroDivisionError):
        GF.inv(0)


def test_gf_vector_operations():
    buf = bytearray([1, 2, 3, 4, 5])
    scalar = 3

    # vec_mul_scalar
    scaled = GF.vec_mul_scalar(buf, scalar)
    for i in range(len(buf)):
        assert scaled[i] == GF.mul(buf[i], scalar)

    # vec_mul_accumulate
    dest = bytearray([10, 20, 30, 40, 50])
    expected = [dest[i] ^ GF.mul(buf[i], scalar) for i in range(len(dest))]
    GF.vec_mul_accumulate(dest, buf, scalar)
    assert list(dest) == expected
