"""
Remotive API — vagas remotas, gratuita, sem key.
https://remotive.com/api/remote-jobs
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import logging
import requests

logger = logging.getLogger(__name__)

API_URL = "https://remotive.com/api/remote-jobs"


class RemotiveScraper:
    source_name = "remotive"

    def __init__(self, keywords: list[str] | None = None):
        self.keywords = [k.lower() for k in (keywords or [])]

    def run(self) -> list[dict]:
        jobs = []
        try:
            logger.info("▶ Iniciando scraper: remotive")
            params: dict = {"limit": 100}
            if self.keywords:
                params["search"] = self.keywords[0] if self.keywords else ""

            resp = requests.get(API_URL, params=params, timeout=15)
            resp.raise_for_status()
            data = resp.json().get("jobs", [])

            for item in data:
                title = (item.get("title") or "").strip()
                company = (item.get("company_name") or "").strip()
                url = item.get("url") or item.get("company_logo_url", "")
                category = (item.get("category") or "").lower()
                description = (item.get("description") or "")[:500]
                pub_date = item.get("publication_date", "")[:10] or None

                if not title:
                    continue

                combined = f"{title} {company} {category}".lower()
                # Filtro de keywords opcional — não rejeitar se não houver match (Remotive é em inglês)
                if self.keywords and not any(kw in combined for kw in self.keywords):
                    if not any(kw in (description or '').lower() for kw in self.keywords):
                        pass  # manter vaga mesmo sem match — vocabulário em inglês

                jobs.append({
                    "source": self.source_name,
                    "source_url": url,
                    "title": title[:200],
                    "organization": company or None,
                    "description": description or None,
                    "city": "Remoto",
                    "state": None,
                    "job_type": "clt",
                    "deadline": None,
                    "published_at": pub_date,
                    "raw_data": {"category": item.get("category"), "tags": item.get("tags", [])},
                })

            logger.info("✓ remotive: %d vagas coletadas", len(jobs))

        except Exception as e:
            logger.error("Remotive erro: %s", e)

        return jobs
