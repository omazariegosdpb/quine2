/**
 * Tipos de la base de datos.
 *
 * Placeholder con la forma que espera @supabase/supabase-js v2.
 * Regenerar oficialmente con:
 *   npx supabase gen types typescript --project-id pvytlgnkdodhafzuqrhm > src/lib/supabase/types.ts
 */
export type Role = "admin" | "player";
export type PaymentStatus = "pending" | "submitted" | "confirmed" | "refunded" | "rejected";
export type MatchStatus = "scheduled" | "live" | "finished" | "cancelled";

export type Profile = {
  id: string;
  full_name: string;
  display_name: string;
  role: Role;
  payment_status: PaymentStatus;
  must_change_password: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Round = {
  id: string;
  code: string;
  name: string;
  closes_at: string;
  is_locked: boolean;
  is_active: boolean;
  /** Etiqueta para "amarrar" rondas en un ranking propio. NULL = solo cuenta en el general. */
  ranking_group: string | null;
  snapshot_at: string | null;
  snapshot_hash: string | null;
};

export type Team = {
  id: number;
  name: string;
  iso_code: string | null;
  group_letter: string | null;
};

export type Match = {
  id: number;
  round_id: string;
  group_letter: string | null;
  home_team_id: number;
  away_team_id: number;
  kickoff_at: string;
  venue: string | null;
  home_score: number | null;
  away_score: number | null;
  status: MatchStatus;
};

export type Prediction = {
  id: number;
  user_id: string;
  match_id: number;
  home_score: number;
  away_score: number;
  created_at: string;
  updated_at: string;
};

export type Payment = {
  id: string;
  user_id: string;
  amount_quetzales: number;
  receipt_path: string | null;
  status: "submitted" | "confirmed" | "rejected" | "refunded";
  confirmed_by: string | null;
  confirmed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type AuditLog = {
  id: number;
  actor_id: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  before_val: unknown;
  after_val: unknown;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

export type PredictionSnapshot = {
  id: string;
  round_id: string;
  user_id: string;
  match_id: number;
  home_score: number | null;
  away_score: number | null;
  snapshot_at: string;
};

export type Branding = {
  id: string;
  company_name: string;
  logo_path: string | null;
  updated_at: string;
  updated_by: string | null;
};

export type AppTexts = {
  id: string;
  quick_rules: string[];
  payment_steps: string[];
  updated_at: string;
  updated_by: string | null;
};

type WithRelationships<T> = T & { Relationships: [] };

export type Database = {
  public: {
    Tables: {
      profiles: WithRelationships<{
        Row: Profile;
        Insert: Partial<Profile> & { id: string; full_name: string; display_name: string };
        Update: Partial<Profile>;
      }>;
      rounds: WithRelationships<{
        Row: Round;
        Insert: Partial<Round> & { code: string; name: string; closes_at: string };
        Update: Partial<Round>;
      }>;
      teams: WithRelationships<{
        Row: Team;
        Insert: Team;
        Update: Partial<Team>;
      }>;
      matches: WithRelationships<{
        Row: Match;
        Insert: Match;
        Update: Partial<Match>;
      }>;
      predictions: WithRelationships<{
        Row: Prediction;
        Insert: Omit<Prediction, "id" | "created_at" | "updated_at"> &
          Partial<Pick<Prediction, "created_at" | "updated_at">>;
        Update: Partial<Prediction>;
      }>;
      payments: WithRelationships<{
        Row: Payment;
        Insert: Partial<Payment> & { user_id: string };
        Update: Partial<Payment>;
      }>;
      audit_log: WithRelationships<{
        Row: AuditLog;
        Insert: Partial<AuditLog> & { action: string };
        Update: Partial<AuditLog>;
      }>;
      prediction_snapshots: WithRelationships<{
        Row: PredictionSnapshot;
        Insert: PredictionSnapshot;
        Update: Partial<PredictionSnapshot>;
      }>;
      branding: WithRelationships<{
        Row: Branding;
        Insert: Partial<Branding> & { id?: string };
        Update: Partial<Branding>;
      }>;
      app_texts: WithRelationships<{
        Row: AppTexts;
        Insert: Partial<AppTexts> & { id?: string };
        Update: Partial<AppTexts>;
      }>;
    };
    Views: {
      v_standings: {
        Row: {
          user_id: string;
          display_name: string;
          is_active: boolean;
          points: number;
          exact_count: number;
          result_count: number;
          miss_count: number;
        };
        Relationships: [];
      };
      v_standings_by_group: {
        Row: {
          ranking_group: string;
          user_id: string;
          display_name: string;
          is_active: boolean;
          points: number;
          exact_count: number;
          result_count: number;
          miss_count: number;
        };
        Relationships: [];
      };
      group_standings_view: {
        Row: {
          team_id: number;
          team_name: string;
          iso_code: string | null;
          group_letter: string;
          pj: number;
          g: number;
          e: number;
          p: number;
          gf: number;
          gc: number;
          dg: number;
          pts: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
