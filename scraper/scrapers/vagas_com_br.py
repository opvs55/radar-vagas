"""
Vagas.com.br + Empregos.com.br — scraping HTML estático.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import logging
import re
from base_scraper import BaseScraper

logger = logging.getLogger(__name__)


class VagasComBrScraper(BaseScraper):
    source_name = "vagas_com_br"

    def __init__(self, keywords: list[str] | None = None):
        super().__init__()
        self.keywords = [k.lower() for k in (keywords or [])]

    def scrape(self) -> list[dict]:
        jobs = []
        kw_query = "-".join(self.keywords[:2]) if self.keywords else "professor"
        url = f"https://www.vagas.com.br/vagas-de-{kw_query}"

        try:
            soup = self.get(url)
            # Estrutura real: <li class="vaga"> com conteúdo aninhado
            cards = soup.select("li.vaga")

            for card in cards:
                # Título fica no span .cargo dentro do link
                title_el = card.select_one("a")
                title = self.clean(title_el.get_text()) if title_el else self.clean(card.get_text())
                href = title_el.get("href", "") if title_el else ""

                org_el = card.select_one(".empr, span.empr, .empresa")
                org = self.clean(org_el.get_text()) if org_el else None

                loc_el = card.select_one(".local, span.local, .vaga-local")
                loc = self.clean(loc_el.get_text()) if loc_el else None
                city, state = _parse_location(loc)

                if not title or len(title) < 5:
                    continue

                source_url = href if href.startswith("http") else "https://www.vagas.com.br" + href

                jobs.append({
                    "source": self.source_name,
                    "source_url": source_url,
                    "title": title[:200],
                    "organization": org,
                    "description": None,
                    "city": city,
                    "state": state,
                    "job_type": "clt",
                    "deadline": None,
                    "raw_data": {},
                })

        except Exception as e:
            logger.error("Vagas.com.br erro: %s", e)

        return jobs


class EmpregosComBrScraper(BaseScraper):
    source_name = "empregos_com_br"

    def __init__(self, keywords: list[str] | None = None):
        super().__init__()
        self.keywords = [k.lower() for k in (keywords or [])]

    def scrape(self) -> list[dict]:
        jobs = []
        kw_query = self.keywords[0] if self.keywords else "professor"
        url = f"https://www.empregos.com.br/vagas/{kw_query}"

        try:
            soup = self.get(url)
            # Estrutura real: h3 > a com empresa logo abaixo
            cards = soup.select("h3")

            for card in cards:
                title_el = card.select_one("a")
                if not title_el:
                    continue
                title = self.clean(title_el.get_text())
                href = title_el.get("href", "")

                # Empresa: elemento irmão após o h3
                next_el = card.find_next_sibling()
                org = self.clean(next_el.get_text()) if next_el and next_el.name in ("p", "span", "div") else None
                city, state = None, None

                if not title or len(title) < 5:
                    continue

                source_url = href if href.startswith("http") else "https://www.empregos.com.br" + href

                jobs.append({
                    "source": self.source_name,
                    "source_url": source_url,
                    "title": title[:200],
                    "organization": org,
                    "description": None,
                    "city": city,
                    "state": state,
                    "job_type": "clt",
                    "deadline": None,
                    "raw_data": {},
                })

        except Exception as e:
            logger.error("Empregos.com.br erro: %s", e)

        return jobs


def _parse_location(loc: str | None) -> tuple[str | None, str | None]:
    if not loc:
        return None, None
    # Formato comum: "São Paulo - SP" ou "SP" ou "São Paulo/SP"
    match = re.search(r"([A-ZÀ-Ú][a-zà-ú\s]+)\s*[-/]\s*([A-Z]{2})", loc)
    if match:
        return match.group(1).strip(), match.group(2).strip()
    if re.match(r"^[A-Z]{2}$", loc.strip()):
        return None, loc.strip()
    return loc.strip(), None
