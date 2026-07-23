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
      ai_interactions: {
        Row: {
          actor_role: string
          created_at: string
          id: string
          prompt: string
          response: string | null
          user_id: string | null
        }
        Insert: {
          actor_role: string
          created_at?: string
          id?: string
          prompt: string
          response?: string | null
          user_id?: string | null
        }
        Update: {
          actor_role?: string
          created_at?: string
          id?: string
          prompt?: string
          response?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      authorized_emails: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      case_attachments: {
        Row: {
          case_id: string
          created_at: string
          file_name: string
          file_type: string
          id: string
          url: string
        }
        Insert: {
          case_id: string
          created_at?: string
          file_name: string
          file_type?: string
          id?: string
          url: string
        }
        Update: {
          case_id?: string
          created_at?: string
          file_name?: string
          file_type?: string
          id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_attachments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "patient_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      checkups: {
        Row: {
          checkup_date: string
          completed: boolean
          created_at: string
          id: string
          note: string | null
          notified: boolean
          patient_id: string
          room_id: string | null
        }
        Insert: {
          checkup_date: string
          completed?: boolean
          created_at?: string
          id?: string
          note?: string | null
          notified?: boolean
          patient_id: string
          room_id?: string | null
        }
        Update: {
          checkup_date?: string
          completed?: boolean
          created_at?: string
          id?: string
          note?: string | null
          notified?: boolean
          patient_id?: string
          room_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkups_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkups_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_media: {
        Row: {
          created_at: string
          hospital_id: string
          id: string
          media_type: string
          sort_order: number
          url: string
        }
        Insert: {
          created_at?: string
          hospital_id: string
          id?: string
          media_type?: string
          sort_order?: number
          url: string
        }
        Update: {
          created_at?: string
          hospital_id?: string
          id?: string
          media_type?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "hospital_media_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_time: {
        Row: {
          base_time: string
          hospital_id: string
          id: string
          set_at: string
          set_by: string | null
        }
        Insert: {
          base_time?: string
          hospital_id: string
          id?: string
          set_at?: string
          set_by?: string | null
        }
        Update: {
          base_time?: string
          hospital_id?: string
          id?: string
          set_at?: string
          set_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hospital_time_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      hospitals: {
        Row: {
          admin_email: string | null
          bank_accounts: Json
          base_price: number
          created_at: string
          id: string
          logo_url: string | null
          name: string
          payment_confirmed: boolean
          registration_fee: number
          room_limit: number
          service_active: boolean
          service_end: string | null
          service_start: string | null
          subscription_years: number
          telebirr_number: string | null
          updated_at: string
        }
        Insert: {
          admin_email?: string | null
          bank_accounts?: Json
          base_price?: number
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          payment_confirmed?: boolean
          registration_fee?: number
          room_limit?: number
          service_active?: boolean
          service_end?: string | null
          service_start?: string | null
          subscription_years?: number
          telebirr_number?: string | null
          updated_at?: string
        }
        Update: {
          admin_email?: string | null
          bank_accounts?: Json
          base_price?: number
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          payment_confirmed?: boolean
          registration_fee?: number
          room_limit?: number
          service_active?: boolean
          service_end?: string | null
          service_start?: string | null
          subscription_years?: number
          telebirr_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          content: string | null
          created_at: string
          id: string
          read: boolean
          recipient_id: string | null
          sender_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string | null
          created_at?: string
          id?: string
          read?: boolean
          recipient_id?: string | null
          sender_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string | null
          created_at?: string
          id?: string
          read?: boolean
          recipient_id?: string | null
          sender_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          patient_id: string | null
          read: boolean
          title: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          patient_id?: string | null
          read?: boolean
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          patient_id?: string | null
          read?: boolean
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_cases: {
        Row: {
          created_at: string
          created_by: string | null
          diagnosis: string | null
          id: string
          notes: string | null
          patient_id: string
          payment_status: string
          prescriptions: string | null
          room_id: string | null
          service_description: string | null
          service_fee: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          diagnosis?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          payment_status?: string
          prescriptions?: string | null
          room_id?: string | null
          service_description?: string | null
          service_fee?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          diagnosis?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          payment_status?: string
          prescriptions?: string | null
          room_id?: string | null
          service_description?: string | null
          service_fee?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_cases_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_cases_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          created_at: string
          date_of_birth: string | null
          emergency_phone: string | null
          fan_number: string
          full_name: string
          has_insurance: boolean
          hospital_id: string
          id: string
          medical_notes: string | null
          phone: string | null
          photo_url: string | null
          place_of_birth: string | null
          registered_by: string | null
          sex: string | null
          status: Database["public"]["Enums"]["patient_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          emergency_phone?: string | null
          fan_number: string
          full_name: string
          has_insurance?: boolean
          hospital_id: string
          id?: string
          medical_notes?: string | null
          phone?: string | null
          photo_url?: string | null
          place_of_birth?: string | null
          registered_by?: string | null
          sex?: string | null
          status?: Database["public"]["Enums"]["patient_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          emergency_phone?: string | null
          fan_number?: string
          full_name?: string
          has_insurance?: boolean
          hospital_id?: string
          id?: string
          medical_notes?: string | null
          phone?: string | null
          photo_url?: string | null
          place_of_birth?: string | null
          registered_by?: string | null
          sex?: string | null
          status?: Database["public"]["Enums"]["patient_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          account_used: string | null
          ai_matched: boolean | null
          ai_validation: Json | null
          amount: number | null
          auto_evaluated: boolean
          case_id: string | null
          created_at: string
          id: string
          patient_id: string
          purpose: string
          reviewed_at: string | null
          reviewed_by: string | null
          screenshot_url: string | null
          status: Database["public"]["Enums"]["payment_status"]
          transaction_id: string
        }
        Insert: {
          account_used?: string | null
          ai_matched?: boolean | null
          ai_validation?: Json | null
          amount?: number | null
          auto_evaluated?: boolean
          case_id?: string | null
          created_at?: string
          id?: string
          patient_id: string
          purpose?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          screenshot_url?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_id: string
        }
        Update: {
          account_used?: string | null
          ai_matched?: boolean | null
          ai_validation?: Json | null
          amount?: number | null
          auto_evaluated?: boolean
          case_id?: string | null
          created_at?: string
          id?: string
          patient_id?: string
          purpose?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          screenshot_url?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "patient_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      room_queue: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          patient_id: string
          room_id: string
          status: Database["public"]["Enums"]["queue_status"]
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          patient_id: string
          room_id: string
          status?: Database["public"]["Enums"]["queue_status"]
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          patient_id?: string
          room_id?: string
          status?: Database["public"]["Enums"]["queue_status"]
        }
        Relationships: [
          {
            foreignKeyName: "room_queue_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_queue_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          active: boolean
          created_at: string
          hospital_id: string
          id: string
          name: string
          room_code: string
          room_type: Database["public"]["Enums"]["room_type"]
        }
        Insert: {
          active?: boolean
          created_at?: string
          hospital_id: string
          id?: string
          name: string
          room_code: string
          room_type?: Database["public"]["Enums"]["room_type"]
        }
        Update: {
          active?: boolean
          created_at?: string
          hospital_id?: string
          id?: string
          name?: string
          room_code?: string
          room_type?: Database["public"]["Enums"]["room_type"]
        }
        Relationships: [
          {
            foreignKeyName: "rooms_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
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
      [_ in never]: never
    }
    Enums: {
      app_role:
        | "web_admin"
        | "hospital_admin"
        | "manager"
        | "doctor_room"
        | "patient"
      patient_status: "pending_payment" | "active"
      payment_status: "pending" | "approved" | "rejected"
      queue_status: "waiting" | "in_progress" | "done"
      room_type: "doctor" | "manager"
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
      app_role: [
        "web_admin",
        "hospital_admin",
        "manager",
        "doctor_room",
        "patient",
      ],
      patient_status: ["pending_payment", "active"],
      payment_status: ["pending", "approved", "rejected"],
      queue_status: ["waiting", "in_progress", "done"],
      room_type: ["doctor", "manager"],
    },
  },
} as const
