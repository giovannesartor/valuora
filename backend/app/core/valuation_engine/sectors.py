"""
Quanto Vale — Setores IBGE (Divisão CNAE 2.0)
Mapeamento de ~35 setores mais relevantes para PMEs brasileiras.

Fonte: IBGE — Classificação Nacional de Atividades Econômicas (CNAE 2.0)
Agrupados por divisão CNAE para uso no motor de valuation.
"""

from typing import Dict, List, Any


# ─── Setores IBGE agrupados por relevância para PMEs ────────
IBGE_SECTORS: List[Dict[str, Any]] = [
    # Tecnologia & Digital
    {"id": "tecnologia", "cnae": "62", "label": "Tecnologia da Informação", "group": "Tecnologia & Digital", "liquidity": "high"},
    {"id": "saas", "cnae": "63", "label": "SaaS / Serviços Digitais", "group": "Tecnologia & Digital", "liquidity": "high"},
    {"id": "ecommerce", "cnae": "47", "label": "E-commerce", "group": "Tecnologia & Digital", "liquidity": "high"},
    {"id": "fintech", "cnae": "64", "label": "Fintech / Serviços Financeiros", "group": "Tecnologia & Digital", "liquidity": "high"},

    # Saúde & Bem-estar
    {"id": "saude", "cnae": "86", "label": "Saúde / Clínicas", "group": "Saúde & Bem-estar", "liquidity": "medium"},
    {"id": "farmacia", "cnae": "21", "label": "Farmacêutica", "group": "Saúde & Bem-estar", "liquidity": "medium"},
    {"id": "estetica", "cnae": "96", "label": "Estética / Bem-estar", "group": "Saúde & Bem-estar", "liquidity": "medium"},

    # Comércio & Varejo
    {"id": "varejo", "cnae": "47", "label": "Varejo / Comércio", "group": "Comércio & Varejo", "liquidity": "medium"},
    {"id": "atacado", "cnae": "46", "label": "Atacado / Distribuição", "group": "Comércio & Varejo", "liquidity": "medium"},

    # Indústria & Manufatura
    {"id": "industria", "cnae": "25", "label": "Indústria / Manufatura", "group": "Indústria & Manufatura", "liquidity": "low"},
    {"id": "alimentos_industria", "cnae": "10", "label": "Indústria Alimentícia", "group": "Indústria & Manufatura", "liquidity": "low"},
    {"id": "textil", "cnae": "14", "label": "Têxtil / Confecção", "group": "Indústria & Manufatura", "liquidity": "low"},
    {"id": "quimica", "cnae": "20", "label": "Química / Plásticos", "group": "Indústria & Manufatura", "liquidity": "low"},

    # Serviços Profissionais
    {"id": "consultoria", "cnae": "70", "label": "Consultoria", "group": "Serviços Profissionais", "liquidity": "medium"},
    {"id": "contabilidade", "cnae": "69", "label": "Contabilidade / Jurídico", "group": "Serviços Profissionais", "liquidity": "medium"},
    {"id": "marketing", "cnae": "73", "label": "Marketing / Publicidade", "group": "Serviços Profissionais", "liquidity": "medium"},
    {"id": "servicos", "cnae": "74", "label": "Serviços Diversos", "group": "Serviços Profissionais", "liquidity": "medium"},

    # Alimentação & Hospitalidade
    {"id": "alimentacao", "cnae": "56", "label": "Alimentação / Restaurantes", "group": "Alimentação & Hospitalidade", "liquidity": "medium"},
    {"id": "hotelaria", "cnae": "55", "label": "Hotelaria / Turismo", "group": "Alimentação & Hospitalidade", "liquidity": "low"},

    # Educação
    {"id": "educacao", "cnae": "85", "label": "Educação", "group": "Educação", "liquidity": "medium"},
    {"id": "edtech", "cnae": "85", "label": "EdTech / Educação Online", "group": "Educação", "liquidity": "high"},

    # Construção & Imobiliário
    {"id": "construcao", "cnae": "41", "label": "Construção Civil", "group": "Construção & Imobiliário", "liquidity": "low"},
    {"id": "imobiliario", "cnae": "68", "label": "Imobiliário", "group": "Construção & Imobiliário", "liquidity": "low"},

    # Agronegócio
    {"id": "agronegocio", "cnae": "01", "label": "Agronegócio", "group": "Agronegócio", "liquidity": "low"},
    {"id": "agritech", "cnae": "01", "label": "AgriTech", "group": "Agronegócio", "liquidity": "medium"},

    # Logística & Transporte
    {"id": "logistica", "cnae": "49", "label": "Logística / Transporte", "group": "Logística & Transporte", "liquidity": "medium"},
    {"id": "entregas", "cnae": "53", "label": "Entregas / Last-mile", "group": "Logística & Transporte", "liquidity": "medium"},

    # Energia & Infraestrutura
    {"id": "energia", "cnae": "35", "label": "Energia", "group": "Energia & Infraestrutura", "liquidity": "low"},
    {"id": "energia_solar", "cnae": "35", "label": "Energia Solar / Renovável", "group": "Energia & Infraestrutura", "liquidity": "medium"},

    # Financeiro
    {"id": "financeiro", "cnae": "64", "label": "Serviços Financeiros", "group": "Financeiro", "liquidity": "high"},
    {"id": "seguros", "cnae": "65", "label": "Seguros", "group": "Financeiro", "liquidity": "medium"},

    # Mídia & Entretenimento
    {"id": "midia", "cnae": "59", "label": "Mídia / Entretenimento", "group": "Mídia & Entretenimento", "liquidity": "medium"},
    {"id": "games", "cnae": "62", "label": "Games / Jogos Digitais", "group": "Mídia & Entretenimento", "liquidity": "high"},

    # Outros
    {"id": "outros", "cnae": "82", "label": "Outros", "group": "Outros", "liquidity": "medium"},
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
