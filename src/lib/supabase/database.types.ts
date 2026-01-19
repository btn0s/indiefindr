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
      collection_games: {
        Row: {
          appid: number
          collection_id: string
          created_at: string | null
          position: number
        }
        Insert: {
          appid: number
          collection_id: string
          created_at?: string | null
          position?: number
        }
        Update: {
          appid?: number
          collection_id?: string
          created_at?: string | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "collection_games_appid_fkey"
            columns: ["appid"]
            isOneToOne: false
            referencedRelation: "games_new"
            referencedColumns: ["appid"]
          },
          {
            foreignKeyName: "collection_games_appid_fkey"
            columns: ["appid"]
            isOneToOne: false
            referencedRelation: "games_new_home"
            referencedColumns: ["appid"]
          },
          {
            foreignKeyName: "collection_games_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string | null
          description: string | null
          home_position: number
          id: string
          is_default: boolean
          is_public: boolean
          owner_id: string | null
          pinned_to_home: boolean
          published: boolean
          slug: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          home_position?: number
          id?: string
          is_default?: boolean
          is_public?: boolean
          owner_id?: string | null
          pinned_to_home?: boolean
          published?: boolean
          slug?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          home_position?: number
          id?: string
          is_default?: boolean
          is_public?: boolean
          owner_id?: string | null
          pinned_to_home?: boolean
          published?: boolean
          slug?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      distributed_locks: {
        Row: {
          acquired_at: string
          expires_at: string
          id: string
          lock_key: string
        }
        Insert: {
          acquired_at?: string
          expires_at: string
          id?: string
          lock_key: string
        }
        Update: {
          acquired_at?: string
          expires_at?: string
          id?: string
          lock_key?: string
        }
        Relationships: []
      }
      game_embeddings: {
        Row: {
          appid: number
          created_at: string
          embedding: string
          embedding_model: string
          embedding_version: number
          facet: string
          id: string
          source_data: Json | null
          source_type: string
          updated_at: string
        }
        Insert: {
          appid: number
          created_at?: string
          embedding: string
          embedding_model?: string
          embedding_version?: number
          facet: string
          id?: string
          source_data?: Json | null
          source_type: string
          updated_at?: string
        }
        Update: {
          appid?: number
          created_at?: string
          embedding?: string
          embedding_model?: string
          embedding_version?: number
          facet?: string
          id?: string
          source_data?: Json | null
          source_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_embeddings_appid_fkey"
            columns: ["appid"]
            isOneToOne: false
            referencedRelation: "games_new"
            referencedColumns: ["appid"]
          },
          {
            foreignKeyName: "game_embeddings_appid_fkey"
            columns: ["appid"]
            isOneToOne: false
            referencedRelation: "games_new_home"
            referencedColumns: ["appid"]
          },
        ]
      }
      game_igdb_data: {
        Row: {
          appid: number
          fetched_at: string
          game_engines: string[] | null
          game_modes: string[] | null
          igdb_id: number | null
          keywords: string[] | null
          player_perspectives: string[] | null
          storyline: string | null
          themes: string[] | null
        }
        Insert: {
          appid: number
          fetched_at?: string
          game_engines?: string[] | null
          game_modes?: string[] | null
          igdb_id?: number | null
          keywords?: string[] | null
          player_perspectives?: string[] | null
          storyline?: string | null
          themes?: string[] | null
        }
        Update: {
          appid?: number
          fetched_at?: string
          game_engines?: string[] | null
          game_modes?: string[] | null
          igdb_id?: number | null
          keywords?: string[] | null
          player_perspectives?: string[] | null
          storyline?: string | null
          themes?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "game_igdb_data_appid_fkey"
            columns: ["appid"]
            isOneToOne: true
            referencedRelation: "games_new"
            referencedColumns: ["appid"]
          },
          {
            foreignKeyName: "game_igdb_data_appid_fkey"
            columns: ["appid"]
            isOneToOne: true
            referencedRelation: "games_new_home"
            referencedColumns: ["appid"]
          },
        ]
      }
      games_new: {
        Row: {
          appid: number
          created_at: string | null
          developers: string[] | null
          header_image: string | null
          is_indie: boolean | null
          long_description: string | null
          raw: Json
          release_date: string | null
          screenshots: Json
          search_vector: unknown
          short_description: string | null
          steam_release_date: string | null
          steamspy_negative: number | null
          steamspy_owners: string | null
          steamspy_positive: number | null
          steamspy_tags: Json | null
          steamspy_updated_at: string | null
          title: string
          updated_at: string | null
          videos: Json
        }
        Insert: {
          appid: number
          created_at?: string | null
          developers?: string[] | null
          header_image?: string | null
          is_indie?: boolean | null
          long_description?: string | null
          raw: Json
          release_date?: string | null
          screenshots: Json
          search_vector?: unknown
          short_description?: string | null
          steam_release_date?: string | null
          steamspy_negative?: number | null
          steamspy_owners?: string | null
          steamspy_positive?: number | null
          steamspy_tags?: Json | null
          steamspy_updated_at?: string | null
          title: string
          updated_at?: string | null
          videos: Json
        }
        Update: {
          appid?: number
          created_at?: string | null
          developers?: string[] | null
          header_image?: string | null
          is_indie?: boolean | null
          long_description?: string | null
          raw?: Json
          release_date?: string | null
          screenshots?: Json
          search_vector?: unknown
          short_description?: string | null
          steam_release_date?: string | null
          steamspy_negative?: number | null
          steamspy_owners?: string | null
          steamspy_positive?: number | null
          steamspy_tags?: Json | null
          steamspy_updated_at?: string | null
          title?: string
          updated_at?: string | null
          videos?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          display_name: string | null
          id: string
          updated_at: string | null
          username: string | null
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          id: string
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          created_at: string
          key: string
          last_request_at: string
        }
        Insert: {
          created_at?: string
          key: string
          last_request_at?: string
        }
        Update: {
          created_at?: string
          key?: string
          last_request_at?: string
        }
        Relationships: []
      }
      suggestion_jobs: {
        Row: {
          created_at: string | null
          error: string | null
          finished_at: string | null
          id: string
          source_appid: number
          started_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          source_appid: number
          started_at?: string | null
          status: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          source_appid?: number
          started_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_jobs_source_appid_fkey"
            columns: ["source_appid"]
            isOneToOne: true
            referencedRelation: "games_new"
            referencedColumns: ["appid"]
          },
          {
            foreignKeyName: "suggestion_jobs_source_appid_fkey"
            columns: ["source_appid"]
            isOneToOne: true
            referencedRelation: "games_new_home"
            referencedColumns: ["appid"]
          },
        ]
      }
    }
    Views: {
      games_new_home: {
        Row: {
          appid: number | null
          created_at: string | null
          developers: string[] | null
          header_image: string | null
          home_bucket: number | null
          is_indie: boolean | null
          is_recent_indie: boolean | null
          long_description: string | null
          raw: Json | null
          release_date: string | null
          screenshots: Json | null
          search_vector: unknown
          short_description: string | null
          steam_release_date: string | null
          steamspy_negative: number | null
          steamspy_owners: string | null
          steamspy_positive: number | null
          steamspy_tags: Json | null
          steamspy_updated_at: string | null
          title: string | null
          updated_at: string | null
          videos: Json | null
        }
        Insert: {
          appid?: number | null
          created_at?: string | null
          developers?: string[] | null
          header_image?: string | null
          home_bucket?: never
          is_indie?: boolean | null
          is_recent_indie?: never
          long_description?: string | null
          raw?: Json | null
          release_date?: string | null
          screenshots?: Json | null
          search_vector?: unknown
          short_description?: string | null
          steam_release_date?: string | null
          steamspy_negative?: number | null
          steamspy_owners?: string | null
          steamspy_positive?: number | null
          steamspy_tags?: Json | null
          steamspy_updated_at?: string | null
          title?: string | null
          updated_at?: string | null
          videos?: Json | null
        }
        Update: {
          appid?: number | null
          created_at?: string | null
          developers?: string[] | null
          header_image?: string | null
          home_bucket?: never
          is_indie?: boolean | null
          is_recent_indie?: never
          long_description?: string | null
          raw?: Json | null
          release_date?: string | null
          screenshots?: Json | null
          search_vector?: unknown
          short_description?: string | null
          steam_release_date?: string | null
          steamspy_negative?: number | null
          steamspy_owners?: string | null
          steamspy_positive?: number | null
          steamspy_tags?: Json | null
          steamspy_updated_at?: string | null
          title?: string | null
          updated_at?: string | null
          videos?: Json | null
        }
        Relationships: []
      }
    }
    Functions: {
      find_similar_games: {
        Args: {
          p_appid: number
          p_facet: string
          p_limit?: number
          p_threshold?: number
        }
        Returns: {
          out_appid: number
          out_header_image: string
          out_similarity: number
          out_title: string
        }[]
      }
      find_similar_games_weighted: {
        Args: {
          p_appid: number
          p_limit?: number
          p_threshold?: number
          p_weights: Json
        }
        Returns: {
          out_appid: number
          out_facet_scores: Json
          out_header_image: string
          out_title: string
          out_weighted_similarity: number
        }[]
      }
      get_embedding_coverage: {
        Args: never
        Returns: {
          coverage_pct: number
          facet: string
          game_count: number
          total_games: number
        }[]
      }
      search_games: {
        Args: { max_results?: number; search_query: string }
        Returns: {
          appid: number
          header_image: string
          rank: number
          title: string
        }[]
      }
      search_games_by_embedding: {
        Args: { p_facet: string; p_limit?: number; p_query_embedding: string }
        Returns: {
          appid: number
          header_image: string
          similarity: number
          title: string
        }[]
      }
      steam_is_likely_indie: { Args: { raw: Json }; Returns: boolean }
      steam_try_parse_release_date: {
        Args: { date_text: string }
        Returns: string
      }
      validate_username: { Args: { username: string }; Returns: boolean }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

