"""
JSearch API (RapidAPI) — agrega Indeed, LinkedIn, Glassdoor.
Cadastro gratuito: https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
Variável necessária no scraper/.env:
  JSEARCH_API_KEY=sua_rapidapi_key
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import logging
import requests
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

API_URL = "https://jsearch.p.rapidapi.com/search"
HEADERS_BASE = {
    "x-rapidapi-host": "jsearch.p.rapidapi.com",
}


class JSearchScraper:
    source_name = "jsearch"

    def __init__(self, keywords: list[str] | None = None, location: str | None = None):
        self.keywords = keywords or []
        self.location = location  # ex: "São Paulo, Brazil"
        self.api_key = os.getenv("JSEARCH_API_KEY", "")

    def run(self) -> list[dict]:
        if not self.api_key:
            logger.warning("JSearch: JSEARCH_API_KEY não configurada — pulando")
            return []

        jobs = []
        try:
            logger.info("▶ Iniciando scraper: jsearch")
            query = " ".join(self.keywords[:4]) if self.keywords else "professor educacao Brasil"
            location_str = self.location or "Brasil"
            params = {
                "query": f"{query} {location_str}",
                "page": "1",
                "num_pages": "3",
                "country": "br",
                "language": "pt",
            }
            headers = {**HEADERS_BASE, "x-rapidapi-key": self.api_key}

            resp = requests.get(API_URL, params=params, headers=headers, timeout=15)
            resp.raise_for_status()
            data = resp.json().get("data", [])

            for item in data:
                title = (item.get("job_title") or "").strip()
                if not title:
                    continue

                company = (item.get("employer_name") or "").strip()
                city = item.get("job_city")
                state = item.get("job_state")
                country = item.get("job_country", "")
                url = item.get("job_apply_link") or item.get("job_google_link", "")
                description = (item.get("job_description") or "")[:500]
                pub_date = (item.get("job_posted_at_datetime_utc") or "")[:10] or None
                salary_min = item.get("job_min_salary")
                salary_max = item.get("job_max_salary")
                employment_type = (item.get("job_employment_type") or "").lower()

                job_type = "clt"
                if "contract" in employment_type or "pj" in employment_type:
                    job_type = "pj"
                elif "temporary" in employment_type:
                    job_type = "temporario"

                if country and country.upper() not in ("BR", "BRAZIL", "BRASIL", ""):
                    continue

                jobs.append({
                    "source": self.source_name,
                    "source_url": url,
                    "title": title[:200],
                    "organization": company or None,
                    "description": description or None,
                    "city": city,
                    "state": state,
                    "job_type": job_type,
                    "salary_min": float(salary_min) if salary_min else None,
                    "salary_max": float(salary_max) if salary_max else None,
                    "deadline": None,
                    "published_at": pub_date,
                    "raw_data": {"employer_logo": item.get("employer_logo")},
                })

            logger.info("✓ jsearch: %d vagas coletadas", len(jobs))

        except Exception as e:
            logger.error("JSearch erro: %s", e)

        return jobs
