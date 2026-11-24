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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      criteria_categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          sort_order: number
          title: string
          version_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          title: string
          version_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          title?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "criteria_categories_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "criteria_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      criteria_versions: {
        Row: {
          academic_year: string | null
          created_at: string
          id: string
          is_official: boolean
          professional_role_id: string
          source_reference: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          academic_year?: string | null
          created_at?: string
          id?: string
          is_official?: boolean
          professional_role_id: string
          source_reference?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          academic_year?: string | null
          created_at?: string
          id?: string
          is_official?: boolean
          professional_role_id?: string
          source_reference?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "criteria_versions_professional_role_id_fkey"
            columns: ["professional_role_id"]
            isOneToOne: false
            referencedRelation: "professional_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      evidences: {
        Row: {
          created_at: string
          description: string | null
          evidence_date: string | null
          file_name: string
          file_path: string
          file_size: number
          id: string
          indicator_index: number | null
          indicator_text: string | null
          mime_type: string
          standard_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          evidence_date?: string | null
          file_name: string
          file_path: string
          file_size: number
          id?: string
          indicator_index?: number | null
          indicator_text?: string | null
          mime_type: string
          standard_id: string
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          evidence_date?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          indicator_index?: number | null
          indicator_text?: string | null
          mime_type?: string
          standard_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidences_standard_id_fkey"
            columns: ["standard_id"]
            isOneToOne: false
            referencedRelation: "standards"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_roles: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          academic_year: string | null
          bio: string | null
          created_at: string
          education_office: string | null
          email: string | null
          full_name: string
          id: string
          job_title: string | null
          onboarding_completed_at: string | null
          phone: string | null
          professional_role_id: string | null
          school: string | null
          stage: string | null
          subject: string | null
          updated_at: string
          years_experience: number | null
        }
        Insert: {
          academic_year?: string | null
          bio?: string | null
          created_at?: string
          education_office?: string | null
          email?: string | null
          full_name?: string
          id: string
          job_title?: string | null
          onboarding_completed_at?: string | null
          phone?: string | null
          professional_role_id?: string | null
          school?: string | null
          stage?: string | null
          subject?: string | null
          updated_at?: string
          years_experience?: number | null
        }
        Update: {
          academic_year?: string | null
          bio?: string | null
          created_at?: string
          education_office?: string | null
          email?: string | null
          full_name?: string
          id?: string
          job_title?: string | null
          onboarding_completed_at?: string | null
          phone?: string | null
          professional_role_id?: string | null
          school?: string | null
          stage?: string | null
          subject?: string | null
          updated_at?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_professional_role_id_fkey"
            columns: ["professional_role_id"]
            isOneToOne: false
            referencedRelation: "professional_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      standard_progress: {
        Row: {
          notes: string | null
          standard_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          notes?: string | null
          standard_id: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          notes?: string | null
          standard_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "standard_progress_standard_id_fkey"
            columns: ["standard_id"]
            isOneToOne: false
            referencedRelation: "standards"
            referencedColumns: ["id"]
          },
        ]
      }
      standards: {
        Row: {
          category_id: string | null
          code: string
          created_at: string
          criteria_version_id: string | null
          description: string | null
          guidance: string | null
          id: string
          indicators: string[]
          is_active: boolean
          is_placeholder: boolean
          owner_id: string | null
          sort_order: number
          title: string
          updated_at: string
          weight: number
        }
        Insert: {
          category_id?: string | null
          code: string
          created_at?: string
          criteria_version_id?: string | null
          description?: string | null
          guidance?: string | null
          id?: string
          indicators?: string[]
          is_active?: boolean
          is_placeholder?: boolean
          owner_id?: string | null
          sort_order?: number
          title: string
          updated_at?: string
          weight?: number
        }
        Update: {
          category_id?: string | null
          code?: string
          created_at?: string
          criteria_version_id?: string | null
          description?: string | null
          guidance?: string | null
          id?: string
          indicators?: string[]
          is_active?: boolean
          is_placeholder?: boolean
          owner_id?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "standards_category_version_fk"
            columns: ["category_id", "criteria_version_id"]
            isOneToOne: false
            referencedRelation: "criteria_categories"
            referencedColumns: ["id", "version_id"]
          },
          {
            foreignKeyName: "standards_criteria_version_id_fkey"
            columns: ["criteria_version_id"]
            isOneToOne: false
            referencedRelation: "criteria_versions"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_list_personal_accounts: {
        Args: never
        Returns: {
          career_path: string
          created_at: string
          email: string
          full_name: string
          id: string
        }[]
      }
      can_document_standard: {
        Args: { _standard_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      owns_evidence_for_standard: {
        Args: { _standard_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "teacher"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "teacher"],
    },
  },
} as const
