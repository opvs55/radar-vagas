import { NavLink } from 'react-router-dom'
import { Radar, User, MapPin, Briefcase, Sparkles, BarChart2, GraduationCap } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/radar',         icon: Radar,     label: 'Radar' },
  { to: '/zona-de-busca', icon: MapPin,     label: 'Zona de Busca' },
  { to: '/candidaturas',  icon: Briefcase,  label: 'Candidaturas' },
  { to: '/carreira',      icon: Sparkles,   label: 'Carreira IA' },
  { to: '/mercado',       icon: BarChart2,      label: 'Mercado' },
  { to: '/cursos',        icon: GraduationCap,  label: 'Cursos' },
  { to: '/perfil',        icon: User,       label: 'Perfil' },
]

export default function Sidebar() {
  return (
    <aside className="w-64 flex flex-col bg-surface-card border-r border-surface-border shrink-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-surface-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shadow-glow">
            <Radar size={16} className="text-white" />
          </div>
          <div>
            <span className="text-white font-semibold text-sm tracking-tight">Radar</span>
            <span className="text-brand-400 font-semibold text-sm tracking-tight"> Vagas</span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-brand-600/15 text-brand-400 border border-brand-600/25'
                  : 'text-gray-400 hover:text-white hover:bg-surface-muted',
              )
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-surface-border">
        <p className="text-xs text-gray-600 text-center">v1.0 · MVP</p>
      </div>
    </aside>
  )
}
