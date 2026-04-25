"""
runner.py — Executa todos os scrapers e salva no Supabase.
Uso:
  python runner.py           → roda uma vez
  python runner.py --watch   → roda em loop a cada 6h (cron)
"""
import sys
import argparse
import logging
import schedule
import time

from config import KEYWORDS_DEFAULT
from db import upsert_job, count_jobs, get_client
from geocoder import run as geocode_all
from scrapers.pci_concursos import PCIConcursosScraper
from scrapers.vunesp import GranCursosScraper
from scrapers.remotive import RemotiveScraper
from scrapers.vagas_com_br import VagasComBrScraper, EmpregosComBrScraper
from scrapers.adzuna import AdzunaScraper
from scrapers.jsearch import JSearchScraper
from scrapers.concursos_publicos import ConcursosNoBrasilScraper, ConcursoPublicoBRScraper
from scrapers.remoteok import RemoteOKScraper
from scrapers.gupy import GupyScraper
from scrapers.clickmuseus import ClickMuseusScraper
from scrapers.ciee import CIEEScraper
from scrapers.iel import IELScraper
from scrapers.jooble import JoobleScraper
from scrapers.trabalha_brasil import TrabalhaBrasilScraper
from scrapers.infojobs import InfoJobsScraper
from scrapers.courses import scrape_all_courses
from keywords_builder import build_keywords_from_profiles
from enricher import run as enrich_all

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("runner")


def get_profile_locations() -> list[str]:
    """Busca cidades únicas dos perfis ativos no Supabase."""
    try:
        from db import get_client
        client = get_client()
        result = client.table("profiles").select("city, state").execute()
        locs = []
        for p in (result.data or []):
            if p.get("city"):
                loc = p["city"]
                if p.get("state"):
                    loc += f", {p['state']}"
                locs.append(loc)
        return list(set(locs)) or ["São Paulo", "Brasil"]
    except Exception as e:
        logger.warning("Não foi possível buscar localizações dos perfis: %s", e)
        return ["São Paulo", "Brasil"]


def build_scrapers(keywords: list[str], locations: list[str] | None = None) -> list:
    locs = locations or ["São Paulo", "Brasil"]
    primary_loc = locs[0] if locs else "São Paulo"

    scrapers = [
        # Fontes sem API key
        RemotiveScraper(keywords=keywords),
        RemoteOKScraper(keywords=keywords),
        VagasComBrScraper(keywords=keywords),
        EmpregosComBrScraper(keywords=keywords),
        PCIConcursosScraper(keywords=keywords),
        GranCursosScraper(keywords=keywords),
        # Gupy — maior plataforma BR, com filtro por localização
        GupyScraper(keywords=keywords),
        # Vagas culturais
        ClickMuseusScraper(keywords=keywords),
        # Estágios e primeiro emprego
        CIEEScraper(keywords=keywords, location=primary_loc),
        IELScraper(keywords=keywords, location=primary_loc),
        # Portais brasileiros adicionais
        TrabalhaBrasilScraper(keywords=keywords, location=primary_loc),
        InfoJobsScraper(keywords=keywords, location=primary_loc),
    ]

    scrapers += [
        # Concursos públicos
        ConcursosNoBrasilScraper(keywords=keywords),
        ConcursoPublicoBRScraper(keywords=keywords),
        # Fontes com API key com localização primária
        AdzunaScraper(keywords=keywords, location=primary_loc),
        JSearchScraper(keywords=keywords, location=primary_loc),
        # Jooble agrega Indeed, LinkedIn e outros (requer JOOBLE_API_KEY)
        JoobleScraper(keywords=keywords, location=primary_loc),
    ]

    return scrapers


def run_all(keywords: list[str] | None = None, locations: list[str] | None = None) -> dict:
    if keywords or locations:
        kw = keywords or KEYWORDS_DEFAULT
        locs = locations or get_profile_locations()
    else:
        # Geração dinâmica baseada nos perfis cadastrados
        kw, locs = build_keywords_from_profiles()
    logger.info("Keywords (%d): %s...", len(kw), kw[:8])
    logger.info("Localizações: %s", locs)
    scrapers = build_scrapers(kw, locs)

    total_new = 0
    total_found = 0
    results = {}

    for scraper in scrapers:
        jobs = scraper.run()
        total_found += len(jobs)
        new_count = 0
        for job in jobs:
            if upsert_job(job):
                new_count += 1
        total_new += new_count
        results[scraper.source_name] = {"found": len(jobs), "new": new_count}

    logger.info("=" * 50)
    logger.info("RESUMO: %d vagas coletadas, %d novas inseridas", total_found, total_new)
    logger.info("Total no banco: %d vagas", count_jobs())
    logger.info("Por fonte: %s", results)
    logger.info("=" * 50)

    if total_new > 0:
        logger.info("Geocodificando %d novas vagas...", total_new)
        geocode_all()

    # Enriquecer vagas sem localização/salário (extrai da descrição)
    logger.info("Enriquecendo vagas sem localização/salário...")
    enrich_all()

    # Coletar cursos e inscrições abertas
    logger.info("Coletando cursos gratuitos e inscrições abertas...")
    _run_courses()

    return results


def _run_courses():
    client = get_client()
    courses = scrape_all_courses()
    new_count = 0
    for c in courses:
        try:
            resp = client.table("courses").upsert(
                {k: v for k, v in c.items() if v is not None},
                on_conflict="source,source_url",
            ).execute()
            if resp.data:
                new_count += 1
        except Exception as e:
            logger.warning("Erro ao inserir curso '%s': %s", c.get("title", "")[:40], e)
    logger.info("Cursos: %d inseridos/atualizados", new_count)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--watch", action="store_true", help="Rodar em loop a cada 6 horas")
    parser.add_argument("--keywords", nargs="*", help="Palavras-chave customizadas")
    parser.add_argument("--location", nargs="*", help="Localizações para busca (ex: 'São Paulo' 'Rio de Janeiro')")
    args = parser.parse_args()

    kw = args.keywords or None
    locs = args.location or None

    if args.watch:
        logger.info("Modo watch ativado — rodando a cada 6 horas")
        run_all(kw, locs)
        schedule.every(6).hours.do(run_all, kw, locs)
        while True:
            schedule.run_pending()
            time.sleep(60)
    else:
        run_all(kw)


if __name__ == "__main__":
    main()
