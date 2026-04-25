import { useQuery } from '@tanstack/react-query'
import { BarChart2, MapPin, Building2, TrendingUp, Briefcase, Globe, DollarSign } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useProfile } from '@/hooks/useProfile'
import { cn } from '@/lib/utils'

const SOURCE_LABELS: Record<string, string> = {
  gupy: 'Gupy', indeed: 'Indeed', clickmuseus: 'ClickMuseus',
  remotive: 'Remotive', remoteok: 'RemoteOK', adzuna: 'Adzuna',
  jsearch: 'JSearch', vagas_com_br: 'Vagas.com.br', empregos_com_br: 'Empregos.com.br',
  concursosnobrasil: 'Concursos BR', concursopublico_br: 'Concurso Público',
  pci_concursos: 'PCI', cebraspe: 'CEBRASPE', fcc: 'FCC', concursos_com_br: 'Concursos BR',
}

const TYPE_COLORS: Record<string, string> = {
  clt:       'bg-green-500',
  concurso:  'bg-blue-500',
  pj:        'bg-purple-500',
  temporario:'bg-yellow-500',
  outro:     'bg-gray-500',
}
const TYPE_LABELS: Record<string, string> = {
  clt: 'CLT', concurso: 'Concurso', pj: 'PJ', temporario: 'Temporário', outro: 'Outro',
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string
}) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', color ?? 'bg-brand-600/15')}>
        <Icon size={18} className={color ? 'text-white' : 'text-brand-400'} />
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

function HorizontalBar({ label, value, max, color }: { label: string; value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-300 truncate max-w-[60%]">{label}</span>
        <span className="text-gray-500 font-medium">{value}</span>
      </div>
      <div className="h-2 bg-surface-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', color ?? 'bg-brand-500')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function MiniBarChart({ data }: { data: { day: string; total: number }[] }) {
  const max = Math.max(...data.map(d => d.total), 1)
  return (
    <div className="flex items-end gap-1 h-16">
      {data.map((d, i) => {
        const pct = Math.round((d.total / max) * 100)
        const date = new Date(d.day)
        const label = `${date.getDate()}/${date.getMonth() + 1}`
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div
              className="w-full bg-brand-600/60 hover:bg-brand-500 rounded-t transition-all"
              style={{ height: `${Math.max(pct, 4)}%` }}
            />
            {i % 3 === 0 && (
              <span className="text-[9px] text-gray-600">{label}</span>
            )}
            <div className="absolute bottom-full mb-1 bg-gray-900 text-white text-xs px-2 py-1 rounded shadow hidden group-hover:block whitespace-nowrap z-10">
              {label}: {d.total} vaga{d.total !== 1 ? 's' : ''}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function InsightsPage() {
  const { data: profile } = useProfile()

  const { data: summary } = useQuery({
    queryKey: ['insights_summary'],
    queryFn: async () => {
      const { data } = await supabase.rpc('insights_summary')
      return (data?.[0] ?? {}) as {
        total_jobs: number; jobs_last_7_days: number;
        with_salary: number; with_location: number; remote_jobs: number
      }
    },
  })

  const { data: byType = [] } = useQuery({
    queryKey: ['insights_by_type'],
    queryFn: async () => {
      const { data } = await supabase.rpc('insights_by_type')
      return (data ?? []) as { job_type: string; total: number }[]
    },
  })

  const { data: byCity = [] } = useQuery({
    queryKey: ['insights_by_city'],
    queryFn: async () => {
      const { data } = await supabase.rpc('insights_by_city', { p_limit: 10 })
      return (data ?? []) as { city: string; total: number }[]
    },
  })

  const { data: bySource = [] } = useQuery({
    queryKey: ['insights_by_source'],
    queryFn: async () => {
      const { data } = await supabase.rpc('insights_by_source')
      return (data ?? []) as { source: string; total: number }[]
    },
  })

  const { data: perDay = [] } = useQuery({
    queryKey: ['insights_per_day'],
    queryFn: async () => {
      const { data } = await supabase.rpc('insights_jobs_per_day', { p_days: 14 })
      return (data ?? []) as { day: string; total: number }[]
    },
  })

  const maxCity = byCity[0]?.total ?? 1
  const maxSource = bySource[0]?.total ?? 1
  const totalTypes = byType.reduce((s, t) => s + t.total, 0)
  const userCity = profile?.city ?? profile?.state

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Cabeçalho */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <BarChart2 size={20} className="text-brand-400" />
          Termômetro do Mercado
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Panorama das vagas coletadas
          {userCity && <span> · focado em <span className="text-gray-400">{userCity}</span></span>}
        </p>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Briefcase} label="Vagas no banco" value={summary?.total_jobs ?? '—'} />
        <StatCard icon={TrendingUp} label="Últimos 7 dias" value={summary?.jobs_last_7_days ?? '—'} color="bg-green-600" />
        <StatCard icon={Globe} label="Vagas remotas" value={summary?.remote_jobs ?? '—'} color="bg-purple-600" />
        <StatCard icon={DollarSign} label="Com salário" value={summary?.with_salary ?? '—'} color="bg-yellow-600" />
      </div>

      {/* Gráfico de linha temporal */}
      {perDay.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <TrendingUp size={14} className="text-brand-400" />
            Vagas coletadas por dia (14 dias)
          </h2>
          <MiniBarChart data={perDay} />
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">

        {/* Por tipo */}
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <Briefcase size={14} className="text-brand-400" />
            Por tipo de contrato
          </h2>
          <div className="space-y-3">
            {byType.map(({ job_type, total }) => (
              <div key={job_type} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2">
                    <span className={cn('w-2 h-2 rounded-full', TYPE_COLORS[job_type] ?? 'bg-gray-500')} />
                    <span className="text-gray-300">{TYPE_LABELS[job_type] ?? job_type}</span>
                  </span>
                  <span className="text-gray-500 font-medium">
                    {total} <span className="text-gray-700">({totalTypes > 0 ? Math.round((total / totalTypes) * 100) : 0}%)</span>
                  </span>
                </div>
                <div className="h-2 bg-surface-muted rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', TYPE_COLORS[job_type] ?? 'bg-gray-500')}
                    style={{ width: `${totalTypes > 0 ? (total / totalTypes) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Por fonte */}
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <Building2 size={14} className="text-brand-400" />
            Por fonte
          </h2>
          <div className="space-y-3">
            {bySource.map(({ source, total }) => (
              <HorizontalBar
                key={source}
                label={SOURCE_LABELS[source] ?? source}
                value={total}
                max={maxSource}
                color="bg-brand-500"
              />
            ))}
          </div>
        </div>

        {/* Por cidade */}
        <div className="card p-5 space-y-4 sm:col-span-2">
          <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <MapPin size={14} className="text-brand-400" />
            Top cidades (excluindo remoto)
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {byCity.map(({ city, total }, i) => (
              <HorizontalBar
                key={city}
                label={city}
                value={total}
                max={maxCity}
                color={i === 0 ? 'bg-brand-500' : i < 3 ? 'bg-brand-600/70' : 'bg-brand-700/50'}
              />
            ))}
          </div>
        </div>

      </div>

      {/* Nota de rodapé */}
      <p className="text-xs text-gray-700 text-center pb-2">
        Dados baseados nas {summary?.total_jobs ?? '—'} vagas coletadas pelos scrapers · atualizado diariamente
      </p>
    </div>
  )
}
