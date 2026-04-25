from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY
from typing import Optional
import logging

logger = logging.getLogger(__name__)

_client: Optional[Client] = None


def get_client() -> Client:
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            raise RuntimeError("SUPABASE_URL e SUPABASE_SERVICE_KEY devem estar no .env")
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _client


def upsert_job(job: dict) -> bool:
    """
    Insere ou atualiza uma vaga na tabela jobs.
    Usa source_url como chave de deduplicação.
    Retorna True se foi inserida/atualizada.
    """
    client = get_client()
    try:
        if not job.get("title") or not job.get("source"):
            logger.warning("Vaga ignorada — sem title ou source: %s", job)
            return False

        if job.get("source_url"):
            existing = (
                client.table("jobs")
                .select("id")
                .eq("source_url", job["source_url"])
                .execute()
            )
            if existing.data:
                logger.debug("Vaga já existe: %s", job["source_url"])
                return False

        client.table("jobs").insert(job).execute()
        logger.info("✓ Inserida: %s", job["title"])
        return True

    except Exception as e:
        logger.error("Erro ao inserir vaga '%s': %s", job.get("title"), e)
        return False


def count_jobs() -> int:
    client = get_client()
    result = client.table("jobs").select("id", count="exact").execute()
    return result.count or 0
