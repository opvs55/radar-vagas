import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import time
import logging
from playwright.sync_api import sync_playwright
from base_scraper import BaseScraper

logger = logging.getLogger(__name__)

BASE_URL = "https://www.cebraspe.org.br"
PAGES = [
    f"{BASE_URL}/concursos/inscricoes-abertas/",
    f"{BASE_URL}/concursos/em-andamento/",
]


class CebraspeScraper(BaseScraper):
    source_name = "cebraspe"

    def __init__(self, keywords: list[str] | None = None):
        super().__init__()
        self.keywords = [k.lower() for k in (keywords or [])]

    def scrape(self) -> list[dict]:
        jobs = []
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            page = browser.new_page(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36"
            )
            for url in PAGES:
                try:
                    page.goto(url, wait_until="networkidle", timeout=20000)
                    time.sleep(3)

                    # Cards de concurso são h3 com link /concursos/<SIGLA>
                    headings = page.query_selector_all("h3")
                    for h3 in headings:
                        title = self.clean(h3.inner_text())
                        if not title or len(title) < 4:
                            continue

                        if self.keywords and not any(kw in title.lower() for kw in self.keywords):
                            continue

                        # Link pode estar no h3 ou no botão "MAIS INFORMAÇÕES" próximo
                        link_el = h3.query_selector("a") or h3.evaluate_handle(
                            "el => el.nextElementSibling && el.nextElementSibling.querySelector('a')"
                        )
                        href = None
                        try:
                            href = link_el.get_attribute("href")
                        except Exception:
                            pass

                        source_url = None
                        if href:
                            source_url = href if href.startswith("http") else BASE_URL + href

                        jobs.append({
                            "source": self.source_name,
                            "source_url": source_url,
                            "title": title[:200],
                            "organization": "CEBRASPE",
                            "description": None,
                            "city": None,
                            "state": None,
                            "job_type": "concurso",
                            "deadline": None,
                            "raw_data": {"page": url},
                        })

                except Exception as e:
                    logger.error("CEBRASPE erro em %s: %s", url, e)

            browser.close()
        return jobs
