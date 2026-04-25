import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

KEYWORDS_DEFAULT = [
    "professor", "docente", "licenciatura", "ciências sociais", "história",
    "matemática", "tecnologia educacional", "proatec", "edtech",
    "educação", "ensino", "pedagogia",
]

REQUEST_DELAY_SECONDS = 1
MAX_RETRIES = 2
