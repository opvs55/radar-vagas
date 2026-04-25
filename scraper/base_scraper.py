import time
import logging
import requests
from abc import ABC, abstractmethod
from bs4 import BeautifulSoup
from fake_useragent import UserAgent
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from config import REQUEST_DELAY_SECONDS, MAX_RETRIES

logger = logging.getLogger(__name__)
ua = UserAgent()


class BaseScraper(ABC):
    source_name: str = "unknown"

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": ua.random})

    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type(requests.RequestException),
        reraise=True,
    )
    def get(self, url: str, **kwargs) -> BeautifulSoup:
        self.session.headers.update({"User-Agent": ua.random})
        resp = self.session.get(url, timeout=15, **kwargs)
        resp.raise_for_status()
        time.sleep(REQUEST_DELAY_SECONDS)
        return BeautifulSoup(resp.text, "lxml")

    @abstractmethod
    def scrape(self) -> list[dict]:
        """Retorna lista de dicts compatíveis com a tabela jobs."""
        pass

    def run(self) -> list[dict]:
        logger.info("▶ Iniciando scraper: %s", self.source_name)
        try:
            jobs = self.scrape()
            logger.info("✓ %s: %d vagas coletadas", self.source_name, len(jobs))
            return jobs
        except Exception as e:
            logger.error("✗ %s falhou: %s", self.source_name, e)
            return []

    @staticmethod
    def clean(text: str | None) -> str | None:
        if not text:
            return None
        return " ".join(text.split()).strip() or None
