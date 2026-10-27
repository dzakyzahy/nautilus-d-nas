"""
Galois Field Matrix Operations and Generator Matrix Construction.
Supports Gauss-Jordan elimination over GF(2^8) for matrix inversion,
matrix multiplication, and building systematic Vandermonde & Cauchy
generator matrices for Reed-Solomon erasure coding.
"""

from typing import List, Optional
from nautilus_rs_codec.galois import GF


class MatrixInversionError(Exception):
    """Raised when a sub-matrix is singular (cannot be inverted)."""
    pass


def identity_matrix(n: int) -> List[List[int]]:
    """Returns an n x n identity matrix in GF(2^8)."""
    return [[1 if i == j else 0 for j in range(n)] for i in range(n)]


def matrix_multiply(A: List[List[int]], B: List[List[int]]) -> List[List[int]]:
    """Multiplies two matrices A (p x q) and B (q x r) over GF(2^8)."""
    p = len(A)
    q = len(A[0])
    r = len(B[0])
    C = [[0] * r for _ in range(p)]
    for i in range(p):
        for k in range(q):
            a_ik = A[i][k]
            if a_ik == 0:
                continue
            for j in range(r):
                C[i][j] ^= GF.mul(a_ik, B[k][j])
    return C


def matrix_vector_multiply(A: List[List[int]], v: List[int]) -> List[int]:
    """Multiplies matrix A (p x q) by vector v (q) over GF(2^8)."""
    p = len(A)
    q = len(v)
    out = [0] * p
    for i in range(p):
        s = 0
        for j in range(q):
            s ^= GF.mul(A[i][j], v[j])
        out[i] = s
    return out


def gauss_jordan_invert(matrix: List[List[int]]) -> List[List[int]]:
    """
    Computes the inverse of an n x n matrix over GF(2^8) using Gauss-Jordan elimination.
    Raises MatrixInversionError if the matrix is singular.
    """
    n = len(matrix)
    # Augment matrix with n x n identity matrix
    A = [[matrix[i][j] for j in range(n)] + [1 if i == j else 0 for j in range(n)] for i in range(n)]

    for col in range(n):
        # Locate pivot in current column
        pivot = -1
        for row in range(col, n):
            if A[row][col] != 0:
                pivot = row
                break
        if pivot == -1:
            raise MatrixInversionError(f"Matrix is singular at column {col}")

        # Swap rows if necessary
        if pivot != col:
            A[col], A[pivot] = A[pivot], A[col]

        # Normalize pivot row
        pivot_val = A[col][col]
        inv_pivot = GF.inv(pivot_val)
        for c in range(2 * n):
            A[col][c] = GF.mul(A[col][c], inv_pivot)

        # Eliminate all other rows in this column
        for row in range(n):
            if row != col and A[row][col] != 0:
                factor = A[row][col]
                for c in range(2 * n):
                    A[row][c] ^= GF.mul(factor, A[col][c])

    # Extract right side (n x n inverse)
    return [[A[i][n + j] for j in range(n)] for i in range(n)]


def build_vandermonde_matrix(k: int, m: int) -> List[List[int]]:
    """
    Constructs a systematic (k + m) x k generator matrix using Vandermonde matrix.
    The top k x k block is the identity matrix I_k (systematic code).
    The bottom m x k block contains parity generation coefficients derived
    from Vandermonde evaluation points in GF(2^8).
    """
    n = k + m
    if n > 256:
        raise ValueError(f"Total shards n={n} cannot exceed field size 256")

    # Raw Vandermonde matrix V of size n x k where V_{i,j} = alpha_i^j
    V: List[List[int]] = []
    for i in range(n):
        row = []
        base = GF.exp_table[i]
        val = 1
        for j in range(k):
            row.append(val)
            val = GF.mul(val, base)
        V.append(row)

    # Invert top k x k square submatrix to make matrix systematic
    V_top = [V[r] for r in range(k)]
    inv_top = gauss_jordan_invert(V_top)

    # Systematic generator G = V * inv(V_top)
    return matrix_multiply(V, inv_top)


def build_cauchy_matrix(k: int, m: int) -> List[List[int]]:
    """
    Constructs a systematic (k + m) x k generator matrix using a Cauchy matrix.
    Cauchy matrices guarantee that ANY k x k submatrix is non-singular.
    Top k x k is I_k; bottom m x k is C_{i, j} = 1 / ((i + k) ^ j).
    """
    n = k + m
    if n > 256:
        raise ValueError(f"Total shards n={n} cannot exceed field size 256")

    G: List[List[int]] = []
    # Systematic data rows: Identity I_k
    for i in range(k):
        G.append([1 if i == j else 0 for j in range(k)])

    # Parity rows: Cauchy elements
    for i in range(m):
        row = []
        for j in range(k):
            diff = (i + k) ^ j
            row.append(GF.inv(diff))
        G.append(row)

    return G


def get_generator_matrix(k: int, m: int, matrix_type: str = "vandermonde") -> List[List[int]]:
    """Retrieves systematic generator matrix based on matrix_type."""
    if matrix_type.lower() == "vandermonde":
        return build_vandermonde_matrix(k, m)
    elif matrix_type.lower() == "cauchy":
        return build_cauchy_matrix(k, m)
    else:
        raise ValueError(f"Unknown matrix type: {matrix_type}. Use 'vandermonde' or 'cauchy'.")
