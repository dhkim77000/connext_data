// lib/supabase/types.ts
export type Database = {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string
          name: string
          owner_auth_id: string
          plan: string
          created_at: string
        }
        Insert: {
          name: string
          owner_auth_id: string
          plan?: string
        }
        Update: Partial<Database['public']['Tables']['tenants']['Row']>
        Relationships: []
      }
      channel_connections: {
        Row: {
          id: string
          tenant_id: string
          connector_id: string
          display_name: string
          status: 'active' | 'error' | 'paused'
          extra: Record<string, unknown>
          last_synced_at: string | null
          created_at: string
        }
        Insert: {
          tenant_id: string
          connector_id: string
          display_name?: string
          status?: 'active' | 'error' | 'paused'
          extra?: Record<string, unknown>
        }
        Update: Partial<Database['public']['Tables']['channel_connections']['Row']>
        Relationships: []
      }
      sync_jobs: {
        Row: {
          id: string
          tenant_id: string
          connection_id: string
          connector_id: string
          data_type: string
          status: 'pending' | 'running' | 'done' | 'error'
          since: string | null
          until: string | null
          rows_ingested: number
          error_message: string | null
          started_at: string | null
          completed_at: string | null
          created_at: string
        }
        Insert: {
          tenant_id: string
          connection_id: string
          connector_id: string
          data_type: string
          status?: 'pending' | 'running' | 'done' | 'error'
          since?: string
          until?: string
        }
        Update: Partial<Database['public']['Tables']['sync_jobs']['Row']>
        Relationships: []
      }
      channel_credentials: {
        Row: {
          id: string
          connection_id: string
          access_token: string
          refresh_token: string | null
          expires_at: number | null
          extra: Record<string, unknown>
          created_at: string
          updated_at: string
        }
        Insert: {
          connection_id: string
          access_token: string
          refresh_token?: string
          expires_at?: number
          extra?: Record<string, unknown>
        }
        Update: Partial<Database['public']['Tables']['channel_credentials']['Row']>
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
