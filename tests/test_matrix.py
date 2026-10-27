"""Tests for Matrix operations and generator matrix construction."""
import itertools
import pytest
from nautilus_rs_codec.matrix import (
    identity_matrix,
    matrix_multiply,
    matrix_vector_multiply,
    gauss_jordan_invert,
    build_vandermonde_matrix,
    build_cauchy_matrix,
    MatrixInversionError,
)


def test_identity_and_multiplication():
    I3 = identity_matrix(3)
    A = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
    ]
    # A * I == A
    prod = matrix_multiply(A, I3)
    assert prod == A


def test_matrix_inversion():
    A = [
        [1, 2],
        [3, 4],
    ]
    inv_A = gauss_jordan_invert(A)
    # A * inv(A) == I
    I_res = matrix_multiply(A, inv_A)
    assert I_res == identity_matrix(2)


def test_singular_matrix_rejection():
    # Identical rows -> singular
    singular = [
        [5, 5],
        [5, 5],
    ]
    with pytest.raises(MatrixInversionError):
        gauss_jordan_invert(singular)


def test_vandermonde_and_cauchy_systematic_identity():
    k, m = 6, 4
    G_vand = build_vandermonde_matrix(k, m)
    G_cauchy = build_cauchy_matrix(k, m)

    assert len(G_vand) == k + m
    assert len(G_vand[0]) == k
    assert len(G_cauchy) == k + m
    assert len(G_cauchy[0]) == k

    # Top k x k rows must be identity matrix
    I_k = identity_matrix(k)
    for i in range(k):
        assert G_vand[i] == I_k[i]
        assert G_cauchy[i] == I_k[i]


def test_all_submatrices_invertible():
    k, m = 6, 4
    n = k + m
    G_vand = build_vandermonde_matrix(k, m)
    G_cauchy = build_cauchy_matrix(k, m)

    # For both matrices, all C(10, 6) = 210 submatrices must be invertible
    combinations = list(itertools.combinations(range(n), k))
    assert len(combinations) == 210

    for rows in combinations:
        sub_vand = [G_vand[r] for r in rows]
        inv_vand = gauss_jordan_invert(sub_vand)
        assert inv_vand is not None

        sub_cauchy = [G_cauchy[r] for r in rows]
        inv_cauchy = gauss_jordan_invert(sub_cauchy)
        assert inv_cauchy is not None
