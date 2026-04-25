"""
ClickMuseus — blog de vagas culturais (museus, institutos, ONGs culturais).
https://clickmuseus.com.br/category/vagas/
Scraping via RSS feed do WordPress.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import logging
import re
import requests
from bs4 import BeautifulSoup
from fake_useragent import UserAgent

logger = logging.getLogger(__name__)
UA = UserAgent()

RSS_URL = "https://clickmuseus.com.br/category/vagas/feed/"
SITE_URL = "https://clickmuseus.com.br/category/vagas/"


class ClickMuseusScraper:
    source_name = "clickmuseus"

    def __init__(self, keywords: list[str] | None = None):
        self.keywords = [k.lower() for k in (keywords or [])]

    def run(self) -> list[dict]:
        jobs = []
        seen: set[str] = set()

        try:
            logger.info("▶ Iniciando scraper: clickmuseus")
            headers = {"User-Agent": UA.random, "Accept": "application/rss+xml, text/xml, */*"}

            # Tentar RSS primeiro (mais limpo)
            r = requests.get(RSS_URL, headers=headers, timeout=15)

            if r.status_code == 200 and "<rss" in r.text:
                jobs = self._parse_rss(r.text, seen)
            else:
                # Fallback: scraping HTML
                r2 = requests.get(SITE_URL, headers={**headers, "Accept": "text/html"}, timeout=15)
                if r2.status_code == 200:
                    jobs = self._parse_html(r2.text, seen)

            logger.info("✓ clickmuseus: %d vagas coletadas", len(jobs))

        except Exception as e:
            logger.error("ClickMuseus erro: %s", e)

        return jobs

    def _parse_rss(self, xml: str, seen: set) -> list[dict]:
        jobs = []
        soup = BeautifulSoup(xml, "xml")

        for item in soup.find_all("item"):
            title_el = item.find("title")
            link_el = item.find("link")
            desc_el = item.find("description") or item.find("content:encoded")
            pub_el = item.find("pubDate")

            title = self._clean(title_el.get_text() if title_el else "")
            if not title or title in seen:
                continue
            seen.add(title)

            url = link_el.get_text().strip() if link_el else None
            raw_desc = desc_el.get_text() if desc_el else ""
            description = BeautifulSoup(raw_desc, "html.parser").get_text()[:500]
            pub_date = self._parse_date(pub_el.get_text() if pub_el else "")

            # Extrair organização do título (padrão: "Vaga para Cargo - Organização")
            org = self._extract_org(title)

            jobs.append({
                "source": self.source_name,
                "source_url": url,
                "title": self._clean_title(title)[:200],
                "organization": org,
                "description": description or None,
                "city": "São Paulo",
                "state": "SP",
                "job_type": "outro",
                "salary_min": None,
                "salary_max": None,
                "deadline": None,
                "published_at": pub_date,
                "raw_data": {"category": "cultura"},
            })

        return jobs

    def _parse_html(self, html: str, seen: set) -> list[dict]:
        jobs = []
        soup = BeautifulSoup(html, "html.parser")

        for article in soup.select("article, .post, .entry"):
            title_el = article.select_one("h2 a, h1 a, .entry-title a")
            if not title_el:
                continue

            title = self._clean(title_el.get_text())
            if not title or title in seen:
                continue
            seen.add(title)

            url = title_el.get("href", "")
            desc_el = article.select_one(".entry-summary, .entry-content, p")
            description = self._clean(desc_el.get_text())[:500] if desc_el else None
            org = self._extract_org(title)

            jobs.append({
                "source": self.source_name,
                "source_url": url or None,
                "title": self._clean_title(title)[:200],
                "organization": org,
                "description": description,
                "city": "São Paulo",
                "state": "SP",
                "job_type": "outro",
                "salary_min": None,
                "salary_max": None,
                "deadline": None,
                "published_at": None,
                "raw_data": {"category": "cultura"},
            })

        return jobs

    def _clean(self, text: str) -> str:
        return re.sub(r"\s+", " ", text).strip()

    def _clean_title(self, title: str) -> str:
        # Remover prefixos como "#Vaga para ", "Vaga: ", etc.
        title = re.sub(r"^#?[Vv]aga\s+(para|de|–|-|:)?\s*", "", title).strip()
        return title

    def _extract_org(self, title: str) -> str | None:
        # Padrão: "Cargo - Organização" ou "Cargo| Organização"
        for sep in [" - ", " – ", " | ", "- ", "– "]:
            if sep in title:
                parts = title.split(sep)
                if len(parts) >= 2:
                    return parts[-1].strip()[:200]
        return None

    def _parse_date(self, date_str: str) -> str | None:
        # RFC 2822 → YYYY-MM-DD
        try:
            from email.utils import parsedate_to_datetime
            return parsedate_to_datetime(date_str).strftime("%Y-%m-%d")
        except Exception:
            return None
