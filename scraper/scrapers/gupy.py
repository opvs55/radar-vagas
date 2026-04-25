"""
Gupy API — maior plataforma de vagas brasileira.
API pública, sem key necessária.
https://portal.api.gupy.io/api/v1/jobs
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import logging
import requests
from fake_useragent import UserAgent

logger = logging.getLogger(__name__)

API_URL = "https://portal.api.gupy.io/api/v1/jobs"
UA = UserAgent()

KEYWORDS_DEFAULT = [
    "professor", "docente", "educacao", "pedagogia",
    "licenciatura", "ensino", "tutor", "coordenador pedagogico",
]


class GupyScraper:
    source_name = "gupy"

    def __init__(
        self,
        keywords: list[str] | None = None,
        location: str | None = None,   # ex: "São Paulo" ou "SP"
        state: str | None = None,       # ex: "SP"
    ):
        self.keywords = keywords or KEYWORDS_DEFAULT
        self.location = location
        self.state = state

    def run(self) -> list[dict]:
        jobs: list[dict] = []
        seen: set[str] = set()

        try:
            logger.info("▶ Iniciando scraper: gupy")
            headers = {"User-Agent": UA.random, "Accept": "application/json"}

            for keyword in self.keywords[:6]:  # até 6 keywords
                offset = 0
                limit = 100

                while True:
                    params = {
                        "jobName": keyword,
                        "offset": offset,
                        "limit": limit,
                    }
                    resp = requests.get(API_URL, params=params, headers=headers, timeout=15)
                    resp.raise_for_status()
                    data = resp.json()

                    results = data.get("data", [])
                    total = data.get("pagination", {}).get("total", 0)

                    if not results:
                        break

                    for item in results:
                        job_id = str(item.get("id", ""))
                        if job_id in seen:
                            continue
                        seen.add(job_id)

                        title = (item.get("name") or "").strip()
                        if not title:
                            continue

                        company = (item.get("company", {}) or {}).get("name") or ""
                        city_raw = (item.get("city") or "").strip()
                        state_raw = (item.get("state") or "").strip()
                        country = (item.get("country") or "").upper()

                        # Só vagas do Brasil
                        if country and country not in ("BR", "BRASIL", "BRAZIL", ""):
                            continue

                        # Filtro por estado/localidade se especificado
                        if self.state and state_raw:
                            if self.state.upper() not in state_raw.upper():
                                continue
                        if self.location and city_raw:
                            if self.location.lower() not in city_raw.lower():
                                # não filtrar muito rígido — aceitar vagas remotas ou sem cidade
                                if city_raw.lower() not in ("remoto", "remote", ""):
                                    continue

                        url = item.get("jobUrl") or f"https://portal.gupy.io/job/{job_id}"
                        description = (item.get("description") or "")[:500]
                        pub_date = (item.get("publishedDate") or item.get("createdAt") or "")[:10] or None
                        deadline = (item.get("deadline") or "")[:10] or None
                        is_remote = item.get("isRemoteWork", False)

                        # Tipo de contrato
                        contract = (item.get("contractType") or "").lower()
                        if "pj" in contract or "freelan" in contract:
                            job_type = "pj"
                        elif "temporar" in contract or "intermit" in contract:
                            job_type = "temporario"
                        elif "est" in contract or "trainee" in contract:
                            job_type = "outro"
                        else:
                            job_type = "clt"

                        jobs.append({
                            "source": self.source_name,
                            "source_url": url,
                            "title": title[:200],
                            "organization": company or None,
                            "description": description or None,
                            "city": "Remoto" if is_remote and not city_raw else city_raw or None,
                            "state": state_raw or None,
                            "job_type": job_type,
                            "salary_min": None,
                            "salary_max": None,
                            "deadline": deadline,
                            "published_at": pub_date,
                            "raw_data": {"gupy_id": job_id, "remote": is_remote},
                        })

                    offset += limit
                    if offset >= total or offset >= 300:  # máx 300 por keyword
                        break

            logger.info("✓ gupy: %d vagas coletadas", len(jobs))

        except Exception as e:
            logger.error("Gupy erro: %s", e)

        return jobs
