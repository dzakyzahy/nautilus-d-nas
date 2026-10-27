"""
Galois Field GF(2^8) Arithmetic Engine for Nautilus D-NAS.
Implements field arithmetic over GF(2^8) with irreducible polynomial
P(x) = x^8 + x^4 + x^3 + x^2 + 1 (0x11D, decimal 285).
Uses precomputed exponential (anti-log) and logarithmic lookup tables
for O(1) byte multiplication and division.
"""

from typing import List, Union

# Irreducible primitive polynomial P(x) = x^8 + x^4 + x^3 + x^2 + 1
PRIMITIVE_POLYNOMIAL = 0x11D
FIELD_SIZE = 256


class GaloisField256:
    """Precomputed lookup tables for arithmetic over GF(2^8)."""

    def __init__(self, prim_poly: int = PRIMITIVE_POLYNOMIAL):
        self.prim_poly = prim_poly
        self.exp_table: List[int] = [0] * (FIELD_SIZE * 2)
        self.log_table: List[int] = [0] * FIELD_SIZE

        # Initialize exponential and logarithm lookup tables
        x = 1
        for i in range(FIELD_SIZE - 1):
            self.exp_table[i] = x
            self.exp_table[i + (FIELD_SIZE - 1)] = x
            self.log_table[x] = i
            x <<= 1
            if x & FIELD_SIZE:
                x ^= self.prim_poly

        self.log_table[0] = 0  # Conventionally undefined, safe guard

    def add(self, a: int, b: int) -> int:
        """Addition in GF(2^8) is bitwise XOR."""
        return a ^ b

    def sub(self, a: int, b: int) -> int:
        """Subtraction in GF(2^8) is bitwise XOR (identical to addition)."""
        return a ^ b

    def mul(self, a: int, b: int) -> int:
        """Multiplication in GF(2^8) using log/exp tables."""
        if a == 0 or b == 0:
            return 0
        return self.exp_table[self.log_table[a] + self.log_table[b]]

    def div(self, a: int, b: int) -> int:
        """Division in GF(2^8). Raises ZeroDivisionError if b == 0."""
        if b == 0:
            raise ZeroDivisionError("Division by zero in GF(2^8)")
        if a == 0:
            return 0
        diff = self.log_table[a] - self.log_table[b] + (FIELD_SIZE - 1)
        return self.exp_table[diff % (FIELD_SIZE - 1)]

    def inv(self, a: int) -> int:
        """Multiplicative inverse in GF(2^8). Raises ZeroDivisionError if a == 0."""
        if a == 0:
            raise ZeroDivisionError("Cannot invert zero in GF(2^8)")
        return self.exp_table[(FIELD_SIZE - 1) - self.log_table[a]]

    def pow(self, a: int, power: int) -> int:
        """Exponentiation in GF(2^8)."""
        if power == 0:
            return 1
        if a == 0:
            return 0
        log_a = self.log_table[a]
        return self.exp_table[(log_a * power) % (FIELD_SIZE - 1)]

    def vec_mul_scalar(self, vector: Union[bytes, bytearray], scalar: int) -> bytearray:
        """Multiplies a byte buffer by a scalar element in GF(2^8)."""
        if scalar == 0:
            return bytearray(len(vector))
        if scalar == 1:
            return bytearray(vector)

        scalar_log = self.log_table[scalar]
        exp_tbl = self.exp_table
        log_tbl = self.log_table

        out = bytearray(len(vector))
        for i, val in enumerate(vector):
            if val != 0:
                out[i] = exp_tbl[log_tbl[val] + scalar_log]
        return out

    def vec_mul_accumulate(
        self,
        dest: bytearray,
        source: Union[bytes, bytearray],
        scalar: int,
    ) -> None:
        """In-place dest[i] ^= scalar * source[i] in GF(2^8)."""
        if scalar == 0:
            return
        if scalar == 1:
            for i in range(len(source)):
                dest[i] ^= source[i]
            return

        scalar_log = self.log_table[scalar]
        exp_tbl = self.exp_table
        log_tbl = self.log_table

        for i in range(len(source)):
            val = source[i]
            if val != 0:
                dest[i] ^= exp_tbl[log_tbl[val] + scalar_log]


# Singleton default instance
GF = GaloisField256()
