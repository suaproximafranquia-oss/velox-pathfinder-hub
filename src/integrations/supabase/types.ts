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
      app_user_connections: {
        Row: {
          account_email: string | null
          connection_key_ciphertext: string
          connector_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_email?: string | null
          connection_key_ciphertext: string
          connector_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_email?: string | null
          connection_key_ciphertext?: string
          connector_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          audience: string
          created_at: string
          created_by: string
          created_by_name: string
          failed_count: number
          id: string
          last_dispatch_at: string | null
          name: string
          objective: string
          replied_count: number
          scheduled_at: string | null
          sent_count: number
          status: string
          template_id: string | null
          updated_at: string
        }
        Insert: {
          audience?: string
          created_at?: string
          created_by?: string
          created_by_name?: string
          failed_count?: number
          id: string
          last_dispatch_at?: string | null
          name: string
          objective?: string
          replied_count?: number
          scheduled_at?: string | null
          sent_count?: number
          status?: string
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          audience?: string
          created_at?: string
          created_by?: string
          created_by_name?: string
          failed_count?: number
          id?: string
          last_dispatch_at?: string | null
          name?: string
          objective?: string
          replied_count?: number
          scheduled_at?: string | null
          sent_count?: number
          status?: string
          template_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      creative_art_cache: {
        Row: {
          cache_key: string
          city: string
          created_at: string
          institucional_base64: string
          marketing_base64: string
          model_version: string
          state: string
        }
        Insert: {
          cache_key: string
          city: string
          created_at?: string
          institucional_base64: string
          marketing_base64: string
          model_version: string
          state: string
        }
        Update: {
          cache_key?: string
          city?: string
          created_at?: string
          institucional_base64?: string
          marketing_base64?: string
          model_version?: string
          state?: string
        }
        Relationships: []
      }
      creative_official_model: {
        Row: {
          content_base64: string
          file_name: string
          id: string
          layout: Json
          mime_type: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          content_base64: string
          file_name: string
          id?: string
          layout?: Json
          mime_type: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          content_base64?: string
          file_name?: string
          id?: string
          layout?: Json
          mime_type?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      creative_templates: {
        Row: {
          config: Json
          content_type: string
          data_url: string
          file_name: string
          height: number | null
          model: string
          updated_at: string
          updated_by: string | null
          width: number | null
        }
        Insert: {
          config?: Json
          content_type?: string
          data_url: string
          file_name: string
          height?: number | null
          model: string
          updated_at?: string
          updated_by?: string | null
          width?: number | null
        }
        Update: {
          config?: Json
          content_type?: string
          data_url?: string
          file_name?: string
          height?: number | null
          model?: string
          updated_at?: string
          updated_by?: string | null
          width?: number | null
        }
        Relationships: []
      }
      crm_automation_settings: {
        Row: {
          id: boolean
          material_url: string | null
          sync_interval_minutes: number
          updated_at: string
          welcome_body: string | null
          welcome_enabled: boolean
          welcome_template_id: string
        }
        Insert: {
          id?: boolean
          material_url?: string | null
          sync_interval_minutes?: number
          updated_at?: string
          welcome_body?: string | null
          welcome_enabled?: boolean
          welcome_template_id?: string
        }
        Update: {
          id?: boolean
          material_url?: string | null
          sync_interval_minutes?: number
          updated_at?: string
          welcome_body?: string | null
          welcome_enabled?: boolean
          welcome_template_id?: string
        }
        Relationships: []
      }
      crm_cadence_tasks: {
        Row: {
          channel: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          cycle_date: string
          due_date: string
          id: string
          lead_id: string
          note: string | null
          status: string
          step_day: number
          updated_at: string
        }
        Insert: {
          channel?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          cycle_date?: string
          due_date: string
          id?: string
          lead_id: string
          note?: string | null
          status?: string
          step_day: number
          updated_at?: string
        }
        Update: {
          channel?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          cycle_date?: string
          due_date?: string
          id?: string
          lead_id?: string
          note?: string | null
          status?: string
          step_day?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_cadence_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_connections: {
        Row: {
          account_email: string | null
          account_label: string | null
          created_at: string
          credentials_ciphertext: string | null
          id: string
          last_verified_at: string | null
          provider: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_email?: string | null
          account_label?: string | null
          created_at?: string
          credentials_ciphertext?: string | null
          id?: string
          last_verified_at?: string | null
          provider?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_email?: string | null
          account_label?: string | null
          created_at?: string
          credentials_ciphertext?: string | null
          id?: string
          last_verified_at?: string | null
          provider?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      crm_lead_events: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          lead_id: string
          message: string | null
          type: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          lead_id: string
          message?: string | null
          type: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          lead_id?: string
          message?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          capture_form: string | null
          created_at: string
          email: string
          entry_count: number
          external_created_at: string | null
          external_id: string
          external_pipeline_id: string | null
          external_source: string
          external_stage_id: string | null
          id: string
          ingested_at: string
          last_entry_at: string | null
          last_synced_at: string | null
          name: string
          origin: string | null
          phone: string
          pipeline_name: string | null
          raw_payload: Json | null
          stage_key: string | null
          sync_error: string | null
          sync_status: string
          updated_at: string
          welcome_attempts: number
          welcome_error: string | null
          welcome_link: string | null
          welcome_sent_at: string | null
          welcome_started_at: string | null
          welcome_status: string
          welcome_template: string | null
        }
        Insert: {
          capture_form?: string | null
          created_at?: string
          email?: string
          entry_count?: number
          external_created_at?: string | null
          external_id: string
          external_pipeline_id?: string | null
          external_source?: string
          external_stage_id?: string | null
          id?: string
          ingested_at?: string
          last_entry_at?: string | null
          last_synced_at?: string | null
          name?: string
          origin?: string | null
          phone?: string
          pipeline_name?: string | null
          raw_payload?: Json | null
          stage_key?: string | null
          sync_error?: string | null
          sync_status?: string
          updated_at?: string
          welcome_attempts?: number
          welcome_error?: string | null
          welcome_link?: string | null
          welcome_sent_at?: string | null
          welcome_started_at?: string | null
          welcome_status?: string
          welcome_template?: string | null
        }
        Update: {
          capture_form?: string | null
          created_at?: string
          email?: string
          entry_count?: number
          external_created_at?: string | null
          external_id?: string
          external_pipeline_id?: string | null
          external_source?: string
          external_stage_id?: string | null
          id?: string
          ingested_at?: string
          last_entry_at?: string | null
          last_synced_at?: string | null
          name?: string
          origin?: string | null
          phone?: string
          pipeline_name?: string | null
          raw_payload?: Json | null
          stage_key?: string | null
          sync_error?: string | null
          sync_status?: string
          updated_at?: string
          welcome_attempts?: number
          welcome_error?: string | null
          welcome_link?: string | null
          welcome_sent_at?: string | null
          welcome_started_at?: string | null
          welcome_status?: string
          welcome_template?: string | null
        }
        Relationships: []
      }
      crm_messages: {
        Row: {
          at: string
          author_id: string
          author_name: string | null
          body: string
          created_at: string
          direction: string
          id: string
          investor_id: string
        }
        Insert: {
          at?: string
          author_id: string
          author_name?: string | null
          body: string
          created_at?: string
          direction: string
          id: string
          investor_id: string
        }
        Update: {
          at?: string
          author_id?: string
          author_name?: string | null
          body?: string
          created_at?: string
          direction?: string
          id?: string
          investor_id?: string
        }
        Relationships: []
      }
      crm_pipeline_stages: {
        Row: {
          created_at: string
          external_tag: string
          id: string
          is_entry: boolean
          key: string
          label: string
          pipeline_id: string
          position: number
          updated_at: string
          visible: boolean
        }
        Insert: {
          created_at?: string
          external_tag: string
          id?: string
          is_entry?: boolean
          key: string
          label: string
          pipeline_id: string
          position?: number
          updated_at?: string
          visible?: boolean
        }
        Update: {
          created_at?: string
          external_tag?: string
          id?: string
          is_entry?: boolean
          key?: string
          label?: string
          pipeline_id?: string
          position?: number
          updated_at?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "crm_pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pipelines: {
        Row: {
          active: boolean
          created_at: string
          external_id: string
          external_source: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          external_id: string
          external_source?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          external_id?: string
          external_source?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_sync_runs: {
        Row: {
          created_at: string
          created_count: number
          error_count: number
          finished_at: string | null
          found_count: number
          id: string
          last_error: string | null
          skipped_count: number
          started_at: string
          status: string
          trigger: string
          updated_count: number
          welcome_failed_count: number
          welcome_sent_count: number
        }
        Insert: {
          created_at?: string
          created_count?: number
          error_count?: number
          finished_at?: string | null
          found_count?: number
          id?: string
          last_error?: string | null
          skipped_count?: number
          started_at?: string
          status?: string
          trigger?: string
          updated_count?: number
          welcome_failed_count?: number
          welcome_sent_count?: number
        }
        Update: {
          created_at?: string
          created_count?: number
          error_count?: number
          finished_at?: string | null
          found_count?: number
          id?: string
          last_error?: string | null
          skipped_count?: number
          started_at?: string
          status?: string
          trigger?: string
          updated_count?: number
          welcome_failed_count?: number
          welcome_sent_count?: number
        }
        Relationships: []
      }
      crm_timeline: {
        Row: {
          actor_id: string | null
          at: string
          created_at: string
          event: string
          id: string
          investor_id: string
          origin: string
          owner_id: string | null
          reason: string
        }
        Insert: {
          actor_id?: string | null
          at?: string
          created_at?: string
          event: string
          id: string
          investor_id: string
          origin?: string
          owner_id?: string | null
          reason?: string
        }
        Update: {
          actor_id?: string | null
          at?: string
          created_at?: string
          event?: string
          id?: string
          investor_id?: string
          origin?: string
          owner_id?: string | null
          reason?: string
        }
        Relationships: []
      }
      executive_profiles: {
        Row: {
          created_at: string
          email: string
          executive_id: string
          name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          executive_id: string
          name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          executive_id?: string
          name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      knowledge_documents: {
        Row: {
          chunks: Json
          created_by: string | null
          description: string | null
          id: string
          name: string
          size_bytes: number
          status: string
          type: string
          updated_at: string
          uploaded_at: string
          uploaded_by_name: string
          uploaded_by_user_id: string
          visibility: string
          workspace_id: string
        }
        Insert: {
          chunks?: Json
          created_by?: string | null
          description?: string | null
          id: string
          name: string
          size_bytes?: number
          status?: string
          type?: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by_name?: string
          uploaded_by_user_id?: string
          visibility?: string
          workspace_id: string
        }
        Update: {
          chunks?: Json
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          size_bytes?: number
          status?: string
          type?: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by_name?: string
          uploaded_by_user_id?: string
          visibility?: string
          workspace_id?: string
        }
        Relationships: []
      }
      meta_templates: {
        Row: {
          body: string
          category: string
          created_at: string
          created_by: string
          id: string
          language: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          body?: string
          category?: string
          created_at?: string
          created_by?: string
          id: string
          language?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          created_by?: string
          id?: string
          language?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      news_posts: {
        Row: {
          audience: string
          author_id: string
          author_name: string
          body: string
          created_at: string
          id: string
          image_url: string | null
          published_at: string | null
          status: string
          summary: string
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          audience?: string
          author_id?: string
          author_name?: string
          body?: string
          created_at?: string
          id: string
          image_url?: string | null
          published_at?: string | null
          status?: string
          summary?: string
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          audience?: string
          author_id?: string
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          image_url?: string | null
          published_at?: string | null
          status?: string
          summary?: string
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      portal_backup_blobs: {
        Row: {
          created_at: string
          hash: string
          payload: Json
          size_bytes: number
        }
        Insert: {
          created_at?: string
          hash: string
          payload: Json
          size_bytes?: number
        }
        Update: {
          created_at?: string
          hash?: string
          payload?: Json
          size_bytes?: number
        }
        Relationships: []
      }
      portal_backups: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_name: string
          id: string
          kind: string
          label: string
          origin: string
          payload: Json
          payload_hash: string | null
          protected: boolean
          size_bytes: number
          status: string
          table_counts: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          id?: string
          kind?: string
          label: string
          origin?: string
          payload?: Json
          payload_hash?: string | null
          protected?: boolean
          size_bytes?: number
          status?: string
          table_counts?: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          id?: string
          kind?: string
          label?: string
          origin?: string
          payload?: Json
          payload_hash?: string | null
          protected?: boolean
          size_bytes?: number
          status?: string
          table_counts?: Json
        }
        Relationships: []
      }
      portal_engagement: {
        Row: {
          active_ms: number
          created_at: string
          first_access_at: string
          investor_id: string
          last_access_at: string
          modules: Json
          returns: number
          session_started_at: string
          sessions: number
          updated_at: string
        }
        Insert: {
          active_ms?: number
          created_at?: string
          first_access_at?: string
          investor_id: string
          last_access_at?: string
          modules?: Json
          returns?: number
          session_started_at?: string
          sessions?: number
          updated_at?: string
        }
        Update: {
          active_ms?: number
          created_at?: string
          first_access_at?: string
          investor_id?: string
          last_access_at?: string
          modules?: Json
          returns?: number
          session_started_at?: string
          sessions?: number
          updated_at?: string
        }
        Relationships: []
      }
      portal_journey_events: {
        Row: {
          created_at: string
          detail: string | null
          event: string
          id: string
          investor_id: string
          module: string | null
          percent: number | null
        }
        Insert: {
          created_at?: string
          detail?: string | null
          event: string
          id?: string
          investor_id: string
          module?: string | null
          percent?: number | null
        }
        Update: {
          created_at?: string
          detail?: string | null
          event?: string
          id?: string
          investor_id?: string
          module?: string | null
          percent?: number | null
        }
        Relationships: []
      }
      portal_leads: {
        Row: {
          campaign: string | null
          city: string
          created_at: string
          device: string | null
          email: string
          external_created_at: string | null
          external_id: string | null
          external_payload: Json | null
          external_source: string | null
          external_updated_at: string | null
          id: string
          journey: Json
          journey_chapter: string | null
          journey_completed_at: string | null
          journey_first_access_at: string | null
          journey_last_event_at: string | null
          journey_percent: number
          journey_stage: string | null
          journey_started_at: string | null
          last_activity_at: string
          material: string
          name: string
          origin: string
          personalized: boolean
          portal_release_reason: string | null
          portal_released_at: string | null
          portal_released_by: string | null
          responsible_executive_id: string | null
          responsible_executive_slug: string | null
          scope: string
          updated_at: string
          whatsapp: string
          whatsapp_confirmed_at: string | null
        }
        Insert: {
          campaign?: string | null
          city?: string
          created_at?: string
          device?: string | null
          email: string
          external_created_at?: string | null
          external_id?: string | null
          external_payload?: Json | null
          external_source?: string | null
          external_updated_at?: string | null
          id: string
          journey?: Json
          journey_chapter?: string | null
          journey_completed_at?: string | null
          journey_first_access_at?: string | null
          journey_last_event_at?: string | null
          journey_percent?: number
          journey_stage?: string | null
          journey_started_at?: string | null
          last_activity_at?: string
          material?: string
          name: string
          origin?: string
          personalized?: boolean
          portal_release_reason?: string | null
          portal_released_at?: string | null
          portal_released_by?: string | null
          responsible_executive_id?: string | null
          responsible_executive_slug?: string | null
          scope?: string
          updated_at?: string
          whatsapp?: string
          whatsapp_confirmed_at?: string | null
        }
        Update: {
          campaign?: string | null
          city?: string
          created_at?: string
          device?: string | null
          email?: string
          external_created_at?: string | null
          external_id?: string | null
          external_payload?: Json | null
          external_source?: string | null
          external_updated_at?: string | null
          id?: string
          journey?: Json
          journey_chapter?: string | null
          journey_completed_at?: string | null
          journey_first_access_at?: string | null
          journey_last_event_at?: string | null
          journey_percent?: number
          journey_stage?: string | null
          journey_started_at?: string | null
          last_activity_at?: string
          material?: string
          name?: string
          origin?: string
          personalized?: boolean
          portal_release_reason?: string | null
          portal_released_at?: string | null
          portal_released_by?: string | null
          responsible_executive_id?: string | null
          responsible_executive_slug?: string | null
          scope?: string
          updated_at?: string
          whatsapp?: string
          whatsapp_confirmed_at?: string | null
        }
        Relationships: []
      }
      portal_restores: {
        Row: {
          backup_id: string | null
          created_at: string
          details: string
          id: string
          performed_by: string | null
          performed_by_name: string
          safety_backup_id: string | null
          status: string
        }
        Insert: {
          backup_id?: string | null
          created_at?: string
          details?: string
          id?: string
          performed_by?: string | null
          performed_by_name?: string
          safety_backup_id?: string | null
          status?: string
        }
        Update: {
          backup_id?: string | null
          created_at?: string
          details?: string
          id?: string
          performed_by?: string | null
          performed_by_name?: string
          safety_backup_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_restores_backup_id_fkey"
            columns: ["backup_id"]
            isOneToOne: false
            referencedRelation: "portal_backups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_restores_safety_backup_id_fkey"
            columns: ["safety_backup_id"]
            isOneToOne: false
            referencedRelation: "portal_backups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_validations: {
        Row: {
          created_at: string
          id: string
          investor_name: string | null
          journey_id: string | null
          phone: string
          raw: Json | null
          responded_at: string | null
          status: string
          template_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          investor_name?: string | null
          journey_id?: string | null
          phone: string
          raw?: Json | null
          responded_at?: string | null
          status?: string
          template_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          investor_name?: string | null
          journey_id?: string | null
          phone?: string
          raw?: Json | null
          responded_at?: string | null
          status?: string
          template_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_investor: { Args: { _investor_id: string }; Returns: boolean }
      current_executive_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "user"
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
    Enums: {
      app_role: ["admin", "manager", "user"],
    },
  },
} as const
