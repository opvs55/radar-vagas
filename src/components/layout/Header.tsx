import { useLocation } from 'react-router-dom'
import { Bell, LogOut } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/radar':         { title: 'Radar de Vagas',    subtitle: 'Oportunidades filtradas pelo seu perfil' },
  '/zona-de-busca': { title: 'Zona de Busca',      subtitle: 'Configure sua área geográfica de interesse' },
  '/candidaturas':  { title: 'Candidaturas',       subtitle: 'Acompanhe seu pipeline de vagas' },
  '/perfil':        { title: 'Perfil',             subtitle: 'Gerencie suas formações e competências' },
}

export default function Header() {
  const { pathname } = useLocation()
  const { user, signOut } = useAuth()
  const page = pageTitles[pathname] ?? { title: 'Radar Vagas', subtitle: '' }

  return (
    <header className="h-16 bg-surface-card border-b border-surface-border flex items-center justify-between px-6 shrink-0">
      <div>
        <h1 className="text-white font-semibold text-base leading-tight">{page.title}</h1>
        <p className="text-gray-500 text-xs mt-0.5">{page.subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        <button className="w-9 h-9 rounded-xl bg-surface-muted border border-surface-border flex items-center justify-center text-gray-400 hover:text-white transition-colors relative">
          <Bell size={16} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-brand-500" />
        </button>

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
