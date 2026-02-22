"""
Seed data — popula dados de setores e benchmarks.
Executar: python -m app.seeds.seed_sectors
"""
import asyncio
from sqlalchemy import select
from app.core.database import async_session_maker, init_db
from app.models.models import SectorData, BenchmarkData


SECTORS = [
    {"sector_name": "tecnologia", "beta": 1.3, "avg_margin": 0.18, "avg_growth": 0.20, "avg_multiple": 4.5, "risk_premium": 0.02, "description": "Empresas de software, SaaS, TI e serviços digitais"},
    {"sector_name": "saude", "beta": 0.9, "avg_margin": 0.15, "avg_growth": 0.12, "avg_multiple": 3.0, "risk_premium": 0.01, "description": "Clínicas, laboratórios, healthtechs e farmácias"},
    {"sector_name": "varejo", "beta": 1.1, "avg_margin": 0.08, "avg_growth": 0.10, "avg_multiple": 1.5, "risk_premium": 0.015, "description": "Comércio varejista físico e digital"},
    {"sector_name": "industria", "beta": 1.0, "avg_margin": 0.10, "avg_growth": 0.08, "avg_multiple": 1.8, "risk_premium": 0.01, "description": "Manufatura e indústria de transformação"},
    {"sector_name": "servicos", "beta": 1.05, "avg_margin": 0.12, "avg_growth": 0.10, "avg_multiple": 2.5, "risk_premium": 0.01, "description": "Prestação de serviços diversos"},
    {"sector_name": "alimentacao", "beta": 0.85, "avg_margin": 0.08, "avg_growth": 0.07, "avg_multiple": 1.2, "risk_premium": 0.005, "description": "Restaurantes, food service e indústria alimentícia"},
    {"sector_name": "educacao", "beta": 0.9, "avg_margin": 0.14, "avg_growth": 0.12, "avg_multiple": 2.8, "risk_premium": 0.01, "description": "Escolas, cursos, edtechs e universidades"},
    {"sector_name": "construcao", "beta": 1.15, "avg_margin": 0.09, "avg_growth": 0.08, "avg_multiple": 1.3, "risk_premium": 0.02, "description": "Construção civil e incorporação"},
    {"sector_name": "agronegocio", "beta": 1.0, "avg_margin": 0.12, "avg_growth": 0.09, "avg_multiple": 1.5, "risk_premium": 0.015, "description": "Agricultura, pecuária e agroindústria"},
    {"sector_name": "financeiro", "beta": 1.2, "avg_margin": 0.20, "avg_growth": 0.15, "avg_multiple": 3.5, "risk_premium": 0.02, "description": "Fintechs, seguradoras e serviços financeiros"},
    {"sector_name": "logistica", "beta": 1.1, "avg_margin": 0.08, "avg_growth": 0.10, "avg_multiple": 1.8, "risk_premium": 0.015, "description": "Transporte, armazenagem e distribuição"},
    {"sector_name": "energia", "beta": 0.95, "avg_margin": 0.15, "avg_growth": 0.08, "avg_multiple": 2.0, "risk_premium": 0.01, "description": "Energia elétrica, solar, eólica e petróleo"},
    {"sector_name": "imobiliario", "beta": 1.05, "avg_margin": 0.13, "avg_growth": 0.09, "avg_multiple": 2.2, "risk_premium": 0.015, "description": "Imobiliárias e administração de imóveis"},
    {"sector_name": "consultoria", "beta": 1.0, "avg_margin": 0.18, "avg_growth": 0.12, "avg_multiple": 2.5, "risk_premium": 0.01, "description": "Consultorias empresariais e estratégicas"},
    {"sector_name": "marketing", "beta": 1.15, "avg_margin": 0.12, "avg_growth": 0.14, "avg_multiple": 2.0, "risk_premium": 0.015, "description": "Agências e empresas de marketing digital"},
    {"sector_name": "ecommerce", "beta": 1.25, "avg_margin": 0.10, "avg_growth": 0.18, "avg_multiple": 3.0, "risk_premium": 0.02, "description": "Comércio eletrônico e marketplaces"},
]


async def seed():
    await init_db()
    async with async_session_maker() as db:
        for sector in SECTORS:
            existing = await db.execute(
                select(SectorData).where(SectorData.sector_name == sector["sector_name"])
            )
            if not existing.scalar_one_or_none():
                db.add(SectorData(**sector))
        await db.commit()
        print(f"✓ {len(SECTORS)} setores inseridos/verificados.")


if __name__ == "__main__":
    asyncio.run(seed())
