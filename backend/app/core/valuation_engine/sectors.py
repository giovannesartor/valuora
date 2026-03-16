"""
Valuora — Industry Sectors
Mapping of ~35 sectors most relevant for SMB/startup valuations.

Sector IDs are kept as legacy Portuguese identifiers for backward compatibility
with existing analyses stored in the database. Labels and groups are in English.
"""

from typing import Dict, List, Any


# ─── Industry Sectors ───────────────────────────────────────
IBGE_SECTORS: List[Dict[str, Any]] = [
    # Technology & Digital
    {"id": "tecnologia", "cnae": "62", "label": "Information Technology", "group": "Technology & Digital", "liquidity": "high"},
    {"id": "saas", "cnae": "63", "label": "SaaS / Digital Services", "group": "Technology & Digital", "liquidity": "high"},
    {"id": "ecommerce", "cnae": "47", "label": "E-commerce", "group": "Technology & Digital", "liquidity": "high"},
    {"id": "fintech", "cnae": "64", "label": "Fintech / Financial Services", "group": "Technology & Digital", "liquidity": "high"},

    # Healthcare & Wellness
    {"id": "saude", "cnae": "86", "label": "Healthcare / Clinics", "group": "Healthcare & Wellness", "liquidity": "medium"},
    {"id": "farmacia", "cnae": "21", "label": "Pharmaceuticals", "group": "Healthcare & Wellness", "liquidity": "medium"},
    {"id": "estetica", "cnae": "96", "label": "Aesthetics / Wellness", "group": "Healthcare & Wellness", "liquidity": "medium"},

    # Commerce & Retail
    {"id": "varejo", "cnae": "47", "label": "Retail / Commerce", "group": "Commerce & Retail", "liquidity": "medium"},
    {"id": "atacado", "cnae": "46", "label": "Wholesale / Distribution", "group": "Commerce & Retail", "liquidity": "medium"},

    # Industry & Manufacturing
    {"id": "industria", "cnae": "25", "label": "Industry / Manufacturing", "group": "Industry & Manufacturing", "liquidity": "low"},
    {"id": "alimentos_industria", "cnae": "10", "label": "Food Industry", "group": "Industry & Manufacturing", "liquidity": "low"},
    {"id": "textil", "cnae": "14", "label": "Textile / Apparel", "group": "Industry & Manufacturing", "liquidity": "low"},
    {"id": "quimica", "cnae": "20", "label": "Chemicals / Plastics", "group": "Industry & Manufacturing", "liquidity": "low"},

    # Professional Services
    {"id": "consultoria", "cnae": "70", "label": "Consulting", "group": "Professional Services", "liquidity": "medium"},
    {"id": "contabilidade", "cnae": "69", "label": "Accounting / Legal", "group": "Professional Services", "liquidity": "medium"},
    {"id": "marketing", "cnae": "73", "label": "Marketing / Advertising", "group": "Professional Services", "liquidity": "medium"},
    {"id": "servicos", "cnae": "74", "label": "General Services", "group": "Professional Services", "liquidity": "medium"},

    # Food & Hospitality
    {"id": "alimentacao", "cnae": "56", "label": "Food & Restaurants", "group": "Food & Hospitality", "liquidity": "medium"},
    {"id": "hotelaria", "cnae": "55", "label": "Hotels / Tourism", "group": "Food & Hospitality", "liquidity": "low"},

    # Education
    {"id": "educacao", "cnae": "85", "label": "Education", "group": "Education", "liquidity": "medium"},
    {"id": "edtech", "cnae": "85", "label": "EdTech / Online Education", "group": "Education", "liquidity": "high"},

    # Construction & Real Estate
    {"id": "construcao", "cnae": "41", "label": "Construction", "group": "Construction & Real Estate", "liquidity": "low"},
    {"id": "imobiliario", "cnae": "68", "label": "Real Estate", "group": "Construction & Real Estate", "liquidity": "low"},

    # Agribusiness
    {"id": "agronegocio", "cnae": "01", "label": "Agribusiness", "group": "Agribusiness", "liquidity": "low"},
    {"id": "agritech", "cnae": "01", "label": "AgriTech", "group": "Agribusiness", "liquidity": "medium"},

    # Logistics & Transportation
    {"id": "logistica", "cnae": "49", "label": "Logistics / Transportation", "group": "Logistics & Transportation", "liquidity": "medium"},
    {"id": "entregas", "cnae": "53", "label": "Delivery / Last-mile", "group": "Logistics & Transportation", "liquidity": "medium"},

    # Energy & Infrastructure
    {"id": "energia", "cnae": "35", "label": "Energy", "group": "Energy & Infrastructure", "liquidity": "low"},
    {"id": "energia_solar", "cnae": "35", "label": "Solar / Renewable Energy", "group": "Energy & Infrastructure", "liquidity": "medium"},

    # Financial
    {"id": "financeiro", "cnae": "64", "label": "Financial Services", "group": "Financial", "liquidity": "high"},
    {"id": "seguros", "cnae": "65", "label": "Insurance", "group": "Financial", "liquidity": "medium"},

    # Media & Entertainment
    {"id": "midia", "cnae": "59", "label": "Media / Entertainment", "group": "Media & Entertainment", "liquidity": "medium"},
    {"id": "games", "cnae": "62", "label": "Games / Digital Gaming", "group": "Media & Entertainment", "liquidity": "high"},

    # Other
    {"id": "outros", "cnae": "82", "label": "Other", "group": "Other", "liquidity": "medium"},
]

# ─── Quick lookup maps ──────────────────────────────────────
SECTOR_BY_ID: Dict[str, Dict[str, Any]] = {s["id"]: s for s in IBGE_SECTORS}

SECTOR_LABELS: Dict[str, str] = {s["id"]: s["label"] for s in IBGE_SECTORS}

SECTOR_CNAE_MAP: Dict[str, str] = {s["id"]: s["cnae"] for s in IBGE_SECTORS}

SECTOR_LIQUIDITY: Dict[str, str] = {s["id"]: s["liquidity"] for s in IBGE_SECTORS}


def get_sector_list() -> List[Dict[str, str]]:
    """Returns list of sectors for frontend dropdown (grouped)."""
    result = []
    seen_groups = []
    for s in IBGE_SECTORS:
        result.append({
            "id": s["id"],
            "label": s["label"],
            "group": s["group"],
        })
    return result


def get_sector_cnae(sector_id: str) -> str:
    """Returns CNAE code for a sector ID."""
    return SECTOR_CNAE_MAP.get(sector_id.lower().strip(), "47")


def get_sector_label(sector_id: str) -> str:
    """Returns human-readable label for a sector ID."""
    return SECTOR_LABELS.get(sector_id.lower().strip(), sector_id.capitalize())


def get_sector_liquidity(sector_id: str) -> str:
    """Returns liquidity level: high, medium, low."""
    return SECTOR_LIQUIDITY.get(sector_id.lower().strip(), "medium")


def is_valid_sector(sector_id: str) -> bool:
    """Check if sector ID is valid."""
    return sector_id.lower().strip() in SECTOR_BY_ID
