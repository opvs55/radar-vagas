import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Radar, ArrowRight, ArrowLeft, CheckCircle, Star, GraduationCap, MapPin, Sparkles } from 'lucide-react'
import { useUpdateProfile } from '@/hooks/useProfile'
import { cn } from '@/lib/utils'

const INTEREST_AREAS = [
  { id: 'design',       label: 'Design & Artes',       emoji: '🎨' },
  { id: 'tecnologia',   label: 'Tecnologia',            emoji: '💻' },
  { id: 'educacao',     label: 'Educação',              emoji: '📚' },
  { id: 'cultura',      label: 'Cultura & Museus',      emoji: '🎭' },
  { id: 'comunicacao',  label: 'Comunicação & Mídia',   emoji: '📢' },
  { id: 'saude',        label: 'Saúde',                 emoji: '🏥' },
  { id: 'administracao',label: 'Administração',         emoji: '📊' },
  { id: 'engenharia',   label: 'Engenharia',            emoji: '⚙️' },
  { id: 'juridico',     label: 'Jurídico',              emoji: '⚖️' },
  { id: 'comercial',    label: 'Vendas & Comercial',    emoji: '🤝' },
  { id: 'logistica',    label: 'Logística',             emoji: '🚚' },
  { id: 'gastronomia',  label: 'Gastronomia & Eventos', emoji: '🍽️' },
]

const EDUCATION_LEVELS = [
  { id: 'fundamental',       label: 'Ensino Fundamental' },
  { id: 'medio',             label: 'Ensino Médio' },
  { id: 'medio_incompleto',  label: 'Ensino Médio (cursando)' },
  { id: 'tecnico',           label: 'Curso Técnico' },
  { id: 'superior',          label: 'Ensino Superior' },
  { id: 'superior_cursando', label: 'Superior (cursando)' },
]

// Keywords geradas por área de interesse
const AREA_KEYWORDS: Record<string, string[]> = {
  design:        ['design', 'designer', 'UX', 'UI', 'artes visuais', 'ilustração', 'gráfico'],
  tecnologia:    ['desenvolvedor', 'programador', 'software', 'TI', 'tecnologia', 'suporte'],
  educacao:      ['educação', 'professor', 'pedagogo', 'monitor', 'tutor', 'coordenador pedagógico'],
  cultura:       ['museu', 'cultura', 'patrimônio', 'curador', 'mediador cultural', 'arte'],
  comunicacao:   ['comunicação', 'marketing', 'redação', 'jornalismo', 'social media', 'publicidade'],
  saude:         ['saúde', 'enfermagem', 'psicologia', 'nutrição', 'fisioterapia', 'técnico de saúde'],
  administracao: ['administrativo', 'gestão', 'recursos humanos', 'financeiro', 'secretaria'],
  engenharia:    ['engenharia', 'engenheiro', 'técnico', 'produção', 'civil', 'mecânica'],
  juridico:      ['direito', 'jurídico', 'advocacia', 'estágio jurídico', 'paralegal'],
  comercial:     ['vendas', 'atendimento', 'comercial', 'representante', 'consultor'],
  logistica:     ['logística', 'estoque', 'almoxarifado', 'transporte', 'supply chain'],
  gastronomia:   ['gastronomia', 'cozinha', 'eventos', 'hotelaria', 'restaurante', 'confeitaria'],
}

type Step = 'areas' | 'education' | 'location' | 'done'

export default function OnboardingFirstJobPage() {
  const navigate = useNavigate()
  const updateProfile = useUpdateProfile()

  const [step, setStep] = useState<Step>('areas')
  const [areas, setAreas] = useState<string[]>([])
  const [education, setEducation] = useState('')
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [saving, setSaving] = useState(false)

  const toggleArea = (id: string) => {
    setAreas(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : prev.length < 4 ? [...prev, id] : prev
    )
  }

  const buildKeywords = () =>
    areas.flatMap(a => AREA_KEYWORDS[a] ?? [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateProfile.mutateAsync({
        full_name:       name || undefined,
        city:            city || undefined,
        state:           state || undefined,
        first_job:       true,
        education_level: education || undefined,
        interest_areas:  areas,
        keywords:        buildKeywords(),
      })
      setStep('done')
    } catch {
      setSaving(false)
    }
  }

  const STATES = [
    'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
    'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
  ]

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center shadow-glow">
            <Radar size={18} className="text-white" />
          </div>
          <span className="text-white font-bold text-xl tracking-tight">
            Radar <span className="text-brand-400">Vagas</span>
          </span>
        </div>

        {/* Progresso */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {(['areas', 'education', 'location'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                step === s || (s === 'location' && step === 'done')
                  ? 'bg-brand-600 text-white ring-2 ring-brand-500/30'
                  : ['areas', 'education'].indexOf(s) < ['areas', 'education', 'location', 'done'].indexOf(step)
                  ? 'bg-green-600 text-white'
                  : 'bg-surface-card border border-surface-border text-gray-600',
              )}>
                {['areas', 'education'].indexOf(s) < ['areas', 'education', 'location', 'done'].indexOf(step)
                  ? '✓' : i + 1}
              </div>
              {i < 2 && <div className="w-8 h-px bg-surface-border" />}
            </div>
          ))}
        </div>

        <div className="bg-surface-card border border-surface-border rounded-2xl p-6 shadow-xl">

          {/* Step 1 — Áreas de interesse */}
          {step === 'areas' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-white mb-1">Quais áreas te interessam?</h2>
                <p className="text-gray-500 text-sm">Escolha até 4. Vamos buscar vagas compatíveis.</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {INTEREST_AREAS.map(({ id, label, emoji }) => (
                  <button
                    key={id}
                    onClick={() => toggleArea(id)}
                    className={cn(
                      'flex items-center gap-2.5 p-3 rounded-xl border text-sm font-medium text-left transition-all',
                      areas.includes(id)
                        ? 'bg-brand-600/15 border-brand-600/40 text-brand-300'
                        : 'bg-surface-hover border-surface-border text-gray-400 hover:text-white hover:border-surface-border/80',
                      areas.length >= 4 && !areas.includes(id) && 'opacity-40 cursor-not-allowed',
                    )}
                  >
                    <span className="text-lg leading-none">{emoji}</span>
                    <span className="leading-tight">{label}</span>
                  </button>
                ))}
              </div>

              <button
                disabled={areas.length === 0}
                onClick={() => setStep('education')}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continuar <ArrowRight size={15} />
              </button>
            </div>
          )}

          {/* Step 2 — Escolaridade */}
          {step === 'education' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                  <GraduationCap size={18} className="text-brand-400" />
                  Qual é sua escolaridade?
                </h2>
                <p className="text-gray-500 text-sm">Isso ajuda a filtrar vagas compatíveis com seu nível de formação.</p>
              </div>

              <div className="space-y-2">
                {EDUCATION_LEVELS.map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setEducation(id)}
                    className={cn(
                      'w-full flex items-center justify-between p-3.5 rounded-xl border text-sm font-medium transition-all text-left',
                      education === id
                        ? 'bg-brand-600/15 border-brand-600/40 text-white'
                        : 'bg-surface-hover border-surface-border text-gray-400 hover:text-white',
                    )}
                  >
                    {label}
                    {education === id && <CheckCircle size={15} className="text-brand-400 shrink-0" />}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <button onClick={() => setStep('areas')} className="btn-ghost flex items-center gap-1.5">
                  <ArrowLeft size={14} /> Voltar
                </button>
                <button
                  disabled={!education}
                  onClick={() => setStep('location')}
                  className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Continuar <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Localização */}
          {step === 'location' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                  <MapPin size={18} className="text-brand-400" />
                  Onde você mora?
                </h2>
                <p className="text-gray-500 text-sm">Vamos priorizar vagas na sua região.</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">Seu nome (opcional)</label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Como prefere ser chamado?"
                    className="input"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 mb-1.5 block">Cidade</label>
                    <input
                      value={city}
                      onChange={e => setCity(e.target.value)}
                      placeholder="Ex: São Paulo"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block">Estado</label>
                    <select
                      value={state}
                      onChange={e => setState(e.target.value)}
                      className="input"
                    >
                      <option value="">UF</option>
                      {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setStep('education')} className="btn-ghost flex items-center gap-1.5">
                  <ArrowLeft size={14} /> Voltar
                </button>
                <button
                  disabled={saving}
                  onClick={handleSave}
                  className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {saving
                    ? <><Sparkles size={15} className="animate-pulse" /> Salvando...</>
                    : <><Star size={15} /> Ver minhas vagas</>
                  }
                </button>
              </div>

              <button
                onClick={handleSave}
                className="text-xs text-gray-600 hover:text-gray-400 transition-colors w-full text-center"
              >
                Pular localização por agora
              </button>
            </div>
          )}

          {/* Done */}
          {step === 'done' && (
            <div className="text-center space-y-5 py-4">
              <div className="w-16 h-16 rounded-2xl bg-green-500/15 flex items-center justify-center mx-auto">
                <CheckCircle size={28} className="text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-2">
                  {name ? `Tudo pronto, ${name.split(' ')[0]}!` : 'Tudo pronto!'}
                </h2>
                <p className="text-gray-400 text-sm">
                  Seu radar está configurado para vagas de{' '}
                  <span className="text-brand-400">primeiro emprego</span> nas áreas:{' '}
                  <span className="text-gray-300">
                    {areas.map(a => INTEREST_AREAS.find(i => i.id === a)?.label).join(', ')}
                  </span>
                </p>
              </div>

              <div className="p-4 rounded-xl bg-brand-600/10 border border-brand-500/20 text-left space-y-2">
                <p className="text-brand-300 text-xs font-semibold uppercase tracking-wider">O que vamos mostrar</p>
                <ul className="space-y-1.5 text-sm text-gray-400">
                  <li className="flex items-center gap-2"><CheckCircle size={13} className="text-green-500 shrink-0" /> Vagas sem exigência de experiência</li>
                  <li className="flex items-center gap-2"><CheckCircle size={13} className="text-green-500 shrink-0" /> Estágios e jovem aprendiz</li>
                  <li className="flex items-center gap-2"><CheckCircle size={13} className="text-green-500 shrink-0" /> Vagas compatíveis com sua escolaridade</li>
                  <li className="flex items-center gap-2"><CheckCircle size={13} className="text-green-500 shrink-0" /> Oportunidades nas suas áreas de interesse</li>
                </ul>
              </div>

              <button
                onClick={() => navigate('/radar')}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                Ver minhas vagas <ArrowRight size={15} />
              </button>
            </div>
          )}
        </div>

        {/* Link para fluxo completo */}
        {step !== 'done' && (
          <p className="text-center text-xs text-gray-700 mt-4">
            Tem currículo?{' '}
            <button
              onClick={() => navigate('/onboarding')}
              className="text-brand-400 hover:text-brand-300 underline underline-offset-2"
            >
              Fazer upload do PDF
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
