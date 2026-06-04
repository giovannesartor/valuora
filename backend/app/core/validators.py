"""Validators for Brazilian documents (CPF/CNPJ) using official checksum algorithms."""
from __future__ import annotations


def _only_digits(value: str) -> str:
    return "".join(c for c in (value or "") if c.isdigit())


def is_valid_cpf(value: str) -> bool:
    """Validate a Brazilian CPF using the two check digits algorithm."""
    cpf = _only_digits(value)
    if len(cpf) != 11 or cpf == cpf[0] * 11:
        return False
    for i in (9, 10):
        s = sum(int(cpf[n]) * ((i + 1) - n) for n in range(i))
        d = (s * 10 % 11) % 10
        if d != int(cpf[i]):
            return False
    return True


def is_valid_cnpj(value: str) -> bool:
    """Validate a Brazilian CNPJ using the two check digits algorithm."""
    cnpj = _only_digits(value)
    if len(cnpj) != 14 or cnpj == cnpj[0] * 14:
        return False
    weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    weights2 = [6] + weights1
    for i, weights in enumerate((weights1, weights2)):
        s = sum(int(cnpj[n]) * weights[n] for n in range(12 + i))
        d = s % 11
        d = 0 if d < 2 else 11 - d
        if d != int(cnpj[12 + i]):
            return False
    return True


def is_valid_cpf_or_cnpj(value: str) -> bool:
    digits = _only_digits(value)
    if len(digits) == 11:
        return is_valid_cpf(digits)
    if len(digits) == 14:
        return is_valid_cnpj(digits)
    return False
