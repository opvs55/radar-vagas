import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Briefcase, MapPin, Building2, Calendar, Trash2, ChevronDown, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { cn, formatDate, formatCurrency } from '@/lib/utils'
import type { Application, ApplicationStatus } from '@/types/database'

const STATUS_CONFIG: Record<ApplicationStatus, { label: string; color: string }> = {
  salvo:        { label: 'Salvo',        color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
  inscrito:     { label: 'Inscrito',     color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  'em andamento': { label: 'Em andamento', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  aprovado:     { label: 'Aprovado',     color: 'bg-green-500/10 text-green-400 border-green-500/20' },
  reprovado:    { label: 'Reprovado',    color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  desistiu:     { label: 'Desistiu',     color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
}

const ALL_STATUSES = Object.keys(STATUS_CONFIG) as ApplicationStatus[]

const PIPELINE_COLUMNS: ApplicationStatus[] = ['salvo', 'inscrito', 'em andamento', 'aprovado']

function StatusSelect({ current, onChange }: { current: ApplicationStatus; onChange: (s: ApplicationStatus) => void }) {
  const [open, setOpen] = useState(false)
  const cfg = STATUS_CONFIG[current]
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={cn('badge border flex items-center gap-1 cursor-pointer', cfg.color)}
      >
        {cfg.label} <ChevronDown size={10} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-surface-card border border-surface-border rounded-xl shadow-card z-20 py-1 min-w-[140px]">
          {ALL_STATUSES.map(s => (
            <button
              key={s}
              onClick={() => { onChange(s); setOpen(false) }}
              className={cn(
                'w-full text-left px-3 py-2 text-xs hover:bg-surface-muted transition-colors',
                s === current ? 'text-brand-400' : 'text-gray-300',
              )}
            >
              {STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ApplicationsPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [view, setView] = useState<'lista' | 'pipeline'>('lista')
  const [filterStatus, setFilterStatus] = useState<ApplicationStatus | 'todos'>('todos')

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['applications-full', user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('applications')
        .select('*, job:jobs(*)')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Application[]
    },
    enabled: !!user,
  })

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ApplicationStatus }) => {
      const { error } = await supabase.from('applications').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['applications-full', user?.id] }),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('applications').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['applications-full', user?.id] })
      qc.invalidateQueries({ queryKey: ['applications', user?.id] })
    },
  })

  const filtered = filterStatus === 'todos'
    ? applications
    : applications.filter(a => a.status === filterStatus)

  const pipelineByStatus = (status: ApplicationStatus) =>
    applications.filter(a => a.status === status)

  const stats = ALL_STATUSES.map(s => ({
    status: s,
    count: applications.filter(a => a.status === s).length,
    ...STATUS_CONFIG[s],
  })).filter(s => s.count > 0)

  return (
    <div className="max-w-5xl mx-auto space-y-5">

      {/* Stats strip */}
      {stats.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          {stats.map(s => (
            <div key={s.status} className={cn('card px-4 py-3 flex items-center gap-2.5 cursor-pointer hover:border-brand-600/30 transition-all',
              filterStatus === s.status && 'border-brand-600/40'
            )} onClick={() => setFilterStatus(f => f === s.status ? 'todos' : s.status)}>
              <span className={cn('badge border text-xs', s.color)}>{s.label}</span>
              <span className="text-white font-bold text-lg leading-none">{s.count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Header controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-surface-card border border-surface-border rounded-xl p-1">
          {(['lista', 'pipeline'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize',
                view === v ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white',
              )}
            >
              {v === 'lista' ? 'Lista' : 'Pipeline'}
            </button>
          ))}
        </div>
        <span className="text-gray-500 text-xs">{filtered.length} candidaturas</span>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty */}
      {!isLoading && applications.length === 0 && (
        <div className="card p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-surface-muted flex items-center justify-center mx-auto mb-4">
            <Briefcase size={20} className="text-gray-500" />
          </div>
          <p className="text-white font-medium mb-1">Nenhuma candidatura ainda</p>
          <p className="text-gray-500 text-sm">Salve vagas no Radar para acompanhá-las aqui.</p>
        </div>
      )}

      {/* Lista view */}
      {!isLoading && view === 'lista' && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map(app => {
            const job = app.job
            if (!job) return null
            return (
              <div key={app.id} className="card p-5 hover:border-brand-600/20 transition-all">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusSelect
                        current={app.status}
                        onChange={s => updateStatus.mutate({ id: app.id, status: s })}
                      />
                      {app.match_score != null && (
                        <span className="text-xs text-gray-600">Match: <strong className="text-brand-400">{Math.round(app.match_score)}%</strong></span>
                      )}
                    </div>
                    <h3 className="text-white font-semibold text-sm line-clamp-1 mt-1.5">{job.title}</h3>
                    <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                      {job.organization && (
                        <span className="flex items-center gap-1 text-gray-400 text-xs"><Building2 size={11} />{job.organization}</span>
                      )}
                      {(job.city || job.state) && (
                        <span className="flex items-center gap-1 text-gray-400 text-xs"><MapPin size={11} />{[job.city, job.state].filter(Boolean).join(', ')}</span>
                      )}
                      {job.deadline && (
                        <span className="flex items-center gap-1 text-gray-400 text-xs"><Calendar size={11} />até {formatDate(job.deadline)}</span>
                      )}
                    </div>
                    {(job.salary_min || job.salary_max) && (
                      <p className="text-brand-400 text-xs font-medium mt-1.5">
                        {formatCurrency(job.salary_min)}{job.salary_max ? ` – ${formatCurrency(job.salary_max)}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {job.source_url && (
                      <a href={job.source_url} target="_blank" rel="noopener noreferrer"
                        className="w-8 h-8 rounded-lg text-gray-600 hover:text-white hover:bg-surface-muted flex items-center justify-center transition-all">
                        <ExternalLink size={14} />
                      </a>
                    )}
                    <button
                      onClick={() => remove.mutate(app.id)}
                      className="w-8 h-8 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-400/10 flex items-center justify-center transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pipeline view */}
      {!isLoading && view === 'pipeline' && applications.length > 0 && (
        <div className="grid grid-cols-4 gap-4 pb-4">
          {PIPELINE_COLUMNS.map(status => {
            const cols = pipelineByStatus(status)
            const cfg = STATUS_CONFIG[status]
            return (
              <div key={status} className="card p-4">
                <div className="flex items-center justify-between mb-4">
                  <span className={cn('badge border text-xs', cfg.color)}>{cfg.label}</span>
                  <span className="text-gray-600 text-xs font-medium">{cols.length}</span>
                </div>
                <div className="space-y-2">
                  {cols.map(app => {
                    const job = app.job
                    if (!job) return null
                    return (
                      <div key={app.id} className="bg-surface-muted border border-surface-border rounded-xl p-3 hover:border-brand-600/30 transition-all cursor-default">
                        <p className="text-white text-xs font-medium line-clamp-2 leading-snug">{job.title}</p>
                        {job.organization && (
                          <p className="text-gray-500 text-xs mt-1 truncate">{job.organization}</p>
                        )}
                        {job.deadline && (
                          <p className="text-gray-600 text-xs mt-1.5 flex items-center gap-1">
                            <Calendar size={10} /> {formatDate(job.deadline)}
                          </p>
                        )}
                      </div>
                    )
                  })}
                  {cols.length === 0 && (
                    <p className="text-gray-700 text-xs text-center py-4">—</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
