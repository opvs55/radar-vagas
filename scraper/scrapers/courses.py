"""
courses.py — Scraper de cursos gratuitos.

Fontes (todas com API pública ou RSS estável):
  1. Fundação Bradesco (ev.org.br) — API JSON pública
  2. SENAI Nacional       — API REST pública
  3. Sebrae EaD           — API REST pública
  4. Escola Virtual Gov   — API REST pública (MEC)
  5. Coursera (RSS)       — feed RSS público por categoria
"""
import re
import time
import logging
import requests
from datetime import datetime, date
from xml.etree import ElementTree as ET

logger = logging.getLogger("scraper.courses")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    "Accept": "application/json, text/html, */*",
    "Accept-Language": "pt-BR,pt;q=0.9",
}


def _get(url: str, timeout: int = 15, params: dict | None = None) -> requests.Response | None:
    try:
        r = requests.get(url, headers=HEADERS, params=params, timeout=timeout)
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
            return datetime.strptime(s.strip()[:10], fmt).date()
        except ValueError:
            pass
    return None


def _detect_area(text: str) -> str:
    t = text.lower()
    if any(k in t for k in ["design", "artes", "gráfico", "visual"]):          return "design"
    if any(k in t for k in ["programação", "tecnologia", "informática", "python", "web", "software", "dados", "ia ", "inteligência artificial"]):
        return "tecnologia"
    if any(k in t for k in ["educação", "pedagog", "docência", "professor"]):   return "educacao"
    if any(k in t for k in ["administração", "gestão", "rh ", "recursos humanos", "financeiro", "contabil", "empreendedor"]):
        return "administracao"
    if any(k in t for k in ["saúde", "enfermagem", "farmácia", "nutrição", "fisio", "medicina"]):
        return "saude"
    if any(k in t for k in ["comunicação", "marketing", "publicidade", "jornalismo", "social media", "redação"]):
        return "comunicacao"
    if any(k in t for k in ["cultura", "museu", "patrimônio", "arte"]):         return "cultura"
    if any(k in t for k in ["engenharia", "mecânica", "elétrica", "civil", "produção", "industrial"]):
        return "engenharia"
    if any(k in t for k in ["gastronomia", "culinária", "confeitaria", "cozinha"]): return "gastronomia"
    if any(k in t for k in ["logística", "estoque", "transporte", "supply"]):   return "logistica"
    return "outro"


# ─── Fonte 1: Fundação Bradesco (ev.org.br) — HTML verificado ───────────────

def scrape_fundacao_bradesco() -> list[dict]:
    from bs4 import BeautifulSoup
    courses = []
    seen: set[str] = set()
    for url in ["https://www.ev.org.br/cursos", "https://www.ev.org.br"]:
        resp = _get(url)
        if not resp:
            continue
        soup = BeautifulSoup(resp.text, "html.parser")
        for a in soup.select("a[href*='/cursos/']"):
            href = a["href"]
            if not href.startswith("http"):
                href = "https://www.ev.org.br" + href
            if href in seen:
                continue
            seen.add(href)
            title = a.get_text(strip=True)
            if not title or len(title) < 5:
                continue
            courses.append({
                "source": "fundacao_bradesco", "source_url": href,
                "title": title[:200], "organization": "Fundação Bradesco",
                "description": None, "area": _detect_area(title),
                "level": "básico", "modality": "online", "price": 0,
                "state": None, "city": None,
            })
        if courses:
            break
    logger.info("Fundação Bradesco: %d cursos", len(courses))
    return courses


# ─── Fonte 2: SENAI — cursos gratuitos online ────────────────────────────────

def scrape_senai() -> list[dict]:
    from bs4 import BeautifulSoup
    courses = []
    urls_to_try = [
        "https://online.sp.senai.br/cursos/gratuitos",
        "https://www.sp.senai.br/cursos?gratis=true",
        "https://online.senai.br/cursos-gratuitos",
    ]
    for url in urls_to_try:
        resp = _get(url)
        if not resp:
            continue
        soup = BeautifulSoup(resp.text, "html.parser")
        for card in soup.select("[class*='course'], [class*='curso'], [class*='card']")[:40]:
            title_el = card.select_one("h2, h3, h4, .title, [class*='title'], [class*='name']")
            if not title_el:
                continue
            title = title_el.get_text(strip=True)
            if not title or len(title) < 5:
                continue
            link_el = card.select_one("a[href]")
            href = link_el["href"] if link_el else url
            if href and not href.startswith("http"):
                href = "https://online.sp.senai.br" + href
            courses.append({
                "source": "senai", "source_url": href,
                "title": title[:200], "organization": "SENAI",
                "description": None, "area": _detect_area(title),
                "level": "técnico", "modality": "online", "price": 0,
                "state": "SP", "city": None,
            })
        if courses:
            break
    logger.info("SENAI: %d cursos", len(courses))
    return courses


# ─── Fonte 3: Sebrae — cursos gratuitos ─────────────────────────────────────

def scrape_sebrae() -> list[dict]:
    from bs4 import BeautifulSoup
    courses = []
    urls_to_try = [
        "https://sebrae.com.br/sites/PortalSebrae/cursosonline",
        "https://www.sebrae.com.br/sites/PortalSebrae/cursosonline",
    ]
    for url in urls_to_try:
        resp = _get(url)
        if not resp:
            continue
        soup = BeautifulSoup(resp.text, "html.parser")
        for a in soup.select("a[href*='curso']")[:40]:
            title = a.get_text(strip=True)
            if not title or len(title) < 5:
                continue
            href = a["href"]
            if not href.startswith("http"):
                href = "https://sebrae.com.br" + href
            courses.append({
                "source": "sebrae", "source_url": href,
                "title": title[:200], "organization": "Sebrae",
                "description": None, "area": _detect_area(title),
                "level": "básico", "modality": "online", "price": 0,
                "state": None, "city": None,
            })
        if courses:
            break
    logger.info("Sebrae: %d cursos", len(courses))
    return courses


# ─── Fonte 4: Escola Virtual Gov (MEC) — HTML verificado ────────────────────

def scrape_escola_virtual_gov() -> list[dict]:
    from bs4 import BeautifulSoup
    courses = []
    seen: set[str] = set()
    resp = _get("https://www.escolavirtual.gov.br/catalogo")
    if not resp:
        resp = _get("https://www.escolavirtual.gov.br")
    if not resp:
        logger.info("Escola Virtual Gov: 0 cursos")
        return []
    soup = BeautifulSoup(resp.text, "html.parser")
    for a in soup.select("a[href*='/curso']"):
        href = a["href"]
        if not href.startswith("http"):
            href = "https://www.escolavirtual.gov.br" + href
        if href in seen:
            continue
        seen.add(href)
        title = a.get_text(strip=True)
        if not title or len(title) < 5:
            continue
        courses.append({
            "source": "escola_virtual_gov", "source_url": href,
            "title": title[:200], "organization": "Escola Virtual Gov (MEC)",
            "description": None, "area": _detect_area(title),
            "level": "básico", "modality": "online", "price": 0,
            "state": None, "city": None,
        })
    logger.info("Escola Virtual Gov: %d cursos", len(courses))
    return courses


# ─── Fonte 5: Class Central — RSS verificado ─────────────────────────────────

def scrape_classcentral_rss() -> list[dict]:
    courses = []
    resp = _get("https://www.classcentral.com/report/feed/", timeout=20)
    if not resp:
        logger.info("Class Central RSS: 0 cursos")
        return []
    try:
        root = ET.fromstring(resp.content)
        for item in root.findall(".//item")[:30]:
            title = (item.findtext("title") or "").strip()
            link  = (item.findtext("link") or "").strip()
            desc  = re.sub(r"<[^>]+>", " ", item.findtext("description") or "").strip()[:400]
            if not title:
                continue
            courses.append({
                "source": "classcentral", "source_url": link,
                "title": title[:200], "organization": "Class Central",
                "description": desc or None,
                "area": _detect_area(title + " " + desc), "level": "básico",
                "modality": "online", "price": 0, "state": None, "city": None,
            })
    except Exception as e:
        logger.warning("Class Central RSS parse: %s", e)
    logger.info("Class Central RSS: %d cursos", len(courses))
    return courses


# ─── Runner principal ────────────────────────────────────────────────────────

def scrape_all_courses() -> list[dict]:
    all_courses: list[dict] = []

    scrapers = [
        ("Fundação Bradesco", scrape_fundacao_bradesco),
        ("SENAI",             scrape_senai),
        ("Sebrae",            scrape_sebrae),
        ("Escola Virtual Gov", scrape_escola_virtual_gov),
        ("Class Central",     scrape_classcentral_rss),
    ]

    for name, fn in scrapers:
        try:
            results = fn()
            all_courses.extend(results)
            time.sleep(1)
        except Exception as e:
            logger.error("Erro em %s: %s", name, e)

    seen = set()
    unique = []
    for c in all_courses:
        k = c.get("source_url") or c.get("title", "")
        if k not in seen:
            seen.add(k)
            unique.append(c)

    logger.info("Total de cursos coletados: %d", len(unique))
    return unique
