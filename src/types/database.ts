export type JobType = 'concurso' | 'clt' | 'pj' | 'temporario' | 'edtech' | 'outro'
export type ApplicationStatus = 'salvo' | 'inscrito' | 'em andamento' | 'aprovado' | 'reprovado' | 'desistiu'
export type FormationStatus = 'concluído' | 'em andamento'

export interface Profile {
  id: string
  full_name: string | null
  city: string | null
  state: string | null
  latitude: number | null
  longitude: number | null
  search_radius_km: number
  keywords: string[] | null
  job_types: string[] | null
  first_job: boolean | null
  education_level: string | null
  interest_areas: string[] | null
  created_at: string
  updated_at: string
}

export interface Formation {
  id: string
  profile_id: string
  degree: string
  field: string
  status: FormationStatus
  institution: string | null
  year_end: number | null
  created_at: string
}

export interface Experience {
  id: string
  profile_id: string
  title: string
  organization: string | null
  description: string | null
  start_date: string | null
  end_date: string | null
  current: boolean
  created_at: string
}

export interface Job {
  id: string
  source: string
  source_url: string | null
  title: string
  organization: string | null
  description: string | null
  city: string | null
  state: string | null
  latitude: number | null
  longitude: number | null
  job_type: JobType | null
  salary_min: number | null
  salary_max: number | null
  deadline: string | null
  published_at: string | null
  raw_data: Record<string, unknown> | null
  created_at: string
}

export interface Application {
  id: string
  profile_id: string
  job_id: string
  status: ApplicationStatus
  match_score: number | null
  notes: string | null
  created_at: string
  updated_at: string
  job?: Job
}

export interface JobScore {
  id: string
  profile_id: string
  job_id: string
  score: number
  reason: string | null
  created_at: string
}

export interface CareerAnalysis {
  id: string
  profile_id: string
  strengths: string[]
  gaps: string[]
  courses: string[]
  career_paths: string[]
  action_plan: string[]
  salary_range: { min: number; max: number; currency: string } | null
  summary: string | null
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> }
      formations: { Row: Formation; Insert: Omit<Formation, 'id' | 'created_at'>; Update: Partial<Formation> }
      experiences: { Row: Experience; Insert: Omit<Experience, 'id' | 'created_at'>; Update: Partial<Experience> }
      jobs: { Row: Job; Insert: Omit<Job, 'id' | 'created_at'>; Update: Partial<Job> }
      applications: { Row: Application; Insert: Omit<Application, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Application> }
    }
  }
}
