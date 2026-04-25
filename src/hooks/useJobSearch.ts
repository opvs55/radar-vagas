import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export type JobSearchStatus = 'idle' | 'searching' | 'done' | 'error'

export function useTriggerJobSearch() {
  const [status, setStatus] = useState<JobSearchStatus>('idle')
  const [count, setCount] = useState(0)

  const trigger = async () => {
    setStatus('searching')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Não autenticado')

      const res = await supabase.functions.invoke('search-jobs-for-user', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (res.error) throw res.error

      const inserted = res.data?.inserted ?? 0
      setCount(inserted)
      setStatus('done')
    } catch (err) {
      console.error('Erro ao buscar vagas:', err)
      setStatus('error')
    }
  }

  return { trigger, status, count }
}
