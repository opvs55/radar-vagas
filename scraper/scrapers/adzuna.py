"""
Adzuna API — vagas brasileiras com dados estruturados.
Cadastro gratuito: https://developer.adzuna.com
Variáveis necessárias no scraper/.env:
  ADZUNA_APP_ID=seu_app_id
  ADZUNA_APP_KEY=sua_app_key
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import logging
import requests
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

BASE_URL = "https://api.adzuna.com/v1/api/jobs/br/search"


class AdzunaScraper:
    source_name = "adzuna"

    def __init__(self, keywords: list[str] | None = None, location: str | None = None):
        self.keywords = keywords or []
        self.location = location  # ex: "São Paulo"
        self.app_id = os.getenv("ADZUNA_APP_ID", "")
        self.app_key = os.getenv("ADZUNA_APP_KEY", "")

    def run(self) -> list[dict]:
        if not self.app_id or not self.app_key:
            logger.warning("Adzuna: ADZUNA_APP_ID / ADZUNA_APP_KEY não configuradas — pulando")
            return []

        jobs = []
        kws = self.keywords[:5] if self.keywords else ["emprego", "vaga"]
        seen_urls: set[str] = set()

        for kw in kws:
            try:
                params = {
                    "app_id": self.app_id,
                    "app_key": self.app_key,
                    "results_per_page": 30,
                    "what": kw,
                    "content-type": "application/json",
                }
                if self.location:
                    params["where"] = self.location

                for page in range(1, 3):  # 2 páginas por keyword = 60 vagas
                    resp = requests.get(f"{BASE_URL}/{page}", params=params, timeout=15)
                    resp.raise_for_status()
                    data = resp.json()
                    results = data.get("results", [])
                    if not results:
                        break

                    for item in results:
                        title = (item.get("title") or "").strip()
                        if not title:
                            continue
                        url = item.get("redirect_url") or item.get("adref", "")
                        if url in seen_urls:
                            continue
                        seen_urls.add(url)

                        company = (item.get("company", {}).get("display_name") or "").strip()
                        location_data = item.get("location", {})
                        area = location_data.get("area", [])
                        city = area[-1] if area else None
                        state = area[-2] if len(area) >= 2 else None
                        salary_min = item.get("salary_min")
                        salary_max = item.get("salary_max")
                        description = (item.get("description") or "")[:500]
                        created = (item.get("created") or "")[:10] or None

                        jobs.append({
                            "source": self.source_name,
                            "source_url": url,
                            "title": title[:200],
                            "organization": company or None,
                            "description": description or None,
                            "city": city,
                            "state": state,
                            "job_type": "clt",
                            "salary_min": float(salary_min) if salary_min else None,
                            "salary_max": float(salary_max) if salary_max else None,
                            "deadline": None,
                            "published_at": created,
                            "raw_data": {"keyword": kw, "category": item.get("category", {}).get("label")},
                        })
            except Exception as e:
                logger.error("Adzuna '%s' erro: %s", kw, e)

        logger.info("✓ adzuna: %d vagas coletadas", len(jobs))
        return jobs
