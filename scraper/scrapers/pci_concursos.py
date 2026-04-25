import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from base_scraper import BaseScraper
import logging

logger = logging.getLogger(__name__)

BASE_URL = "https://www.pciconcursos.com.br"
SEARCH_URL = f"{BASE_URL}/concursos/"


class PCIConcursosScraper(BaseScraper):
    source_name = "pci_concursos"

    def __init__(self, keywords: list[str] | None = None):
        super().__init__()
        self.keywords = [k.lower() for k in (keywords or [])]

    def scrape(self) -> list[dict]:
        jobs = []
        try:
            soup = self.get(SEARCH_URL)
            articles = soup.select("div.na a")

            for a in articles:
                title = self.clean(a.get_text())
                href = a.get("href", "")
                if not title:
                    continue

                full_url = href if href.startswith("http") else BASE_URL + href
                detail = self._get_detail(full_url)

                jobs.append({
                    "source": self.source_name,
                    "source_url": full_url,
                    "title": title,
                    "organization": detail.get("organization"),
                    "description": detail.get("description"),
                    "city": detail.get("city"),
                    "state": detail.get("state"),
                    "job_type": "concurso",
                    "deadline": detail.get("deadline"),
                    "raw_data": detail,
                })

        except Exception as e:
            logger.error("PCI Concursos erro: %s", e)

        return jobs

    def _get_detail(self, url: str) -> dict:
        detail: dict = {}
        try:
            soup = self.get(url)

            org_el = soup.select_one("h1.cargo")
            if org_el:
                detail["organization"] = self.clean(org_el.get_text())

            info_items = soup.select("div.info_concurso li")
            for li in info_items:
                text = li.get_text(" ", strip=True).lower()
                if "estado:" in text or "uf:" in text:
                    detail["state"] = self.clean(li.get_text().split(":")[-1])
                if "município" in text or "cidade" in text:
                    detail["city"] = self.clean(li.get_text().split(":")[-1])
                if "inscrições" in text and "até" in text:
                    parts = li.get_text().split("até")
                    if len(parts) > 1:
                        raw_date = parts[-1].strip().split()[0]
                        detail["deadline"] = _parse_br_date(raw_date)

            desc_el = soup.select_one("div.conteudo_noticia")
            if desc_el:
                detail["description"] = self.clean(desc_el.get_text(" "))[:1000]

        except Exception as e:
            logger.debug("Detalhe PCI falhou para %s: %s", url, e)

        return detail


def _parse_br_date(date_str: str) -> str | None:
    """Converte dd/mm/aaaa → aaaa-mm-dd."""
    try:
        parts = date_str.strip().split("/")
        if len(parts) == 3:
            return f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
    except Exception:
        pass
    return None
