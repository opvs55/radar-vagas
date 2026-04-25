"""
enricher.py — Enriquece vagas sem localização e sem salário no banco.

1. Extrai cidade/estado da descrição/título via regex
2. Extrai faixa salarial da descrição via regex
3. Geocodifica vagas que passaram a ter localização

Uso:
  python enricher.py
"""
import re
import logging
import time
import requests
from db import get_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S")
logger = logging.getLogger("enricher")

# ─── Cidades brasileiras mais comuns em vagas ───────────────────────────────
CITY_PATTERNS = [
    # "em São Paulo", "em SP", "- São Paulo/SP", "São Paulo - SP"
    r"\bem\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+){0,2})\s*[/\-–]?\s*(SP|RJ|MG|RS|PR|SC|BA|GO|DF|CE|PE|AM|PA|MA|ES|RN|PB|MT|MS|RO|TO|PI|AL|SE|AC|AP|RR)",
    r"([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+){0,2})\s*[/\-–]\s*(SP|RJ|MG|RS|PR|SC|BA|GO|DF|CE|PE|AM|PA|MA|ES|RN|PB|MT|MS|RO|TO|PI|AL|SE|AC|AP|RR)\b",
    r"\b(SP|RJ|MG|RS|PR|SC|BA|GO|DF|CE|PE|AM|PA|MA|ES|RN|PB|MT|MS|RO|TO|PI|AL|SE|AC|AP|RR)\b",
]

# Mapa sigla → estado completo (para geocoding)
STATE_NAMES = {
    "SP": "São Paulo", "RJ": "Rio de Janeiro", "MG": "Minas Gerais",
    "RS": "Rio Grande do Sul", "PR": "Paraná", "SC": "Santa Catarina",
    "BA": "Bahia", "GO": "Goiás", "DF": "Brasília", "CE": "Ceará",
    "PE": "Pernambuco", "AM": "Amazonas", "PA": "Pará", "MA": "Maranhão",
    "ES": "Espírito Santo", "RN": "Rio Grande do Norte", "PB": "Paraíba",
    "MT": "Mato Grosso", "MS": "Mato Grosso do Sul", "RO": "Rondônia",
    "TO": "Tocantins", "PI": "Piauí", "AL": "Alagoas", "SE": "Sergipe",
    "AC": "Acre", "AP": "Amapá", "RR": "Roraima",
}

# ─── Padrões de salário (BRL) ────────────────────────────────────────────────
SALARY_PATTERNS = [
    # R$ 3.500,00 a R$ 5.000,00  |  R$ 3500 - R$ 5000
    r"R\$\s*([\d.,]+)\s*(?:a|–|-|até)\s*R\$\s*([\d.,]+)",
    # salário de R$ 3500
    r"sal[aá]rio\s+(?:de\s+)?R\$\s*([\d.,]+)",
    # R$ 3.500
    r"R\$\s*([\d.,]+)",
]

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
NOMINATIM_HEADERS = {"User-Agent": "RadarVagas/1.0"}
_geocache: dict[str, tuple[float, float] | None] = {}


def extract_location(text: str) -> tuple[str | None, str | None]:
    """Extrai (city, state) de um texto livre."""
    if not text:
        return None, None
    for pattern in CITY_PATTERNS:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            groups = m.groups()
            if len(groups) == 2:
                city, state = groups
                # Validar que city não é apenas uma sigla
                if len(city.strip()) > 2:
                    return city.strip(), state.strip().upper()
                else:
                    return None, city.strip().upper()
            elif len(groups) == 1:
                return None, groups[0].strip().upper()
    return None, None


def extract_salary(text: str) -> tuple[float | None, float | None]:
    """Extrai (salary_min, salary_max) de um texto livre."""
    if not text:
        return None, None

    def parse_value(s: str) -> float | None:
        try:
            # "3.500,00" → 3500.0 | "3500" → 3500.0
            clean = s.replace(".", "").replace(",", ".")
            val = float(clean)
            # Ignorar valores absurdos (< 500 ou > 100.000)
            if 500 <= val <= 100_000:
                return val
        except Exception:
            pass
        return None

    # Tentar padrão com range primeiro
    m = re.search(SALARY_PATTERNS[0], text, re.IGNORECASE)
    if m:
        mn = parse_value(m.group(1))
        mx = parse_value(m.group(2))
        if mn and mx:
            return (min(mn, mx), max(mn, mx))

    # Salário único
    for pattern in SALARY_PATTERNS[1:]:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            val = parse_value(m.group(1))
            if val:
                return val, None

    return None, None


def geocode(city: str | None, state: str | None) -> tuple[float, float] | None:
    parts = [p for p in [city, STATE_NAMES.get(state or "", state), "Brasil"] if p]
    query = ", ".join(parts)
    if query in _geocache:
        return _geocache[query]
    try:
        r = requests.get(
            NOMINATIM_URL,
            params={"q": query, "format": "json", "limit": 1, "countrycodes": "br"},
            headers=NOMINATIM_HEADERS,
            timeout=10,
        )
        r.raise_for_status()
        data = r.json()
        time.sleep(1.1)
        if data:
            result = (float(data[0]["lat"]), float(data[0]["lon"]))
            _geocache[query] = result
            return result
    except Exception as e:
        logger.warning("Geocoding erro '%s': %s", query, e)
    _geocache[query] = None
    return None


def run():
    client = get_client()

    # Buscar vagas sem localização OU sem salário que tenham descrição
    result = client.table("jobs").select("id, title, description, city, state, latitude, salary_min, salary_max").execute()
    jobs = result.data or []

    loc_fixed = 0
    salary_fixed = 0

    for job in jobs:
        updates: dict = {}
        desc = (job.get("description") or "") + " " + (job.get("title") or "")

        # 1. Extrair localização se ausente
        if not job.get("city") and not job.get("state"):
            city, state = extract_location(desc)
            if city or state:
                updates["city"] = city
                updates["state"] = state
                loc_fixed += 1
                logger.info("📍 %s → %s/%s", job["title"][:50], city, state)

        # 2. Geocodificar se tem city/state mas não tem lat/lng
        if not job.get("latitude"):
            final_city = updates.get("city") or job.get("city")
            final_state = updates.get("state") or job.get("state")
            if final_city or final_state:
                coords = geocode(final_city, final_state)
                if coords:
                    updates["latitude"], updates["longitude"] = coords

        # 3. Extrair salário se ausente
        if not job.get("salary_min") and not job.get("salary_max"):
            sal_min, sal_max = extract_salary(desc)
            if sal_min:
                updates["salary_min"] = sal_min
                updates["salary_max"] = sal_max
                salary_fixed += 1
                logger.info("💰 %s → R$%.0f%s", job["title"][:50], sal_min,
                            f" – R${sal_max:.0f}" if sal_max else "")

        if updates:
            client.table("jobs").update(updates).eq("id", job["id"]).execute()

    logger.info("=" * 50)
    logger.info("Localização extraída: %d vagas", loc_fixed)
    logger.info("Salário extraído: %d vagas", salary_fixed)


if __name__ == "__main__":
    run()
