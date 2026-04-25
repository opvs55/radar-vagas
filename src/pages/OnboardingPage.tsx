import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Radar, Sparkles, ArrowRight, CheckCircle, FileText, User, Star } from 'lucide-react'
import ResumeUpload from '@/components/ResumeUpload'
import {
  useUpdateProfile,
  useAddFormation,
  useAddExperience,
} from '@/hooks/useProfile'
import type { ParsedResume } from '@/lib/gemini'
import { cn } from '@/lib/utils'

type Step = 'welcome' | 'upload' | 'importing' | 'done'

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('welcome')
  const [parsed, setParsed] = useState<ParsedResume | null>(null)
  const [importMsg, setImportMsg] = useState('')

  const updateProfile = useUpdateProfile()
  const addFormation = useAddFormation()
  const addExperience = useAddExperience()

  const handleParsed = (data: ParsedResume) => {
    setParsed(data)
  }

  const handleImport = async () => {
    if (!parsed) return
    setStep('importing')
    try {
      await updateProfile.mutateAsync({
        full_name: parsed.full_name ?? undefined,
        city: parsed.city ?? undefined,
        state: parsed.state ?? undefined,
        keywords: parsed.keywords.length > 0 ? parsed.keywords : undefined,
      })

      for (const f of parsed.formations) {
        await addFormation.mutateAsync({
          degree: f.degree,
          field: f.field,
          institution: f.institution ?? null,
          year_end: f.year_end ?? null,
          status: f.status,
        })
      }

      for (const e of parsed.experiences) {
        await addExperience.mutateAsync({
          title: e.title,
          organization: e.organization ?? null,
          description: e.description ?? null,
          start_date: e.start_date ?? null,
          end_date: null,
          current: e.current,
        })
      }

      setImportMsg(
        `${parsed.formations.length} formações · ${parsed.experiences.length} experiências · ${parsed.keywords.length} competências`
      )
      setStep('done')
    } catch {
      setImportMsg('Erro ao salvar. Tente novamente.')
      setStep('upload')
    }
  }

  const skipToRadar = () => navigate('/radar')

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

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {(['welcome', 'upload', 'done'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                step === s || (s === 'done' && step === 'importing')
                  ? 'bg-brand-600 text-white ring-2 ring-brand-500/30'
                  : ['welcome', 'upload'].indexOf(s) < ['welcome', 'upload', 'done'].indexOf(step)
                  ? 'bg-green-600 text-white'
                  : 'bg-surface-card border border-surface-border text-gray-600',
              )}>
                {['welcome', 'upload'].indexOf(s) < ['welcome', 'upload', 'done'].indexOf(step)
                  ? '✓' : i + 1}
              </div>
              {i < 2 && <div className="w-8 h-px bg-surface-border" />}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-surface-card border border-surface-border rounded-2xl p-7 shadow-xl">

          {/* Step: Welcome */}
          {step === 'welcome' && (
            <div className="text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-brand-600/15 flex items-center justify-center mx-auto">
                <Sparkles size={28} className="text-brand-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white mb-2">Bem-vindo ao Radar Vagas</h1>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Encontramos vagas personalizadas para o <strong className="text-white">seu perfil</strong> — educação, cultura, design, tecnologia e muito mais.
                </p>
              </div>

              <div className="space-y-3 text-left">
                {[
                  { icon: FileText, text: 'Envie seu currículo em PDF — a IA extrai tudo automaticamente' },
                  { icon: Sparkles, text: 'O Gemini analisa seu perfil e encontra as melhores vagas' },
                  { icon: Radar, text: 'Seu radar pessoal de vagas fica pronto em segundos' },
                ].map(({ icon: Icon, text }, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-surface-hover">
                    <div className="w-7 h-7 rounded-lg bg-brand-600/15 flex items-center justify-center shrink-0">
                      <Icon size={14} className="text-brand-400" />
                    </div>
                    <p className="text-sm text-gray-300">{text}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <button
                  onClick={() => setStep('upload')}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  Enviar meu currículo
                  <ArrowRight size={16} />
                </button>
                <button
                  onClick={() => navigate('/onboarding/primeiro-emprego')}
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border border-surface-border bg-surface-hover text-gray-300 hover:text-white text-sm font-medium transition-all"
                >
                  <Star size={14} className="text-yellow-400" />
                  Estou buscando meu primeiro emprego
                </button>
                <button
                  onClick={skipToRadar}
                  className="text-sm text-gray-600 hover:text-gray-400 transition-colors py-1"
                >
                  Pular por agora e explorar as vagas
                </button>
              </div>
            </div>
          )}

          {/* Step: Upload */}
          {(step === 'upload') && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-white mb-1">Envie seu currículo</h2>
                <p className="text-gray-500 text-sm">O Gemini vai ler e extrair automaticamente suas informações.</p>
              </div>

              <ResumeUpload onParsed={handleParsed} />

              {parsed && (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                    <p className="text-green-400 font-medium text-sm flex items-center gap-2 mb-2">
                      <CheckCircle size={15} />
                      Currículo lido com sucesso!
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[
                        { label: 'Formações', value: parsed.formations.length },
                        { label: 'Experiências', value: parsed.experiences.length },
                        { label: 'Competências', value: parsed.keywords.length },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-surface-card rounded-lg p-2">
                          <p className="text-white font-bold text-lg">{value}</p>
                          <p className="text-gray-500 text-xs">{label}</p>
                        </div>
                      ))}
                    </div>
                    {parsed.full_name && (
                      <p className="text-gray-400 text-xs mt-2 flex items-center gap-1">
                        <User size={11} /> {parsed.full_name}
                        {parsed.city && ` · ${parsed.city}${parsed.state ? '/' + parsed.state : ''}`}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={handleImport}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    <Sparkles size={15} />
                    Salvar e ver minhas vagas
                  </button>
                </div>
              )}

              <button
                onClick={skipToRadar}
                className="text-sm text-gray-600 hover:text-gray-400 transition-colors w-full text-center py-1"
              >
                Pular e configurar depois
              </button>
            </div>
          )}

          {/* Step: Importing */}
          {step === 'importing' && (
            <div className="text-center py-8 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-brand-600/15 flex items-center justify-center mx-auto">
                <Sparkles size={24} className="text-brand-400 animate-pulse" />
              </div>
              <div>
                <p className="text-white font-medium">Salvando seu perfil...</p>
                <p className="text-gray-500 text-sm mt-1">Preparando seu radar personalizado</p>
              </div>
            </div>
          )}

          {/* Step: Done */}
          {step === 'done' && (
            <div className="text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-green-500/15 flex items-center justify-center mx-auto">
                <CheckCircle size={28} className="text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-2">Perfil criado!</h2>
                <p className="text-gray-400 text-sm">{importMsg}</p>
              </div>

              <div className="p-4 rounded-xl bg-brand-600/10 border border-brand-500/20 text-left">
                <p className="text-brand-300 text-sm font-medium mb-1 flex items-center gap-2">
                  <Radar size={14} /> Seu radar está pronto
                </p>
                <p className="text-gray-400 text-xs leading-relaxed">
                  As vagas exibidas serão filtradas e ordenadas de acordo com seu perfil, localização e formação.
                </p>
              </div>

              <button
                onClick={() => navigate('/radar')}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                Ver minhas vagas
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
