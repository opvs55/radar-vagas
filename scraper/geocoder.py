"""
geocoder.py — Adiciona lat/lng às vagas sem coordenadas usando Nominatim (OpenStreetMap).

Uso:
  python geocoder.py          → geocodifica todas as vagas sem lat/lng
  python geocoder.py --dry    → mostra o que seria feito sem alterar o banco
"""
import time
import logging
import argparse
import requests
from db import get_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("geocoder")

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
HEADERS = {"User-Agent": "RadarVagas/1.0 (contact@radarvagas.local)"}
DELAY = 1.1  # respeitar rate limit do Nominatim (max 1 req/s)

# Cache local para evitar requests repetidos da mesma localização
_cache: dict[str, tuple[float, float] | None] = {}


def geocode(city: str | None, state: str | None) -> tuple[float, float] | None:
    """Retorna (lat, lng) ou None se não encontrado."""
    parts = [p for p in [city, state, "Brasil"] if p]
    query = ", ".join(parts)

    if query in _cache:
        return _cache[query]

    try:
        resp = requests.get(
            NOMINATIM_URL,
            params={"q": query, "format": "json", "limit": 1, "countrycodes": "br"},
            headers=HEADERS,
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        time.sleep(DELAY)

        if data:
            lat = float(data[0]["lat"])
            lng = float(data[0]["lon"])
            _cache[query] = (lat, lng)
            return lat, lng

    except Exception as e:
        logger.warning("Erro geocodificando '%s': %s", query, e)

    _cache[query] = None
    return None


def run(dry: bool = False) -> dict:
    client = get_client()

    # Buscar vagas sem lat/lng
    result = (
        client.table("jobs")
        .select("id, title, city, state")
        .is_("latitude", "null")
        .execute()
    )
    jobs = result.data or []
    logger.info("Vagas sem coordenadas: %d", len(jobs))

    stats = {"total": len(jobs), "geocoded": 0, "failed": 0, "skipped": 0}

    for job in jobs:
        city = job.get("city")
        state = job.get("state")

        if not city and not state:
            logger.debug("Sem localização para '%s' — pulando", job["title"][:50])
            stats["skipped"] += 1
            continue

        coords = geocode(city, state)

        if coords:
            lat, lng = coords
            logger.info("✓ %-40s → %.4f, %.4f", (job["title"] or "")[:40], lat, lng)
            if not dry:
                client.table("jobs").update(
                    {"latitude": lat, "longitude": lng}
                ).eq("id", job["id"]).execute()
            stats["geocoded"] += 1
        else:
            logger.warning("✗ Não encontrado: %s / %s", city, state)
            stats["failed"] += 1

    logger.info("=" * 50)
    logger.info(
        "RESUMO: %d geocodificados, %d falhos, %d sem localização",
        stats["geocoded"], stats["failed"], stats["skipped"],
    )
    if dry:
        logger.info("(modo --dry: nenhuma alteração feita no banco)")
    return stats


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry", action="store_true", help="Simular sem salvar no banco")
    args = parser.parse_args()
    run(dry=args.dry)
