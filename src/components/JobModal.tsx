import { useEffect, useRef } from 'react'
import {
  X, MapPin, Building2, Calendar, ExternalLink,
  Bookmark, Zap, Sparkles, Clock, DollarSign, Tag,
} from 'lucide-react'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import type { Job } from '@/types/database'

const JOB_TYPE_COLORS: Record<string, string> = {
  concurso:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
  clt:       'bg-green-500/10 text-green-400 border-green-500/20',
  pj:        'bg-purple-500/10 text-purple-400 border-purple-500/20',
  temporario:'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  outro:     'bg-gray-500/10 text-gray-400 border-gray-500/20',
}
const TYPE_LABELS: Record<string, string> = {
  concurso: 'Concurso', clt: 'CLT', pj: 'PJ', temporario: 'Temporário', outro: 'Outro',
}

const SOURCE_LABELS: Record<string, string> = {
  gupy: 'Gupy', indeed: 'Indeed', clickmuseus: 'ClickMuseus',
  remotive: 'Remotive', remoteok: 'RemoteOK', adzuna: 'Adzuna',
  jsearch: 'JSearch', vagas_com_br: 'Vagas.com.br', empregos_com_br: 'Empregos.com.br',
  concursosnobrasil: 'Concursos BR', concursopublico_br: 'Concurso Público',
  pci_concursos: 'PCI', cebraspe: 'CEBRASPE', fcc: 'FCC',
}

type EnrichedJob = Job & {
  distance?: number
  match_score?: number
  ai_score?: number
  ai_reason?: string
}

interface Props {
  job: EnrichedJob
  saved: boolean
  onSave: () => void
  onClose: () => void
}

function deadlineBadge(deadline: string | null) {
  if (!deadline) return null
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000)
  if (days < 0) return <span className="text-xs text-red-400 font-medium">Encerrado</span>
  if (days === 0) return <span className="text-xs text-red-400 font-bold animate-pulse">Encerra hoje!</span>
  if (days <= 3) return <span className="text-xs text-orange-400 font-bold">⚠ {days}d restantes</span>
  if (days <= 7) return <span className="text-xs text-yellow-400 font-medium">{days}d restantes</span>
  return <span className="text-xs text-gray-500">{days}d restantes</span>
}

export default function JobModal({ job, saved, onSave, onClose }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null)

  // Fechar com ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Travar scroll do body
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Paragrafos da descrição
  const descParagraphs = (job.description ?? '').split(/\n{2,}|\r\n{2,}/).filter(Boolean)

  return (
    <div
      ref={backdropRef}
      onClick={e => { if (e.target === backdropRef.current) onClose() }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
    >
      <div className="relative w-full sm:max-w-2xl max-h-[92dvh] bg-surface-card border border-surface-border rounded-t-2xl sm:rounded-2xl flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-surface-border shrink-0">
          <div className="flex-1 min-w-0">
            {/* Badges */}
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {job.job_type && (
                <span className={cn('badge border text-xs', JOB_TYPE_COLORS[job.job_type] ?? JOB_TYPE_COLORS.outro)}>
                  {TYPE_LABELS[job.job_type] ?? job.job_type}
                </span>
              )}
              {job.source && (
                <span className="badge border bg-surface-muted text-gray-400 border-surface-border text-xs">
                  {SOURCE_LABELS[job.source] ?? job.source}
                </span>
              )}
              {job.ai_score !== undefined ? (
                <div className="relative group/tip">
                  <div className={cn(
                    'flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold',
                    job.ai_score >= 80 ? 'text-green-400 bg-green-500/10 border-green-500/20'
                      : job.ai_score >= 60 ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
                      : 'text-orange-400 bg-orange-500/10 border-orange-500/20',
                  )}>
                    <Sparkles size={11} /> {job.ai_score}% <span className="opacity-60 text-[10px]">IA</span>
                  </div>
                  {job.ai_reason && (
                    <div className="absolute top-full left-0 mt-1 w-60 bg-gray-900 border border-surface-border rounded-xl p-3 text-xs text-gray-300 shadow-xl z-10 hidden group-hover/tip:block">
                      <p className="font-medium text-brand-400 mb-1 flex items-center gap-1"><Sparkles size={10} /> Análise IA</p>
                      {job.ai_reason}
                    </div>
                  )}
                </div>
              ) : job.match_score !== undefined && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold text-gray-400 bg-gray-500/10 border-gray-500/20">
                  <Zap size={11} /> {Math.round(job.match_score)}%
                </div>
              )}
            </div>

            <h2 className="text-white font-bold text-base leading-snug">{job.title}</h2>

            {/* Meta */}
            <div className="flex flex-wrap gap-3 mt-2">
              {job.organization && (
                <span className="flex items-center gap-1.5 text-gray-400 text-xs">
                  <Building2 size={12} /> {job.organization}
                </span>
              )}
              {(job.city || job.state) && (
                <span className="flex items-center gap-1.5 text-gray-400 text-xs">
                  <MapPin size={12} />
                  {[job.city, job.state].filter(Boolean).join(', ')}
                  {job.distance !== undefined && (
                    <span className="text-gray-600"> · {Math.round(job.distance)} km</span>
                  )}
                </span>
              )}
              {job.published_at && (
                <span className="flex items-center gap-1.5 text-gray-500 text-xs">
                  <Clock size={12} /> {formatDate(job.published_at)}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-gray-500 hover:text-white hover:bg-surface-muted flex items-center justify-center transition-all shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Salary + deadline strip */}
        {(job.salary_min || job.salary_max || job.deadline) && (
          <div className="flex items-center gap-4 px-5 py-3 bg-surface-hover border-b border-surface-border shrink-0 flex-wrap">
            {(job.salary_min || job.salary_max) && (
              <span className="flex items-center gap-1.5 text-brand-400 font-semibold text-sm">
                <DollarSign size={14} />
                {formatCurrency(job.salary_min)}
                {job.salary_max && ` – ${formatCurrency(job.salary_max)}`}
              </span>
            )}
            {job.deadline && (
              <span className="flex items-center gap-1.5">
                <Calendar size={13} className="text-gray-500" />
                <span className="text-gray-400 text-xs">Prazo: {formatDate(job.deadline)}</span>
                <span className="ml-1">{deadlineBadge(job.deadline)}</span>
              </span>
            )}
          </div>
        )}

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 min-h-0">

          {/* Descrição */}
          {job.description ? (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Tag size={11} /> Sobre a vaga
              </h3>
              <div className="space-y-3">
                {descParagraphs.length > 1
                  ? descParagraphs.map((p, i) => (
                    <p key={i} className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{p.trim()}</p>
                  ))
                  : <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{job.description}</p>
                }
              </div>
            </div>
          ) : (
            <p className="text-gray-600 text-sm italic">Descrição não disponível — veja o link original para mais detalhes.</p>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-3 p-4 border-t border-surface-border shrink-0 bg-surface-card rounded-b-2xl">
          <button
            onClick={onSave}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all',
              saved
                ? 'bg-brand-600/20 text-brand-400 border-brand-600/30'
                : 'bg-surface-muted text-gray-400 border-surface-border hover:text-white',
            )}
          >
            <Bookmark size={14} fill={saved ? 'currentColor' : 'none'} />
            {saved ? 'Salvo' : 'Salvar'}
          </button>

          {job.source_url && (
            <a
              href={job.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition-all"
            >
              Ver vaga original
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
