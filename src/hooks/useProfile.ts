import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Profile, Formation, Experience } from '@/types/database'

export function useProfile() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (error && error.code !== 'PGRST116') throw error
      return data as Profile | null
    },
    enabled: !!user,
  })
}

export function useUpdateProfile() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (updates: Partial<Profile>) => {
      if (!user) throw new Error('Não autenticado')
      const { data, error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, ...updates, updated_at: new Date().toISOString() })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile', user?.id] }),
  })
}

export function useFormations() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['formations', user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('formations')
        .select('*')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Formation[]
    },
    enabled: !!user,
  })
}

export function useAddFormation() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (formation: Omit<Formation, 'id' | 'created_at' | 'profile_id'>) => {
      if (!user) throw new Error('Não autenticado')
      const { data, error } = await supabase
        .from('formations')
        .insert({ ...formation, profile_id: user.id })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['formations', user?.id] }),
  })
}

export function useDeleteFormation() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('formations').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['formations', user?.id] }),
  })
}

export function useExperiences() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['experiences', user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('experiences')
        .select('*')
        .eq('profile_id', user.id)
        .order('start_date', { ascending: false })
      if (error) throw error
      return data as Experience[]
    },
    enabled: !!user,
  })
}

export function useAddExperience() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (exp: Omit<Experience, 'id' | 'created_at' | 'profile_id'>) => {
      if (!user) throw new Error('Não autenticado')
      const { data, error } = await supabase
        .from('experiences')
        .insert({ ...exp, profile_id: user.id })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['experiences', user?.id] }),
  })
}

export function useDeleteExperience() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('experiences').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['experiences', user?.id] }),
  })
}
