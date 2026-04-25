import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

KEYWORDS_DEFAULT = [
    # Tecnologia
    "desenvolvedor", "programador", "analista de sistemas", "data science",
    "suporte técnico", "infraestrutura", "segurança da informação",
    # Administração e negócios
    "administrativo", "assistente administrativo", "recursos humanos",
    "financeiro", "contabilidade", "controladoria", "analista financeiro",
    # Direito
    "advogado", "assistente jurídico", "analista jurídico", "paralegal",
    # Saúde
    "enfermeiro", "técnico de enfermagem", "farmacêutico", "fisioterapeuta",
    # Educação
    "professor", "pedagogo", "coordenador pedagógico", "educação",
    # Engenharia
    "engenheiro civil", "engenheiro elétrico", "técnico em edificações",
    # Comunicação e marketing
    "marketing digital", "social media", "redator", "jornalista",
    # Vendas e atendimento
    "vendedor", "representante comercial", "atendimento ao cliente",
    # Geral
    "estágio", "jovem aprendiz", "trainee", "analista",
]

REQUEST_DELAY_SECONDS = 1
MAX_RETRIES = 2
