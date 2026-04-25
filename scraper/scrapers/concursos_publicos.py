"""
Scrapers de concursos públicos:
  - ConcursosNobrasilScraper  → concursosnobrasil.com (tabelas por estado)
  - ConcursoPublicoBRScraper  → concursopublico.com.br (cards)
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import re
import logging
from base_scraper import BaseScraper

logger = logging.getLogger(__name__)

ESTADOS_BR = [
    "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA",
    "MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN",
    "RO","RR","RS","SC","SE","SP","TO",
]


class ConcursosNoBrasilScraper(BaseScraper):
    source_name = "concursosnobrasil"

    def __init__(self, keywords: list[str] | None = None):
        super().__init__()
        self.keywords = [k.lower() for k in (keywords or [])]

    def scrape(self) -> list[dict]:
        jobs = []
        seen_orgs: set[str] = set()
        url = "https://concursosnobrasil.com/concursos/"

        try:
            soup = self.get(url)
            tables = soup.select("table")

            for table in tables:
                # Cabeçalho da tabela pode ter nome do estado
                header = table.find_previous(["h2", "h3", "h4", "strong"])
                header_text = header.get_text(strip=True) if header else ""

                # Detectar estado pelo header
                state = None
                for uf in ESTADOS_BR:
                    if uf in header_text.upper():
                        state = uf
                        break

                rows = table.select("tr")
                for row in rows:
                    cells = row.select("td, th")
                    if len(cells) < 2:
                        continue

                    org = self.clean(cells[0].get_text())
                    vagas_text = self.clean(cells[1].get_text())

                    if not org or org.lower() in ("órgão", "orgao", "entidade", "banca"):
                        continue

                    # Link
                    link_el = cells[0].select_one("a") or row.select_one("a")
                    href = link_el.get("href", "") if link_el else ""
                    source_url = href if href.startswith("http") else (
                        "https://concursosnobrasil.com" + href if href else "https://concursosnobrasil.com/concursos/"
                    )

                    # Vagas
                    vagas_num = re.sub(r"[^\d]", "", vagas_text)

                    title = f"Concurso {org}"
                    if vagas_num:
                        title += f" — {vagas_num} vagas"

                    # Deduplicar concursos nacionais que aparecem em todos os estados
                    dedup_key = org.lower()
                    if dedup_key in seen_orgs:
                        continue
                    seen_orgs.add(dedup_key)

                    combined = f"{title} {org}".lower()
                    if self.keywords and not any(kw in combined for kw in self.keywords):
                        continue

                    jobs.append({
                        "source": self.source_name,
                        "source_url": source_url,
                        "title": title[:200],
                        "organization": org,
                        "description": None,
                        "city": None,
                        "state": state,
                        "job_type": "concurso",
                        "deadline": None,
                        "raw_data": {"vagas": vagas_num or None},
                    })

        except Exception as e:
            logger.error("ConcursosNoBrasil erro: %s", e)

        return jobs


class ConcursoPublicoBRScraper(BaseScraper):
    source_name = "concursopublico_br"

    def __init__(self, keywords: list[str] | None = None):
        super().__init__()
        self.keywords = [k.lower() for k in (keywords or [])]

    def scrape(self) -> list[dict]:
        jobs = []
        url = "https://concursopublico.com.br/concursos/"

        try:
            soup = self.get(url)
            cards = soup.select(".card")

            for card in cards:
                title_el = card.select_one("h2, h3, .card-title, a")
                if not title_el:
                    continue
                title = self.clean(title_el.get_text())
                if not title or len(title) < 8:
                    continue

                link_el = card.select_one("a")
                href = link_el.get("href", "") if link_el else ""
                source_url = href if href.startswith("http") else "https://concursopublico.com.br" + href

                # Localização (ex: "Nacional", "São Paulo")
                loc_el = card.select_one(".badge, .local, .location, .estado, span")
                loc_text = self.clean(loc_el.get_text()) if loc_el else None

                state = None
                city = None
                if loc_text:
                    for uf in ESTADOS_BR:
                        if uf in loc_text.upper():
                            state = uf
                            break
                    if loc_text.lower() not in ("nacional", "todo o brasil", ""):
                        city = loc_text

                # Órgão / descrição — evitar pegar data como org
                org_el = card.select_one(".card-text, p, .org, .organizacao")
                org_text = self.clean(org_el.get_text()) if org_el else None
                # Descartar se for data (ex: "Publicado em: 22/04/2025")
                org = org_text if org_text and "publicado" not in org_text.lower() else None

                combined = f"{title} {org or ''}".lower()
                if self.keywords and not any(kw in combined for kw in self.keywords):
                    continue

                jobs.append({
                    "source": self.source_name,
                    "source_url": source_url,
                    "title": title[:200],
                    "organization": org[:100] if org else None,
                    "description": None,
                    "city": city,
                    "state": state,
                    "job_type": "concurso",
                    "deadline": None,
                    "raw_data": {},
                })

        except Exception as e:
            logger.error("ConcursoPublicoBR erro: %s", e)

        return jobs
