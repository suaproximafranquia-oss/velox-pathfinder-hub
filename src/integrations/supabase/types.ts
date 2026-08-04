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
      portal_leads: {
        Row: {
          campaign: string | null
          city: string
          created_at: string
          device: string | null
          email: string
          id: string
          journey: Json
          last_activity_at: string
          material: string
          name: string
          origin: string
          personalized: boolean
          responsible_executive_id: string | null
          responsible_executive_slug: string | null
          scope: string
          updated_at: string
          whatsapp: string
        }
        Insert: {
          campaign?: string | null
          city?: string
          created_at?: string
          device?: string | null
          email: string
          id: string
          journey?: Json
          last_activity_at?: string
          material?: string
          name: string
          origin?: string
          personalized?: boolean
          responsible_executive_id?: string | null
          responsible_executive_slug?: string | null
          scope?: string
          updated_at?: string
          whatsapp?: string
        }
        Update: {
          campaign?: string | null
          city?: string
          created_at?: string
          device?: string | null
          email?: string
          id?: string
          journey?: Json
          last_activity_at?: string
          material?: string
          name?: string
          origin?: string
          personalized?: boolean
          responsible_executive_id?: string | null
          responsible_executive_slug?: string | null
          scope?: string
          updated_at?: string
          whatsapp?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
