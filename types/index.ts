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
          belong_year: number | null
          signed_at: string | null
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
          signed_at?: string | null
          created_at?: string
          updated_at?: string
          belong_year?: number | null
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
          signed_at?: string | null
          created_at?: string
          updated_at?: string
          belong_year?: number | null
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
          milestone_reminder_days: number
          sales_goal: number | null
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
          milestone_reminder_days?: number
          sales_goal?: number | null
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
          milestone_reminder_days?: number
          sales_goal?: number | null
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
          planned_accepted_date: string | null
          planned_invoiced_date: string | null
          planned_paid_date: string | null
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
          planned_accepted_date?: string | null
          planned_invoiced_date?: string | null
          planned_paid_date?: string | null
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
          planned_accepted_date?: string | null
          planned_invoiced_date?: string | null
          planned_paid_date?: string | null
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
export type WeeklyUpdate = { id: string; project_id: string; week: string; content: string | null; contract_signed: boolean; settlement_accepted: number; settlement_invoiced: number; settlement_paid: number; settlement_total: number; created_at: string; updated_at: string; team_id: string | null }

export type CustomerInsert = Database['public']['Tables']['customers']['Insert']
export type ProjectInsert = Database['public']['Tables']['projects']['Insert']
export type TaskInsert = Database['public']['Tables']['tasks']['Insert']
export type UserSettingsInsert = Database['public']['Tables']['user_settings']['Insert']
export type SettlementStageInsert = Database['public']['Tables']['settlement_stages']['Insert']
export type WeeklyUpdateInsert = Omit<WeeklyUpdate, 'id' | 'created_at' | 'updated_at'>
export type WeeklyUpdateUpdate = Partial<WeeklyUpdateInsert>

export type CustomerUpdate = Database['public']['Tables']['customers']['Update']
export type ProjectUpdate = Database['public']['Tables']['projects']['Update']
export type TaskUpdate = Database['public']['Tables']['tasks']['Update']
export type UserSettingsUpdate = Database['public']['Tables']['user_settings']['Update']
export type SettlementStageUpdate = Database['public']['Tables']['settlement_stages']['Update']

// ─── Team types ───────────────────────────────────────────────

export type TeamRole = 'super_admin' | 'sales_manager' | 'sales_rep'

export type Team = {
  id: string
  name: string
  created_by: string | null
  created_at: string
}

export type TeamMember = {
  id: string
  team_id: string
  user_id: string
  role: TeamRole
  status: 'active' | 'disabled' | 'pending'
  invited_by: string | null
  joined_at: string
  data_scope: 'own' | 'team'
  approval_cc: boolean
}

export type TeamInvitation = {
  id: string
  team_id: string
  email: string
  role: TeamRole
  token: string
  invited_by: string | null
  expires_at: string
  used_at: string | null
  created_at: string
}

export type AssignmentLog = {
  id: string
  team_id: string
  resource_type: 'customer' | 'project' | 'task'
  resource_id: string
  assigned_from: string | null
  assigned_to: string
  operated_by: string
  created_at: string
}

export type ApprovalRequestType = 'create_customer' | 'create_project' | 'update_project'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export type ApprovalRequest = {
  id: string
  team_id: string
  type: ApprovalRequestType
  target_id: string | null
  payload: Record<string, unknown>
  submitted_by: string
  reviewed_by: string | null
  status: ApprovalStatus
  reject_reason: string | null
  current_step: number
  total_steps: number
  created_at: string
  reviewed_at: string | null
}

export type UserTeamContext = {
  teamId: string
  teamName: string
  role: TeamRole
  userId: string
  dataScope: 'own' | 'team'
  approvalCc: boolean
}

export type InboxNotificationType =
  | 'approval_submitted'
  | 'approval_approved'
  | 'approval_rejected'
  | 'approval_cc'
  | 'approval_urge'
  | 'approval_urge_received'
  | 'member_request'
  | 'member_approved'

export type InboxLinkType = 'approval'
