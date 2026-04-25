import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import re
import time
import logging
from playwright.sync_api import sync_playwright
from base_scraper import BaseScraper

logger = logging.getLogger(__name__)

BASE_URL = "https://br.indeed.com"


class IndeedScraper(BaseScraper):
    source_name = "indeed"

    def __init__(self, keywords: list[str], location: str = "Brasil", max_pages: int = 3):
        super().__init__()
        self.keywords = keywords
        self.location = location
        self.max_pages = max_pages

    def scrape(self) -> list[dict]:
        jobs = []
        query = " OR ".join(self.keywords[:5])

        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            ctx = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
                viewport={"width": 1280, "height": 900},
            )
            page = ctx.new_page()

            for page_num in range(self.max_pages):
                start = page_num * 10
                url = f"{BASE_URL}/jobs?q={query}&l={self.location}&start={start}&lang=pt_BR"
                logger.info("Indeed página %d: %s", page_num + 1, url)

                try:
                    page.goto(url, wait_until="domcontentloaded", timeout=20000)
                    time.sleep(2)

                    cards = page.query_selector_all("div.job_seen_beacon")
                    if not cards:
                        logger.info("Sem mais resultados na página %d", page_num + 1)
                        break

                    for card in cards:
                        job = self._parse_card(card, page)
                        if job:
                            jobs.append(job)

                except Exception as e:
                    logger.error("Indeed página %d erro: %s", page_num + 1, e)
                    break

            browser.close()

        return jobs

    def _parse_card(self, card, page) -> dict | None:
        try:
            title_el = card.query_selector("h2.jobTitle span")
            title = self.clean(title_el.inner_text() if title_el else None)
            if not title:
                return None

            company_el = card.query_selector("[data-testid='company-name']")
            company = self.clean(company_el.inner_text() if company_el else None)

            location_el = card.query_selector("[data-testid='text-location']")
            raw_location = self.clean(location_el.inner_text() if location_el else None)
            city, state = _parse_location(raw_location)

            salary_el = card.query_selector("[data-testid='attribute_snippet_testid']")
            salary_text = self.clean(salary_el.inner_text() if salary_el else None)
            salary_min, salary_max = _parse_salary(salary_text)

            link_el = card.query_selector("h2.jobTitle a")
            href = link_el.get_attribute("href") if link_el else None
            source_url = (BASE_URL + href) if href and href.startswith("/") else href

            job_type = _infer_job_type(title, salary_text or "")

            return {
                "source": self.source_name,
                "source_url": source_url,
                "title": title,
                "organization": company,
                "description": None,
                "city": city,
                "state": state,
                "job_type": job_type,
                "salary_min": salary_min,
                "salary_max": salary_max,
                "deadline": None,
                "raw_data": {"raw_location": raw_location, "salary_text": salary_text},
            }

        except Exception as e:
            logger.debug("Erro ao parsear card: %s", e)
            return None


def _parse_location(raw: str | None) -> tuple[str | None, str | None]:
    if not raw:
        return None, None
    parts = raw.split(",")
    city = parts[0].strip() if parts else None
    state = parts[1].strip()[:2].upper() if len(parts) > 1 else None
    return city, state


def _parse_salary(text: str | None) -> tuple[float | None, float | None]:
    if not text:
        return None, None
    numbers = re.findall(r"[\d\.]+", text.replace(",", "."))
    vals = []
    for n in numbers:
        try:
            vals.append(float(n.replace(".", "")))
        except ValueError:
            pass
    if len(vals) == 0:
        return None, None
    if len(vals) == 1:
        return vals[0], None
    return min(vals), max(vals)


def _infer_job_type(title: str, salary_text: str) -> str:
    lower = (title + " " + salary_text).lower()
    if any(w in lower for w in ["pj", "pessoa jurídica", "cnpj"]):
        return "pj"
    if any(w in lower for w in ["clt", "carteira"]):
        return "clt"
    if any(w in lower for w in ["edtech", "startup", "plataforma educacional"]):
        return "edtech"
    return "clt"
