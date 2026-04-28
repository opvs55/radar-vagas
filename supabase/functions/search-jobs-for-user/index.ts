import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ADZUNA_APP_ID = Deno.env.get('ADZUNA_APP_ID') ?? ''
const ADZUNA_APP_KEY = Deno.env.get('ADZUNA_APP_KEY') ?? ''
const JSEARCH_API_KEY = Deno.env.get('JSEARCH_API_KEY') ?? ''
const JOOBLE_API_KEY = Deno.env.get('JOOBLE_API_KEY') ?? ''

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function fixJobType(raw: string | null | undefined): string {
  const t = (raw ?? '').toLowerCase()
  if (t.includes('concurso')) return 'concurso'
  if (t.includes('pj') || t.includes('contractor')) return 'pj'
  if (t.includes('temp') || t.includes('part')) return 'temporario'
  return 'clt'
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const sb = createClient(SUPABASE_URL, SERVICE_KEY)

    const { data: { user }, error: ae } = await sb.auth.getUser(jwt)
    if (ae || !user) return resp({ error: 'nao autenticado' }, 401)

    const [pR, fR, eR] = await Promise.all([
      sb.from('profiles').select('keywords,city,state').eq('id', user.id).single(),
      sb.from('formations').select('field').eq('profile_id', user.id),
      sb.from('experiences').select('title').eq('profile_id', user.id),
    ])

    const kws: string[] = [
      ...(pR.data?.keywords ?? []),
      ...((fR.data ?? []) as { field: string }[]).map(f => f.field),
      ...((eR.data ?? []) as { title: string }[]).map(e => e.title),
    ].filter(Boolean).slice(0, 6)

    if (!kws.length) return resp({ inserted: 0, message: 'sem keywords' })

    const loc = pR.data?.city ? `${pR.data.city}, ${pR.data.state ?? 'Brasil'}` : 'Brasil'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jobs: any[] = []

    if (ADZUNA_APP_ID) {
      for (const k of kws.slice(0, 3)) {
        try {
          const r = await fetch(`https://api.adzuna.com/v1/api/jobs/br/search/1?app_id=${ADZUNA_APP_ID}&app_key=${ADZUNA_APP_KEY}&what=${encodeURIComponent(k)}&where=${encodeURIComponent(loc)}&results_per_page=10&content-type=application/json`)
          if (r.ok) {
            const d = await r.json()
            for (const j of (d.results ?? [])) {
              jobs.push({ source: 'adzuna', source_url: j.redirect_url ?? null, title: j.title ?? '', organization: j.company?.display_name ?? null, description: j.description ?? null, city: j.location?.area?.[1] ?? null, state: j.location?.area?.[0] ?? null, job_type: 'clt', salary_min: j.salary_min ?? null, salary_max: j.salary_max ?? null, deadline: null })
            }
          }
        } catch (_) { /* skip */ }
      }
    }

    if (JSEARCH_API_KEY) {
      for (const k of kws.slice(0, 3)) {
        try {
          const r = await fetch(`https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(k + ' in ' + loc)}&num_pages=1`, { headers: { 'x-rapidapi-key': JSEARCH_API_KEY, 'x-rapidapi-host': 'jsearch.p.rapidapi.com' } })
          if (r.ok) {
            const d = await r.json()
            for (const j of (d.data ?? [])) {
              jobs.push({ source: 'jsearch', source_url: j.job_apply_link ?? null, title: j.job_title ?? '', organization: j.employer_name ?? null, description: j.job_description?.slice(0, 500) ?? null, city: j.job_city ?? null, state: j.job_state ?? null, job_type: fixJobType(j.job_employment_type), salary_min: j.job_min_salary ?? null, salary_max: j.job_max_salary ?? null, deadline: null })
            }
          }
        } catch (_) { /* skip */ }
      }
    }

    if (JOOBLE_API_KEY) {
      for (const k of kws.slice(0, 3)) {
        try {
          const r = await fetch(`https://jooble.org/api/${JOOBLE_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keywords: k, location: loc, resultsOnPage: 10 }) })
          if (r.ok) {
            const d = await r.json()
            for (const j of (d.jobs ?? [])) {
              const s = (j.salary ?? '').match(/[\d.]+/g)?.map(Number).filter((n: number) => n > 100) ?? []
              jobs.push({ source: 'jooble', source_url: j.link ?? null, title: j.title ?? '', organization: j.company ?? null, description: j.snippet?.replace(/<[^>]+>/g, ' ').slice(0, 500) ?? null, city: j.location?.split(',')?.[0]?.trim() ?? null, state: null, job_type: 'clt', salary_min: s[0] ?? null, salary_max: s[1] ?? null, deadline: null })
            }
          }
        } catch (_) { /* skip */ }
      }
    }

    const seen = new Set<string>()
    const unique = jobs.filter(j => {
      const k = String(j.source_url ?? j.title)
      if (seen.has(k)) return false
      seen.add(k); return true
    })

    if (!unique.length) return resp({ inserted: 0, message: 'nenhuma vaga' })

    const { error: ie } = await sb.from('jobs').insert(unique)
    if (ie && !ie.message?.includes('duplicate') && !ie.message?.includes('unique')) {
      console.error('insert error:', ie.message)
      throw new Error(ie.message)
    }

    return resp({ inserted: unique.length, keywords: kws })
  } catch (e) {
    console.error('fatal:', String(e))
    return resp({ error: String(e) }, 500)
  }
})

function resp(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}
