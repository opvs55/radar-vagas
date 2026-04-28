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


# ─── Fonte 1: Fundação Bradesco — API JSON ───────────────────────────────────

def scrape_fundacao_bradesco() -> list[dict]:
    courses = []
    for page in range(1, 4):
        resp = _get(
            "https://www.ev.org.br/api/courses",
            params={"page": page, "pageSize": 30, "isFree": "true"},
        )
        if not resp:
            break
        try:
            data = resp.json()
            items = data.get("items") or data.get("data") or data.get("courses") or []
            if not items:
                break
            for c in items:
                title = (c.get("name") or c.get("title") or "").strip()
                if not title:
                    continue
                slug = c.get("slug") or c.get("id") or ""
                href = f"https://www.ev.org.br/cursos/{slug}" if slug else "https://www.ev.org.br"
                courses.append({
                    "source": "fundacao_bradesco", "source_url": href,
                    "title": title, "organization": "Fundação Bradesco",
                    "description": c.get("description") or c.get("shortDescription"),
                    "area": _detect_area(title), "level": "básico",
                    "modality": "online", "price": 0, "state": None, "city": None,
                })
        except Exception:
            break
    if not courses:
        courses = _scrape_bradesco_html()
    logger.info("Fundação Bradesco: %d cursos", len(courses))
    return courses


def _scrape_bradesco_html() -> list[dict]:
    from bs4 import BeautifulSoup
    courses = []
    for url in ["https://www.ev.org.br/cursos", "https://www.ev.org.br/trilhas-de-conhecimento"]:
        resp = _get(url)
        if not resp:
            continue
        soup = BeautifulSoup(resp.text, "html.parser")
        for a in soup.select("a[href*='/cursos/']")[:30]:
            title_el = a.select_one("h2, h3, h4, p, span")
            title = title_el.get_text(strip=True) if title_el else a.get_text(strip=True)
            if not title or len(title) < 5:
                continue
            href = a["href"]
            if not href.startswith("http"):
                href = "https://www.ev.org.br" + href
            courses.append({
                "source": "fundacao_bradesco", "source_url": href,
                "title": title, "organization": "Fundação Bradesco",
                "description": None, "area": _detect_area(title),
                "level": "básico", "modality": "online", "price": 0,
                "state": None, "city": None,
            })
    return courses


# ─── Fonte 2: SENAI — API REST ───────────────────────────────────────────────

def scrape_senai() -> list[dict]:
    courses = []
    endpoints = [
        "https://www.senai.br/api/courses?type=free&limit=50",
        "https://online.sp.senai.br/api/courses?free=true&limit=50",
    ]
    for url in endpoints:
        resp = _get(url)
        if not resp:
            continue
        try:
            data = resp.json()
            items = data.get("data") or data.get("courses") or data.get("items") or []
            for c in items:
                title = (c.get("name") or c.get("title") or "").strip()
                if not title:
                    continue
                href = c.get("url") or c.get("link") or "https://online.sp.senai.br"
                courses.append({
                    "source": "senai", "source_url": href,
                    "title": title, "organization": "SENAI",
                    "description": c.get("description"),
                    "area": _detect_area(title), "level": "técnico",
                    "modality": "online", "price": 0, "state": "SP", "city": None,
                })
            if courses:
                break
        except Exception:
            continue
    logger.info("SENAI: %d cursos", len(courses))
    return courses


# ─── Fonte 3: Sebrae — API REST ─────────────────────────────────────────────

def scrape_sebrae() -> list[dict]:
    courses = []
    endpoints = [
        "https://digital.sebrae.com.br/api/courses?free=true&limit=50",
        "https://www.sebrae.com.br/api/cursos?gratuito=true&limit=50",
    ]
    for url in endpoints:
        resp = _get(url)
        if not resp:
            continue
        try:
            data = resp.json()
            items = data.get("data") or data.get("cursos") or data.get("items") or []
            for c in items:
                title = (c.get("titulo") or c.get("name") or c.get("title") or "").strip()
                if not title:
                    continue
                href = c.get("url") or c.get("link") or "https://sebrae.com.br/cursos"
                courses.append({
                    "source": "sebrae", "source_url": href,
                    "title": title, "organization": "Sebrae",
                    "description": c.get("descricao") or c.get("description"),
                    "area": _detect_area(title), "level": "básico",
                    "modality": "online", "price": 0, "state": None, "city": None,
                })
            if courses:
                break
        except Exception:
            continue
    logger.info("Sebrae: %d cursos", len(courses))
    return courses


# ─── Fonte 4: Escola Virtual Gov (MEC) — API REST ───────────────────────────

def scrape_escola_virtual_gov() -> list[dict]:
    courses = []
    resp = _get(
        "https://www.escolavirtual.gov.br/api/cursos",
        params={"page": 1, "limit": 50, "gratuito": "true"},
    )
    if resp:
        try:
            data = resp.json()
            items = data.get("data") or data.get("cursos") or data.get("results") or []
            for c in items:
                title = (c.get("titulo") or c.get("name") or c.get("title") or "").strip()
                if not title:
                    continue
                href = c.get("url") or c.get("link") or "https://www.escolavirtual.gov.br"
                if href and not href.startswith("http"):
                    href = "https://www.escolavirtual.gov.br" + href
                courses.append({
                    "source": "escola_virtual_gov", "source_url": href,
                    "title": title, "organization": "Escola Virtual Gov (MEC)",
                    "description": c.get("descricao") or c.get("description"),
                    "area": _detect_area(title), "level": "básico",
                    "modality": "online", "price": 0, "state": None, "city": None,
                })
        except Exception:
            pass
    logger.info("Escola Virtual Gov: %d cursos", len(courses))
    return courses


# ─── Fonte 5: Coursera — RSS por categoria ──────────────────────────────────

def scrape_coursera_rss() -> list[dict]:
    feeds = [
        ("https://www.coursera.org/sitemap~www~courses.xml", "Coursera"),
    ]
    courses = []
    rss_urls = [
        "https://www.classcentral.com/report/feed/?tag=free-certificate",
    ]
    for url in rss_urls:
        resp = _get(url, timeout=20)
        if not resp:
            continue
        try:
            root = ET.fromstring(resp.content)
            for item in root.findall(".//item")[:40]:
                title = (item.findtext("title") or "").strip()
                link  = (item.findtext("link") or "").strip()
                desc  = re.sub(r"<[^>]+>", " ", item.findtext("description") or "").strip()[:400]
                if not title:
                    continue
                courses.append({
                    "source": "classcentral", "source_url": link or url,
                    "title": title, "organization": "Class Central",
                    "description": desc or None,
                    "area": _detect_area(title + " " + desc), "level": "básico",
                    "modality": "online", "price": 0, "state": None, "city": None,
                })
        except Exception as e:
            logger.warning("Coursera RSS: %s", e)

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
        ("Class Central",     scrape_coursera_rss),
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
