"""
CareerJet API pública — agrega vagas de Catho, InfoJobs e outros portais BR.
Documentação: http://public.api.careerjet.net/
Sem key necessária, apenas user_ip e user_agent.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import logging
import requests
from fake_useragent import UserAgent

logger = logging.getLogger(__name__)

API_URL = "http://public.api.careerjet.net/search"
UA = UserAgent()


class CareerJetScraper:
    source_name = "careerjet"

    def __init__(self, keywords: list[str] | None = None):
        self.keywords = keywords or []

    def run(self) -> list[dict]:
        jobs = []
        query = " ".join(self.keywords[:5]) if self.keywords else "professor educacao"
        user_agent = UA.random

        try:
            logger.info("▶ Iniciando scraper: careerjet")

            for page in range(1, 4):  # até 3 páginas = 60 vagas
                params = {
                    "keywords": query,
                    "location": "Brasil",
                    "affid": "none",
                    "locale_code": "pt_BR",
                    "pagesize": 20,
                    "page": page,
                    "user_ip": "127.0.0.1",
                    "user_agent": user_agent,
                }

                resp = requests.get(API_URL, params=params, timeout=15)
                resp.raise_for_status()
                data = resp.json()

                if data.get("type") == "ERROR":
                    logger.warning("CareerJet erro API: %s", data.get("error"))
                    break

                results = data.get("jobs", [])
                if not results:
                    break

                for item in results:
                    title = (item.get("title") or "").strip()
                    if not title:
                        continue

                    company = (item.get("company") or "").strip()
                    url = item.get("url") or item.get("site", "")
                    description = (item.get("description") or "")[:500]
                    locations = item.get("locations", "")
                    date = (item.get("date") or "")[:10] or None

                    # Parsear localização "Cidade, UF"
                    city, state = _parse_loc(locations)

                    jobs.append({
                        "source": self.source_name,
                        "source_url": url,
                        "title": title[:200],
                        "organization": company or None,
                        "description": description or None,
                        "city": city,
                        "state": state,
                        "job_type": "clt",
                        "deadline": None,
                        "published_at": date,
                        "raw_data": {"locations": locations},
                    })

            logger.info("✓ careerjet: %d vagas coletadas", len(jobs))

        except Exception as e:
            logger.error("CareerJet erro: %s", e)

        return jobs


def _parse_loc(loc: str) -> tuple[str | None, str | None]:
    if not loc:
        return None, None
    parts = [p.strip() for p in loc.split(",")]
    if len(parts) >= 2:
        return parts[0], parts[-1]
    return loc.strip(), None
