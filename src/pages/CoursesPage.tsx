import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  GraduationCap, Search, ExternalLink, Clock, MapPin,
  DollarSign, Calendar, BookOpen, Filter,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useProfile } from '@/hooks/useProfile'
import { cn, formatDate } from '@/lib/utils'

// Cursos curados — sempre exibidos como fallback
const CURATED_COURSES: Course[] = [
  { id: 'c1',  source: 'fundacao_bradesco',  source_url: 'https://www.ev.org.br/Areas/Gratuitos', title: 'Lógica de Programação', organization: 'Fundação Bradesco', description: 'Introdução ao raciocínio lógico e algoritmos para quem está começando na tecnologia.', area: 'tecnologia', level: 'básico', modality: 'online', price: 0, deadline: null, starts_at: null, duration: '20h', city: null, state: null, created_at: '' },
  { id: 'c2',  source: 'fundacao_bradesco',  source_url: 'https://www.ev.org.br/Areas/Gratuitos', title: 'Excel Básico ao Avançado', organization: 'Fundação Bradesco', description: 'Aprenda planilhas, fórmulas e automações com Excel, do básico ao avançado.', area: 'administracao', level: 'básico', modality: 'online', price: 0, deadline: null, starts_at: null, duration: '30h', city: null, state: null, created_at: '' },
  { id: 'c3',  source: 'fundacao_bradesco',  source_url: 'https://www.ev.org.br/Areas/Gratuitos', title: 'Design Gráfico', organization: 'Fundação Bradesco', description: 'Fundamentos de design gráfico: cores, tipografia, composição e ferramentas digitais.', area: 'design', level: 'básico', modality: 'online', price: 0, deadline: null, starts_at: null, duration: '40h', city: null, state: null, created_at: '' },
  { id: 'c4',  source: 'escola_virtual_gov', source_url: 'https://www.escolavirtual.gov.br/cursos', title: 'Ética no Serviço Público', organization: 'Escola Virtual Gov (MEC)', description: 'Conceitos de ética, integridade e conduta no setor público brasileiro.', area: 'administracao', level: 'básico', modality: 'online', price: 0, deadline: null, starts_at: null, duration: '20h', city: null, state: null, created_at: '' },
  { id: 'c5',  source: 'escola_virtual_gov', source_url: 'https://www.escolavirtual.gov.br/cursos', title: 'Inclusão e Diversidade', organization: 'Escola Virtual Gov (MEC)', description: 'Curso sobre equidade, diversidade e inclusão no ambiente de trabalho e social.', area: 'educacao', level: 'básico', modality: 'online', price: 0, deadline: null, starts_at: null, duration: '15h', city: null, state: null, created_at: '' },
  { id: 'c6',  source: 'sebrae',             source_url: 'https://sebrae.com.br/sites/PortalSebrae/cursosonline', title: 'Como Montar um Negócio', organization: 'Sebrae', description: 'Aprenda a estruturar seu próprio negócio: plano, modelo de negócio e mercado.', area: 'administracao', level: 'básico', modality: 'online', price: 0, deadline: null, starts_at: null, duration: '6h', city: null, state: null, created_at: '' },
  { id: 'c7',  source: 'sebrae',             source_url: 'https://sebrae.com.br/sites/PortalSebrae/cursosonline', title: 'Marketing Digital para Iniciantes', organization: 'Sebrae', description: 'Estratégias de marketing digital, redes sociais e presença online para pequenos negócios.', area: 'comunicacao', level: 'básico', modality: 'online', price: 0, deadline: null, starts_at: null, duration: '8h', city: null, state: null, created_at: '' },
  { id: 'c8',  source: 'futurelearn',        source_url: 'https://www.futurelearn.com/courses?filter_category=creative-arts-and-media&filter_availability=open', title: 'Introduction to Creative Arts', organization: 'FutureLearn', description: 'Explore painting, drawing, photography and creative expression with leading educators.', area: 'design', level: 'básico', modality: 'online', price: 0, deadline: null, starts_at: null, duration: '3 semanas', city: null, state: null, created_at: '' },
  { id: 'c9',  source: 'senai',              source_url: 'https://www.sp.senai.br/cursos-gratuitos', title: 'Manutenção de Computadores', organization: 'SENAI', description: 'Hardware, software e manutenção preventiva e corretiva de equipamentos de informática.', area: 'tecnologia', level: 'técnico', modality: 'online', price: 0, deadline: null, starts_at: null, duration: '60h', city: null, state: 'SP', created_at: '' },
  { id: 'c10', source: 'senai',              source_url: 'https://www.sp.senai.br/cursos-gratuitos', title: 'Segurança do Trabalho', organization: 'SENAI', description: 'Normas regulamentadoras, prevenção de acidentes e saúde ocupacional.', area: 'engenharia', level: 'técnico', modality: 'online', price: 0, deadline: null, starts_at: null, duration: '40h', city: null, state: 'SP', created_at: '' },
  { id: 'c11', source: 'fundacao_bradesco',  source_url: 'https://www.ev.org.br/Areas/Gratuitos', title: 'Comunicação Empresarial', organization: 'Fundação Bradesco', description: 'Técnicas de comunicação verbal, escrita e apresentação no ambiente corporativo.', area: 'comunicacao', level: 'básico', modality: 'online', price: 0, deadline: null, starts_at: null, duration: '20h', city: null, state: null, created_at: '' },
  { id: 'c12', source: 'escola_virtual_gov', source_url: 'https://www.escolavirtual.gov.br/cursos', title: 'Educação Especial e Inclusiva', organization: 'Escola Virtual Gov (MEC)', description: 'Formação para educadores e profissionais da área de educação especial e inclusão.', area: 'educacao', level: 'básico', modality: 'online', price: 0, deadline: null, starts_at: null, duration: '40h', city: null, state: null, created_at: '' },
]

interface Course {
  id: string
  source: string
  source_url: string | null
  title: string
  organization: string | null
  description: string | null
  area: string | null
  level: string | null
  modality: string | null
  price: number | null
  deadline: string | null
  starts_at: string | null
  duration: string | null
  city: string | null
  state: string | null
  created_at: string
}

const SOURCE_LABELS: Record<string, string> = {
  senai:               'SENAI',
  sebrae:              'Sebrae',
  fundacao_bradesco:   'Fund. Bradesco',
  futurelearn:         'FutureLearn',
  escola_virtual_gov:  'Gov.br / MEC',
}

const AREA_LABELS: Record<string, string> = {
  design:        '🎨 Design',
  tecnologia:    '💻 Tecnologia',
  educacao:      '📚 Educação',
  cultura:       '🎭 Cultura',
  comunicacao:   '📢 Comunicação',
  saude:         '🏥 Saúde',
  administracao: '📊 Administração',
  engenharia:    '⚙️ Engenharia',
  gastronomia:   '🍽️ Gastronomia',
  logistica:     '🚚 Logística',
  outro:         '📌 Outro',
}

const AREA_COLORS: Record<string, string> = {
  design:        'bg-pink-500/10 text-pink-400 border-pink-500/20',
  tecnologia:    'bg-blue-500/10 text-blue-400 border-blue-500/20',
  educacao:      'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  cultura:       'bg-purple-500/10 text-purple-400 border-purple-500/20',
  comunicacao:   'bg-orange-500/10 text-orange-400 border-orange-500/20',
  saude:         'bg-green-500/10 text-green-400 border-green-500/20',
  administracao: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  engenharia:    'bg-gray-500/10 text-gray-400 border-gray-500/20',
  gastronomia:   'bg-red-500/10 text-red-400 border-red-500/20',
  logistica:     'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  outro:         'bg-gray-500/10 text-gray-400 border-gray-500/20',
}

function deadlineBadge(deadline: string | null) {
  if (!deadline) return null
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000)
  if (days < 0)  return <span className="text-xs text-red-400">Encerrado</span>
  if (days === 0) return <span className="text-xs text-red-400 font-bold animate-pulse">Encerra hoje!</span>
  if (days <= 5)  return <span className="text-xs text-orange-400 font-bold">⚠ {days}d restantes</span>
  if (days <= 14) return <span className="text-xs text-yellow-400">{days}d restantes</span>
  return null
}

function CourseCard({ course }: { course: Course }) {
  const isGratuito = !course.price || course.price === 0
  return (
    <div className="card p-5 hover:border-brand-600/30 transition-all duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {course.area && (
              <span className={cn('badge border text-xs', AREA_COLORS[course.area] ?? AREA_COLORS.outro)}>
                {AREA_LABELS[course.area] ?? course.area}
              </span>
            )}
            {isGratuito && (
              <span className="badge border bg-green-500/10 text-green-400 border-green-500/20 text-xs">
                Gratuito
              </span>
            )}
            {course.modality && course.modality !== 'online' && (
              <span className="badge border bg-surface-muted text-gray-400 border-surface-border text-xs">
                {course.modality}
              </span>
            )}
            {course.level && (
              <span className="badge border bg-surface-muted text-gray-500 border-surface-border text-xs">
                {course.level}
              </span>
            )}
          </div>

          <h3 className="text-white font-semibold text-sm leading-snug">{course.title}</h3>

          <div className="flex flex-wrap gap-3 mt-2">
            {course.organization && (
              <span className="flex items-center gap-1 text-gray-400 text-xs">
                <BookOpen size={11} /> {course.organization}
              </span>
            )}
            {(course.city || course.state) && (
              <span className="flex items-center gap-1 text-gray-400 text-xs">
                <MapPin size={11} /> {[course.city, course.state].filter(Boolean).join(', ')}
              </span>
            )}
            {course.duration && (
              <span className="flex items-center gap-1 text-gray-400 text-xs">
                <Clock size={11} /> {course.duration}
              </span>
            )}
            {course.deadline && (
              <span className="flex items-center gap-1 text-gray-500 text-xs">
                <Calendar size={11} /> Inscrições até {formatDate(course.deadline)}
                <span className="ml-1">{deadlineBadge(course.deadline)}</span>
              </span>
            )}
            {course.starts_at && (
              <span className="flex items-center gap-1 text-gray-500 text-xs">
                <Calendar size={11} /> Início: {formatDate(course.starts_at)}
              </span>
            )}
          </div>

          {course.description && (
            <p className="text-gray-500 text-xs mt-2 line-clamp-2">{course.description}</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          {course.source && (
            <span className="text-[10px] text-gray-600 font-medium">
              {SOURCE_LABELS[course.source] ?? course.source}
            </span>
          )}
          {!isGratuito && course.price && (
            <span className="flex items-center gap-1 text-brand-400 text-xs font-semibold">
              <DollarSign size={11} />
              R$ {course.price.toLocaleString('pt-BR')}
            </span>
          )}
          {course.source_url && (
            <a
              href={course.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium transition-all"
            >
              Acessar <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CoursesPage() {
  const { data: profile } = useProfile()
  const [search, setSearch]         = useState('')
  const [filterArea, setFilterArea] = useState('todas')
  const [onlyFree, setOnlyFree]     = useState(false)
  const [onlyOpen, setOnlyOpen]     = useState(false)

  const { data: dbCourses = [], isLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .order('deadline', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return (data ?? []) as Course[]
    },
  })

  // Usa DB se tiver dados, senão fallback curado
  const courses = dbCourses.length > 0 ? dbCourses : CURATED_COURSES

  // Áreas presentes nos dados
  const availableAreas = ['todas', ...Array.from(new Set(courses.map(c => c.area).filter(Boolean))) as string[]]

  // Áreas do perfil para destaque
  const profileAreas = profile?.interest_areas ?? []

  const filtered = courses
    .filter(c => filterArea === 'todas' || c.area === filterArea)
    .filter(c => !onlyFree || !c.price || c.price === 0)
    .filter(c => {
      if (!onlyOpen || !c.deadline) return true
      return new Date(c.deadline) >= new Date()
    })
    .filter(c => {
      if (!search) return true
      const text = `${c.title} ${c.organization ?? ''} ${c.area ?? ''}`.toLowerCase()
      return text.includes(search.toLowerCase())
    })

  // Priorizar áreas do perfil
  const sorted = [...filtered].sort((a, b) => {
    const aMatch = profileAreas.includes(a.area ?? '') ? 0 : 1
    const bMatch = profileAreas.includes(b.area ?? '') ? 0 : 1
    return aMatch - bMatch
  })

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <GraduationCap size={20} className="text-brand-400" />
          Cursos & Inscrições
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Cursos gratuitos e abertos · atualizado pelo scraper diário
          {profileAreas.length > 0 && (
            <span className="text-brand-400"> · priorizando suas áreas de interesse</span>
          )}
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3">
        {/* Busca */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar curso ou instituição..."
            className="input pl-10"
          />
        </div>

        {/* Chips de área + toggles */}
        <div className="flex gap-2 flex-wrap items-center">
          {availableAreas.map(area => (
            <button
              key={area}
              onClick={() => setFilterArea(area)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                filterArea === area
                  ? 'bg-brand-600 border-brand-600 text-white'
                  : 'bg-surface-card border-surface-border text-gray-400 hover:text-white',
              )}
            >
              {area === 'todas' ? 'Todas as áreas' : (AREA_LABELS[area] ?? area)}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setOnlyFree(v => !v)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                onlyFree
                  ? 'bg-green-600/20 border-green-600/40 text-green-400'
                  : 'bg-surface-card border-surface-border text-gray-400 hover:text-white',
              )}
            >
              <DollarSign size={11} /> Gratuitos
            </button>
            <button
              onClick={() => setOnlyOpen(v => !v)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                onlyOpen
                  ? 'bg-brand-600/20 border-brand-600/40 text-brand-400'
                  : 'bg-surface-card border-surface-border text-gray-400 hover:text-white',
              )}
            >
              <Filter size={11} /> Inscrições abertas
            </button>
            <span className="text-xs text-gray-600">{sorted.length} cursos</span>
          </div>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-surface-muted flex items-center justify-center mx-auto mb-4">
            <GraduationCap size={20} className="text-gray-500" />
          </div>
          <p className="text-white font-medium mb-1">Nenhum curso encontrado</p>
          <p className="text-gray-500 text-sm">
            {courses.length === 0
              ? 'O scraper ainda não coletou cursos. Rode o runner.py para buscar.'
              : 'Tente remover alguns filtros.'}
          </p>
        </div>
      ) : (
        <>
          {dbCourses.length === 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600/10 border border-brand-500/20 text-xs text-brand-300">
              <GraduationCap size={13} />
              Exibindo cursos curados. O scraper populará mais opções automaticamente todo dia.
            </div>
          )}
          <div className="space-y-3">
            {sorted.map(course => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
