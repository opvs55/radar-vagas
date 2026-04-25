import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Sparkles, TrendingUp, BookOpen, Target, Lightbulb, DollarSign, RefreshCw, ChevronRight, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/hooks/useProfile'
import { careerCoachAnalysis, scoreJobsWithAI } from '@/lib/gemini'
import { cn, formatCurrency } from '@/lib/utils'
import type { Formation, Experience, Job, CareerAnalysis, JobScore } from '@/types/database'

function SectionCard({ icon: Icon, title, color, children }: {
  icon: React.ElementType
  title: string
  color: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-5">
      <div className={cn('flex items-center gap-2 mb-4', color)}>
        <Icon size={18} />
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function Pill({ text, variant = 'default' }: { text: string; variant?: 'default' | 'gap' | 'path' }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium',
      variant === 'gap' && 'bg-red-500/10 text-red-400 border border-red-500/20',
      variant === 'path' && 'bg-brand-500/10 text-brand-400 border border-brand-500/20',
      variant === 'default' && 'bg-surface-hover border border-surface-border text-gray-300',
    )}>
      {text}
    </span>
  )
}

export default function CareerPage() {
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const qc = useQueryClient()
  const [aiScoresMap, setAiScoresMap] = useState<Record<string, { score: number; reason: string }>>({})

  const { data: formations = [] } = useQuery<Formation[]>({
    queryKey: ['formations', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('formations').select('*').eq('profile_id', user!.id)
      return data ?? []
    },
    enabled: !!user,
  })

  const { data: experiences = [] } = useQuery<Experience[]>({
    queryKey: ['experiences', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('experiences').select('*').eq('profile_id', user!.id)
      return data ?? []
    },
    enabled: !!user,
  })

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ['jobs'],
    queryFn: async () => {
      const { data } = await supabase.from('jobs').select('*').order('created_at', { ascending: false }).limit(100)
      return data ?? []
    },
  })

  const { data: cachedAnalysis } = useQuery<CareerAnalysis | null>({
    queryKey: ['career_analysis', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('career_analyses')
        .select('*')
        .eq('profile_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return data as CareerAnalysis | null
    },
    enabled: !!user,
  })

  const { data: cachedScores = [] } = useQuery<JobScore[]>({
    queryKey: ['job_scores', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('job_scores')
        .select('*')
        .eq('profile_id', user!.id)
        .order('score', { ascending: false })
        .limit(20)
      return data ?? []
    },
    enabled: !!user,
  })

  const hasProfile = formations.length > 0 || experiences.length > 0 || (profile?.keywords?.length ?? 0) > 0

  const analysisMutation = useMutation({
    mutationFn: async () => {
      if (!user || !profile) throw new Error('Perfil não carregado')

      // 1. Análise de carreira
      const analysis = await careerCoachAnalysis(
        { keywords: profile.keywords, formations, experiences },
        jobs,
      )

      await supabase.from('career_analyses').insert({
        profile_id: user.id,
        ...analysis,
      })

      // 2. Score das top 20 vagas (por score básico)
      const top20 = jobs.slice(0, 20)
      if (top20.length > 0) {
        const scores = await scoreJobsWithAI(top20, { keywords: profile.keywords, formations, experiences })

        // Salvar no banco (upsert)
        await supabase.from('job_scores').upsert(
          scores.map(s => ({ profile_id: user.id, job_id: s.job_id, score: s.score, reason: s.reason })),
          { onConflict: 'profile_id,job_id' },
        )

        // Cache local para mostrar imediatamente
        const map: Record<string, { score: number; reason: string }> = {}
        scores.forEach(s => { map[s.job_id] = { score: s.score, reason: s.reason } })
        setAiScoresMap(map)
      }

      return analysis
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['career_analysis', user?.id] })
      qc.invalidateQueries({ queryKey: ['job_scores', user?.id] })
    },
  })

  const analysis = analysisMutation.data ?? cachedAnalysis
  const isLoading = analysisMutation.isPending

  // Merge scores
  const scoresMap: Record<string, { score: number; reason: string }> = {}
  cachedScores.forEach(s => { scoresMap[s.job_id] = { score: s.score, reason: s.reason ?? '' } })
  Object.assign(scoresMap, aiScoresMap)

  const topScoredJobs = jobs
    .filter(j => scoresMap[j.id])
    .sort((a, b) => (scoresMap[b.id]?.score ?? 0) - (scoresMap[a.id]?.score ?? 0))
    .slice(0, 10)

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles size={20} className="text-brand-400" />
            Conselheiro de Carreira
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Análise personalizada com IA baseada no seu currículo e no mercado atual
          </p>
        </div>
        <button
          onClick={() => analysisMutation.mutate()}
          disabled={isLoading || !hasProfile}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <RefreshCw size={14} className={cn(isLoading && 'animate-spin')} />
          {isLoading ? 'Analisando...' : analysis ? 'Reanalisar' : 'Analisar meu perfil'}
        </button>
      </div>

      {/* Sem perfil */}
      {!hasProfile && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-5 flex gap-3">
          <AlertCircle size={18} className="text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-yellow-300 font-medium">Perfil incompleto</p>
            <p className="text-xs text-yellow-400/70 mt-1">
              Adicione suas formações e experiências no <a href="/perfil" className="underline">Perfil</a> ou faça upload do currículo para ativar a análise de carreira.
            </p>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="bg-surface-card border border-surface-border rounded-xl p-8 text-center">
          <Sparkles size={32} className="text-brand-400 mx-auto mb-3 animate-pulse" />
          <p className="text-white font-medium">Analisando seu perfil...</p>
          <p className="text-sm text-gray-500 mt-1">O Gemini está avaliando seu currículo e as vagas disponíveis</p>
        </div>
      )}

      {/* Erro */}
      {analysisMutation.isError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-400">
          Erro na análise: {String(analysisMutation.error)}
        </div>
      )}

      {/* Resultado */}
      {analysis && !isLoading && (
        <>
          {/* Summary */}
          {analysis.summary && (
            <div className="bg-brand-600/10 border border-brand-500/20 rounded-xl p-5">
              <p className="text-sm text-gray-200 leading-relaxed">{analysis.summary}</p>
              {'created_at' in analysis && (
                <p className="text-xs text-gray-600 mt-3">
                  Análise gerada em {new Date((analysis as CareerAnalysis).created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          )}

          {/* Faixa salarial */}
          {analysis.salary_range && (
            <SectionCard icon={DollarSign} title="Faixa salarial estimada para seu perfil" color="text-green-400">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-xs text-gray-500">Mínimo</p>
                  <p className="text-lg font-bold text-white">{formatCurrency(analysis.salary_range.min)}</p>
                </div>
                <div className="flex-1 h-2 bg-surface-hover rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-green-500 to-brand-500 rounded-full" style={{ width: '70%' }} />
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Máximo</p>
                  <p className="text-lg font-bold text-white">{formatCurrency(analysis.salary_range.max)}</p>
                </div>
              </div>
            </SectionCard>
          )}

          {/* Grid de 4 cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <SectionCard icon={TrendingUp} title="Pontos fortes" color="text-green-400">
              <ul className="space-y-2">
                {analysis.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <ChevronRight size={14} className="text-green-400 shrink-0 mt-0.5" />
                    {s}
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard icon={AlertCircle} title="Lacunas a desenvolver" color="text-red-400">
              <div className="flex flex-wrap gap-2">
                {analysis.gaps.map((g, i) => <Pill key={i} text={g} variant="gap" />)}
              </div>
            </SectionCard>

            <SectionCard icon={BookOpen} title="Cursos recomendados" color="text-blue-400">
              <ul className="space-y-2">
                {analysis.courses.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <ChevronRight size={14} className="text-blue-400 shrink-0 mt-0.5" />
                    {c}
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard icon={Lightbulb} title="Caminhos de carreira" color="text-yellow-400">
              <div className="flex flex-wrap gap-2">
                {analysis.career_paths.map((p, i) => <Pill key={i} text={p} variant="path" />)}
              </div>
            </SectionCard>

          </div>

          {/* Plano de ação */}
          <SectionCard icon={Target} title="Plano de ação" color="text-brand-400">
            <ol className="space-y-3">
              {analysis.action_plan.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-brand-600/20 border border-brand-500/30 text-brand-400 text-xs font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <p className="text-sm text-gray-300 pt-0.5">{step}</p>
                </li>
              ))}
            </ol>
          </SectionCard>

          {/* Top vagas com AI score */}
          {topScoredJobs.length > 0 && (
            <div className="bg-surface-card border border-surface-border rounded-xl p-5">
              <h3 className="font-semibold text-sm text-white flex items-center gap-2 mb-4">
                <Sparkles size={15} className="text-brand-400" />
                Vagas com melhor compatibilidade (IA)
              </h3>
              <div className="space-y-3">
                {topScoredJobs.map(job => {
                  const s = scoresMap[job.id]
                  return (
                    <div key={job.id} className="flex items-center gap-3 p-3 bg-surface-hover rounded-lg">
                      <div className="w-10 h-10 rounded-full bg-brand-600/20 border border-brand-500/30 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-brand-400">{s.score}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{job.title}</p>
                        <p className="text-xs text-gray-500 truncate">{s.reason}</p>
                      </div>
                      {job.source_url && (
                        <a href={job.source_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-brand-400 hover:underline shrink-0">
                          Ver vaga
                        </a>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Estado inicial sem análise */}
      {!analysis && !isLoading && hasProfile && (
        <div className="bg-surface-card border border-surface-border rounded-xl p-12 text-center">
          <Sparkles size={40} className="text-brand-400/40 mx-auto mb-4" />
          <p className="text-gray-400 font-medium">Nenhuma análise gerada ainda</p>
          <p className="text-sm text-gray-600 mt-1">Clique em "Analisar meu perfil" para começar</p>
        </div>
      )}

    </div>
  )
}
