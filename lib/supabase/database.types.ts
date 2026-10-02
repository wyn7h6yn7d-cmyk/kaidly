export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity_history: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: number
          new_data: Json | null
          old_data: Json | null
          organisation_id: string
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          organisation_id: string
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          organisation_id?: string
          record_id?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_history_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      deficiencies: {
        Row: {
          created_at: string
          created_by: string
          created_by_name: string
          description: string
          detected_at: string
          due_on: string | null
          electrical_installation_id: string
          id: string
          organisation_id: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          resolved_by_name: string | null
          responsible_person_name: string | null
          severity: Database["public"]["Enums"]["deficiency_severity"]
          site_id: string
          status: Database["public"]["Enums"]["deficiency_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          created_by_name?: string
          description: string
          detected_at?: string
          due_on?: string | null
          electrical_installation_id: string
          id?: string
          organisation_id: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_by_name?: string | null
          responsible_person_name?: string | null
          severity: Database["public"]["Enums"]["deficiency_severity"]
          site_id: string
          status?: Database["public"]["Enums"]["deficiency_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          created_by_name?: string
          description?: string
          detected_at?: string
          due_on?: string | null
          electrical_installation_id?: string
          id?: string
          organisation_id?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_by_name?: string | null
          responsible_person_name?: string | null
          severity?: Database["public"]["Enums"]["deficiency_severity"]
          site_id?: string
          status?: Database["public"]["Enums"]["deficiency_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deficiencies_electrical_installation_id_organisation_id_fkey"
            columns: ["electrical_installation_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "electrical_installations"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "deficiencies_electrical_installation_id_site_id_fkey"
            columns: ["electrical_installation_id", "site_id"]
            isOneToOne: false
            referencedRelation: "electrical_installations"
            referencedColumns: ["id", "site_id"]
          },
          {
            foreignKeyName: "deficiencies_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deficiencies_site_id_organisation_id_fkey"
            columns: ["site_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "site_attention"
            referencedColumns: ["site_id", "organisation_id"]
          },
          {
            foreignKeyName: "deficiencies_site_id_organisation_id_fkey"
            columns: ["site_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id", "organisation_id"]
          },
        ]
      }
      documents: {
        Row: {
          archived_at: string | null
          category: Database["public"]["Enums"]["document_category"]
          created_at: string
          deficiency_id: string | null
          electrical_installation_id: string | null
          id: string
          log_entry_id: string | null
          mime_type: string
          organisation_id: string
          original_filename: string
          ready_at: string | null
          site_id: string | null
          size_bytes: number
          status: Database["public"]["Enums"]["document_status"]
          storage_path: string
          title: string
          uploaded_by: string
          uploaded_by_name: string
        }
        Insert: {
          archived_at?: string | null
          category: Database["public"]["Enums"]["document_category"]
          created_at?: string
          deficiency_id?: string | null
          electrical_installation_id?: string | null
          id?: string
          log_entry_id?: string | null
          mime_type: string
          organisation_id: string
          original_filename: string
          ready_at?: string | null
          site_id?: string | null
          size_bytes: number
          status?: Database["public"]["Enums"]["document_status"]
          storage_path?: string
          title: string
          uploaded_by?: string
          uploaded_by_name?: string
        }
        Update: {
          archived_at?: string | null
          category?: Database["public"]["Enums"]["document_category"]
          created_at?: string
          deficiency_id?: string | null
          electrical_installation_id?: string | null
          id?: string
          log_entry_id?: string | null
          mime_type?: string
          organisation_id?: string
          original_filename?: string
          ready_at?: string | null
          site_id?: string | null
          size_bytes?: number
          status?: Database["public"]["Enums"]["document_status"]
          storage_path?: string
          title?: string
          uploaded_by?: string
          uploaded_by_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_deficiency_id_electrical_installation_id_fkey"
            columns: ["deficiency_id", "electrical_installation_id"]
            isOneToOne: false
            referencedRelation: "deficiencies"
            referencedColumns: ["id", "electrical_installation_id"]
          },
          {
            foreignKeyName: "documents_electrical_installation_id_organisation_id_fkey"
            columns: ["electrical_installation_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "electrical_installations"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "documents_electrical_installation_id_site_id_fkey"
            columns: ["electrical_installation_id", "site_id"]
            isOneToOne: false
            referencedRelation: "electrical_installations"
            referencedColumns: ["id", "site_id"]
          },
          {
            foreignKeyName: "documents_log_entry_id_electrical_installation_id_fkey"
            columns: ["log_entry_id", "electrical_installation_id"]
            isOneToOne: false
            referencedRelation: "log_entries"
            referencedColumns: ["id", "electrical_installation_id"]
          },
          {
            foreignKeyName: "documents_log_entry_id_electrical_installation_id_fkey"
            columns: ["log_entry_id", "electrical_installation_id"]
            isOneToOne: false
            referencedRelation: "log_entry_current"
            referencedColumns: ["id", "electrical_installation_id"]
          },
          {
            foreignKeyName: "documents_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_site_id_organisation_id_fkey"
            columns: ["site_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "site_attention"
            referencedColumns: ["site_id", "organisation_id"]
          },
          {
            foreignKeyName: "documents_site_id_organisation_id_fkey"
            columns: ["site_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id", "organisation_id"]
          },
        ]
      }
      electrical_installations: {
        Row: {
          archived_at: string | null
          commissioned_on: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          identifier: string | null
          installation_type: Database["public"]["Enums"]["installation_type"]
          location: string | null
          name: string
          notes: string | null
          organisation_id: string
          responsible_person: string | null
          site_id: string
          status: Database["public"]["Enums"]["installation_status"]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          commissioned_on?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          identifier?: string | null
          installation_type: Database["public"]["Enums"]["installation_type"]
          location?: string | null
          name: string
          notes?: string | null
          organisation_id: string
          responsible_person?: string | null
          site_id: string
          status?: Database["public"]["Enums"]["installation_status"]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          commissioned_on?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          identifier?: string | null
          installation_type?: Database["public"]["Enums"]["installation_type"]
          location?: string | null
          name?: string
          notes?: string | null
          organisation_id?: string
          responsible_person?: string | null
          site_id?: string
          status?: Database["public"]["Enums"]["installation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "electrical_installations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "electrical_installations_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "electrical_installations_site_id_organisation_id_fkey"
            columns: ["site_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "site_attention"
            referencedColumns: ["site_id", "organisation_id"]
          },
          {
            foreignKeyName: "electrical_installations_site_id_organisation_id_fkey"
            columns: ["site_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id", "organisation_id"]
          },
        ]
      }
      log_entries: {
        Row: {
          correction_of_id: string | null
          correction_reason: string | null
          created_at: string
          created_by: string
          created_by_name: string
          deficiency_id: string | null
          description: string
          electrical_installation_id: string
          entry_type: Database["public"]["Enums"]["log_entry_type"]
          id: string
          occurred_at: string
          organisation_id: string
          performed_by_name: string | null
          result: string | null
          scheduled_activity_id: string | null
          scheduled_due_on: string | null
          site_id: string
        }
        Insert: {
          correction_of_id?: string | null
          correction_reason?: string | null
          created_at?: string
          created_by?: string
          created_by_name?: string
          deficiency_id?: string | null
          description: string
          electrical_installation_id: string
          entry_type: Database["public"]["Enums"]["log_entry_type"]
          id?: string
          occurred_at?: string
          organisation_id: string
          performed_by_name?: string | null
          result?: string | null
          scheduled_activity_id?: string | null
          scheduled_due_on?: string | null
          site_id: string
        }
        Update: {
          correction_of_id?: string | null
          correction_reason?: string | null
          created_at?: string
          created_by?: string
          created_by_name?: string
          deficiency_id?: string | null
          description?: string
          electrical_installation_id?: string
          entry_type?: Database["public"]["Enums"]["log_entry_type"]
          id?: string
          occurred_at?: string
          organisation_id?: string
          performed_by_name?: string | null
          result?: string | null
          scheduled_activity_id?: string | null
          scheduled_due_on?: string | null
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "log_entries_correction_of_id_electrical_installation_id_fkey"
            columns: ["correction_of_id", "electrical_installation_id"]
            isOneToOne: false
            referencedRelation: "log_entries"
            referencedColumns: ["id", "electrical_installation_id"]
          },
          {
            foreignKeyName: "log_entries_correction_of_id_electrical_installation_id_fkey"
            columns: ["correction_of_id", "electrical_installation_id"]
            isOneToOne: false
            referencedRelation: "log_entry_current"
            referencedColumns: ["id", "electrical_installation_id"]
          },
          {
            foreignKeyName: "log_entries_deficiency_fkey"
            columns: ["deficiency_id", "electrical_installation_id"]
            isOneToOne: false
            referencedRelation: "deficiencies"
            referencedColumns: ["id", "electrical_installation_id"]
          },
          {
            foreignKeyName: "log_entries_electrical_installation_id_organisation_id_fkey"
            columns: ["electrical_installation_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "electrical_installations"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "log_entries_electrical_installation_id_site_id_fkey"
            columns: ["electrical_installation_id", "site_id"]
            isOneToOne: false
            referencedRelation: "electrical_installations"
            referencedColumns: ["id", "site_id"]
          },
          {
            foreignKeyName: "log_entries_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_entries_scheduled_activity_fkey"
            columns: ["scheduled_activity_id", "electrical_installation_id"]
            isOneToOne: false
            referencedRelation: "scheduled_activities"
            referencedColumns: ["id", "electrical_installation_id"]
          },
          {
            foreignKeyName: "log_entries_site_id_organisation_id_fkey"
            columns: ["site_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "site_attention"
            referencedColumns: ["site_id", "organisation_id"]
          },
          {
            foreignKeyName: "log_entries_site_id_organisation_id_fkey"
            columns: ["site_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id", "organisation_id"]
          },
        ]
      }
      notifications: {
        Row: {
          channel: string
          created_at: string
          due_on: string
          id: string
          organisation_id: string
          read_at: string | null
          scheduled_activity_id: string
          threshold_days: number
          type: string
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          due_on: string
          id?: string
          organisation_id: string
          read_at?: string | null
          scheduled_activity_id: string
          threshold_days: number
          type?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          due_on?: string
          id?: string
          organisation_id?: string
          read_at?: string | null
          scheduled_activity_id?: string
          threshold_days?: number
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_scheduled_activity_id_organisation_id_fkey"
            columns: ["scheduled_activity_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "scheduled_activities"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organisation_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          organisation_id: string
          revoked_at: string | null
          revoked_by: string | null
          role: Database["public"]["Enums"]["org_role"]
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          organisation_id: string
          revoked_at?: string | null
          revoked_by?: string | null
          role: Database["public"]["Enums"]["org_role"]
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organisation_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          role?: Database["public"]["Enums"]["org_role"]
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisation_invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organisation_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organisation_invitations_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organisation_invitations_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organisation_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          organisation_id: string
          role: Database["public"]["Enums"]["org_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          organisation_id: string
          role: Database["public"]["Enums"]["org_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          organisation_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisation_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organisation_members_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organisation_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          address: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          deactivated_at: string | null
          deactivated_by: string | null
          id: string
          name: string
          notes: string | null
          registry_code: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          id?: string
          name: string
          notes?: string | null
          registry_code?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          registry_code?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organisations_deactivated_by_fkey"
            columns: ["deactivated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          preferred_locale: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          preferred_locale?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          preferred_locale?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      scheduled_activities: {
        Row: {
          anchor_on: string
          archived_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          electrical_installation_id: string
          frequency_type: Database["public"]["Enums"]["activity_frequency"]
          id: string
          interval_unit: Database["public"]["Enums"]["interval_unit"] | null
          interval_value: number | null
          next_due_on: string | null
          organisation_id: string
          priority: Database["public"]["Enums"]["activity_priority"]
          reminder_days: number[]
          responsible_person_name: string | null
          site_id: string
          title: string
          updated_at: string
        }
        Insert: {
          anchor_on?: string
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          electrical_installation_id: string
          frequency_type: Database["public"]["Enums"]["activity_frequency"]
          id?: string
          interval_unit?: Database["public"]["Enums"]["interval_unit"] | null
          interval_value?: number | null
          next_due_on?: string | null
          organisation_id: string
          priority?: Database["public"]["Enums"]["activity_priority"]
          reminder_days?: number[]
          responsible_person_name?: string | null
          site_id: string
          title: string
          updated_at?: string
        }
        Update: {
          anchor_on?: string
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          electrical_installation_id?: string
          frequency_type?: Database["public"]["Enums"]["activity_frequency"]
          id?: string
          interval_unit?: Database["public"]["Enums"]["interval_unit"] | null
          interval_value?: number | null
          next_due_on?: string | null
          organisation_id?: string
          priority?: Database["public"]["Enums"]["activity_priority"]
          reminder_days?: number[]
          responsible_person_name?: string | null
          site_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_activities_electrical_installation_id_organisati_fkey"
            columns: ["electrical_installation_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "electrical_installations"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "scheduled_activities_electrical_installation_id_site_id_fkey"
            columns: ["electrical_installation_id", "site_id"]
            isOneToOne: false
            referencedRelation: "electrical_installations"
            referencedColumns: ["id", "site_id"]
          },
          {
            foreignKeyName: "scheduled_activities_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_activities_site_id_organisation_id_fkey"
            columns: ["site_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "site_attention"
            referencedColumns: ["site_id", "organisation_id"]
          },
          {
            foreignKeyName: "scheduled_activities_site_id_organisation_id_fkey"
            columns: ["site_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id", "organisation_id"]
          },
        ]
      }
      sites: {
        Row: {
          address: string | null
          archived_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          organisation_id: string
          responsible_person: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          organisation_id: string
          responsible_person?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          organisation_id?: string
          responsible_person?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      log_entry_current: {
        Row: {
          corrected_at: string | null
          corrected_by_name: string | null
          correction_count: number | null
          correction_reason: string | null
          deficiency_id: string | null
          description: string | null
          electrical_installation_id: string | null
          entry_type: Database["public"]["Enums"]["log_entry_type"] | null
          id: string | null
          is_corrected: boolean | null
          occurred_at: string | null
          organisation_id: string | null
          performed_by_name: string | null
          recorded_at: string | null
          recorded_by_name: string | null
          result: string | null
          scheduled_activity_id: string | null
          scheduled_due_on: string | null
          site_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "log_entries_deficiency_fkey"
            columns: ["deficiency_id", "electrical_installation_id"]
            isOneToOne: false
            referencedRelation: "deficiencies"
            referencedColumns: ["id", "electrical_installation_id"]
          },
          {
            foreignKeyName: "log_entries_electrical_installation_id_organisation_id_fkey"
            columns: ["electrical_installation_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "electrical_installations"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "log_entries_electrical_installation_id_site_id_fkey"
            columns: ["electrical_installation_id", "site_id"]
            isOneToOne: false
            referencedRelation: "electrical_installations"
            referencedColumns: ["id", "site_id"]
          },
          {
            foreignKeyName: "log_entries_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_entries_scheduled_activity_fkey"
            columns: ["scheduled_activity_id", "electrical_installation_id"]
            isOneToOne: false
            referencedRelation: "scheduled_activities"
            referencedColumns: ["id", "electrical_installation_id"]
          },
          {
            foreignKeyName: "log_entries_site_id_organisation_id_fkey"
            columns: ["site_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "site_attention"
            referencedColumns: ["site_id", "organisation_id"]
          },
          {
            foreignKeyName: "log_entries_site_id_organisation_id_fkey"
            columns: ["site_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id", "organisation_id"]
          },
        ]
      }
      site_attention: {
        Row: {
          due_soon_activities: number | null
          name: string | null
          open_deficiencies: number | null
          organisation_id: string | null
          overdue_activities: number | null
          serious_deficiencies: number | null
          site_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sites_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: string }
      admin_access_overview: { Args: never; Returns: Json }
      admin_audit_entries: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: Json
      }
      admin_companies: {
        Args: { p_limit?: number; p_offset?: number; p_search?: string }
        Returns: Json
      }
      admin_company: { Args: { p_org: string }; Returns: Json }
      admin_company_access: { Args: { p_org: string }; Returns: Json }
      admin_company_access_list: { Args: { p_filter?: string }; Returns: Json }
      admin_deadlines: {
        Args: {
          p_company?: string
          p_from?: string
          p_include_deactivated?: boolean
          p_kind?: string
          p_severity?: string
          p_site?: string
          p_state?: string
          p_to?: string
        }
        Returns: Json
      }
      admin_expire_access: { Args: { p_org: string }; Returns: undefined }
      admin_extend_trial: {
        Args: { p_org: string; p_trial_ends_at: string }
        Returns: undefined
      }
      admin_overview: { Args: never; Returns: Json }
      admin_password_reset_target: { Args: { p_user: string }; Returns: string }
      admin_remove_member: {
        Args: { p_membership: string }
        Returns: undefined
      }
      admin_revoke_sessions: { Args: { p_user: string }; Returns: undefined }
      admin_set_access_reference: {
        Args: { p_invoice_reference: string; p_notes: string; p_org: string }
        Returns: undefined
      }
      admin_set_full_access: {
        Args: {
          p_invoice_reference: string
          p_notes: string
          p_org: string
          p_until: string
        }
        Returns: undefined
      }
      admin_set_member_role: {
        Args: {
          p_membership: string
          p_role: Database["public"]["Enums"]["org_role"]
        }
        Returns: undefined
      }
      admin_set_user_disabled: {
        Args: { p_disabled: boolean; p_user: string }
        Returns: undefined
      }
      admin_system: { Args: never; Returns: Json }
      admin_user: { Args: { p_user: string }; Returns: Json }
      admin_users: {
        Args: { p_limit?: number; p_offset?: number; p_search?: string }
        Returns: Json
      }
      am_platform_admin: { Args: never; Returns: boolean }
      complete_scheduled_activity: {
        Args: {
          p_activity_id: string
          p_description: string
          p_due_on: string
          p_entry_type: Database["public"]["Enums"]["log_entry_type"]
          p_occurred_at: string
          p_performed_by_name?: string
          p_result?: string
        }
        Returns: string
      }
      create_invitation: {
        Args: {
          p_email: string
          p_organisation_id: string
          p_role: Database["public"]["Enums"]["org_role"]
        }
        Returns: {
          expires_at: string
          invitation_id: string
          token: string
        }[]
      }
      create_organisation: {
        Args: { p_name: string; p_registry_code?: string }
        Returns: string
      }
      deactivate_organisation: {
        Args: { p_confirm_name: string; p_organisation_id: string }
        Returns: undefined
      }
      delete_organisation: {
        Args: { p_confirm_name: string; p_organisation_id: string }
        Returns: undefined
      }
      finalize_document: {
        Args: { p_document_id: string }
        Returns: Database["public"]["Enums"]["document_status"]
      }
      import_company_data: {
        Args: { p_kind: string; p_org: string; p_rows: Json; p_token: string }
        Returns: Json
      }
      invitation_preview: { Args: { p_token: string }; Returns: Json }
      my_notifications: {
        Args: { p_limit?: number; p_offset?: number; p_unread_only?: boolean }
        Returns: Json
      }
      organisation_access: { Args: { p_org: string }; Returns: Json }
      reactivate_organisation: {
        Args: { p_organisation_id: string }
        Returns: undefined
      }
      resolve_deficiency: {
        Args: {
          p_deficiency_id: string
          p_entry_type: Database["public"]["Enums"]["log_entry_type"]
          p_occurred_at: string
          p_performed_by_name?: string
          p_resolution: string
        }
        Returns: string
      }
      revoke_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      search_kaidly: {
        Args: {
          p_entry_types?: Database["public"]["Enums"]["log_entry_type"][]
          p_per_group?: number
          p_query: string
        }
        Returns: Json
      }
    }
    Enums: {
      activity_frequency: "once" | "recurring"
      activity_priority: "low" | "normal" | "high"
      deficiency_severity: "low" | "medium" | "high" | "critical"
      deficiency_status: "open" | "in_progress" | "resolved"
      document_category:
        | "audit"
        | "measurement_protocol"
        | "single_line_diagram"
        | "operating_plan"
        | "maintenance_report"
        | "declaration"
        | "manual"
        | "photo"
        | "other"
      document_status: "pending" | "ready" | "failed"
      installation_status: "in_service" | "out_of_service"
      installation_type:
        | "building"
        | "switchboard"
        | "substation"
        | "solar"
        | "storage"
        | "charging"
        | "industrial"
        | "other"
      interval_unit: "day" | "week" | "month" | "year"
      log_entry_type:
        | "inspection"
        | "maintenance"
        | "switching"
        | "fault"
        | "repair"
        | "measurement"
        | "other"
      org_role: "owner" | "admin" | "operator" | "viewer"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      activity_frequency: ["once", "recurring"],
      activity_priority: ["low", "normal", "high"],
      deficiency_severity: ["low", "medium", "high", "critical"],
      deficiency_status: ["open", "in_progress", "resolved"],
      document_category: [
        "audit",
        "measurement_protocol",
        "single_line_diagram",
        "operating_plan",
        "maintenance_report",
        "declaration",
        "manual",
        "photo",
        "other",
      ],
      document_status: ["pending", "ready", "failed"],
      installation_status: ["in_service", "out_of_service"],
      installation_type: [
        "building",
        "switchboard",
        "substation",
        "solar",
        "storage",
        "charging",
        "industrial",
        "other",
      ],
      interval_unit: ["day", "week", "month", "year"],
      log_entry_type: [
        "inspection",
        "maintenance",
        "switching",
        "fault",
        "repair",
        "measurement",
        "other",
      ],
      org_role: ["owner", "admin", "operator", "viewer"],
    },
  },
} as const

