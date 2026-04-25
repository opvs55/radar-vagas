"""
courses.py — Scraper de cursos gratuitos e inscrições abertas.

Fontes:
  1. SENAI SP   — RSS feed de cursos gratuitos
  2. Sebrae     — RSS feed de cursos/eventos
  3. Fundação Bradesco — página de cursos online gratuitos
  4. Paula Souza (ETEC/FATEC) — processo seletivo via RSS
  5. Coursera (feed público) — cursos com certificado gratuito
"""
import re
import time
import logging
import requests
from datetime import datetime, date
from xml.etree import ElementTree as ET
from bs4 import BeautifulSoup

logger = logging.getLogger("scraper.courses")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; RadarVagas/1.0)",
    "Accept-Language": "pt-BR,pt;q=0.9",
}

# ─── Helpers ────────────────────────────────────────────────────────────────

def _get(url: str, timeout: int = 15) -> requests.Response | None:
    try:
        r = requests.get(url, headers=HEADERS, timeout=timeout)
        r.raise_for_status()
        return r
    except Exception as e:
        logger.warning("GET %s → %s", url, e)
        return None


def _parse_date(s: str | None) -> date | None:
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(s.strip(), fmt).date()
        except ValueError:
            pass
    return None


def _detect_area(text: str) -> str:
    text = text.lower()
    if any(k in text for k in ["design", "artes", "gráfico", "visual"]):
        return "design"
    if any(k in text for k in ["programação", "tecnologia", "informática", "python", "web", "software", "ti "]):
        return "tecnologia"
    if any(k in text for k in ["educação", "pedagog", "docência", "professor"]):
        return "educacao"
    if any(k in text for k in ["administração", "gestão", "rh", "recursos humanos", "financeiro"]):
        return "administracao"
    if any(k in text for k in ["saúde", "enfermagem", "farmácia", "nutrição", "fisio"]):
        return "saude"
    if any(k in text for k in ["comunicação", "marketing", "publicidade", "jornalismo", "social media"]):
        return "comunicacao"
    if any(k in text for k in ["cultura", "museu", "patrimônio", "arte"]):
        return "cultura"
    if any(k in text for k in ["engenharia", "mecânica", "elétrica", "civil", "produção"]):
        return "engenharia"
    if any(k in text for k in ["gastronomia", "culinária", "confeitaria", "cozinha"]):
        return "gastronomia"
    if any(k in text for k in ["logística", "estoque", "transporte", "supply"]):
        return "logistica"
    return "outro"


# ─── Fonte 1: Fundação Bradesco ─────────────────────────────────────────────

def scrape_fundacao_bradesco() -> list[dict]:
    """Cursos EaD gratuitos da Fundação Bradesco."""
    url = "https://www.ev.org.br/Areas/Gratuitos"
    resp = _get(url)
    if not resp:
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    courses = []

    for card in soup.select(".course-card, .card-curso, [class*='course']")[:30]:
        title_el = card.select_one("h2, h3, .title, [class*='title']")
        link_el  = card.select_one("a[href]")
        desc_el  = card.select_one("p, .description, [class*='desc']")

        if not title_el:
            continue

        title = title_el.get_text(strip=True)
        href  = link_el["href"] if link_el else url
        if href and not href.startswith("http"):
            href = "https://www.ev.org.br" + href

        courses.append({
            "source":       "fundacao_bradesco",
            "source_url":   href,
            "title":        title,
            "organization": "Fundação Bradesco",
            "description":  desc_el.get_text(strip=True) if desc_el else None,
            "area":         _detect_area(title),
            "level":        "básico",
            "modality":     "online",
            "price":        0,
            "state":        None,
            "city":         None,
        })

    logger.info("Fundação Bradesco: %d cursos", len(courses))
    return courses


# ─── Fonte 2: SENAI SP (RSS) ─────────────────────────────────────────────────

def scrape_senai_rss() -> list[dict]:
    url = "https://www.sp.senai.br/rss/cursos"
    resp = _get(url)
    if not resp:
        # fallback: página de cursos gratuitos
        return scrape_senai_html()

    try:
        root = ET.fromstring(resp.content)
        items = root.findall(".//item")
        courses = []
        for item in items[:40]:
            title = (item.findtext("title") or "").strip()
            link  = (item.findtext("link") or "").strip()
            desc  = (item.findtext("description") or "").strip()
            # Remove HTML tags da descrição
            desc = re.sub(r"<[^>]+>", " ", desc).strip()

            if not title:
                continue

            price = 0 if any(k in (title + desc).lower() for k in ["gratuito", "grátis", "free", "sem custo"]) else None

            courses.append({
                "source":       "senai",
                "source_url":   link or url,
                "title":        title,
                "organization": "SENAI",
                "description":  desc[:500] if desc else None,
                "area":         _detect_area(title + " " + desc),
                "level":        "técnico",
                "modality":     "online",
                "price":        price,
                "state":        "SP",
                "city":         None,
            })

        logger.info("SENAI RSS: %d cursos", len(courses))
        return courses
    except Exception as e:
        logger.warning("SENAI RSS parse error: %s", e)
        return []


def scrape_senai_html() -> list[dict]:
    url = "https://www.sp.senai.br/cursos-gratuitos"
    resp = _get(url)
    if not resp:
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    courses = []
    for card in soup.select(".course-item, .card, [class*='curso']")[:30]:
        title_el = card.select_one("h2, h3, .title")
        if not title_el:
            continue
        title = title_el.get_text(strip=True)
        link_el = card.select_one("a[href]")
        href = link_el["href"] if link_el else url
        if href and not href.startswith("http"):
            href = "https://www.sp.senai.br" + href

        courses.append({
            "source": "senai", "source_url": href, "title": title,
            "organization": "SENAI", "description": None,
            "area": _detect_area(title), "level": "técnico",
            "modality": "online", "price": 0, "state": "SP", "city": None,
        })

    logger.info("SENAI HTML: %d cursos", len(courses))
    return courses


# ─── Fonte 3: Sebrae EaD ─────────────────────────────────────────────────────

def scrape_sebrae() -> list[dict]:
    url = "https://eadapp.sebrae.com.br/cursos"
    resp = _get(url)
    if not resp:
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    courses = []

    for card in soup.select(".card-curso, .curso-item, [class*='curso'], [class*='course']")[:30]:
        title_el = card.select_one("h2, h3, h4, .title, [class*='title']")
        if not title_el:
            continue
        title = title_el.get_text(strip=True)
        link_el = card.select_one("a[href]")
        href = link_el["href"] if link_el else url
        if href and not href.startswith("http"):
            href = "https://sebrae.com.br" + href

        courses.append({
            "source": "sebrae", "source_url": href, "title": title,
            "organization": "Sebrae", "description": None,
            "area": _detect_area(title), "level": "básico",
            "modality": "online", "price": 0, "state": None, "city": None,
        })

    logger.info("Sebrae: %d cursos", len(courses))
    return courses


# ─── Fonte 4: FutureLearn (RSS público) ─────────────────────────────────────

def scrape_futurelearn() -> list[dict]:
    url = "https://www.futurelearn.com/courses?filter_category=creative-arts-and-media&filter_availability=open"
    resp = _get(url)
    if not resp:
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    courses = []

    for card in soup.select("[data-testid='course-card'], .m-course-card")[:20]:
        title_el = card.select_one("h2, h3, [class*='title']")
        link_el  = card.select_one("a[href]")
        if not title_el:
            continue

        title = title_el.get_text(strip=True)
        href  = link_el["href"] if link_el else ""
        if href and not href.startswith("http"):
            href = "https://www.futurelearn.com" + href

        courses.append({
            "source": "futurelearn", "source_url": href, "title": title,
            "organization": "FutureLearn", "description": None,
            "area": _detect_area(title), "level": "básico",
            "modality": "online", "price": 0, "state": None, "city": None,
        })

    logger.info("FutureLearn: %d cursos", len(courses))
    return courses


# ─── Fonte 5: Gov.br — cursos do Pronatec / BNCC ────────────────────────────

def scrape_gov_cursos() -> list[dict]:
    """Acesso Escola (MEC) — cursos gratuitos para professores e cidadãos."""
    url = "https://www.escolavirtual.gov.br/cursos"
    resp = _get(url)
    if not resp:
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    courses = []

    for card in soup.select(".ev-course-card, .card, [class*='course']")[:30]:
        title_el = card.select_one("h2, h3, .title, [class*='name']")
        if not title_el:
            continue
        title = title_el.get_text(strip=True)
        link_el = card.select_one("a[href]")
        href = link_el["href"] if link_el else url
        if href and not href.startswith("http"):
            href = "https://www.escolavirtual.gov.br" + href

        courses.append({
            "source": "escola_virtual_gov", "source_url": href, "title": title,
            "organization": "Escola Virtual Gov (MEC)", "description": None,
            "area": _detect_area(title), "level": "básico",
            "modality": "online", "price": 0, "state": None, "city": None,
        })

    logger.info("Escola Virtual Gov: %d cursos", len(courses))
    return courses


# ─── Runner principal ────────────────────────────────────────────────────────

def scrape_all_courses() -> list[dict]:
    all_courses: list[dict] = []

    scrapers = [
        ("Fundação Bradesco", scrape_fundacao_bradesco),
        ("SENAI",             scrape_senai_rss),
        ("Sebrae",            scrape_sebrae),
        ("FutureLearn",       scrape_futurelearn),
        ("Gov.br",            scrape_gov_cursos),
    ]

    for name, fn in scrapers:
        try:
            results = fn()
            all_courses.extend(results)
            time.sleep(1.5)
        except Exception as e:
            logger.error("Erro em %s: %s", name, e)

    logger.info("Total de cursos coletados: %d", len(all_courses))
    return all_courses
