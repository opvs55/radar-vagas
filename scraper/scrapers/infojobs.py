"""
infojobs.py — Scraper do InfoJobs Brasil
Usa requests + BeautifulSoup, sem Playwright.
"""
import re
import logging
import requests
from bs4 import BeautifulSoup
from base_scraper import BaseScraper

logger = logging.getLogger(__name__)

BASE_URL = "https://www.infojobs.com.br"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    "Accept-Language": "pt-BR,pt;q=0.9",
    "Accept": "text/html,application/xhtml+xml",
}


class InfoJobsScraper(BaseScraper):
    source_name = "infojobs"

    def __init__(self, keywords: list[str], location: str = "Brasil", max_pages: int = 3):
        super().__init__()
        self.keywords = keywords
        self.location = location
        self.max_pages = max_pages

    def scrape(self) -> list[dict]:
        jobs = []
        for kw in self.keywords[:6]:
            jobs += self._search(kw)

        seen = set()
        unique = []
        for j in jobs:
            key = j.get("source_url") or j.get("title", "")
            if key not in seen:
                seen.add(key)
                unique.append(j)

        logger.info("InfoJobs: %d vagas únicas", len(unique))
        return unique

    def _search(self, keyword: str) -> list[dict]:
        jobs = []
        # Normaliza localização para URL
        loc = self.location.replace(" ", "-").lower() if self.location != "Brasil" else ""

        for page in range(1, self.max_pages + 1):
            if loc:
                url = f"{BASE_URL}/candidato/busca.aspx?palavra={requests.utils.quote(keyword)}&cidade={loc}&pagina={page}"
            else:
                url = f"{BASE_URL}/candidato/busca.aspx?palavra={requests.utils.quote(keyword)}&pagina={page}"

            try:
                resp = requests.get(url, headers=HEADERS, timeout=15)
                resp.raise_for_status()
                soup = BeautifulSoup(resp.text, "html.parser")

                # Selectors do InfoJobs BR
                cards = soup.select(
                    ".ij-OfferCard, .offer-card, [class*='OfferCard'], "
                    ".oferta, [data-jobid], .vaga-item"
                )

                if not cards:
                    # Fallback: qualquer link de vaga
                    cards = soup.select("li.offer, div.offer, .job-list li")

                if not cards:
                    break

                for card in cards:
                    job = self._parse(card, keyword)
                    if job:
                        jobs.append(job)

            except Exception as e:
                logger.warning("InfoJobs '%s' p%d: %s", keyword, page, e)
                break

        return jobs

    def _parse(self, card, keyword: str) -> dict | None:
        try:
            title_el = card.select_one(
                "h2, h3, .ij-OfferCard-title, .offer-title, [class*='title'], a[title]"
            )
            if not title_el:
                return None
            title = self.clean(title_el.get("title") or title_el.get_text())
            if not title or len(title) < 4:
                return None

            company_el = card.select_one(
                ".ij-OfferCard-company, .company, [class*='company'], [class*='empresa']"
            )
            company = self.clean(company_el.get_text()) if company_el else None

            loc_el = card.select_one(
                ".ij-OfferCard-location, .location, [class*='location'], [class*='cidade']"
            )
            raw_loc = self.clean(loc_el.get_text()) if loc_el else None
            city, state = _parse_location(raw_loc)

            sal_el = card.select_one(
                ".ij-OfferCard-salary, .salary, [class*='salary'], [class*='salario']"
            )
            sal_text = self.clean(sal_el.get_text()) if sal_el else None
            sal_min, sal_max = _parse_salary(sal_text)

            link_el = card.select_one("a[href]")
            href = link_el["href"] if link_el else None
            if href and not href.startswith("http"):
                href = BASE_URL + href

            job_type = _infer_job_type(title, sal_text or "")

            return {
                "source": self.source_name,
                "source_url": href or url_from_keyword(keyword),
                "title": title,
                "organization": company,
                "description": None,
                "city": city,
                "state": state,
                "job_type": job_type,
                "salary_min": sal_min,
                "salary_max": sal_max,
                "deadline": None,
                "raw_data": {"keyword": keyword, "raw_location": raw_loc},
            }
        except Exception as e:
            logger.debug("InfoJobs parse: %s", e)
            return None


def url_from_keyword(keyword: str) -> str:
    return f"{BASE_URL}/candidato/busca.aspx?palavra={requests.utils.quote(keyword)}"


def _parse_location(raw: str | None) -> tuple[str | None, str | None]:
    if not raw:
        return None, None
    m = re.search(r"([A-Za-zÀ-ú\s]+)[,\-]\s*([A-Z]{2})\b", raw)
    if m:
        return m.group(1).strip(), m.group(2)
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
    if len(vals) == 1:
        return vals[0], None
    return min(vals), max(vals)


def _infer_job_type(title: str, extra: str) -> str:
    text = (title + " " + extra).lower()
    if any(k in text for k in ["estágio", "estagio", "trainee", "intern"]):
        return "estagio"
    if any(k in text for k in ["aprendiz", "jovem aprendiz"]):
        return "aprendiz"
    if any(k in text for k in ["pj", "pessoa jurídica", "cnpj"]):
        return "pj"
    if any(k in text for k in ["clt", "carteira assinada"]):
        return "clt"
    return "clt"
