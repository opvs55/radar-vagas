# Radar Vagas — Scraper

Motor de coleta de vagas que alimenta o banco Supabase.

## Setup

```bash
cd scraper

# Criar ambiente virtual
python -m venv .venv
.venv\Scripts\activate       # Windows
source .venv/bin/activate    # Linux/Mac

# Instalar dependências
pip install -r requirements.txt

# Instalar browsers do Playwright (necessário para Indeed)
playwright install chromium

# Configurar credenciais
copy .env.example .env
# Edite o .env com a SUPABASE_SERVICE_KEY (role: service_role)
```

## Como obter a SUPABASE_SERVICE_KEY

1. Acesse https://supabase.com/dashboard/project/wzooovpwfutzjmyseetq/settings/api
2. Copie a chave **service_role** (não a anon)
3. Cole no `.env`

## Executar

```bash
# Roda uma vez
python runner.py

# Roda com palavras-chave customizadas
python runner.py --keywords "professor" "ciências sociais" "edtech"

# Modo watch: roda a cada 6 horas automaticamente
python runner.py --watch
```

## Fontes monitoradas

| Fonte          | Tipo       | Método       |
|----------------|------------|--------------|
| PCI Concursos  | Concursos  | requests/BS4 |
| VUNESP         | Concursos  | requests/BS4 |
| CEBRASPE       | Concursos  | requests/BS4 |
| FCC            | Concursos  | requests/BS4 |
| Indeed Brasil  | CLT/PJ     | Playwright   |

## Estrutura

```
scraper/
├── runner.py          # Ponto de entrada principal
├── base_scraper.py    # Classe base com retry e session
├── db.py              # Cliente Supabase + deduplicação
├── config.py          # Keywords padrão e configurações
├── requirements.txt
├── .env               # Suas credenciais (não versionar)
└── scrapers/
    ├── pci_concursos.py
    ├── indeed.py
    ├── vunesp.py
    ├── cebraspe.py
    └── fcc.py
```
