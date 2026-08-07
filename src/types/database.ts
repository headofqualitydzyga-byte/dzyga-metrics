export type UserRole = "admin" | "manager" | "viewer";
export type MetricType = "growing" | "declining" | "range";
export type ValueType = "percent" | "number" | "boolean";
export type SubmissionSource = "telegram" | "web";
export type MetricStatus = "normal" | "warning" | "critical" | "not_submitted";
export type MetricFrequency = "weekly" | "monthly";

export interface Database {
  public: {
    Tables: {
      departments: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          color: string;
          icon: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          color?: string;
          icon?: string;
          sort_order?: number;
        };
        Update: Partial<{
          name: string;
          description: string | null;
          color: string;
          icon: string;
          sort_order: number;
        }>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: UserRole;
          department_id: string | null;
          telegram_id: string | null;
          telegram_username: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role: UserRole;
          department_id?: string | null;
          telegram_id?: string | null;
          telegram_username?: string | null;
        };
        Update: Partial<{
          email: string;
          full_name: string | null;
          role: UserRole;
          department_id: string | null;
          telegram_id: string | null;
          telegram_username: string | null;
        }>;
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey";
            columns: ["department_id"];
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
        ];
      };
      metric_definitions: {
        Row: {
          id: string;
          department_id: string;
          name: string;
          description: string | null;
          type: MetricType;
          value_type: ValueType;
          unit: string;
          plan_value: number | null;
          range_min: number | null;
          range_max: number | null;
          warning_threshold: number;
          critical_threshold: number;
          is_active: boolean;
          sort_order: number;
          frequency: MetricFrequency;
          created_at: string;
        };
        Insert: {
          id?: string;
          department_id: string;
          name: string;
          description?: string | null;
          type: MetricType;
          value_type: ValueType;
          unit: string;
          plan_value?: number | null;
          range_min?: number | null;
          range_max?: number | null;
          warning_threshold?: number;
          critical_threshold?: number;
          is_active?: boolean;
          sort_order?: number;
          frequency?: MetricFrequency;
        };
        Update: Partial<{
          name: string;
          description: string | null;
          type: MetricType;
          value_type: ValueType;
          unit: string;
          plan_value: number | null;
          range_min: number | null;
          range_max: number | null;
          warning_threshold: number;
          critical_threshold: number;
          is_active: boolean;
          sort_order: number;
          frequency: MetricFrequency;
        }>;
        Relationships: [
          {
            foreignKeyName: "metric_definitions_department_id_fkey";
            columns: ["department_id"];
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
        ];
      };
      metric_submissions: {
        Row: {
          id: string;
          profile_id: string;
          metric_definition_id: string;
          /** Period start: Monday for weekly metrics, 1st-of-month for monthly metrics (see metric_definitions.frequency). */
          week_start: string;
          value: number;
          comment: string | null;
          submitted_via: SubmissionSource;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          metric_definition_id: string;
          week_start: string;
          value: number;
          comment?: string | null;
          submitted_via: SubmissionSource;
        };
        Update: Partial<{
          value: number;
          comment: string | null;
          submitted_via: SubmissionSource;
        }>;
        Relationships: [
          {
            foreignKeyName: "metric_submissions_profile_id_fkey";
            columns: ["profile_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "metric_submissions_metric_definition_id_fkey";
            columns: ["metric_definition_id"];
            referencedRelation: "metric_definitions";
            referencedColumns: ["id"];
          },
        ];
      };
      invitations: {
        Row: {
          id: string;
          email: string;
          role: UserRole;
          department_id: string | null;
          token: string;
          invited_by: string;
          expires_at: string;
          accepted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          role: UserRole;
          department_id?: string | null;
          token: string;
          invited_by: string;
          expires_at: string;
        };
        Update: Partial<{
          accepted_at: string | null;
        }>;
        Relationships: [];
      };
      profile_metric_access: {
        Row: {
          profile_id: string;
          metric_definition_id: string;
        };
        Insert: {
          profile_id: string;
          metric_definition_id: string;
        };
        Update: Partial<{
          profile_id: string;
          metric_definition_id: string;
        }>;
        Relationships: [
          {
            foreignKeyName: "profile_metric_access_profile_id_fkey";
            columns: ["profile_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profile_metric_access_metric_definition_id_fkey";
            columns: ["metric_definition_id"];
            referencedRelation: "metric_definitions";
            referencedColumns: ["id"];
          },
        ];
      };
    };
  };
}

export type Department = Database["public"]["Tables"]["departments"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type MetricDefinition =
  Database["public"]["Tables"]["metric_definitions"]["Row"];
export type MetricSubmission =
  Database["public"]["Tables"]["metric_submissions"]["Row"];
export type Invitation = Database["public"]["Tables"]["invitations"]["Row"];
