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
      automation_credentials: {
        Row: {
          created_at: string
          name: string
          rotated_at: string
          secret: string
        }
        Insert: {
          created_at?: string
          name: string
          rotated_at?: string
          secret: string
        }
        Update: {
          created_at?: string
          name?: string
          rotated_at?: string
          secret?: string
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
          cadence_activation_date: string | null
          id: boolean
          material_url: string | null
          sync_interval_minutes: number
          updated_at: string
          welcome_body: string | null
          welcome_enabled: boolean
          welcome_template_id: string
        }
        Insert: {
          cadence_activation_date?: string | null
          id?: boolean
          material_url?: string | null
          sync_interval_minutes?: number
          updated_at?: string
          welcome_body?: string | null
          welcome_enabled?: boolean
          welcome_template_id?: string
        }
        Update: {
          cadence_activation_date?: string | null
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
          outcome: string | null
          status: string
          step_day: number
          step_key: string | null
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
          outcome?: string | null
          status?: string
          step_day: number
          step_key?: string | null
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
          outcome?: string | null
          status?: string
          step_day?: number
          step_key?: string | null
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
          entered_entry_stage_at: string | null
          entry_count: number
          external_created_at: string | null
          external_id: string
          external_pipeline_id: string | null
          external_source: string
          external_stage_id: string | null
          external_status: string | null
          id: string
          ingested_at: string
          is_test: boolean
          last_entry_at: string | null
          last_synced_at: string | null
          manual_overrides: Json
          name: string
          origin: string | null
          phone: string
          pipeline_name: string | null
          raw_payload: Json | null
          remarketing: boolean
          stage_entered_at: string | null
          stage_key: string | null
          sync_error: string | null
          sync_status: string
          tags: Json
          test_batch_id: string | null
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
          entered_entry_stage_at?: string | null
          entry_count?: number
          external_created_at?: string | null
          external_id: string
          external_pipeline_id?: string | null
          external_source?: string
          external_stage_id?: string | null
          external_status?: string | null
          id?: string
          ingested_at?: string
          is_test?: boolean
          last_entry_at?: string | null
          last_synced_at?: string | null
          manual_overrides?: Json
          name?: string
          origin?: string | null
          phone?: string
          pipeline_name?: string | null
          raw_payload?: Json | null
          remarketing?: boolean
          stage_entered_at?: string | null
          stage_key?: string | null
          sync_error?: string | null
          sync_status?: string
          tags?: Json
          test_batch_id?: string | null
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
          entered_entry_stage_at?: string | null
          entry_count?: number
          external_created_at?: string | null
          external_id?: string
          external_pipeline_id?: string | null
          external_source?: string
          external_stage_id?: string | null
          external_status?: string | null
          id?: string
          ingested_at?: string
          is_test?: boolean
          last_entry_at?: string | null
          last_synced_at?: string | null
          manual_overrides?: Json
          name?: string
          origin?: string | null
          phone?: string
          pipeline_name?: string | null
          raw_payload?: Json | null
          remarketing?: boolean
          stage_entered_at?: string | null
          stage_key?: string | null
          sync_error?: string | null
          sync_status?: string
          tags?: Json
          test_batch_id?: string | null
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
          simulated: boolean
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
          simulated?: boolean
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
          simulated?: boolean
        }
        Relationships: []
      }
      crm_meta_templates: {
        Row: {
          body: string | null
          buttons: Json
          category: string | null
          created_at: string
          created_by: string | null
          created_by_name: string
          footer: string | null
          header: string | null
          id: string
          language: string | null
          meta_id: string | null
          meta_name: string
          meta_updated_at: string | null
          notes: string | null
          purpose: string
          status: string | null
          updated_at: string
          variables: Json
        }
        Insert: {
          body?: string | null
          buttons?: Json
          category?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          footer?: string | null
          header?: string | null
          id?: string
          language?: string | null
          meta_id?: string | null
          meta_name: string
          meta_updated_at?: string | null
          notes?: string | null
          purpose?: string
          status?: string | null
          updated_at?: string
          variables?: Json
        }
        Update: {
          body?: string | null
          buttons?: Json
          category?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          footer?: string | null
          header?: string | null
          id?: string
          language?: string | null
          meta_id?: string | null
          meta_name?: string
          meta_updated_at?: string | null
          notes?: string | null
          purpose?: string
          status?: string | null
          updated_at?: string
          variables?: Json
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
          simulated: boolean
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
          simulated?: boolean
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
          simulated?: boolean
        }
        Relationships: []
      }
      executive_profiles: {
        Row: {
          admission_date: string | null
          birth_date: string | null
          created_at: string
          email: string
          executive_id: string
          gestor_id: string | null
          name: string | null
          phone: string | null
          photo_url: string | null
          post_presentation_video_url: string | null
          role_title: string | null
          slug: string | null
          title: string | null
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          admission_date?: string | null
          birth_date?: string | null
          created_at?: string
          email: string
          executive_id: string
          gestor_id?: string | null
          name?: string | null
          phone?: string | null
          photo_url?: string | null
          post_presentation_video_url?: string | null
          role_title?: string | null
          slug?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          admission_date?: string | null
          birth_date?: string | null
          created_at?: string
          email?: string
          executive_id?: string
          gestor_id?: string | null
          name?: string | null
          phone?: string | null
          photo_url?: string | null
          post_presentation_video_url?: string | null
          role_title?: string | null
          slug?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      executive_user_status: {
        Row: {
          executive_id: string
          status: string
          updated_at: string
          updated_by_name: string | null
        }
        Insert: {
          executive_id: string
          status?: string
          updated_at?: string
          updated_by_name?: string | null
        }
        Update: {
          executive_id?: string
          status?: string
          updated_at?: string
          updated_by_name?: string | null
        }
        Relationships: []
      }
      group_unit_lead_events: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          at: string
          created_at: string
          from_status: string | null
          id: string
          kind: string
          lead_id: string
          metadata: Json
          note: string | null
          reason: string | null
          to_status: string | null
          unit: string
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          at?: string
          created_at?: string
          from_status?: string | null
          id?: string
          kind: string
          lead_id: string
          metadata?: Json
          note?: string | null
          reason?: string | null
          to_status?: string | null
          unit: string
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          at?: string
          created_at?: string
          from_status?: string | null
          id?: string
          kind?: string
          lead_id?: string
          metadata?: Json
          note?: string | null
          reason?: string | null
          to_status?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_unit_lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "group_unit_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      group_unit_leads: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          assigned_by_name: string | null
          campaign: string | null
          city: string | null
          close_reason: string | null
          contact_note: string | null
          created_at: string
          email: string | null
          email_key: string | null
          first_contact_at: string | null
          first_contact_by: string | null
          first_contact_by_name: string | null
          first_contact_status: string
          from_group: boolean
          id: string
          investment_range: string
          last_submitted_at: string | null
          name: string
          notes: string | null
          origin: string | null
          responsible_executive_id: string | null
          responsible_executive_name: string | null
          status: string
          submissions: number
          unit: string
          updated_at: string
          whatsapp: string
          whatsapp_key: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_by_name?: string | null
          campaign?: string | null
          city?: string | null
          close_reason?: string | null
          contact_note?: string | null
          created_at?: string
          email?: string | null
          email_key?: string | null
          first_contact_at?: string | null
          first_contact_by?: string | null
          first_contact_by_name?: string | null
          first_contact_status?: string
          from_group?: boolean
          id?: string
          investment_range: string
          last_submitted_at?: string | null
          name: string
          notes?: string | null
          origin?: string | null
          responsible_executive_id?: string | null
          responsible_executive_name?: string | null
          status?: string
          submissions?: number
          unit: string
          updated_at?: string
          whatsapp: string
          whatsapp_key?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_by_name?: string | null
          campaign?: string | null
          city?: string | null
          close_reason?: string | null
          contact_note?: string | null
          created_at?: string
          email?: string | null
          email_key?: string | null
          first_contact_at?: string | null
          first_contact_by?: string | null
          first_contact_by_name?: string | null
          first_contact_status?: string
          from_group?: boolean
          id?: string
          investment_range?: string
          last_submitted_at?: string | null
          name?: string
          notes?: string | null
          origin?: string | null
          responsible_executive_id?: string | null
          responsible_executive_name?: string | null
          status?: string
          submissions?: number
          unit?: string
          updated_at?: string
          whatsapp?: string
          whatsapp_key?: string | null
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
      magazine_editions: {
        Row: {
          cover_url: string | null
          created_at: string
          created_by: string | null
          created_by_name: string
          id: string
          number: number
          published: boolean
          starts_on: string
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          id?: string
          number: number
          published?: boolean
          starts_on?: string
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          id?: string
          number?: number
          published?: boolean
          starts_on?: string
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      magazine_pages: {
        Row: {
          body: string
          caption: string | null
          created_at: string
          edition_id: string
          eyebrow: string | null
          id: string
          media_kind: string
          media_url: string | null
          position: number
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          caption?: string | null
          created_at?: string
          edition_id: string
          eyebrow?: string | null
          id?: string
          media_kind?: string
          media_url?: string | null
          position?: number
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          caption?: string | null
          created_at?: string
          edition_id?: string
          eyebrow?: string | null
          id?: string
          media_kind?: string
          media_url?: string | null
          position?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "magazine_pages_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "magazine_editions"
            referencedColumns: ["id"]
          },
        ]
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
      portal_backup_requests: {
        Row: {
          attempts: number
          backup_id: string | null
          completed_at: string | null
          created_at: string
          id: string
          last_error: string | null
          lease_expires_at: string | null
          lease_owner: string | null
          reference_hour: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          backup_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          lease_expires_at?: string | null
          lease_owner?: string | null
          reference_hour: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          backup_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          lease_expires_at?: string | null
          lease_owner?: string | null
          reference_hour?: string
          started_at?: string | null
          status?: string
          updated_at?: string
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
          last_error: string | null
          origin: string
          payload: Json
          payload_hash: string | null
          protected: boolean
          reference_hour: string | null
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
          last_error?: string | null
          origin?: string
          payload?: Json
          payload_hash?: string | null
          protected?: boolean
          reference_hour?: string | null
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
          last_error?: string | null
          origin?: string
          payload?: Json
          payload_hash?: string | null
          protected?: boolean
          reference_hour?: string | null
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
          modules_last: Json
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
          modules_last?: Json
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
          modules_last?: Json
          returns?: number
          session_started_at?: string
          sessions?: number
          updated_at?: string
        }
        Relationships: []
      }
      portal_institutional_blocks: {
        Row: {
          active: boolean
          body: string
          created_at: string
          eyebrow: string | null
          id: string
          media_kind: string
          media_url: string | null
          module: string
          position: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          body?: string
          created_at?: string
          eyebrow?: string | null
          id?: string
          media_kind?: string
          media_url?: string | null
          module: string
          position?: number
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          eyebrow?: string | null
          id?: string
          media_kind?: string
          media_url?: string | null
          module?: string
          position?: number
          title?: string
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
      portal_lead_guard_log: {
        Row: {
          actor_label: string | null
          actor_user_id: string | null
          created_at: string
          id: string
          lead_id: string | null
          lead_name: string | null
          operation: string
          reason: string
          table_name: string
        }
        Insert: {
          actor_label?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          lead_name?: string | null
          operation: string
          reason: string
          table_name: string
        }
        Update: {
          actor_label?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          lead_name?: string | null
          operation?: string
          reason?: string
          table_name?: string
        }
        Relationships: []
      }
      portal_leads: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          campaign: string | null
          city: string
          closed_at: string | null
          commercial_state: string
          conversation_window_opened_at: string | null
          created_at: string
          device: string | null
          email: string
          external_created_at: string | null
          external_id: string | null
          external_payload: Json | null
          external_source: string | null
          external_updated_at: string | null
          id: string
          identity_alternates: Json
          identity_conflict: Json | null
          identity_key: string | null
          is_private: boolean
          is_test: boolean
          journey: Json
          journey_chapter: string | null
          journey_completed_at: string | null
          journey_first_access_at: string | null
          journey_last_event_at: string | null
          journey_percent: number
          journey_stage: string | null
          journey_started_at: string | null
          last_activity_at: string
          last_inbound_at: string | null
          last_outbound_at: string | null
          manual_overrides: Json
          material: string
          name: string
          notes: string
          origin: string
          ownership_claimed_at: string | null
          ownership_origin: string | null
          personalized: boolean
          portal_release_reason: string | null
          portal_released_at: string | null
          portal_released_by: string | null
          relationship_source: string | null
          relationship_started_at: string | null
          relationship_started_by: string | null
          relationship_started_by_name: string | null
          responsible_executive_id: string | null
          responsible_executive_slug: string | null
          restored_at: string | null
          restored_by: string | null
          scope: string
          test_batch_id: string | null
          updated_at: string
          viewed_at: string | null
          whatsapp: string
          whatsapp_confirmed_at: string | null
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          campaign?: string | null
          city?: string
          closed_at?: string | null
          commercial_state?: string
          conversation_window_opened_at?: string | null
          created_at?: string
          device?: string | null
          email: string
          external_created_at?: string | null
          external_id?: string | null
          external_payload?: Json | null
          external_source?: string | null
          external_updated_at?: string | null
          id: string
          identity_alternates?: Json
          identity_conflict?: Json | null
          identity_key?: string | null
          is_private?: boolean
          is_test?: boolean
          journey?: Json
          journey_chapter?: string | null
          journey_completed_at?: string | null
          journey_first_access_at?: string | null
          journey_last_event_at?: string | null
          journey_percent?: number
          journey_stage?: string | null
          journey_started_at?: string | null
          last_activity_at?: string
          last_inbound_at?: string | null
          last_outbound_at?: string | null
          manual_overrides?: Json
          material?: string
          name: string
          notes?: string
          origin?: string
          ownership_claimed_at?: string | null
          ownership_origin?: string | null
          personalized?: boolean
          portal_release_reason?: string | null
          portal_released_at?: string | null
          portal_released_by?: string | null
          relationship_source?: string | null
          relationship_started_at?: string | null
          relationship_started_by?: string | null
          relationship_started_by_name?: string | null
          responsible_executive_id?: string | null
          responsible_executive_slug?: string | null
          restored_at?: string | null
          restored_by?: string | null
          scope?: string
          test_batch_id?: string | null
          updated_at?: string
          viewed_at?: string | null
          whatsapp?: string
          whatsapp_confirmed_at?: string | null
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          campaign?: string | null
          city?: string
          closed_at?: string | null
          commercial_state?: string
          conversation_window_opened_at?: string | null
          created_at?: string
          device?: string | null
          email?: string
          external_created_at?: string | null
          external_id?: string | null
          external_payload?: Json | null
          external_source?: string | null
          external_updated_at?: string | null
          id?: string
          identity_alternates?: Json
          identity_conflict?: Json | null
          identity_key?: string | null
          is_private?: boolean
          is_test?: boolean
          journey?: Json
          journey_chapter?: string | null
          journey_completed_at?: string | null
          journey_first_access_at?: string | null
          journey_last_event_at?: string | null
          journey_percent?: number
          journey_stage?: string | null
          journey_started_at?: string | null
          last_activity_at?: string
          last_inbound_at?: string | null
          last_outbound_at?: string | null
          manual_overrides?: Json
          material?: string
          name?: string
          notes?: string
          origin?: string
          ownership_claimed_at?: string | null
          ownership_origin?: string | null
          personalized?: boolean
          portal_release_reason?: string | null
          portal_released_at?: string | null
          portal_released_by?: string | null
          relationship_source?: string | null
          relationship_started_at?: string | null
          relationship_started_by?: string | null
          relationship_started_by_name?: string | null
          responsible_executive_id?: string | null
          responsible_executive_slug?: string | null
          restored_at?: string | null
          restored_by?: string | null
          scope?: string
          test_batch_id?: string | null
          updated_at?: string
          viewed_at?: string | null
          whatsapp?: string
          whatsapp_confirmed_at?: string | null
        }
        Relationships: []
      }
      portal_meetings: {
        Row: {
          cancel_reason: string | null
          created_at: string
          duration_min: number
          executive_id: string
          executive_name: string
          google_event_id: string | null
          google_sync: string
          google_sync_error: string | null
          google_synced_at: string | null
          id: string
          investor_email: string | null
          investor_id: string
          investor_name: string
          meet_url: string | null
          meeting_provider: string | null
          meeting_provider_meeting_id: string | null
          meeting_provider_status: string | null
          meeting_provider_url: string | null
          notes: Json
          origin: string
          requested_slots: Json
          scheduled_at: string
          status: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          cancel_reason?: string | null
          created_at?: string
          duration_min?: number
          executive_id: string
          executive_name: string
          google_event_id?: string | null
          google_sync?: string
          google_sync_error?: string | null
          google_synced_at?: string | null
          id: string
          investor_email?: string | null
          investor_id: string
          investor_name: string
          meet_url?: string | null
          meeting_provider?: string | null
          meeting_provider_meeting_id?: string | null
          meeting_provider_status?: string | null
          meeting_provider_url?: string | null
          notes?: Json
          origin?: string
          requested_slots?: Json
          scheduled_at: string
          status: string
          topic?: string | null
          updated_at?: string
        }
        Update: {
          cancel_reason?: string | null
          created_at?: string
          duration_min?: number
          executive_id?: string
          executive_name?: string
          google_event_id?: string | null
          google_sync?: string
          google_sync_error?: string | null
          google_synced_at?: string | null
          id?: string
          investor_email?: string | null
          investor_id?: string
          investor_name?: string
          meet_url?: string | null
          meeting_provider?: string | null
          meeting_provider_meeting_id?: string | null
          meeting_provider_status?: string | null
          meeting_provider_url?: string | null
          notes?: Json
          origin?: string
          requested_slots?: Json
          scheduled_at?: string
          status?: string
          topic?: string | null
          updated_at?: string
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
      presentation_chapters: {
        Row: {
          chapter_key: string
          created_at: string
          created_by: string | null
          created_by_name: string | null
          description: string | null
          id: string
          is_active: boolean
          is_current: boolean
          is_draft: boolean
          published_at: string | null
          published_by: string | null
          published_by_name: string | null
          sort_order: number
          thumbnail_url: string | null
          title: string
          updated_at: string
          version: number
          video_url: string | null
        }
        Insert: {
          chapter_key?: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_current?: boolean
          is_draft?: boolean
          published_at?: string | null
          published_by?: string | null
          published_by_name?: string | null
          sort_order?: number
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          version?: number
          video_url?: string | null
        }
        Update: {
          chapter_key?: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_current?: boolean
          is_draft?: boolean
          published_at?: string | null
          published_by?: string | null
          published_by_name?: string | null
          sort_order?: number
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          version?: number
          video_url?: string | null
        }
        Relationships: []
      }
      relationship_cadences: {
        Row: {
          active: boolean
          auto_reply_last_at: string | null
          auto_reply_total_count: number
          auto_reply_window_count: number
          auto_reply_window_started_at: string | null
          close_reason: string | null
          closed_at: string | null
          content_history: Json
          created_at: string
          current_step: string | null
          ended_at: string | null
          executed_steps: Json
          flow: string
          id: string
          instance_seq: number
          last_event_at: string | null
          last_event_type: string | null
          last_executive_reply_at: string | null
          last_inbound_at: string | null
          last_outbound_at: string | null
          lead_id: string
          name_confirmed: boolean
          opened_reason: string | null
          opening_template_history: Json
          previous_state: string | null
          read_count: number
          response_count: number
          run_id: string | null
          scheduled: boolean
          scope: string
          started_at: string | null
          started_by: string | null
          state: string
          updated_at: string
          window_open_until: string | null
        }
        Insert: {
          active?: boolean
          auto_reply_last_at?: string | null
          auto_reply_total_count?: number
          auto_reply_window_count?: number
          auto_reply_window_started_at?: string | null
          close_reason?: string | null
          closed_at?: string | null
          content_history?: Json
          created_at?: string
          current_step?: string | null
          ended_at?: string | null
          executed_steps?: Json
          flow: string
          id?: string
          instance_seq?: number
          last_event_at?: string | null
          last_event_type?: string | null
          last_executive_reply_at?: string | null
          last_inbound_at?: string | null
          last_outbound_at?: string | null
          lead_id: string
          name_confirmed?: boolean
          opened_reason?: string | null
          opening_template_history?: Json
          previous_state?: string | null
          read_count?: number
          response_count?: number
          run_id?: string | null
          scheduled?: boolean
          scope: string
          started_at?: string | null
          started_by?: string | null
          state: string
          updated_at?: string
          window_open_until?: string | null
        }
        Update: {
          active?: boolean
          auto_reply_last_at?: string | null
          auto_reply_total_count?: number
          auto_reply_window_count?: number
          auto_reply_window_started_at?: string | null
          close_reason?: string | null
          closed_at?: string | null
          content_history?: Json
          created_at?: string
          current_step?: string | null
          ended_at?: string | null
          executed_steps?: Json
          flow?: string
          id?: string
          instance_seq?: number
          last_event_at?: string | null
          last_event_type?: string | null
          last_executive_reply_at?: string | null
          last_inbound_at?: string | null
          last_outbound_at?: string | null
          lead_id?: string
          name_confirmed?: boolean
          opened_reason?: string | null
          opening_template_history?: Json
          previous_state?: string | null
          read_count?: number
          response_count?: number
          run_id?: string | null
          scheduled?: boolean
          scope?: string
          started_at?: string | null
          started_by?: string | null
          state?: string
          updated_at?: string
          window_open_until?: string | null
        }
        Relationships: []
      }
      relationship_content_groups: {
        Row: {
          content_group: string
          content_id: string
          created_at: string
          id: string
        }
        Insert: {
          content_group: string
          content_id: string
          created_at?: string
          id?: string
        }
        Update: {
          content_group?: string
          content_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "relationship_content_groups_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "relationship_contents"
            referencedColumns: ["id"]
          },
        ]
      }
      relationship_contents: {
        Row: {
          active: boolean
          body: string | null
          content_group: string
          created_at: string
          description: string | null
          id: string
          kind: string
          last_used_at: string | null
          mime_type: string | null
          name: string
          scope: string
          updated_at: string
          url: string
          usage_count: number
        }
        Insert: {
          active?: boolean
          body?: string | null
          content_group: string
          created_at?: string
          description?: string | null
          id?: string
          kind: string
          last_used_at?: string | null
          mime_type?: string | null
          name: string
          scope?: string
          updated_at?: string
          url?: string
          usage_count?: number
        }
        Update: {
          active?: boolean
          body?: string | null
          content_group?: string
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          last_used_at?: string | null
          mime_type?: string | null
          name?: string
          scope?: string
          updated_at?: string
          url?: string
          usage_count?: number
        }
        Relationships: []
      }
      relationship_decisions: {
        Row: {
          content_id: string | null
          created_at: string
          decided_at: string
          error: string | null
          flow: string
          id: string
          lead_id: string
          outcome: string
          reason: string
          run_id: string | null
          scope: string
          state_after: string
          state_before: string
          step: string | null
          template_id: string | null
          template_version: number | null
        }
        Insert: {
          content_id?: string | null
          created_at?: string
          decided_at: string
          error?: string | null
          flow: string
          id?: string
          lead_id: string
          outcome: string
          reason: string
          run_id?: string | null
          scope: string
          state_after: string
          state_before: string
          step?: string | null
          template_id?: string | null
          template_version?: number | null
        }
        Update: {
          content_id?: string | null
          created_at?: string
          decided_at?: string
          error?: string | null
          flow?: string
          id?: string
          lead_id?: string
          outcome?: string
          reason?: string
          run_id?: string | null
          scope?: string
          state_after?: string
          state_before?: string
          step?: string | null
          template_id?: string | null
          template_version?: number | null
        }
        Relationships: []
      }
      relationship_e20_accesses: {
        Row: {
          accessed_at: string
          created_at: string
          id: string
          lead_id: string
          occurrence_id: string
          outcome: string
          user_agent: string | null
        }
        Insert: {
          accessed_at?: string
          created_at?: string
          id?: string
          lead_id: string
          occurrence_id: string
          outcome?: string
          user_agent?: string | null
        }
        Update: {
          accessed_at?: string
          created_at?: string
          id?: string
          lead_id?: string
          occurrence_id?: string
          outcome?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relationship_e20_accesses_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "relationship_e20_occurrences"
            referencedColumns: ["id"]
          },
        ]
      }
      relationship_e20_events: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          at: string
          created_at: string
          event: string
          id: string
          lead_id: string
          metadata: Json
          occurrence_id: string | null
          reason: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          at?: string
          created_at?: string
          event: string
          id?: string
          lead_id: string
          metadata?: Json
          occurrence_id?: string | null
          reason?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          at?: string
          created_at?: string
          event?: string
          id?: string
          lead_id?: string
          metadata?: Json
          occurrence_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relationship_e20_events_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "relationship_e20_occurrences"
            referencedColumns: ["id"]
          },
        ]
      }
      relationship_e20_occurrences: {
        Row: {
          cadence_id: string | null
          checkpoint_cancel_reason: string | null
          checkpoint_done_at: string | null
          checkpoint_due_at: string | null
          close_note: string | null
          close_reason: string | null
          closed_at: string | null
          closed_by: string | null
          closed_by_name: string | null
          created_at: string
          expires_at: string
          finalization_done_at: string | null
          finalization_due_on: string | null
          first_opened_at: string | null
          generated_at: string
          generated_by: string | null
          generated_by_executive_id: string | null
          generated_by_name: string
          id: string
          instance_seq: number
          lead_id: string
          link_url: string
          open_count: number
          scope: string
          script_version: number | null
          sent_by: string | null
          sent_by_name: string | null
          sent_confirmed_at: string | null
          snapshot: Json
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          cadence_id?: string | null
          checkpoint_cancel_reason?: string | null
          checkpoint_done_at?: string | null
          checkpoint_due_at?: string | null
          close_note?: string | null
          close_reason?: string | null
          closed_at?: string | null
          closed_by?: string | null
          closed_by_name?: string | null
          created_at?: string
          expires_at: string
          finalization_done_at?: string | null
          finalization_due_on?: string | null
          first_opened_at?: string | null
          generated_at?: string
          generated_by?: string | null
          generated_by_executive_id?: string | null
          generated_by_name?: string
          id?: string
          instance_seq?: number
          lead_id: string
          link_url: string
          open_count?: number
          scope?: string
          script_version?: number | null
          sent_by?: string | null
          sent_by_name?: string | null
          sent_confirmed_at?: string | null
          snapshot?: Json
          status?: string
          token: string
          updated_at?: string
        }
        Update: {
          cadence_id?: string | null
          checkpoint_cancel_reason?: string | null
          checkpoint_done_at?: string | null
          checkpoint_due_at?: string | null
          close_note?: string | null
          close_reason?: string | null
          closed_at?: string | null
          closed_by?: string | null
          closed_by_name?: string | null
          created_at?: string
          expires_at?: string
          finalization_done_at?: string | null
          finalization_due_on?: string | null
          first_opened_at?: string | null
          generated_at?: string
          generated_by?: string | null
          generated_by_executive_id?: string | null
          generated_by_name?: string
          id?: string
          instance_seq?: number
          lead_id?: string
          link_url?: string
          open_count?: number
          scope?: string
          script_version?: number | null
          sent_by?: string | null
          sent_by_name?: string | null
          sent_confirmed_at?: string | null
          snapshot?: Json
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      relationship_engine_log: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          details: Json
          id: string
          scope: string
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          details?: Json
          id?: string
          scope: string
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          details?: Json
          id?: string
          scope?: string
        }
        Relationships: []
      }
      relationship_events: {
        Row: {
          content_id: string | null
          created_at: string
          data: Json
          event_key: string
          historical: boolean
          id: string
          lead_id: string
          occurred_at: string
          run_id: string | null
          scope: string
          step: string | null
          template_id: string | null
          type: string
        }
        Insert: {
          content_id?: string | null
          created_at?: string
          data?: Json
          event_key: string
          historical?: boolean
          id?: string
          lead_id: string
          occurred_at: string
          run_id?: string | null
          scope: string
          step?: string | null
          template_id?: string | null
          type: string
        }
        Update: {
          content_id?: string | null
          created_at?: string
          data?: Json
          event_key?: string
          historical?: boolean
          id?: string
          lead_id?: string
          occurred_at?: string
          run_id?: string | null
          scope?: string
          step?: string | null
          template_id?: string | null
          type?: string
        }
        Relationships: []
      }
      relationship_message_library: {
        Row: {
          active: boolean
          body: string
          body_without_name: string | null
          button_kind: string | null
          code: string | null
          content_group: string | null
          created_at: string
          created_by: string | null
          created_by_name: string
          id: string
          import_version: number | null
          imported_at: string | null
          meta_template_name: string | null
          notes: string | null
          purpose: string
          requires_template: boolean
          requires_video: boolean
          scope: string
          source_kind: string | null
          source_reference: string | null
          step_key: string | null
          supersedes_id: string | null
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          body: string
          body_without_name?: string | null
          button_kind?: string | null
          code?: string | null
          content_group?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          id?: string
          import_version?: number | null
          imported_at?: string | null
          meta_template_name?: string | null
          notes?: string | null
          purpose: string
          requires_template?: boolean
          requires_video?: boolean
          scope?: string
          source_kind?: string | null
          source_reference?: string | null
          step_key?: string | null
          supersedes_id?: string | null
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          body?: string
          body_without_name?: string | null
          button_kind?: string | null
          code?: string | null
          content_group?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          id?: string
          import_version?: number | null
          imported_at?: string | null
          meta_template_name?: string | null
          notes?: string | null
          purpose?: string
          requires_template?: boolean
          requires_video?: boolean
          scope?: string
          source_kind?: string | null
          source_reference?: string | null
          step_key?: string | null
          supersedes_id?: string | null
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      relationship_message_sends: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          button_destinations: Json | null
          cadence_id: string | null
          channel: string
          contact_destination: string | null
          contact_phone: string | null
          content_id: string | null
          content_url: string | null
          created_at: string
          executive_id: string | null
          executive_name: string | null
          id: string
          instance_seq: number
          investor_name_used: string | null
          lead_id: string
          library_code: string | null
          library_id: string | null
          library_version: number | null
          message_id: string | null
          meta_template_name: string | null
          occurrence_id: string | null
          origin: string
          portal_destination: string | null
          purpose: string
          rendered_body: string
          scope: string
          sent_at: string
          simulated: boolean
          step: string
          template_body: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          button_destinations?: Json | null
          cadence_id?: string | null
          channel?: string
          contact_destination?: string | null
          contact_phone?: string | null
          content_id?: string | null
          content_url?: string | null
          created_at?: string
          executive_id?: string | null
          executive_name?: string | null
          id?: string
          instance_seq?: number
          investor_name_used?: string | null
          lead_id: string
          library_code?: string | null
          library_id?: string | null
          library_version?: number | null
          message_id?: string | null
          meta_template_name?: string | null
          occurrence_id?: string | null
          origin?: string
          portal_destination?: string | null
          purpose: string
          rendered_body: string
          scope?: string
          sent_at?: string
          simulated?: boolean
          step: string
          template_body?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          button_destinations?: Json | null
          cadence_id?: string | null
          channel?: string
          contact_destination?: string | null
          contact_phone?: string | null
          content_id?: string | null
          content_url?: string | null
          created_at?: string
          executive_id?: string | null
          executive_name?: string | null
          id?: string
          instance_seq?: number
          investor_name_used?: string | null
          lead_id?: string
          library_code?: string | null
          library_id?: string | null
          library_version?: number | null
          message_id?: string | null
          meta_template_name?: string | null
          occurrence_id?: string | null
          origin?: string
          portal_destination?: string | null
          purpose?: string
          rendered_body?: string
          scope?: string
          sent_at?: string
          simulated?: boolean
          step?: string
          template_body?: string | null
        }
        Relationships: []
      }
      relationship_non_business_days: {
        Row: {
          created_at: string
          created_by: string | null
          day: string
          id: string
          reason: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          day: string
          id?: string
          reason?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          day?: string
          id?: string
          reason?: string
          updated_at?: string
        }
        Relationships: []
      }
      relationship_queue: {
        Row: {
          attempts: number
          created_at: string
          due_at: string
          executed_at: string | null
          flow: string
          id: string
          lead_id: string
          priority: number
          reason: string | null
          result: string | null
          run_id: string | null
          scope: string
          status: string
          step: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          due_at: string
          executed_at?: string | null
          flow: string
          id?: string
          lead_id: string
          priority?: number
          reason?: string | null
          result?: string | null
          run_id?: string | null
          scope: string
          status?: string
          step: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          due_at?: string
          executed_at?: string | null
          flow?: string
          id?: string
          lead_id?: string
          priority?: number
          reason?: string | null
          result?: string | null
          run_id?: string | null
          scope?: string
          status?: string
          step?: string
          updated_at?: string
        }
        Relationships: []
      }
      relationship_sim_runs: {
        Row: {
          content_usage: Json
          created_at: string
          created_by: string | null
          created_by_name: string
          failed: number
          id: string
          label: string
          messages_count: number
          outside_hours: number
          passed: number
          report: Json
          run_id: string
          scenario_summary: Json
          status: string
          total_leads: number
        }
        Insert: {
          content_usage?: Json
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          failed?: number
          id?: string
          label: string
          messages_count?: number
          outside_hours?: number
          passed?: number
          report?: Json
          run_id: string
          scenario_summary?: Json
          status?: string
          total_leads?: number
        }
        Update: {
          content_usage?: Json
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          failed?: number
          id?: string
          label?: string
          messages_count?: number
          outside_hours?: number
          passed?: number
          report?: Json
          run_id?: string
          scenario_summary?: Json
          status?: string
          total_leads?: number
        }
        Relationships: []
      }
      relationship_step_content_bindings: {
        Row: {
          active: boolean
          content_id: string
          created_at: string
          created_by: string | null
          created_by_name: string
          id: string
          notes: string | null
          position: number
          scope: string
          step_key: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          content_id: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          id?: string
          notes?: string | null
          position?: number
          scope?: string
          step_key: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          content_id?: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          id?: string
          notes?: string | null
          position?: number
          scope?: string
          step_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "relationship_step_content_bindings_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "relationship_contents"
            referencedColumns: ["id"]
          },
        ]
      }
      relationship_template_bindings: {
        Row: {
          approved: boolean
          created_at: string
          id: string
          meta_id: string | null
          notes: string | null
          purpose: string
          scope: string
          template_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          approved?: boolean
          created_at?: string
          id?: string
          meta_id?: string | null
          notes?: string | null
          purpose: string
          scope: string
          template_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          approved?: boolean
          created_at?: string
          id?: string
          meta_id?: string | null
          notes?: string | null
          purpose?: string
          scope?: string
          template_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "relationship_template_bindings_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "crm_meta_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      remarketing_campaigns: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_name: string
          duplicate_count: number
          finished_at: string | null
          id: string
          invalid_count: number
          last_run_at: string | null
          name: string
          started_at: string | null
          status: string
          template_body: string
          template_label: string
          template_language: string | null
          template_name: string
          template_version: number
          total_count: number
          updated_at: string
          valid_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          duplicate_count?: number
          finished_at?: string | null
          id?: string
          invalid_count?: number
          last_run_at?: string | null
          name: string
          started_at?: string | null
          status?: string
          template_body?: string
          template_label?: string
          template_language?: string | null
          template_name: string
          template_version?: number
          total_count?: number
          updated_at?: string
          valid_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          duplicate_count?: number
          finished_at?: string | null
          id?: string
          invalid_count?: number
          last_run_at?: string | null
          name?: string
          started_at?: string | null
          status?: string
          template_body?: string
          template_label?: string
          template_language?: string | null
          template_name?: string
          template_version?: number
          total_count?: number
          updated_at?: string
          valid_count?: number
        }
        Relationships: []
      }
      remarketing_contacts: {
        Row: {
          campaign_id: string
          created_at: string
          error: string | null
          id: string
          phone: string
          raw_input: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          error?: string | null
          id?: string
          phone: string
          raw_input?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          error?: string | null
          id?: string
          phone?: string
          raw_input?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "remarketing_contacts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "remarketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      remarketing_conversations: {
        Row: {
          campaign_id: string | null
          campaign_name: string | null
          contact_name: string | null
          created_at: string
          id: string
          last_direction: string
          last_message_at: string
          last_message_preview: string
          phone: string
          status: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          campaign_name?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          last_direction?: string
          last_message_at?: string
          last_message_preview?: string
          phone: string
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          campaign_name?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          last_direction?: string
          last_message_at?: string
          last_message_preview?: string
          phone?: string
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "remarketing_conversations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "remarketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      remarketing_messages: {
        Row: {
          author_name: string | null
          body: string
          campaign_id: string | null
          campaign_version: number | null
          conversation_id: string
          created_at: string
          delivered: boolean
          direction: string
          error: string | null
          id: string
          kind: string
          occurred_at: string
          simulated: boolean
          template_label: string | null
          template_language: string | null
          template_name: string | null
        }
        Insert: {
          author_name?: string | null
          body?: string
          campaign_id?: string | null
          campaign_version?: number | null
          conversation_id: string
          created_at?: string
          delivered?: boolean
          direction: string
          error?: string | null
          id?: string
          kind?: string
          occurred_at?: string
          simulated?: boolean
          template_label?: string | null
          template_language?: string | null
          template_name?: string | null
        }
        Update: {
          author_name?: string | null
          body?: string
          campaign_id?: string | null
          campaign_version?: number | null
          conversation_id?: string
          created_at?: string
          delivered?: boolean
          direction?: string
          error?: string | null
          id?: string
          kind?: string
          occurred_at?: string
          simulated?: boolean
          template_label?: string | null
          template_language?: string | null
          template_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "remarketing_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "remarketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remarketing_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "remarketing_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      test_batch_events: {
        Row: {
          attempts: number
          batch_id: string
          card_id: string | null
          created_at: string
          created_lead_at: string | null
          e0_reason: string | null
          e0_result: string | null
          entry_type: string
          error: string | null
          executed_at: string | null
          external_id: string
          id: string
          lead_name: string
          position: number
          scheduled_at: string
          slot: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          batch_id: string
          card_id?: string | null
          created_at?: string
          created_lead_at?: string | null
          e0_reason?: string | null
          e0_result?: string | null
          entry_type: string
          error?: string | null
          executed_at?: string | null
          external_id: string
          id?: string
          lead_name: string
          position: number
          scheduled_at: string
          slot: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          batch_id?: string
          card_id?: string | null
          created_at?: string
          created_lead_at?: string | null
          e0_reason?: string | null
          e0_result?: string | null
          entry_type?: string
          error?: string | null
          executed_at?: string | null
          external_id?: string
          id?: string
          lead_name?: string
          position?: number
          scheduled_at?: string
          slot?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_batch_events_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "test_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      test_batches: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_name: string
          ends_at: string | null
          id: string
          kind: string
          label: string
          lead_count: number
          notes: string | null
          scenarios: Json
          seed: string | null
          started_at: string | null
          status: string
          time_zone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          ends_at?: string | null
          id: string
          kind?: string
          label: string
          lead_count?: number
          notes?: string | null
          scenarios?: Json
          seed?: string | null
          started_at?: string | null
          status?: string
          time_zone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          ends_at?: string | null
          id?: string
          kind?: string
          label?: string
          lead_count?: number
          notes?: string | null
          scenarios?: Json
          seed?: string | null
          started_at?: string | null
          status?: string
          time_zone?: string
          updated_at?: string
        }
        Relationships: []
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
      workspace_agenda_events: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string
          executive_id: string
          id: string
          note: string | null
          priority: string
          source: string
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at: string
          executive_id: string
          id?: string
          note?: string | null
          priority?: string
          source?: string
          starts_at: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string
          executive_id?: string
          id?: string
          note?: string | null
          priority?: string
          source?: string
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      workspace_module_permissions: {
        Row: {
          enabled: boolean
          module_key: string
          updated_at: string
          updated_by: string | null
          updated_by_name: string
          user_id: string
        }
        Insert: {
          enabled: boolean
          module_key: string
          updated_at?: string
          updated_by?: string | null
          updated_by_name?: string
          user_id: string
        }
        Update: {
          enabled?: boolean
          module_key?: string
          updated_at?: string
          updated_by?: string | null
          updated_by_name?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      agenda_cadence_tasks: {
        Args: { _executive_id?: string; _from: string; _to: string }
        Returns: {
          channel: string
          due_date: string
          id: string
          lead_id: string
          lead_name: string
          note: string
          status: string
          step_day: number
        }[]
      }
      automation_request_headers: { Args: { _name?: string }; Returns: Json }
      can_access_investor: { Args: { _investor_id: string }; Returns: boolean }
      can_access_relationship: {
        Args: { _lead_id: string; _scope: string }
        Returns: boolean
      }
      current_executive_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_content_usage: {
        Args: { _at?: string; _content_id: string }
        Returns: undefined
      }
      is_portal_member: { Args: never; Returns: boolean }
      portal_email_key: { Args: { _email: string }; Returns: string }
      portal_phone_key: { Args: { _phone: string }; Returns: string }
      resolve_portal_identity: {
        Args: {
          _campaign?: string
          _city?: string
          _device?: string
          _email: string
          _executive_id?: string
          _executive_slug?: string
          _material?: string
          _name: string
          _origin?: string
          _personalized?: boolean
          _phone: string
          _scope?: string
        }
        Returns: Json
      }
      set_lead_operational: {
        Args: {
          _closed_at?: string
          _id: string
          _notes?: string
          _set_closed?: boolean
          _set_notes?: boolean
          _set_viewed?: boolean
          _viewed_at?: string
        }
        Returns: number
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
