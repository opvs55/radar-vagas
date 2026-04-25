"""
jooble.py — Scraper via API do Jooble
Agrega vagas de Indeed, LinkedIn, Glassdoor e outros — sem Playwright.
API gratuita: https://jooble.org/api/about (solicitar chave em segundos)
"""
import os
import re
import logging
import requests
from base_scraper import BaseScraper

logger = logging.getLogger(__name__)

JOOBLE_API_URL = "https://jooble.org/api/{key}"


class JoobleScraper(BaseScraper):
    source_name = "jooble"

    def __init__(self, keywords: list[str], location: str = "Brasil", max_results: int = 50):
        super().__init__()
        self.keywords = keywords
        self.location = location
        self.max_results = max_results
        self.api_key = os.getenv("JOOBLE_API_KEY", "")

    def scrape(self) -> list[dict]:
        if not self.api_key:
            logger.warning("JOOBLE_API_KEY não configurada — pulando Jooble")
            return []

        jobs = []
        for kw in self.keywords[:5]:
            jobs += self._fetch(kw)

        seen = set()
        unique = []
        for j in jobs:
            key = j.get("source_url") or j.get("title", "")
            if key not in seen:
                seen.add(key)
                unique.append(j)

        logger.info("Jooble: %d vagas únicas", len(unique))
        return unique

    def _fetch(self, keyword: str) -> list[dict]:
        url = JOOBLE_API_URL.format(key=self.api_key)
        payload = {
            "keywords": keyword,
            "location": self.location,
            "resultsOnPage": self.max_results,
        }
        try:
            resp = requests.post(url, json=payload, timeout=15)
            resp.raise_for_status()
            data = resp.json()
            raw_jobs = data.get("jobs", [])
            return [self._parse(j, keyword) for j in raw_jobs if j.get("title")]
        except Exception as e:
            logger.warning("Jooble '%s': %s", keyword, e)
            return []

    def _parse(self, j: dict, keyword: str) -> dict:
        title    = self.clean(j.get("title", ""))
        company  = self.clean(j.get("company", ""))
        location = self.clean(j.get("location", ""))
        city, state = _parse_location(location)
        salary_text = j.get("salary", "")
        sal_min, sal_max = _parse_salary(salary_text)
        source_url = j.get("link", "")
        description = self.clean(re.sub(r"<[^>]+>", " ", j.get("snippet", "")))
        job_type = _infer_job_type(title, description or "")

        return {
            "source": self.source_name,
            "source_url": source_url,
            "title": title,
            "organization": company,
            "description": description,
            "city": city,
            "state": state,
            "job_type": job_type,
            "salary_min": sal_min,
            "salary_max": sal_max,
            "deadline": None,
            "raw_data": {"keyword": keyword, "raw_location": location, "salary_text": salary_text},
        }


def _parse_location(raw: str | None) -> tuple[str | None, str | None]:
    if not raw:
        return None, None
    m = re.search(r"([A-Za-zÀ-ú\s]+)[,\-]\s*([A-Z]{2})\b", raw)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return raw.strip(), None


def _parse_salary(text: str | None) -> tuple[float | None, float | None]:
    if not text:
        return None, None
    numbers = re.findall(r"[\d\.]+", text.replace(",", "."))
    vals = []
    for n in numbers:
        try:
            v = float(n.replace(".", ""))
            if v > 100:
                vals.append(v)
        except ValueError:
            pass
    if not vals:
        return None, None
    return min(vals), max(vals) if len(vals) > 1 else (vals[0], None)


def _infer_job_type(title: str, desc: str) -> str:
    text = (title + " " + desc).lower()
    if any(k in text for k in ["estágio", "estagio", "intern"]):
        return "estagio"
    if any(k in text for k in ["aprendiz", "jovem aprendiz"]):
        return "aprendiz"
    if any(k in text for k in ["concurso", "edital"]):
        return "concurso"
    if any(k in text for k in ["pj", "pessoa jurídica"]):
        return "pj"
    if any(k in text for k in ["clt", "carteira"]):
        return "clt"
    return "clt"
