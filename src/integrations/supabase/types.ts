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
      achievements: {
        Row: {
          code: string
          description: string | null
          icon: string | null
          id: string
          title: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          code: string
          description?: string | null
          icon?: string | null
          id?: string
          title: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          code?: string
          description?: string | null
          icon?: string | null
          id?: string
          title?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      action_plans: {
        Row: {
          content: string
          created_at: string
          id: string
          source: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          source?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          source?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      focus_sessions: {
        Row: {
          created_at: string
          duration_minutes: number
          ended_at: string | null
          id: string
          is_deep_work: boolean
          session_date: string
          started_at: string
          task_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          ended_at?: string | null
          id?: string
          is_deep_work?: boolean
          session_date?: string
          started_at?: string
          task_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          ended_at?: string | null
          id?: string
          is_deep_work?: boolean
          session_date?: string
          started_at?: string
          task_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "focus_sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          completed: boolean
          created_at: string
          current_value: number
          description: string | null
          due_date: string | null
          id: string
          period: Database["public"]["Enums"]["goal_period"]
          target_value: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          current_value?: number
          description?: string | null
          due_date?: string | null
          id?: string
          period?: Database["public"]["Enums"]["goal_period"]
          target_value?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          current_value?: number
          description?: string | null
          due_date?: string | null
          id?: string
          period?: Database["public"]["Enums"]["goal_period"]
          target_value?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      habit_logs: {
        Row: {
          count: number
          created_at: string
          habit_id: string
          id: string
          log_date: string
          user_id: string
        }
        Insert: {
          count?: number
          created_at?: string
          habit_id: string
          id?: string
          log_date?: string
          user_id: string
        }
        Update: {
          count?: number
          created_at?: string
          habit_id?: string
          id?: string
          log_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          archived: boolean
          color: string
          created_at: string
          current_streak: number
          difficulty: Database["public"]["Enums"]["habit_difficulty"]
          icon: string
          id: string
          longest_streak: number
          name: string
          notes: string | null
          reminder_time: string | null
          target_per_day: number
          target_per_week: number
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          color?: string
          created_at?: string
          current_streak?: number
          difficulty?: Database["public"]["Enums"]["habit_difficulty"]
          icon?: string
          id?: string
          longest_streak?: number
          name: string
          notes?: string | null
          reminder_time?: string | null
          target_per_day?: number
          target_per_week?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          color?: string
          created_at?: string
          current_streak?: number
          difficulty?: Database["public"]["Enums"]["habit_difficulty"]
          icon?: string
          id?: string
          longest_streak?: number
          name?: string
          notes?: string | null
          reminder_time?: string | null
          target_per_day?: number
          target_per_week?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          current_streak: number
          display_name: string | null
          ics_token: string | null
          id: string
          level: number
          longest_streak: number
          notes_rich: boolean
          show_achievements: boolean
          show_focus: boolean
          show_streaks: boolean
          show_xp: boolean
          timezone: string | null
          updated_at: string
          xp: number
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          current_streak?: number
          display_name?: string | null
          ics_token?: string | null
          id: string
          level?: number
          longest_streak?: number
          notes_rich?: boolean
          show_achievements?: boolean
          show_focus?: boolean
          show_streaks?: boolean
          show_xp?: boolean
          timezone?: string | null
          updated_at?: string
          xp?: number
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          current_streak?: number
          display_name?: string | null
          ics_token?: string | null
          id?: string
          level?: number
          longest_streak?: number
          notes_rich?: boolean
          show_achievements?: boolean
          show_focus?: boolean
          show_streaks?: boolean
          show_xp?: boolean
          timezone?: string | null
          updated_at?: string
          xp?: number
        }
        Relationships: []
      }
      recurring_task_logs: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          occurrence_date: string
          override_end_time: string | null
          override_notes: string | null
          override_start_time: string | null
          override_title: string | null
          recurring_task_id: string
          skipped: boolean
          status: string
          time_spent_minutes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          occurrence_date: string
          override_end_time?: string | null
          override_notes?: string | null
          override_start_time?: string | null
          override_title?: string | null
          recurring_task_id: string
          skipped?: boolean
          status?: string
          time_spent_minutes?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          occurrence_date?: string
          override_end_time?: string | null
          override_notes?: string | null
          override_start_time?: string | null
          override_title?: string | null
          recurring_task_id?: string
          skipped?: boolean
          status?: string
          time_spent_minutes?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_task_logs_recurring_task_id_fkey"
            columns: ["recurring_task_id"]
            isOneToOne: false
            referencedRelation: "recurring_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_tasks: {
        Row: {
          category: string
          color: string | null
          created_at: string
          end_time: string | null
          ends_on: string | null
          id: string
          notes: string | null
          position: number
          priority: string
          reminder_minutes_before: number | null
          repeat_days: number[]
          repeat_type: string
          start_time: string | null
          starts_on: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          color?: string | null
          created_at?: string
          end_time?: string | null
          ends_on?: string | null
          id?: string
          notes?: string | null
          position?: number
          priority?: string
          reminder_minutes_before?: number | null
          repeat_days?: number[]
          repeat_type?: string
          start_time?: string | null
          starts_on?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          color?: string | null
          created_at?: string
          end_time?: string | null
          ends_on?: string | null
          id?: string
          notes?: string | null
          position?: number
          priority?: string
          reminder_minutes_before?: number | null
          repeat_days?: number[]
          repeat_type?: string
          start_time?: string | null
          starts_on?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          kind: string
          last_fired_at: string | null
          recurrence: string
          remind_at: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          kind?: string
          last_fired_at?: string | null
          recurrence?: string
          remind_at: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          kind?: string
          last_fired_at?: string | null
          recurrence?: string
          remind_at?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_at: string
          language: string
          notifications_enabled: boolean
          reminder_sound: string
          theme: string
          time_format: string
          updated_at: string
          user_id: string
          week_start: number
        }
        Insert: {
          created_at?: string
          language?: string
          notifications_enabled?: boolean
          reminder_sound?: string
          theme?: string
          time_format?: string
          updated_at?: string
          user_id: string
          week_start?: number
        }
        Update: {
          created_at?: string
          language?: string
          notifications_enabled?: boolean
          reminder_sound?: string
          theme?: string
          time_format?: string
          updated_at?: string
          user_id?: string
          week_start?: number
        }
        Relationships: []
      }
      tasks: {
        Row: {
          attachments: Json
          category: Database["public"]["Enums"]["task_category"]
          checklist: Json
          color: string | null
          completed_at: string | null
          created_at: string
          end_time: string | null
          id: string
          links: Json
          notes: string | null
          position: number
          priority: Database["public"]["Enums"]["task_priority"]
          scheduled_date: string
          start_time: string | null
          status: Database["public"]["Enums"]["task_status"]
          time_spent_minutes: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attachments?: Json
          category?: Database["public"]["Enums"]["task_category"]
          checklist?: Json
          color?: string | null
          completed_at?: string | null
          created_at?: string
          end_time?: string | null
          id?: string
          links?: Json
          notes?: string | null
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          scheduled_date?: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          time_spent_minutes?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attachments?: Json
          category?: Database["public"]["Enums"]["task_category"]
          checklist?: Json
          color?: string | null
          completed_at?: string | null
          created_at?: string
          end_time?: string | null
          id?: string
          links?: Json
          notes?: string | null
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          scheduled_date?: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          time_spent_minutes?: number
          title?: string
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
      goal_period: "daily" | "weekly" | "monthly" | "yearly"
      habit_difficulty: "easy" | "medium" | "hard"
      task_category:
        | "morning_routine"
        | "workout"
        | "meditation"
        | "study"
        | "office"
        | "reading"
        | "finance"
        | "learning"
        | "deep_work"
        | "meals"
        | "family"
        | "sleep"
        | "other"
      task_priority: "low" | "medium" | "high" | "critical"
      task_status: "pending" | "completed" | "missed" | "late" | "skipped"
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
      goal_period: ["daily", "weekly", "monthly", "yearly"],
      habit_difficulty: ["easy", "medium", "hard"],
      task_category: [
        "morning_routine",
        "workout",
        "meditation",
        "study",
        "office",
        "reading",
        "finance",
        "learning",
        "deep_work",
        "meals",
        "family",
        "sleep",
        "other",
      ],
      task_priority: ["low", "medium", "high", "critical"],
      task_status: ["pending", "completed", "missed", "late", "skipped"],
    },
  },
} as const
