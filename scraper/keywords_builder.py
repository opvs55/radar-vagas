"""
keywords_builder.py
Gera um conjunto de keywords de busca baseado nos perfis cadastrados no Supabase.

Lógica:
1. Lê todas as formações e experiências dos usuários
2. Mapeia áreas de formação → keywords de busca relevantes (incluindo vagas afins)
3. Retorna lista deduplicada e ordenada por relevância
"""
import logging
from db import get_client
from config import KEYWORDS_DEFAULT

logger = logging.getLogger(__name__)

# Mapa: área de formação/experiência → keywords de busca relacionadas
# Inclui vagas que exigem apenas "ensino superior" sem área específica
AREA_KEYWORDS_MAP: dict[str, list[str]] = {
    # Educação / Pedagogia
    "pedagogia": ["professor", "docente", "pedagogo", "coordenador pedagogico", "orientador educacional",
                  "educador", "tutor", "instrutor", "monitor", "inspetor de alunos", "supervisor escolar"],
    "licenciatura": ["professor", "docente", "tutor", "educador", "instrutor", "monitor"],
    "educação": ["professor", "educador", "coordenador pedagogico", "gestor escolar", "consultor educacional"],
    "historia": ["professor de historia", "historiador", "pesquisador", "arquivista", "museólogo",
                 "produtor cultural", "educador museal"],
    "ciencias sociais": ["professor", "pesquisador social", "analista social", "gestor cultural",
                         "produtor cultural", "assistente social"],
    "filosofia": ["professor de filosofia", "professor", "pesquisador", "consultor"],
    "letras": ["professor de portugues", "professor de ingles", "professor de literatura",
               "revisor de texto", "redator", "copywriter", "tradutor"],
    "matematica": ["professor de matematica", "professor", "analista de dados", "tutor"],
    "fisica": ["professor de fisica", "professor", "pesquisador"],
    "quimica": ["professor de quimica", "professor", "pesquisador"],
    "biologia": ["professor de biologia", "professor", "pesquisador", "educador ambiental"],
    "geografia": ["professor de geografia", "geoprocessamento", "analista ambiental"],

    # Humanas / Sociais
    "psicologia": ["psicologo", "orientador", "terapeuta", "pesquisador", "analista de RH",
                   "educador", "psicopedagogo"],
    "servico social": ["assistente social", "educador social", "orientador social", "gestor social"],
    "direito": ["advogado", "analista juridico", "assessor juridico", "consultor juridico"],

    # Artes / Cultura
    "artes": ["professor de artes", "artista", "produtor cultural", "educador cultural",
              "curador", "monitor cultural", "mediador cultural", "gestor cultural"],
    "cultura": ["produtor cultural", "gestor cultural", "agente cultural", "educador museal",
                "monitor de museu", "mediador cultural", "curador"],
    "museologia": ["museologo", "museólogo", "educador museal", "monitor de museu",
                   "curador", "gestor de acervo", "pesquisador"],
    "comunicacao": ["jornalista", "relações públicas", "assessor de comunicação",
                    "produtor de conteúdo", "redator", "social media"],

    # Tecnologia
    "tecnologia": ["analista de sistemas", "desenvolvedor", "programador", "professor de informatica",
                   "suporte tecnico", "analista de TI"],
    "informatica": ["professor de informatica", "analista de TI", "desenvolvedor", "suporte"],
    "edtech": ["professor online", "tutor EAD", "designer instrucional", "analista educacional",
               "produtor de conteudo educacional", "tecnologia educacional"],

    # Gestão
    "administracao": ["analista administrativo", "assistente administrativo", "coordenador",
                      "gestor", "analista de projetos"],
    "gestao": ["gestor", "coordenador", "analista de projetos", "supervisor"],

    # Saúde
    "enfermagem": ["enfermeiro", "técnico de enfermagem", "professor de enfermagem"],
    "nutricao": ["nutricionista", "professor", "consultor"],
}

# Keywords culturais sempre incluídas (vagas que qualquer graduado pode concorrer)
CULTURAL_KEYWORDS = [
    "produtor cultural", "agente cultural", "educador museal",
    "monitor cultural", "mediador cultural", "assistente cultural",
    "museu", "instituto cultural", "fundacao cultural",
]

# Vagas que exigem apenas curso superior sem área específica
GENERIC_SUPERIOR_KEYWORDS = [
    "analista junior", "assistente administrativo", "coordenador",
    "gestor de projetos", "analista de projetos", "consultor junior",
    "educador social", "orientador social",
]


def build_keywords_from_profiles() -> tuple[list[str], list[str]]:
    """
    Lê perfis do Supabase e retorna:
    - keywords: lista de keywords de busca baseada nos perfis
    - locations: lista de localizações dos perfis
    """
    try:
        client = get_client()

        # Buscar formações
        formations = client.table("formations").select("degree, field, status").execute().data or []
        # Buscar experiências
        experiences = client.table("experiences").select("title, description").execute().data or []
        # Buscar keywords e localização dos perfis
        profiles = client.table("profiles").select("keywords, city, state").execute().data or []

    except Exception as e:
        logger.warning("Erro ao ler perfis: %s — usando keywords padrão", e)
        return KEYWORDS_DEFAULT, ["São Paulo", "Brasil"]

    keyword_set: set[str] = set()

    # 1. Keywords diretas dos perfis
    for p in profiles:
        for kw in (p.get("keywords") or []):
            if kw and len(kw) > 2:
                keyword_set.add(kw.lower().strip())

    # 2. Keywords baseadas nas formações
    for f in formations:
        field = (f.get("field") or "").lower().strip()
        degree = (f.get("degree") or "").lower().strip()

        # Match direto
        for area, kws in AREA_KEYWORDS_MAP.items():
            if area in field or area in degree:
                keyword_set.update(kws)

        # Formações em licenciatura sempre incluem "professor"
        if "licenciatura" in degree or "licenciatura" in field:
            keyword_set.add("professor")
            keyword_set.add("docente")

        # Pós-graduação em educação
        if "pós" in degree or "especialização" in degree or "mestrado" in degree:
            keyword_set.add("coordenador")
            keyword_set.add("pesquisador")
            keyword_set.add("consultor educacional")

    # 3. Keywords baseadas nas experiências
    for e in experiences:
        title = (e.get("title") or "").lower().strip()
        desc = (e.get("description") or "").lower().strip()
        combined = f"{title} {desc}"

        for area, kws in AREA_KEYWORDS_MAP.items():
            if area in combined:
                # Adiciona apenas as 3 primeiras para não inflar demais
                keyword_set.update(kws[:3])

        # Experiência como professor → inclui coordenador/gestor
        if "professor" in title or "docente" in title:
            keyword_set.update(["coordenador pedagogico", "gestor escolar",
                                 "supervisor escolar", "orientador educacional"])

    # 4. Sempre incluir vagas culturais e de curso superior genérico
    keyword_set.update(CULTURAL_KEYWORDS)
    keyword_set.update(GENERIC_SUPERIOR_KEYWORDS)

    # 5. Fallback se vazio
    if not keyword_set:
        keyword_set.update(KEYWORDS_DEFAULT)

    # Localizações
    locations: list[str] = []
    for p in profiles:
        if p.get("city"):
            loc = p["city"]
            if p.get("state"):
                loc += f", {p['state']}"
            locations.append(loc)
    locations = list(set(locations)) or ["São Paulo", "Brasil"]

    keywords = sorted(keyword_set)
    logger.info("Keywords geradas a partir dos perfis (%d): %s", len(keywords), keywords[:15])

    return keywords, locations
