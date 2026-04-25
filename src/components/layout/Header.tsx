import { useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { Bell, LogOut, Briefcase, GraduationCap, Clock, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

const LAST_VISIT_KEY = 'radar_last_visit'

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/radar':         { title: 'Radar de Vagas',    subtitle: 'Oportunidades filtradas pelo seu perfil' },
  '/zona-de-busca': { title: 'Zona de Busca',      subtitle: 'Configure sua área geográfica de interesse' },
  '/candidaturas':  { title: 'Candidaturas',       subtitle: 'Acompanhe seu pipeline de vagas' },
  '/perfil':        { title: 'Perfil',             subtitle: 'Gerencie suas formações e competências' },
  '/carreira':      { title: 'Carreira IA',        subtitle: 'Análise inteligente do seu perfil' },
  '/mercado':       { title: 'Mercado',            subtitle: 'Termômetro do mercado de trabalho' },
  '/cursos':        { title: 'Cursos & Inscrições', subtitle: 'Cursos gratuitos e abertos para você' },
}

function useNotifications() {
  const [lastVisit] = useState<string>(() => {
    const stored = localStorage.getItem(LAST_VISIT_KEY)
    // Atualizar para agora a cada vez que abre
    const now = new Date().toISOString()
    localStorage.setItem(LAST_VISIT_KEY, now)
    return stored ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  })

  const { data: newJobs = 0 } = useQuery({
    queryKey: ['notif_new_jobs', lastVisit],
    queryFn: async () => {
      const { count } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .gt('created_at', lastVisit)
      return count ?? 0
    },
    staleTime: 5 * 60_000,
  })

  const { data: deadlineSoon = [] } = useQuery({
    queryKey: ['notif_deadlines'],
    queryFn: async () => {
      const in3days = new Date(Date.now() + 3 * 86_400_000).toISOString().split('T')[0]
      const today   = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('jobs')
        .select('id, title, deadline')
        .gte('deadline', today)
        .lte('deadline', in3days)
        .limit(5)
      return data ?? []
    },
    staleTime: 10 * 60_000,
  })

  const total = (newJobs > 0 ? 1 : 0) + (deadlineSoon.length > 0 ? 1 : 0)
  return { newJobs, deadlineSoon, total, lastVisit }
}

export default function Header() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const page = pageTitles[pathname] ?? { title: 'Radar Vagas', subtitle: '' }
  const { newJobs, deadlineSoon, total } = useNotifications()
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Fechar ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <header className="h-16 bg-surface-card border-b border-surface-border flex items-center justify-between px-6 shrink-0">
      <div>
        <h1 className="text-white font-semibold text-base leading-tight">{page.title}</h1>
        <p className="text-gray-500 text-xs mt-0.5">{page.subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        {/* Sino com dropdown */}
        <div className="relative" ref={panelRef}>
          <button
            onClick={() => setOpen(v => !v)}
            className="w-9 h-9 rounded-xl bg-surface-muted border border-surface-border flex items-center justify-center text-gray-400 hover:text-white transition-colors relative"
          >
            <Bell size={16} />
            {total > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center">
                {total}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-12 w-80 bg-surface-card border border-surface-border rounded-2xl shadow-2xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
                <span className="text-white text-sm font-semibold">Notificações</span>
                <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white"><X size={14} /></button>
              </div>

              <div className="divide-y divide-surface-border max-h-72 overflow-y-auto">
                {newJobs > 0 && (
                  <button
                    onClick={() => { setOpen(false); navigate('/radar') }}
                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-surface-hover transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-brand-600/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Briefcase size={14} className="text-brand-400" />
                    </div>
                    <div>
                      <p className="text-white text-xs font-medium">{newJobs} nova{newJobs !== 1 ? 's' : ''} vaga{newJobs !== 1 ? 's' : ''} disponível{newJobs !== 1 ? 'eis' : ''}</p>
                      <p className="text-gray-500 text-xs mt-0.5">Desde sua última visita · Ver radar</p>
                    </div>
                  </button>
                )}

                {deadlineSoon.map((job: { id: string; title: string; deadline: string }) => {
                  const days = Math.ceil((new Date(job.deadline).getTime() - Date.now()) / 86_400_000)
                  return (
                    <button
                      key={job.id}
                      onClick={() => { setOpen(false); navigate('/radar') }}
                      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-surface-hover transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center shrink-0 mt-0.5">
                        <Clock size={14} className="text-orange-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-medium truncate">{job.title}</p>
                        <p className="text-orange-400 text-xs mt-0.5">
                          {days === 0 ? 'Encerra hoje!' : `Encerra em ${days} dia${days !== 1 ? 's' : ''}`}
                        </p>
                      </div>
                    </button>
                  )
                })}

                {total === 0 && (
                  <div className="px-4 py-8 text-center">
                    <GraduationCap size={24} className="text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-500 text-xs">Nenhuma notificação no momento</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5 pl-3 border-l border-surface-border">
          <div className="w-8 h-8 rounded-full bg-brand-700 flex items-center justify-center text-white text-xs font-semibold">
            {user?.email?.[0].toUpperCase() ?? 'U'}
          </div>
          <div className="hidden sm:block">
            <p className="text-white text-xs font-medium leading-tight truncate max-w-[140px]">
              {user?.email}
            </p>
          </div>
          <button
            onClick={signOut}
            className="w-8 h-8 rounded-xl text-gray-500 hover:text-red-400 hover:bg-red-400/10 flex items-center justify-center transition-colors"
            title="Sair"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </header>
  )
}
