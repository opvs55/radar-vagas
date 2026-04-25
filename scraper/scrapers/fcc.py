import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import time
import logging
from playwright.sync_api import sync_playwright
from base_scraper import BaseScraper

logger = logging.getLogger(__name__)

BASE_URL = "https://www.concursosfcc.com.br"
CONCURSOS_URL = f"{BASE_URL}/concursos/index.html"


class FCCScraper(BaseScraper):
    source_name = "fcc"

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
            try:
                page.goto(CONCURSOS_URL, wait_until="networkidle", timeout=20000)
                time.sleep(3)

                # Estrutura: blocos com nome do órgão (p/strong) + título do concurso (p)
                # Agrupados por seção (Inscrições abertas, Em andamento etc.)
                body_text = page.inner_text("body")
                sections = _parse_fcc_body(body_text)

                for org, title in sections:
                    combined = (org + " " + title).lower()
                    if self.keywords and not any(kw in combined for kw in self.keywords):
                        continue

                    jobs.append({
                        "source": self.source_name,
                        "source_url": CONCURSOS_URL,
                        "title": title[:200],
                        "organization": org[:200] if org else None,
                        "description": None,
                        "city": None,
                        "state": None,
                        "job_type": "concurso",
                        "deadline": None,
                        "raw_data": {},
                    })

            except Exception as e:
                logger.error("FCC erro: %s", e)

            browser.close()
        return jobs


def _parse_fcc_body(text: str) -> list[tuple[str, str]]:
    """
    O corpo do FCC lista: ÓRGÃO\nTítulo do concurso\nÓRGÃO\nTítulo...
    Retorna pares (órgão, título).
    """
    results = []
    lines = [l.strip() for l in text.splitlines() if l.strip()]

    skip_keywords = {
        "home", "concursos", "portal do candidato", "rss", "fale conosco",
        "como nos contratar", "inscrições abertas", "em andamento", "próximos concursos",
        "outras situações", "local de prova", "clique aqui", "cookies", "política",
        "site concursos", "site institucional", "telefone", "contatos", "fundação carlos",
        "capital e região", "demais localidades", "0800", "(11)", "unasp",
    }

    i = 0
    while i < len(lines) - 1:
        line = lines[i]
        low = line.lower()
        # Filtrar linhas de ruído
        if any(sk in low for sk in skip_keywords):
            i += 1
            continue
        if len(line) < 8:
            i += 1
            continue
        # Órgãos: ALL CAPS ou Title Case com pelo menos 2 palavras
        is_org = line.isupper() or (line.istitle() and " " in line)
        if is_org:
            next_line = lines[i + 1]
            next_low = next_line.lower()
            if (len(next_line) > 10
                    and not next_line.isupper()
                    and not any(sk in next_low for sk in skip_keywords)):
                results.append((line, next_line))
                i += 2
                continue
        i += 1

    return results
