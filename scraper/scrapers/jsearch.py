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
        headers = {**HEADERS_BASE, "x-rapidapi-key": self.api_key}
        location_str = self.location or "Brasil"
        kws = self.keywords[:4] if self.keywords else ["emprego", "vaga"]
        seen_urls: set[str] = set()

        for kw in kws:
            try:
                params = {
                    "query": f"{kw} em {location_str}",
                    "page": "1",
                    "num_pages": "1",
                    "country": "br",
                    "language": "pt",
                }
                resp = requests.get(API_URL, params=params, headers=headers, timeout=15)

                if resp.status_code in (403, 429):
                    logger.warning("JSearch: limite de plano atingido (HTTP %d) — pulando", resp.status_code)
                    break

                resp.raise_for_status()
                data = resp.json().get("data", [])

                for item in data:
                    title = (item.get("job_title") or "").strip()
                    if not title:
                        continue
                    url = item.get("job_apply_link") or item.get("job_google_link", "")
                    if url in seen_urls:
                        continue
                    seen_urls.add(url)

                    country = item.get("job_country", "")
                    if country and country.upper() not in ("BR", "BRAZIL", "BRASIL", ""):
                        continue

                    company = (item.get("employer_name") or "").strip()
                    city = item.get("job_city")
                    state = item.get("job_state")
                    description = (item.get("job_description") or "")[:500]
                    pub_date = (item.get("job_posted_at_datetime_utc") or "")[:10] or None
                    salary_min = item.get("job_min_salary")
                    salary_max = item.get("job_max_salary")
                    employment_type = (item.get("job_employment_type") or "").lower()

                    job_type = "clt"
                    if "contract" in employment_type or "pj" in employment_type:
                        job_type = "pj"
                    elif "temporary" in employment_type or "intern" in employment_type:
                        job_type = "temporario"

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
                        "raw_data": {"keyword": kw, "employer_logo": item.get("employer_logo")},
                    })

            except Exception as e:
                logger.error("JSearch '%s' erro: %s", kw, e)

        logger.info("✓ jsearch: %d vagas coletadas", len(jobs))
        return jobs
