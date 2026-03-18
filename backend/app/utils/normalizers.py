"""
Quanto Vale — Normalizers
Normalization utilities for IBGE data.
Safe conversion, statistical calculations, and parsing.
"""

import math
import logging
from typing import Any, Dict, List, Optional, Union

logger = logging.getLogger(__name__)


def safe_float(value: Any, default: float = 0.0) -> float:
    """Convert value to float safely.

    Handles strings with comma/period, None, '-', '...' from IBGE.
    """
    if value is None:
        return default
    if isinstance(value, (int, float)):
        return float(value) if not math.isnan(value) and not math.isinf(value) else default
    if isinstance(value, str):
        cleaned = value.strip()
        # Valores especiais do IBGE
        if cleaned in ("", "-", "...", "X", "—", "null", "None"):
            return default
        # Brazilian format: 1.234.567,89
        if "," in cleaned and "." in cleaned:
            cleaned = cleaned.replace(".", "").replace(",", ".")
        elif "," in cleaned:
            cleaned = cleaned.replace(",", ".")
        try:
            result = float(cleaned)
            return result if not math.isnan(result) and not math.isinf(result) else default
        except (ValueError, TypeError):
            return default
    return default


def safe_int(value: Any, default: int = 0) -> int:
    """Convert value to int safely."""
    result = safe_float(value, float(default))
    return int(result)


def parse_percentage(value: Any, default: float = 0.0) -> float:
    """Convert percentage to decimal (e.g., '15.3%' -> 0.153)."""
    if value is None:
        return default
    if isinstance(value, (int, float)):
        # If already appears to be decimal (<= 1), return directly
        if abs(value) <= 1.0:
            return float(value)
        return float(value) / 100.0
    if isinstance(value, str):
        cleaned = value.strip().replace("%", "").replace(",", ".")
        try:
            num = float(cleaned)
            if abs(num) > 1.0:
                return num / 100.0
            return num
        except (ValueError, TypeError):
            return default
    return default


def calculate_growth_rate(values: List[float]) -> Optional[float]:
    """Calculate compound annual growth rate (CAGR) from a series.

    CAGR = (Vf / Vi)^(1/n) - 1
    """
    if not values or len(values) < 2:
        return None
    # Filter zeros and negatives
    valid = [v for v in values if v > 0]
    if len(valid) < 2:
        return None
    first = valid[0]
    last = valid[-1]
    years = len(valid) - 1
    if first <= 0 or years <= 0:
        return None
    try:
        cagr = (last / first) ** (1 / years) - 1
        return round(cagr, 4)
    except (ZeroDivisionError, ValueError, OverflowError):
        return None


def calculate_volatility(values: List[float]) -> float:
    """Calculate volatility (relative standard deviation / coefficient of variation).

    Returns value from 0 to 1 (normalized).
    """
    if not values or len(values) < 2:
        return 0.0
    clean = [safe_float(v) for v in values if safe_float(v) != 0]
    if len(clean) < 2:
        return 0.0
    mean = sum(clean) / len(clean)
    if mean == 0:
        return 0.0
    variance = sum((x - mean) ** 2 for x in clean) / (len(clean) - 1)
    std_dev = math.sqrt(variance)
    cv = std_dev / abs(mean)
    # Normalize to 0–1 (capped at 1)
    return min(round(cv, 4), 1.0)


def calculate_trend(values: List[float]) -> float:
    """Calculate simple linear trend (normalized slope).

    Returns value between -1 and 1.
    Positive = growth, Negative = decline.
    """
    if not values or len(values) < 2:
        return 0.0
    n = len(values)
    x_mean = (n - 1) / 2
    y_mean = sum(values) / n
    if y_mean == 0:
        return 0.0
    numerator = sum((i - x_mean) * (values[i] - y_mean) for i in range(n))
    denominator = sum((i - x_mean) ** 2 for i in range(n))
    if denominator == 0:
        return 0.0
    slope = numerator / denominator
    # Normalize by mean value
    normalized = slope / abs(y_mean)
    return max(-1.0, min(1.0, round(normalized, 4)))


def normalize_ibge_response(data: Any) -> List[Dict[str, Any]]:
    """Normalize IBGE API response to standardized format.

    The IBGE/SIDRA API returns arrays with the first element being a header.
    """
    if not data:
        return []
    if isinstance(data, list):
        # SIDRA: first element is metadata/header
        if len(data) > 1 and isinstance(data[0], dict):
            headers = data[0]
            results = []
            for item in data[1:]:
                if isinstance(item, dict):
                    results.append(item)
            return results
        return data
    if isinstance(data, dict):
        return [data]
    return []


def extract_sidra_values(data: List[Dict], value_key: str = "V") -> List[float]:
    """Extract numeric values from normalized SIDRA response."""
    values = []
    for item in data:
        if isinstance(item, dict):
            raw = item.get(value_key)
            val = safe_float(raw)
            if val != 0:
                values.append(val)
    return values


def cnae_to_division(cnae_code: str) -> str:
    """Extract division (first 2 digits) from a CNAE code."""
    clean = cnae_code.replace(".", "").replace("-", "").replace("/", "")
    return clean[:2] if len(clean) >= 2 else clean


def cnae_to_group(cnae_code: str) -> str:
    """Extract group (first 3 digits) from a CNAE code."""
    clean = cnae_code.replace(".", "").replace("-", "").replace("/", "")
    return clean[:3] if len(clean) >= 3 else clean


def cnae_to_class(cnae_code: str) -> str:
    """Extract class (first 5 digits) from a CNAE code."""
    clean = cnae_code.replace(".", "").replace("-", "").replace("/", "")
    return clean[:5] if len(clean) >= 5 else clean
