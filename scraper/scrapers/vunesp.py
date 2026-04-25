"""
Concursos.com.br — agregador de concursos públicos com HTML estático.
Substitui VUNESP (bloqueada por Akamai) e Gran Cursos (JS-rendered).
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import logging
from base_scraper import BaseScraper

logger = logging.getLogger(__name__)

BASE_URL = "https://www.concursos.com.br"
CONCURSOS_URL = f"{BASE_URL}/"


class GranCursosScraper(BaseScraper):
    """Nome mantido para compatibilidade com runner.py."""
    source_name = "concursos_com_br"

    def __init__(self, keywords: list[str] | None = None):
        super().__init__()
        self.keywords = [k.lower() for k in (keywords or [])]

    def scrape(self) -> list[dict]:
        jobs = []
        try:
            soup = self.get(CONCURSOS_URL)
            cards = soup.select(".card")

            for card in cards:
                full_text = self.clean(card.get_text(" "))
                if not full_text or len(full_text) < 10:
                    continue

                # Título: maior texto dentro do card (geralmente o link principal)
                link = card.select_one("a")
                title = self.clean(link.get_text()) if link else full_text
                href = link.get("href", "") if link else ""

                if not title or len(title) < 8:
                    continue

                if self.keywords and not any(kw in full_text.lower() for kw in self.keywords):
                    continue

                source_url = href if href.startswith("http") else BASE_URL + href

                # Estado: primeira linha costuma ser o estado
                lines = [l.strip() for l in card.get_text("\n").splitlines() if l.strip()]
                state = lines[0] if lines and len(lines[0]) < 30 else None

                jobs.append({
                    "source": self.source_name,
                    "source_url": source_url,
                    "title": title[:200],
                    "organization": None,
                    "description": None,
                    "city": None,
                    "state": state,
                    "job_type": "concurso",
                    "deadline": None,
                    "raw_data": {},
                })

        except Exception as e:
            logger.error("Concursos.com.br erro: %s", e)

        return jobs


def _parse_br_date(date_str: str | None) -> str | None:
    if not date_str:
        return None
    try:
        parts = date_str.strip().split("/")
        if len(parts) == 3:
            return f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
    except Exception:
        pass
    return None
