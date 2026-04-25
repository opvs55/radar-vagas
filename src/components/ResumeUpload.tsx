import { useState, useRef, useCallback } from 'react'
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, X, Sparkles } from 'lucide-react'
import { extractTextFromPdf } from '@/lib/extractPdf'
import { parseResumeWithGemini, type ParsedResume } from '@/lib/gemini'
import { cn } from '@/lib/utils'

type Step = 'idle' | 'reading' | 'parsing' | 'done' | 'error'

interface Props {
  onParsed: (data: ParsedResume) => void
}

export default function ResumeUpload({ onParsed }: Props) {
  const [step, setStep] = useState<Step>('idle')
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Apenas arquivos PDF são suportados.')
      setStep('error')
      return
    }

    setFileName(file.name)
    setError(null)

    try {
      setStep('reading')
      const text = await extractTextFromPdf(file)
      if (!text.trim()) throw new Error('Não foi possível extrair texto do PDF. Verifique se o arquivo não é uma imagem escaneada.')

      setStep('parsing')
      const parsed = await parseResumeWithGemini(text)

      setStep('done')
      onParsed(parsed)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado'
      setError(msg)
      setStep('error')
    }
  }, [onParsed])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const reset = () => {
    setStep('idle')
    setFileName(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const stepMessages: Record<Step, string> = {
    idle: '',
    reading: 'Lendo o PDF...',
    parsing: 'Analisando com IA...',
    done: 'Currículo importado com sucesso!',
    error: error ?? 'Erro desconhecido',
  }

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => step === 'idle' || step === 'error' ? inputRef.current?.click() : null}
        className={cn(
          'relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200',
          dragging
            ? 'border-brand-500 bg-brand-500/5 scale-[1.01]'
            : step === 'done'
            ? 'border-green-500/40 bg-green-500/5'
            : step === 'error'
            ? 'border-red-500/40 bg-red-500/5 cursor-pointer'
            : 'border-surface-border bg-surface-muted/30 hover:border-brand-500/50 hover:bg-brand-500/5 cursor-pointer',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={onInputChange}
        />

        {/* Icon */}
        <div className={cn(
          'w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4',
          step === 'done' ? 'bg-green-500/15' : step === 'error' ? 'bg-red-500/15' : 'bg-brand-600/15',
        )}>
          {step === 'reading' || step === 'parsing' ? (
            <Loader2 size={24} className="text-brand-400 animate-spin" />
          ) : step === 'done' ? (
            <CheckCircle size={24} className="text-green-400" />
          ) : step === 'error' ? (
            <AlertCircle size={24} className="text-red-400" />
          ) : (
            <Upload size={24} className="text-brand-400" />
          )}
        </div>

        {/* Text */}
        {step === 'idle' && (
          <>
            <p className="text-white font-medium text-sm mb-1">
              Arraste seu currículo ou clique para selecionar
            </p>
            <p className="text-gray-500 text-xs">PDF · máximo 10 MB</p>
          </>
        )}

        {(step === 'reading' || step === 'parsing') && (
          <>
            <p className="text-white font-medium text-sm mb-1">{fileName}</p>
            <p className="text-brand-400 text-xs flex items-center justify-center gap-1.5">
              <Sparkles size={12} />
              {stepMessages[step]}
            </p>
          </>
        )}

        {step === 'done' && (
          <>
            <p className="text-white font-medium text-sm mb-1">Importado com sucesso!</p>
            <p className="text-gray-500 text-xs">{fileName}</p>
          </>
        )}

        {step === 'error' && (
          <>
            <p className="text-red-400 font-medium text-sm mb-1">Falha na importação</p>
            <p className="text-gray-500 text-xs line-clamp-2">{error}</p>
            <p className="text-brand-400 text-xs mt-2">Clique para tentar novamente</p>
          </>
        )}

        {/* Reset button */}
        {(step === 'done' || step === 'error') && (
          <button
            onClick={e => { e.stopPropagation(); reset() }}
            className="absolute top-3 right-3 w-6 h-6 rounded-full bg-surface-muted text-gray-500 hover:text-white flex items-center justify-center transition-colors"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Progress steps */}
      {(step === 'reading' || step === 'parsing') && (
        <div className="flex items-center gap-2 px-1">
          {(['reading', 'parsing'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={cn(
                'w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all',
                step === s ? 'bg-brand-600 text-white' : i < ['reading', 'parsing'].indexOf(step) ? 'bg-green-600 text-white' : 'bg-surface-muted text-gray-600',
              )}>
                {i < ['reading', 'parsing'].indexOf(step) ? '✓' : i + 1}
              </div>
              <span className={cn('text-xs', step === s ? 'text-white' : 'text-gray-600')}>
                {s === 'reading' ? 'Lendo PDF' : 'Analisando IA'}
              </span>
              {i < 1 && <div className="flex-1 h-px bg-surface-border" />}
            </div>
          ))}
        </div>
      )}

      {/* Info box */}
      {step === 'idle' && (
        <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-brand-600/8 border border-brand-600/15">
          <FileText size={14} className="text-brand-400 mt-0.5 shrink-0" />
          <p className="text-xs text-gray-400 leading-relaxed">
            O Gemini vai identificar automaticamente seu nome, formações, experiências e competências e preencher o perfil.
          </p>
        </div>
      )}
    </div>
  )
}
