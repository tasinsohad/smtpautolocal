export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      dns_records: {
        Row: {
          cf_record_id: string | null
          content: string
          created_at: string
          domain_id: string
          id: string
          last_error: string | null
          name: string
          priority: number | null
          proxied: boolean
          status: string
          ttl: number
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cf_record_id?: string | null
          content: string
          created_at?: string
          domain_id: string
          id?: string
          last_error?: string | null
          name: string
          priority?: number | null
          proxied?: boolean
          status?: string
          ttl?: number
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cf_record_id?: string | null
          content?: string
          created_at?: string
          domain_id?: string
          id?: string
          last_error?: string | null
          name?: string
          priority?: number | null
          proxied?: boolean
          status?: string
          ttl?: number
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dns_records_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_plans: {
        Row: {
          created_at: string
          domain_id: string
          id: string
          names_snapshot: string[]
          prefixes_snapshot: string[]
          status: string
          subdomain_count: number
          total_inboxes: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          domain_id: string
          id?: string
          names_snapshot?: string[]
          prefixes_snapshot?: string[]
          status?: string
          subdomain_count: number
          total_inboxes: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          domain_id?: string
          id?: string
          names_snapshot?: string[]
          prefixes_snapshot?: string[]
          status?: string
          subdomain_count?: number
          total_inboxes?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      domains: {
        Row: {
          cf_account_id: string | null
          cf_zone_id: string | null
          created_at: string
          id: string
          mailcow_api_key: string | null
          mailcow_hostname: string | null
          name: string
          notes: string | null
          planned_inbox_count: number | null
          server_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cf_account_id?: string | null
          cf_zone_id?: string | null
          created_at?: string
          id?: string
          mailcow_api_key?: string | null
          mailcow_hostname?: string | null
          name: string
          notes?: string | null
          planned_inbox_count?: number | null
          server_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cf_account_id?: string | null
          cf_zone_id?: string | null
          created_at?: string
          id?: string
          mailcow_api_key?: string | null
          mailcow_hostname?: string | null
          name?: string
          notes?: string | null
          planned_inbox_count?: number | null
          server_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "domains_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          completed: number
          created_at: string
          domain_id: string | null
          failed: number
          id: string
          logs: Json
          status: string
          total: number
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: number
          created_at?: string
          domain_id?: string | null
          failed?: number
          id?: string
          logs?: Json
          status?: string
          total?: number
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: number
          created_at?: string
          domain_id?: string | null
          failed?: number
          id?: string
          logs?: Json
          status?: string
          total?: number
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      planned_inboxes: {
        Row: {
          created_at: string
          domain_id: string
          email: string
          format: string | null
          id: string
          last_error: string | null
          local_part: string
          person_name: string | null
          plan_id: string
          status: string
          subdomain_fqdn: string
          subdomain_prefix: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          domain_id: string
          email: string
          format?: string | null
          id?: string
          last_error?: string | null
          local_part: string
          person_name?: string | null
          plan_id: string
          status?: string
          subdomain_fqdn: string
          subdomain_prefix: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          domain_id?: string
          email?: string
          format?: string | null
          id?: string
          last_error?: string | null
          local_part?: string
          person_name?: string | null
          plan_id?: string
          status?: string
          subdomain_fqdn?: string
          subdomain_prefix?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          count: number
          provider: string
          user_id: string
          window_started_at: string
        }
        Insert: {
          count?: number
          provider: string
          user_id: string
          window_started_at?: string
        }
        Update: {
          count?: number
          provider?: string
          user_id?: string
          window_started_at?: string
        }
        Relationships: []
      }
      servers: {
        Row: {
          created_at: string
          hostname: string
          id: string
          ip_address: string
          label: string
          setup_steps: Json
          ssh_user: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hostname: string
          id?: string
          ip_address: string
          label: string
          setup_steps?: Json
          ssh_user?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          hostname?: string
          id?: string
          ip_address?: string
          label?: string
          setup_steps?: Json
          ssh_user?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_secrets: {
        Row: {
          cf_account_id: string | null
          cf_api_token: string | null
          created_at: string
          person_names: string[]
          subdomain_prefixes: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          cf_account_id?: string | null
          cf_api_token?: string | null
          created_at?: string
          person_names?: string[]
          subdomain_prefixes?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          cf_account_id?: string | null
          cf_api_token?: string | null
          created_at?: string
          person_names?: string[]
          subdomain_prefixes?: string[]
          updated_at?: string
          user_id?: string
        }
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
