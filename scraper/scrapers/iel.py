"""
iel.py — Scraper do IEL (Instituto Euvaldo Lodi)
Foco: estágios para estudantes universitários e técnicos.
Usa apenas requests + BeautifulSoup, sem Playwright.
"""
import re
import logging
import requests
from bs4 import BeautifulSoup
from base_scraper import BaseScraper

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    "Accept-Language": "pt-BR,pt;q=0.9",
}

# IEL tem portais por estado — usamos os principais
IEL_PORTALS = [
    ("SP", "https://www.ielsp.org.br/vagas"),
    ("MG", "https://www.ielmg.org.br/vagas"),
    ("RJ", "https://www.ielrj.org.br/vagas"),
    ("PR", "https://www.ielpr.org.br/vagas"),
    ("RS", "https://www.ielrs.org.br/vagas"),
]


class IELScraper(BaseScraper):
    source_name = "iel"

    def __init__(self, keywords: list[str], location: str = "Brasil", max_pages: int = 2):
        super().__init__()
        self.keywords = keywords
        self.location = location
        self.max_pages = max_pages

    def scrape(self) -> list[dict]:
        jobs = []
        for kw in self.keywords[:5]:
            jobs += self._search_national(kw)
        seen = set()
        unique = []
        for j in jobs:
            key = j.get("source_url") or j.get("title", "")
            if key not in seen:
                seen.add(key)
                unique.append(j)
        logger.info("IEL: %d vagas únicas", len(unique))
        return unique

    def _search_national(self, keyword: str) -> list[dict]:
        """Busca no portal nacional do IEL."""
        jobs = []
        base = "https://www.iel.org.br/vagas"
        for page in range(1, self.max_pages + 1):
            url = f"{base}?q={requests.utils.quote(keyword)}&page={page}"
            try:
                resp = requests.get(url, headers=HEADERS, timeout=15)
                resp.raise_for_status()
                soup = BeautifulSoup(resp.text, "html.parser")

                cards = soup.select(".vaga, .job-card, [class*='vaga'], [class*='job']")
                if not cards:
                    break

                for card in cards:
                    job = self._parse(card, keyword)
                    if job:
                        jobs.append(job)

            except Exception as e:
                logger.warning("IEL '%s' p%d: %s", keyword, page, e)
                break
        return jobs

    def _parse(self, card, keyword: str) -> dict | None:
        try:
            title_el = card.select_one("h2, h3, h4, .titulo, [class*='title']")
            if not title_el:
                return None
            title = self.clean(title_el.get_text())
            if not title:
                return None

            company_el = card.select_one(".empresa, [class*='company'], [class*='empresa']")
            company = self.clean(company_el.get_text()) if company_el else None

            loc_el = card.select_one(".local, [class*='local'], [class*='cidade'], [class*='city']")
            raw_loc = self.clean(loc_el.get_text()) if loc_el else None
            city, state = _parse_location(raw_loc)

            link_el = card.select_one("a[href]")
            href = link_el["href"] if link_el else None
            if href and not href.startswith("http"):
                href = "https://www.iel.org.br" + href

            return {
                "source": self.source_name,
                "source_url": href or "https://www.iel.org.br/vagas",
                "title": title,
                "organization": company,
                "description": f"Estágio via IEL. Busca: {keyword}",
                "city": city,
                "state": state,
                "job_type": "estagio",
                "salary_min": None,
                "salary_max": None,
                "deadline": None,
                "raw_data": {"keyword": keyword, "raw_location": raw_loc},
            }
        except Exception as e:
            logger.debug("IEL parse error: %s", e)
            return None


def _parse_location(raw: str | None) -> tuple[str | None, str | None]:
    if not raw:
        return None, None
    m = re.search(r"([A-Za-zÀ-ú\s]+)[,\-]\s*([A-Z]{2})", raw)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return raw.strip(), None
