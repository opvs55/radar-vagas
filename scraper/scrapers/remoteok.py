"""
RemoteOK API — vagas remotas, gratuita, sem key.
https://remoteok.com/api
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import logging
import requests

logger = logging.getLogger(__name__)

API_URL = "https://remoteok.com/api"
HEADERS = {"Accept": "application/json", "User-Agent": "RadarVagas/1.0"}

# Tags relevantes para buscar
TAGS = ["education", "teaching", "elearning", "edtech", "teacher", "tutor", "academic"]


class RemoteOKScraper:
    source_name = "remoteok"

    def __init__(self, keywords: list[str] | None = None):
        self.keywords = [k.lower() for k in (keywords or [])]

    def run(self) -> list[dict]:
        jobs = []
        seen: set[str] = set()

        try:
            logger.info("▶ Iniciando scraper: remoteok")

            for tag in TAGS:
                try:
                    resp = requests.get(
                        f"{API_URL}?tags={tag}",
                        headers=HEADERS,
                        timeout=15,
                    )
                    resp.raise_for_status()
                    data = resp.json()

                    for item in data:
                        if not isinstance(item, dict):
                            continue

                        title = (item.get("position") or "").strip()
                        if not title or title in seen:
                            continue
                        seen.add(title)

                        company = (item.get("company") or "").strip()
                        url = item.get("url") or item.get("apply_url", "")
                        description = (item.get("description") or "")[:500]
                        location = item.get("location") or "Remoto"
                        date = (item.get("date") or "")[:10] or None
                        salary = item.get("salary") or ""

                        # Tentar parsear salário
                        salary_min = salary_max = None
                        if salary and "$" not in salary:
                            import re
                            nums = re.findall(r"\d+", salary.replace(".", "").replace(",", ""))
                            if len(nums) >= 2:
                                salary_min, salary_max = float(nums[0]), float(nums[1])
                            elif len(nums) == 1:
                                salary_min = float(nums[0])

                        jobs.append({
                            "source": self.source_name,
                            "source_url": url if url.startswith("http") else f"https://remoteok.com{url}",
                            "title": title[:200],
                            "organization": company or None,
                            "description": description or None,
                            "city": "Remoto",
                            "state": None,
                            "job_type": "clt",
                            "salary_min": salary_min,
                            "salary_max": salary_max,
                            "deadline": None,
                            "published_at": date,
                            "raw_data": {"tags": item.get("tags", []), "location": location},
                        })

                except Exception as e:
                    logger.warning("RemoteOK tag '%s' erro: %s", tag, e)
                    continue

            logger.info("✓ remoteok: %d vagas coletadas", len(jobs))

        except Exception as e:
            logger.error("RemoteOK erro: %s", e)

        return jobs
