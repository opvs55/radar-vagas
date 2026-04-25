"""
trabalha_brasil.py — Scraper do portal Emprega Brasil (MTE/Gov.br)
API pública REST, sem necessidade de chave, sem Playwright.
Documentação: https://empregabrasil.mte.gov.br
"""
import re
import logging
import requests
from base_scraper import BaseScraper

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; RadarVagas/1.0)",
    "Accept": "application/json",
}

# API REST pública do portal Emprega Brasil (SINE)
API_BASE = "https://empregabrasil.mte.gov.br/76/consultar-vagas/"
API_JSON = "https://api.empregabrasil.mte.gov.br/vagas/v1/vagas"


class TrabalhaBrasilScraper(BaseScraper):
    source_name = "trabalha_brasil"

    def __init__(self, keywords: list[str], location: str = "Brasil", max_pages: int = 5):
        super().__init__()
        self.keywords = keywords
        self.location = location
        self.max_pages = max_pages

    def scrape(self) -> list[dict]:
        jobs = []
        for kw in self.keywords[:6]:
            jobs += self._fetch_api(kw)
            if not jobs:
                jobs += self._fetch_html(kw)

        seen = set()
        unique = []
        for j in jobs:
            key = j.get("source_url") or j.get("title", "")
            if key not in seen:
                seen.add(key)
                unique.append(j)

        logger.info("TrabalhaBrasil: %d vagas únicas", len(unique))
        return unique

    def _fetch_api(self, keyword: str) -> list[dict]:
        """Tenta API JSON do Emprega Brasil."""
        jobs = []
        for page in range(self.max_pages):
            try:
                params = {
                    "descricao": keyword,
                    "municipio": self.location if self.location != "Brasil" else "",
                    "pagina": page + 1,
                    "quantidade": 20,
                }
                resp = requests.get(API_JSON, params=params, headers=HEADERS, timeout=15)
                if resp.status_code != 200:
                    break
                data = resp.json()
                items = data.get("vagas") or data.get("content") or data.get("data") or []
                if not items:
                    break
                for item in items:
                    job = self._parse_api(item, keyword)
                    if job:
                        jobs.append(job)
            except Exception as e:
                logger.debug("TrabalhaBrasil API '%s' p%d: %s", keyword, page + 1, e)
                break
        return jobs

    def _parse_api(self, item: dict, keyword: str) -> dict | None:
        try:
            title = self.clean(
                item.get("titulo") or item.get("cargo") or item.get("descricaoCargo") or ""
            )
            if not title:
                return None

            company = self.clean(
                item.get("empresa") or item.get("nomeEmpresa") or item.get("razaoSocial") or ""
            )
            city  = self.clean(item.get("municipio") or item.get("cidade") or "")
            state = self.clean(item.get("uf") or item.get("estado") or "")
            if state and len(state) > 2:
                state = state[:2].upper()

            sal_min = item.get("salarioMinimo") or item.get("remuneracaoMinima")
            sal_max = item.get("salarioMaximo") or item.get("remuneracaoMaxima")
            desc    = self.clean(item.get("descricao") or item.get("atribuicoes") or "")
            vaga_id = item.get("id") or item.get("codigoVaga") or ""
            url     = f"https://empregabrasil.mte.gov.br/vaga/{vaga_id}" if vaga_id else API_BASE

            job_type = _infer_job_type(title, desc)

            return {
                "source": self.source_name,
                "source_url": url,
                "title": title,
                "organization": company or None,
                "description": desc[:500] if desc else None,
                "city": city or None,
                "state": state or None,
                "job_type": job_type,
                "salary_min": float(sal_min) if sal_min else None,
                "salary_max": float(sal_max) if sal_max else None,
                "deadline": None,
                "raw_data": {"keyword": keyword},
            }
        except Exception as e:
            logger.debug("TrabalhaBrasil parse API: %s", e)
            return None

    def _fetch_html(self, keyword: str) -> list[dict]:
        """Fallback: scraping HTML do portal."""
        jobs = []
        try:
            url = f"https://empregabrasil.mte.gov.br/76/consultar-vagas/?cargo={requests.utils.quote(keyword)}"
            resp = requests.get(url, headers={**HEADERS, "Accept": "text/html"}, timeout=15)
            resp.raise_for_status()
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(resp.text, "html.parser")

            for card in soup.select(".vaga, .card-vaga, [class*='vaga'], tr[data-id]")[:30]:
                title_el = card.select_one("h2, h3, .cargo, td:first-child")
                if not title_el:
                    continue
                title = self.clean(title_el.get_text())
                if not title:
                    continue

                company_el = card.select_one(".empresa, td:nth-child(2)")
                company = self.clean(company_el.get_text()) if company_el else None

                loc_el = card.select_one(".local, .municipio, td:nth-child(3)")
                raw_loc = self.clean(loc_el.get_text()) if loc_el else None
                city, state = _parse_location(raw_loc)

                jobs.append({
                    "source": self.source_name,
                    "source_url": url,
                    "title": title,
                    "organization": company,
                    "description": None,
                    "city": city,
                    "state": state,
                    "job_type": _infer_job_type(title, ""),
                    "salary_min": None,
                    "salary_max": None,
                    "deadline": None,
                    "raw_data": {"keyword": keyword},
                })
        except Exception as e:
            logger.warning("TrabalhaBrasil HTML '%s': %s", keyword, e)
        return jobs


def _parse_location(raw: str | None) -> tuple[str | None, str | None]:
    if not raw:
        return None, None
    m = re.search(r"([A-Za-zÀ-ú\s]+)[,\-/]\s*([A-Z]{2})\b", raw)
    if m:
        return m.group(1).strip(), m.group(2)
    return raw.strip(), None


def _infer_job_type(title: str, desc: str) -> str:
    text = (title + " " + desc).lower()
    if any(k in text for k in ["estágio", "estagio", "trainee"]):
        return "estagio"
    if any(k in text for k in ["aprendiz", "jovem aprendiz"]):
        return "aprendiz"
    if any(k in text for k in ["concurso", "edital"]):
        return "concurso"
    if any(k in text for k in ["pj", "pessoa jurídica"]):
        return "pj"
    return "clt"
