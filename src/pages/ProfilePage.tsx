import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2, GraduationCap, Briefcase, Tag, Save, Loader2, Sparkles } from 'lucide-react'
import {
  useProfile, useUpdateProfile,
  useFormations, useAddFormation, useDeleteFormation,
  useExperiences, useAddExperience, useDeleteExperience,
} from '@/hooks/useProfile'
import { cn, formatDate } from '@/lib/utils'
import type { FormationStatus } from '@/types/database'
import ResumeUpload from '@/components/ResumeUpload'
import type { ParsedResume } from '@/lib/gemini'
import { useTriggerJobSearch } from '@/hooks/useJobSearch'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

const profileSchema = z.object({
  full_name: z.string().min(2, 'Nome obrigatório'),
  city: z.string().min(2, 'Cidade obrigatória'),
  state: z.string().length(2, 'Use a sigla do estado (ex: SP)'),
})

const formationSchema = z.object({
  degree: z.string().min(2),
  field: z.string().min(2),
  institution: z.string().optional(),
  year_end: z.number().optional(),
  status: z.enum(['concluído', 'em andamento']),
})

const experienceSchema = z.object({
  title: z.string().min(2),
  organization: z.string().optional(),
  description: z.string().optional(),
  start_date: z.string().optional(),
  current: z.boolean(),
})

type ProfileForm = z.infer<typeof profileSchema>
type FormationForm = z.infer<typeof formationSchema>
type ExperienceForm = z.infer<typeof experienceSchema>

export default function ProfilePage() {
  const { data: profile } = useProfile()
  const { data: formations = [] } = useFormations()
  const { data: experiences = [] } = useExperiences()
  const updateProfile = useUpdateProfile()
  const addFormation = useAddFormation()
  const deleteFormation = useDeleteFormation()
  const addExperience = useAddExperience()
  const deleteExperience = useDeleteExperience()
  const { user } = useAuth()

  const [showFormationForm, setShowFormationForm] = useState(false)
  const [showExperienceForm, setShowExperienceForm] = useState(false)
  const [keywords, setKeywords] = useState<string[]>(profile?.keywords ?? [])
  const [newKeyword, setNewKeyword] = useState('')
  const [savedMsg, setSavedMsg] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const { trigger: triggerSearch, status: searchStatus, count: searchCount } = useTriggerJobSearch()

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: profile?.full_name ?? '', city: profile?.city ?? '', state: profile?.state ?? '' },
  })

  const formationForm = useForm<FormationForm>({
    resolver: zodResolver(formationSchema),
    defaultValues: { status: 'concluído' },
  })

  const experienceForm = useForm<ExperienceForm>({
    resolver: zodResolver(experienceSchema),
    defaultValues: { current: false },
  })

  const handleResumeImport = async (parsed: ParsedResume) => {
    setImporting(true)
    setImportMsg(null)
    try {
      // Limpa formações e experiências existentes para evitar duplicatas
      if (user) {
        await supabase.from('formations').delete().eq('profile_id', user.id)
        await supabase.from('experiences').delete().eq('profile_id', user.id)
      }

      await updateProfile.mutateAsync({
        full_name: parsed.full_name ?? undefined,
        city: parsed.city ?? undefined,
        state: parsed.state ?? undefined,
        keywords: parsed.keywords.length > 0 ? parsed.keywords : undefined,
      })

      if (parsed.full_name) profileForm.setValue('full_name', parsed.full_name)
      if (parsed.city) profileForm.setValue('city', parsed.city)
      if (parsed.state) profileForm.setValue('state', parsed.state)
      if (parsed.keywords.length) setKeywords(parsed.keywords)

      for (const f of parsed.formations) {
        await addFormation.mutateAsync({
          degree: f.degree,
          field: f.field,
          institution: f.institution,
          year_end: f.year_end,
          status: f.status,
        })
      }

      for (const e of parsed.experiences) {
        await addExperience.mutateAsync({
          title: e.title,
          organization: e.organization,
          description: e.description,
          start_date: e.start_date,
          end_date: null,
          current: e.current,
        })
      }

      setImportMsg(`✓ Importados: ${parsed.formations.length} formações, ${parsed.experiences.length} experiências, ${parsed.keywords.length} competências`)
      // Busca vagas em background baseada no perfil recém-importado
      triggerSearch()
    } catch {
      setImportMsg('Erro ao salvar dados importados')
    } finally {
      setImporting(false)
    }
  }

  const saveProfile = async (data: ProfileForm) => {
    await updateProfile.mutateAsync({ ...data, keywords })
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2000)
  }

  const addKw = () => {
    const kw = newKeyword.trim()
    if (kw && !keywords.includes(kw)) setKeywords(prev => [...prev, kw])
    setNewKeyword('')
  }

  const submitFormation = async (data: FormationForm) => {
    await addFormation.mutateAsync({
      degree: data.degree,
      field: data.field,
      institution: data.institution ?? null,
      year_end: data.year_end ?? null,
      status: data.status as FormationStatus,
    })
    formationForm.reset()
    setShowFormationForm(false)
  }

  const submitExperience = async (data: ExperienceForm) => {
    await addExperience.mutateAsync({
      title: data.title,
      organization: data.organization ?? null,
      description: data.description ?? null,
      start_date: data.start_date ?? null,
      end_date: null,
      current: data.current,
    })
    experienceForm.reset()
    setShowExperienceForm(false)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Upload de currículo */}
      <section className="card p-6">
        <h2 className="text-white font-semibold text-base mb-5 flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-brand-600/20 flex items-center justify-center">
            <Sparkles size={14} className="text-brand-400" />
          </span>
          Importar Currículo com IA
        </h2>
        <ResumeUpload onParsed={handleResumeImport} />
        {importing && (
          <p className="text-brand-400 text-xs mt-3 flex items-center gap-1.5">
            <Loader2 size={12} className="animate-spin" /> Salvando dados importados...
          </p>
        )}
        {importMsg && (
          <p className={cn('text-xs mt-3', importMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400')}>
            {importMsg}
          </p>
        )}
        {searchStatus === 'searching' && (
          <p className="text-brand-400 text-xs mt-2 flex items-center gap-1.5">
            <Loader2 size={12} className="animate-spin" /> Buscando vagas para seu perfil...
          </p>
        )}
        {searchStatus === 'done' && searchCount > 0 && (
          <p className="text-green-400 text-xs mt-2">
            ✓ {searchCount} vagas encontradas para seu perfil!
          </p>
        )}
      </section>

      {/* Dados pessoais */}
      <section className="card p-6">
        <h2 className="text-white font-semibold text-base mb-5 flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-brand-600/20 flex items-center justify-center">
            <Briefcase size={14} className="text-brand-400" />
          </span>
          Dados Pessoais
        </h2>

        <form onSubmit={profileForm.handleSubmit(saveProfile)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1.5">Nome completo</label>
              <input {...profileForm.register('full_name')} className="input" placeholder="Seu nome" />
              {profileForm.formState.errors.full_name && (
                <p className="text-red-400 text-xs mt-1">{profileForm.formState.errors.full_name.message}</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Cidade</label>
              <input {...profileForm.register('city')} className="input" placeholder="São Paulo" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Estado (sigla)</label>
              <input {...profileForm.register('state')} className="input" placeholder="SP" maxLength={2} />
            </div>
          </div>

          {/* Keywords */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 flex items-center gap-1.5">
              <Tag size={12} /> Palavras-chave de interesse
            </label>
            <div className="flex gap-2 mb-2">
              <input
                value={newKeyword}
                onChange={e => setNewKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addKw())}
                className="input flex-1"
                placeholder="Ex: tecnologia educacional, PROATEC..."
              />
              <button type="button" onClick={addKw} className="btn-ghost px-3">
                <Plus size={16} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {keywords.map(kw => (
                <span key={kw} className="badge bg-brand-600/15 text-brand-300 border border-brand-600/25">
                  {kw}
                  <button type="button" onClick={() => setKeywords(prev => prev.filter(k => k !== kw))}>
                    <Trash2 size={10} />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={updateProfile.isPending}
            className={cn('btn-primary flex items-center gap-2', savedMsg && 'bg-green-600 hover:bg-green-700')}
          >
            {updateProfile.isPending
              ? <Loader2 size={16} className="animate-spin" />
              : <Save size={16} />}
            {savedMsg ? 'Salvo!' : 'Salvar perfil'}
          </button>
        </form>
      </section>

      {/* Formações */}
      <section className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold text-base flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-brand-600/20 flex items-center justify-center">
              <GraduationCap size={14} className="text-brand-400" />
            </span>
            Formações Acadêmicas
          </h2>
          <button onClick={() => setShowFormationForm(v => !v)} className="btn-ghost text-sm flex items-center gap-1.5">
            <Plus size={15} /> Adicionar
          </button>
        </div>

        {showFormationForm && (
          <form onSubmit={formationForm.handleSubmit(submitFormation)} className="bg-surface-muted rounded-xl p-4 mb-4 space-y-3 border border-surface-border">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Grau</label>
                <input {...formationForm.register('degree')} className="input text-sm" placeholder="Licenciatura, Bacharelado..." />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Área</label>
                <input {...formationForm.register('field')} className="input text-sm" placeholder="Ciências Sociais, História..." />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Instituição</label>
                <input {...formationForm.register('institution')} className="input text-sm" placeholder="Nome da faculdade" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Ano de conclusão</label>
                <input {...formationForm.register('year_end', { valueAsNumber: true })} type="number" className="input text-sm" placeholder="2024" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-400 mb-1">Status</label>
                <select {...formationForm.register('status')} className="input text-sm">
                  <option value="concluído">Concluído</option>
                  <option value="em andamento">Em andamento</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={addFormation.isPending} className="btn-primary text-sm flex items-center gap-1.5">
                {addFormation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Adicionar
              </button>
              <button type="button" onClick={() => setShowFormationForm(false)} className="btn-ghost text-sm">Cancelar</button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          {formations.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-6">Nenhuma formação cadastrada ainda.</p>
          )}
          {formations.map(f => (
            <div key={f.id} className="flex items-start justify-between p-3 rounded-xl bg-surface-muted border border-surface-border">
              <div>
                <p className="text-white text-sm font-medium">{f.degree} em {f.field}</p>
                <p className="text-gray-500 text-xs mt-0.5">{f.institution} {f.year_end ? `· ${f.year_end}` : ''}</p>
                <span className={cn('badge mt-1.5 text-xs',
                  f.status === 'concluído' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                )}>
                  {f.status}
                </span>
              </div>
              <button onClick={() => deleteFormation.mutate(f.id)} className="text-gray-600 hover:text-red-400 transition-colors p-1">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Experiências */}
      <section className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold text-base flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-brand-600/20 flex items-center justify-center">
              <Briefcase size={14} className="text-brand-400" />
            </span>
            Experiências Profissionais
          </h2>
          <button onClick={() => setShowExperienceForm(v => !v)} className="btn-ghost text-sm flex items-center gap-1.5">
            <Plus size={15} /> Adicionar
          </button>
        </div>

        {showExperienceForm && (
          <form onSubmit={experienceForm.handleSubmit(submitExperience)} className="bg-surface-muted rounded-xl p-4 mb-4 space-y-3 border border-surface-border">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Cargo / Função</label>
                <input {...experienceForm.register('title')} className="input text-sm" placeholder="Professor, Analista..." />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Organização</label>
                <input {...experienceForm.register('organization')} className="input text-sm" placeholder="Nome da empresa" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Início</label>
                <input {...experienceForm.register('start_date')} type="date" className="input text-sm" />
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 text-xs text-gray-400 mb-2 cursor-pointer">
                  <input {...experienceForm.register('current')} type="checkbox" className="accent-brand-500" />
                  Trabalho aqui atualmente
                </label>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-400 mb-1">Descrição</label>
                <textarea {...experienceForm.register('description')} className="input text-sm resize-none" rows={2} placeholder="Principais atividades..." />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={addExperience.isPending} className="btn-primary text-sm flex items-center gap-1.5">
                {addExperience.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Adicionar
              </button>
              <button type="button" onClick={() => setShowExperienceForm(false)} className="btn-ghost text-sm">Cancelar</button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          {experiences.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-6">Nenhuma experiência cadastrada ainda.</p>
          )}
          {experiences.map(e => (
            <div key={e.id} className="flex items-start justify-between p-3 rounded-xl bg-surface-muted border border-surface-border">
              <div>
                <p className="text-white text-sm font-medium">{e.title}</p>
                {e.organization && <p className="text-gray-400 text-xs">{e.organization}</p>}
                <p className="text-gray-600 text-xs mt-0.5">
                  {formatDate(e.start_date)} · {e.current ? 'Atual' : formatDate(e.end_date)}
                </p>
                {e.description && <p className="text-gray-500 text-xs mt-1 line-clamp-2">{e.description}</p>}
              </div>
              <button onClick={() => deleteExperience.mutate(e.id)} className="text-gray-600 hover:text-red-400 transition-colors p-1">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
