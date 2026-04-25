import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Job, Formation, Experience } from '@/types/database'

export interface JobScoreResult {
  job_id: string
  score: number
  reason: string
}

export interface CareerCoachResult {
  strengths: string[]
  gaps: string[]
  courses: string[]
  career_paths: string[]
  action_plan: string[]
  salary_range: { min: number; max: number; currency: string } | null
  summary: string
}

export interface ParsedResume {
  full_name: string | null
  city: string | null
  state: string | null
  keywords: string[]
  formations: Array<{
    degree: string
    field: string
    institution: string | null
    year_end: number | null
    status: 'concluído' | 'em andamento'
  }>
  experiences: Array<{
    title: string
    organization: string | null
    description: string | null
    start_date: string | null
    current: boolean
  }>
}

const PROMPT = `Você é um parser de currículos. Analise o texto abaixo e retorne um JSON válido com exatamente esta estrutura:

{
  "full_name": "Nome completo ou null",
  "city": "Cidade ou null",
  "state": "Sigla do estado (2 letras) ou null",
  "keywords": ["lista de competências, habilidades e áreas de interesse relevantes"],
  "formations": [
    {
      "degree": "Licenciatura / Bacharelado / Tecnólogo / Pós-graduação / etc",
      "field": "Área do curso",
      "institution": "Nome da instituição ou null",
      "year_end": 2024,
      "status": "concluído ou em andamento"
    }
  ],
  "experiences": [
    {
      "title": "Cargo ou função",
      "organization": "Empresa ou instituição ou null",
      "description": "Resumo das atividades ou null",
      "start_date": "YYYY-MM-DD ou null",
      "current": true ou false
    }
  ]
}

Retorne APENAS o JSON, sem markdown, sem explicações.

TEXTO DO CURRÍCULO:
`

function getModel() {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey || apiKey === 'COLE_SUA_GEMINI_API_KEY_AQUI') {
    throw new Error('VITE_GEMINI_API_KEY não configurada no .env')
  }
  const genAI = new GoogleGenerativeAI(apiKey)
  return genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' })
}

function parseJSON<T>(raw: string): T {
  const cleaned = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
  return JSON.parse(cleaned) as T
}

export async function parseResumeWithGemini(text: string): Promise<ParsedResume> {
  const model = getModel()
  const result = await model.generateContent(PROMPT + text.slice(0, 8000))
  return parseJSON<ParsedResume>(result.response.text().trim())
}

export async function scoreJobsWithAI(
  jobs: Pick<Job, 'id' | 'title' | 'organization' | 'description' | 'job_type'>[],
  profile: { keywords: string[] | null; formations: Formation[]; experiences: Experience[] },
): Promise<JobScoreResult[]> {
  const model = getModel()

  const profileSummary = [
    `Formações: ${profile.formations.map(f => `${f.degree} em ${f.field}`).join(', ') || 'não informado'}`,
    `Experiências: ${profile.experiences.map(e => e.title).join(', ') || 'não informado'}`,
    `Competências: ${(profile.keywords || []).join(', ') || 'não informado'}`,
  ].join('\n')

  const jobsText = jobs.map((j, i) =>
    `[${i}] id="${j.id}" | ${j.title} @ ${j.organization || 'sem empresa'} | tipo: ${j.job_type || 'N/A'} | ${j.description?.slice(0, 150) || ''}`
  ).join('\n')

  const prompt = `Você é um recrutador especialista. Avalie a compatibilidade entre o perfil do candidato e cada vaga.

PERFIL DO CANDIDATO:
${profileSummary}

VAGAS (formato: [índice] id="..." | título @ empresa | tipo | descrição):
${jobsText}

Retorne APENAS um JSON array com exatamente ${jobs.length} objetos, um por vaga, na mesma ordem:
[{"job_id":"...","score":85,"reason":"Formação em X alinha com Y, porém falta Z"},...]

score: inteiro de 0 a 100. reason: máximo 100 caracteres em português. Retorne APENAS o JSON.`

  const result = await model.generateContent(prompt)
  return parseJSON<JobScoreResult[]>(result.response.text().trim())
}

export async function careerCoachAnalysis(
  profile: { keywords: string[] | null; formations: Formation[]; experiences: Experience[] },
  topJobs: Pick<Job, 'title' | 'organization' | 'job_type'>[],
): Promise<CareerCoachResult> {
  const model = getModel()

  const profileSummary = [
    `Formações: ${profile.formations.map(f => `${f.degree} em ${f.field} (${f.status})`).join('; ') || 'não informado'}`,
    `Experiências: ${profile.experiences.map(e => `${e.title} em ${e.organization || 'N/A'}`).join('; ') || 'não informado'}`,
    `Competências: ${(profile.keywords || []).join(', ') || 'não informado'}`,
  ].join('\n')

  const jobsContext = topJobs.slice(0, 20).map(j => `${j.title} @ ${j.organization || 'N/A'}`).join('\n')

  const prompt = `Você é um conselheiro de carreira especialista no mercado de trabalho brasileiro. Analise o perfil abaixo e as vagas disponíveis.

PERFIL:
${profileSummary}

VAGAS DISPONÍVEIS NO MERCADO (amostra):
${jobsContext}

Retorne APENAS um JSON com esta estrutura exata:
{
  "strengths": ["ponto forte 1", "ponto forte 2", "ponto forte 3"],
  "gaps": ["gap/lacuna 1", "gap 2", "gap 3"],
  "courses": ["Curso recomendado 1 (plataforma)", "Curso 2", "Curso 3", "Curso 4"],
  "career_paths": ["Cargo/área que pode evoluir 1", "Caminho 2", "Caminho 3"],
  "action_plan": ["Ação concreta nos próximos 30 dias", "Ação 2-3 meses", "Ação 6-12 meses", "Ação longo prazo"],
  "salary_range": {"min": 3000, "max": 8000, "currency": "BRL"},
  "summary": "Parágrafo de 2-3 frases resumindo a situação atual e potencial do candidato."
}

Seja específico, prático e baseado na realidade do mercado brasileiro. Retorne APENAS o JSON.`

  const result = await model.generateContent(prompt)
  return parseJSON<CareerCoachResult>(result.response.text().trim())
}
