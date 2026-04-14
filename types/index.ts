export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string
          user_id: string
          name: string
          company: string | null
          email: string | null
          phone: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          company?: string | null
          email?: string | null
          phone?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          company?: string | null
          email?: string | null
          phone?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          user_id: string
          customer_id: string
          name: string
          description: string | null
          status: 'active' | 'won' | 'lost' | 'on_hold'
          value: number | null
          start_date: string | null
          expected_close_date: string | null
          actual_close_date: string | null
          probability: number
          has_start_notice: boolean
          contract_signed: boolean
          settlement_stages: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          customer_id: string
          name: string
          description?: string | null
          status?: 'active' | 'won' | 'lost' | 'on_hold'
          value?: number | null
          start_date?: string | null
          expected_close_date?: string | null
          actual_close_date?: string | null
          probability?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          customer_id?: string
          name?: string
          description?: string | null
          status?: 'active' | 'won' | 'lost' | 'on_hold'
          value?: number | null
          start_date?: string | null
          expected_close_date?: string | null
          actual_close_date?: string | null
          probability?: number
          created_at?: string
          updated_at?: string
        }
      }
      tasks: {
        Row: {
          id: string
          user_id: string
          project_id: string
          title: string
          description: string | null
          status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
          priority: 'low' | 'medium' | 'high' | 'urgent'
          due_date: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          project_id: string
          title: string
          description?: string | null
          status?: 'pending' | 'in_progress' | 'completed' | 'cancelled'
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          due_date?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          project_id?: string
          title?: string
          description?: string | null
          status?: 'pending' | 'in_progress' | 'completed' | 'cancelled'
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          due_date?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      user_settings: {
        Row: {
          id: string
          user_id: string
          font_family: string
          font_size: number
          theme: 'light' | 'dark' | 'system'
          reminder_enabled: boolean
          reminder_advance_hours: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          font_family?: string
          font_size?: number
          theme?: 'light' | 'dark' | 'system'
          reminder_enabled?: boolean
          reminder_advance_hours?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          font_family?: string
          font_size?: number
          theme?: 'light' | 'dark' | 'system'
          reminder_enabled?: boolean
          reminder_advance_hours?: number
          created_at?: string
          updated_at?: string
        }
      }
      settlement_stages: {
        Row: {
          id: string
          project_id: string
          stage_number: number
          stage_name: string | null
          amount: number | null
          accepted: boolean
          accepted_date: string | null
          invoiced: boolean
          invoiced_date: string | null
          paid: boolean
          paid_date: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          stage_number: number
          stage_name?: string | null
          amount?: number | null
          accepted?: boolean
          accepted_date?: string | null
          invoiced?: boolean
          invoiced_date?: string | null
          paid?: boolean
          paid_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          stage_number?: number
          stage_name?: string | null
          amount?: number | null
          accepted?: boolean
          accepted_date?: string | null
          invoiced?: boolean
          invoiced_date?: string | null
          paid?: boolean
          paid_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

export type Customer = Database['public']['Tables']['customers']['Row']
export type Project = Database['public']['Tables']['projects']['Row']
export type Task = Database['public']['Tables']['tasks']['Row']
export type UserSettings = Database['public']['Tables']['user_settings']['Row']
export type SettlementStage = Database['public']['Tables']['settlement_stages']['Row']

export type CustomerInsert = Database['public']['Tables']['customers']['Insert']
export type ProjectInsert = Database['public']['Tables']['projects']['Insert']
export type TaskInsert = Database['public']['Tables']['tasks']['Insert']
export type UserSettingsInsert = Database['public']['Tables']['user_settings']['Insert']
export type SettlementStageInsert = Database['public']['Tables']['settlement_stages']['Insert']

export type CustomerUpdate = Database['public']['Tables']['customers']['Update']
export type ProjectUpdate = Database['public']['Tables']['projects']['Update']
export type TaskUpdate = Database['public']['Tables']['tasks']['Update']
export type UserSettingsUpdate = Database['public']['Tables']['user_settings']['Update']
export type SettlementStageUpdate = Database['public']['Tables']['settlement_stages']['Update']
