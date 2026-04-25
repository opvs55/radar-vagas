import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, MapPin, Building2, Calendar, Bookmark, ExternalLink, Zap, RefreshCw, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/hooks/useProfile'
import { cn, formatCurrency, formatDate, haversineDistanceKm } from '@/lib/utils'
import type { Job, Application, JobScore } from '@/types/database'
import JobModal from '@/components/JobModal'

function _timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 60) return 'agora'
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`
  return `há ${Math.floor(diff / 3600)}h`
}

const FIRST_JOB_KEYWORDS = [
  'primeiro emprego', 'sem experiência', 'aprendiz', 'jovem aprendiz',
  'estágio', 'estagiário', 'trainee', 'sem experiencia', 'não exige experiência',
]

function isFirstJobFriendly(job: Job): boolean {
  const text = `${job.title} ${job.description ?? ''}`.toLowerCase()
  return FIRST_JOB_KEYWORDS.some(kw => text.includes(kw))
}

const JOB_TYPE_COLORS: Record<string, string> = {
  concurso:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
  clt:       'bg-green-500/10 text-green-400 border-green-500/20',
  pj:        'bg-purple-500/10 text-purple-400 border-purple-500/20',
  temporario:'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  edtech:    'bg-pink-500/10 text-pink-400 border-pink-500/20',
  outro:     'bg-gray-500/10 text-gray-400 border-gray-500/20',
}

const TYPE_LABELS: Record<string, string> = {
  concurso: 'Concurso', clt: 'CLT', pj: 'PJ', temporario: 'Temporário', edtech: 'EdTech', outro: 'Outro',
}

function ScoreBadge({ score, reason, isAI }: { score: number; reason?: string | null; isAI?: boolean }) {
  const color = score >= 80 ? 'text-green-400 bg-green-500/10 border-green-500/20'
    : score >= 60 ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
    : score >= 40 ? 'text-orange-400 bg-orange-500/10 border-orange-500/20'
    : 'text-gray-500 bg-gray-500/10 border-gray-500/20'
  const Icon = isAI ? Sparkles : Zap
  const label = isAI ? 'IA' : ''
  return (
    <div className="relative group/score">
      <div className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold', color)}>
        <Icon size={11} />
        <span>{score}%</span>
        {label && <span className="text-[10px] opacity-70">{label}</span>}
      </div>
      {reason && (
        <div className="absolute bottom-full left-0 mb-2 w-56 bg-gray-900 border border-surface-border rounded-lg p-2.5 text-xs text-gray-300 shadow-xl z-10 hidden group-hover/score:block pointer-events-none">
          <p className="font-medium text-brand-400 mb-1 flex items-center gap-1"><Sparkles size={10} /> Análise IA</p>
          {reason}
        </div>
      )}
    </div>
  )
}

function JobCard({ job, saved, onSave, onClick, showFirstJobBadge }: { job: Job & { distance?: number; match_score?: number; ai_score?: number; ai_reason?: string }; saved: boolean; onSave: () => void; onClick: () => void; showFirstJobBadge?: boolean }) {
  const firstJobFriendly = showFirstJobBadge && isFirstJobFriendly(job)
  return (
    <div
      className={cn(
        'card p-5 hover:border-brand-600/30 transition-all duration-200 group cursor-pointer',
        firstJobFriendly && 'ring-1 ring-yellow-500/20',
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {firstJobFriendly && (
              <span className="badge border bg-yellow-500/10 text-yellow-400 border-yellow-500/20 flex items-center gap-1">
                ⭐ Primeiro emprego
              </span>
            )}
            {job.job_type && (
              <span className={cn('badge border', JOB_TYPE_COLORS[job.job_type] ?? JOB_TYPE_COLORS.outro)}>
                {TYPE_LABELS[job.job_type] ?? job.job_type}
              </span>
            )}
            {job.ai_score !== undefined
              ? <ScoreBadge score={job.ai_score} reason={job.ai_reason} isAI />
              : job.match_score !== undefined && <ScoreBadge score={Math.round(job.match_score)} />
            }
          </div>

          <h3 className="text-white font-semibold text-sm leading-snug line-clamp-2 mt-1">{job.title}</h3>

          <div className="flex items-center gap-4 mt-2 flex-wrap">
            {job.organization && (
              <span className="flex items-center gap-1 text-gray-400 text-xs">
                <Building2 size={12} /> {job.organization}
              </span>
            )}
            {(job.city || job.state) && (
              <span className="flex items-center gap-1 text-gray-400 text-xs">
                <MapPin size={12} /> {[job.city, job.state].filter(Boolean).join(', ')}
                {job.distance !== undefined && <span className="text-gray-600"> · {Math.round(job.distance)} km</span>}
              </span>
            )}
            {job.deadline && (
              <span className="flex items-center gap-1 text-gray-400 text-xs">
                <Calendar size={12} /> até {formatDate(job.deadline)}
              </span>
            )}
          </div>

          {(job.salary_min || job.salary_max) && (
            <p className="text-brand-400 text-sm font-medium mt-2">
              {formatCurrency(job.salary_min)} {job.salary_max ? `– ${formatCurrency(job.salary_max)}` : ''}
            </p>
          )}

          {job.description && (
            <p className="text-gray-500 text-xs mt-2 line-clamp-2">{job.description}</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onSave() }}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
              saved
                ? 'bg-brand-600/20 text-brand-400'
                : 'text-gray-600 hover:text-brand-400 hover:bg-brand-600/10',
            )}
            title={saved ? 'Salvo' : 'Salvar vaga'}
          >
            <Bookmark size={15} fill={saved ? 'currentColor' : 'none'} />
          </button>
          {job.source_url && (
            <a
              href={job.source_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="w-8 h-8 rounded-lg text-gray-600 hover:text-white hover:bg-surface-muted flex items-center justify-center transition-all"
              title="Ver vaga"
            >
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export default function RadarPage() {
  const { user } = useAuth()
  const { data: profile, isLoading: profileLoading } = useProfile()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('todos')
  const [filterSource, setFilterSource] = useState<string>('todas')
  const [onlyZone, setOnlyZone] = useState(false)
  const [sortBy, setSortBy] = useState<'score' | 'distance' | 'date'>('score')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  type EnrichedJob = Job & { distance?: number; match_score?: number; ai_score?: number; ai_reason?: string; keyword_hits?: number; distance_km?: number | null }
  const [selectedJob, setSelectedJob] = useState<EnrichedJob | null>(null)

  // Redirecionar usuário novo (sem keywords e sem formações)
  useEffect(() => {
    if (!profileLoading && profile !== undefined) {
      const hasProfile = (profile?.keywords?.length ?? 0) > 0 || !!profile?.full_name
      const visited = sessionStorage.getItem('onboarding_checked')
      if (!hasProfile && !visited) {
        sessionStorage.setItem('onboarding_checked', '1')
        navigate('/onboarding')
      }
    }
  }, [profile, profileLoading, navigate])

  const { data: jobs = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['jobs', profile?.keywords, profile?.latitude, profile?.longitude, profile?.search_radius_km],
    queryFn: async () => {
      const keywords = profile?.keywords ?? []
      const { data, error } = await supabase.rpc('search_jobs_for_profile', {
        p_keywords:  keywords.length > 0 ? keywords : null,
        p_job_types: null,
        p_lat:       profile?.latitude ?? null,
        p_lng:       profile?.longitude ?? null,
        p_radius_km: profile?.search_radius_km ?? 200,
        p_limit:     200,
        p_offset:    0,
      })
      if (error) throw error
      setLastUpdated(new Date())
      return (data ?? []) as (Job & { keyword_hits: number; distance_km: number | null })[]
    },
    enabled: !profileLoading,
  })

  const { data: aiScores = [] } = useQuery<JobScore[]>({
    queryKey: ['job_scores', user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data } = await supabase
        .from('job_scores')
        .select('*')
        .eq('profile_id', user.id)
      return data ?? []
    },
    enabled: !!user,
  })

  const aiScoreMap = Object.fromEntries(aiScores.map(s => [s.job_id, s]))

  const { data: applications = [] } = useQuery({
    queryKey: ['applications', user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase.from('applications').select('job_id').eq('profile_id', user.id)
      if (error) throw error
      return data as Pick<Application, 'job_id'>[]
    },
    enabled: !!user,
  })

  const savedJobIds = new Set(applications.map(a => a.job_id))

  const saveJob = useMutation({
    mutationFn: async (jobId: string) => {
      if (!user) return
      if (savedJobIds.has(jobId)) {
        await supabase.from('applications').delete().eq('profile_id', user.id).eq('job_id', jobId)
      } else {
        await supabase.from('applications').insert({ profile_id: user.id, job_id: jobId, status: 'salvo' })
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['applications', user?.id] }),
  })

  const computeScore = (job: Job): number => {
    let score = 50
    const keywords = profile?.keywords ?? []
    const text = `${job.title} ${job.description ?? ''}`.toLowerCase()
    keywords.forEach(kw => { if (text.includes(kw.toLowerCase())) score += 10 })
    if (profile?.job_types?.includes(job.job_type ?? '')) score += 15
    return Math.min(score, 100)
  }

  const enriched = jobs.map(job => {
    const ai = aiScoreMap[job.id]
    const j = job as Job & { keyword_hits?: number; distance_km?: number | null }
    return {
      ...job,
      match_score: computeScore(job),
      ai_score: ai?.score,
      ai_reason: ai?.reason ?? undefined,
      distance: j.distance_km ?? (
        profile?.latitude && profile?.longitude && job.latitude && job.longitude
          ? haversineDistanceKm(profile.latitude, profile.longitude, job.latitude, job.longitude)
          : undefined
      ),
    }
  })

  const radius = profile?.search_radius_km ?? 50
  const hasZone = !!(profile?.latitude && profile?.longitude)

  const SOURCE_LABELS: Record<string, string> = {
    gupy: 'Gupy', indeed: 'Indeed', clickmuseus: 'ClickMuseus',
    remotive: 'Remotive', remoteok: 'RemoteOK', adzuna: 'Adzuna',
    jsearch: 'JSearch', vagas_com_br: 'Vagas.com.br', empregos_com_br: 'Empregos.com.br',
    concursosnobrasil: 'Concursos BR', concursopublico_br: 'Concurso Público',
    pci_concursos: 'PCI', cebraspe: 'CEBRASPE', fcc: 'FCC', concursos_com_br: 'Concursos BR',
  }

  const availableSources = ['todas', ...Array.from(new Set(enriched.map(j => j.source).filter(Boolean)))]

  const filtered = enriched
    .filter(j => filterType === 'todos' || j.job_type === filterType)
    .filter(j => filterSource === 'todas' || j.source === filterSource)
    .filter(j => !search || `${j.title} ${j.organization ?? ''} ${j.city ?? ''}`.toLowerCase().includes(search.toLowerCase()))
    .filter(j => {
      if (!onlyZone || !hasZone) return true
      if (j.distance === undefined) return true
      return j.distance <= radius
    })
    .sort((a, b) => {
      if (sortBy === 'distance') {
        if (a.distance === undefined && b.distance === undefined) return 0
        if (a.distance === undefined) return 1
        if (b.distance === undefined) return -1
        return a.distance - b.distance
      }
      if (sortBy === 'date') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      // Score: AI score tem prioridade sobre score básico
      const scoreA = a.ai_score ?? a.match_score ?? 0
      const scoreB = b.ai_score ?? b.match_score ?? 0
      return scoreB - scoreA
    })

  // Categorias dinâmicas baseadas nas vagas disponíveis (remove categorias sem vagas)
  const availableTypes = ['todos', ...Array.from(new Set(enriched.map(j => j.job_type).filter(Boolean))) as string[]]
  const typeLabels: Record<string, string> = {
    todos: 'Todos', concurso: 'Concurso', clt: 'CLT', pj: 'PJ',
    temporario: 'Temporário', outro: 'Outro',
  }
  const typeOptions = availableTypes.filter(t => t === 'todos' || typeLabels[t])

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      {/* Barra de busca */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por cargo, empresa ou cidade..."
            className="input pl-10"
          />
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="btn-ghost flex items-center gap-2 shrink-0"
          title="Atualizar vagas"
        >
          <RefreshCw size={15} className={cn(isFetching && 'animate-spin')} />
          <span className="hidden sm:inline">
            {isFetching ? 'Atualizando...' : lastUpdated ? `Atualizado ${_timeAgo(lastUpdated)}` : 'Atualizar'}
          </span>
        </button>
      </div>

      {/* Filtros por tipo */}
      <div className="flex gap-2 flex-wrap items-center">
        {typeOptions.map(t => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
              filterType === t
                ? 'bg-brand-600 border-brand-600 text-white'
                : 'bg-surface-card border-surface-border text-gray-400 hover:text-white',
            )}
          >
            {typeLabels[t] ?? t}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-3">
          {/* Filtro por fonte */}
          <select
            value={filterSource}
            onChange={e => setFilterSource(e.target.value)}
            className="text-xs bg-surface-card border border-surface-border rounded-lg px-2 py-1.5 text-gray-400 focus:outline-none focus:border-brand-500"
          >
            {availableSources.map(s => (
              <option key={s} value={s}>{s === 'todas' ? 'Todas as fontes' : (SOURCE_LABELS[s] ?? s)}</option>
            ))}
          </select>

          {/* Ordenação */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="text-xs bg-surface-card border border-surface-border rounded-lg px-2 py-1.5 text-gray-400 focus:outline-none focus:border-brand-500"
          >
            <option value="score">Match</option>
            <option value="distance">Distância</option>
            <option value="date">Mais recente</option>
          </select>

          {/* Toggle zona */}
          {hasZone && (
            <button
              onClick={() => setOnlyZone(v => !v)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                onlyZone
                  ? 'bg-brand-600 border-brand-600 text-white'
                  : 'bg-surface-card border-surface-border text-gray-400 hover:text-white',
              )}
            >
              <MapPin size={11} />
              Minha zona ({radius} km)
            </button>
          )}

          <span className="text-xs text-gray-600">{filtered.length} vagas</span>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-surface-muted flex items-center justify-center mx-auto mb-4">
            <Search size={20} className="text-gray-500" />
          </div>
          <p className="text-white font-medium mb-1">Nenhuma vaga encontrada</p>
          <p className="text-gray-500 text-sm">
            Configure sua zona de busca e aguarde o radar coletar novas oportunidades.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(job => (
            <JobCard
              key={job.id}
              job={job}
              saved={savedJobIds.has(job.id)}
              onSave={() => saveJob.mutate(job.id)}
              onClick={() => setSelectedJob(job)}
              showFirstJobBadge={!!profile?.first_job}
            />
          ))}
        </div>
      )}

      {selectedJob && (
        <JobModal
          job={selectedJob}
          saved={savedJobIds.has(selectedJob.id)}
          onSave={() => saveJob.mutate(selectedJob.id)}
          onClose={() => setSelectedJob(null)}
        />
      )}
    </div>
  )
}
