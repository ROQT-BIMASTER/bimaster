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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      access_audit_log: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: unknown
          modulo_codigo: string | null
          success: boolean
          tela_codigo: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          modulo_codigo?: string | null
          success?: boolean
          tela_codigo?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          modulo_codigo?: string | null
          success?: boolean
          tela_codigo?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      account_category_mapping: {
        Row: {
          account_id: string | null
          categoria_codigo: string | null
          categoria_nome: string | null
          confidence_score: number | null
          created_at: string | null
          created_by: string | null
          id: string
        }
        Insert: {
          account_id?: string | null
          categoria_codigo?: string | null
          categoria_nome?: string | null
          confidence_score?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
        }
        Update: {
          account_id?: string | null
          categoria_codigo?: string | null
          categoria_nome?: string | null
          confidence_score?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_category_mapping_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "trade_chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      account_classification_rules: {
        Row: {
          categoria_nome: string
          confidence_score: number | null
          created_at: string | null
          created_by: string | null
          departamento_id: string | null
          fornecedor_nome: string | null
          id: string
          last_used_at: string | null
          plano_contas_id: string | null
          times_used: number | null
          tipo_documento: string | null
        }
        Insert: {
          categoria_nome: string
          confidence_score?: number | null
          created_at?: string | null
          created_by?: string | null
          departamento_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          last_used_at?: string | null
          plano_contas_id?: string | null
          times_used?: number | null
          tipo_documento?: string | null
        }
        Update: {
          categoria_nome?: string
          confidence_score?: number | null
          created_at?: string | null
          created_by?: string | null
          departamento_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          last_used_at?: string | null
          plano_contas_id?: string | null
          times_used?: number | null
          tipo_documento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_classification_rules_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_classification_rules_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "mv_analise_departamentos"
            referencedColumns: ["departamento_id"]
          },
          {
            foreignKeyName: "account_classification_rules_plano_contas_id_fkey"
            columns: ["plano_contas_id"]
            isOneToOne: false
            referencedRelation: "trade_chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_accounts: {
        Row: {
          account_id: string
          account_name: string
          created_at: string
          credentials_encrypted: string | null
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          platform: string
          sync_status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          account_name: string
          created_at?: string
          credentials_encrypted?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          platform: string
          sync_status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          account_name?: string
          created_at?: string
          credentials_encrypted?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          platform?: string
          sync_status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ads_campaign_metrics: {
        Row: {
          campaign_id: string | null
          clicks: number | null
          conversion_value: number | null
          conversions: number | null
          cpc: number | null
          created_at: string
          ctr: number | null
          id: string
          impressions: number | null
          metric_date: string
          reach: number | null
          spend: number | null
        }
        Insert: {
          campaign_id?: string | null
          clicks?: number | null
          conversion_value?: number | null
          conversions?: number | null
          cpc?: number | null
          created_at?: string
          ctr?: number | null
          id?: string
          impressions?: number | null
          metric_date: string
          reach?: number | null
          spend?: number | null
        }
        Update: {
          campaign_id?: string | null
          clicks?: number | null
          conversion_value?: number | null
          conversions?: number | null
          cpc?: number | null
          created_at?: string
          ctr?: number | null
          id?: string
          impressions?: number | null
          metric_date?: string
          reach?: number | null
          spend?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_campaign_metrics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ads_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_campaigns: {
        Row: {
          account_id: string | null
          budget_type: string | null
          campaign_id: string
          campaign_name: string
          created_at: string
          daily_budget: number | null
          end_date: string | null
          id: string
          lifetime_budget: number | null
          objective: string | null
          start_date: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          budget_type?: string | null
          campaign_id: string
          campaign_name: string
          created_at?: string
          daily_budget?: number | null
          end_date?: string | null
          id?: string
          lifetime_budget?: number | null
          objective?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          budget_type?: string | null
          campaign_id?: string
          campaign_name?: string
          created_at?: string
          daily_budget?: number | null
          end_date?: string | null
          id?: string
          lifetime_budget?: number | null
          objective?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ads_campaigns_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ads_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_campaigns_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ads_accounts_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_metrics: {
        Row: {
          account_id: string | null
          campaign_data: Json | null
          clicks: number | null
          conversion_value: number | null
          conversions: number | null
          cpc: number | null
          cpm: number | null
          created_at: string
          ctr: number | null
          engagement: number | null
          frequency: number | null
          id: string
          impressions: number | null
          metric_date: string
          reach: number | null
          roas: number | null
          spend: number | null
          video_views: number | null
        }
        Insert: {
          account_id?: string | null
          campaign_data?: Json | null
          clicks?: number | null
          conversion_value?: number | null
          conversions?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          engagement?: number | null
          frequency?: number | null
          id?: string
          impressions?: number | null
          metric_date: string
          reach?: number | null
          roas?: number | null
          spend?: number | null
          video_views?: number | null
        }
        Update: {
          account_id?: string | null
          campaign_data?: Json | null
          clicks?: number | null
          conversion_value?: number | null
          conversions?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          engagement?: number | null
          frequency?: number | null
          id?: string
          impressions?: number | null
          metric_date?: string
          reach?: number | null
          roas?: number | null
          spend?: number | null
          video_views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_metrics_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ads_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_metrics_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ads_accounts_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      agg_daily_kpis: {
        Row: {
          created_at: string | null
          date: string
          id: string
          media_ticket: number | null
          prospects_convertidos: number | null
          regiao: string
          taxa_conversao: number | null
          total_atividades: number | null
          total_investimentos: number | null
          total_prospects: number | null
          total_vendas: number | null
          total_visitas: number | null
          uf: string
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          media_ticket?: number | null
          prospects_convertidos?: number | null
          regiao?: string
          taxa_conversao?: number | null
          total_atividades?: number | null
          total_investimentos?: number | null
          total_prospects?: number | null
          total_vendas?: number | null
          total_visitas?: number | null
          uf?: string
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          media_ticket?: number | null
          prospects_convertidos?: number | null
          regiao?: string
          taxa_conversao?: number | null
          total_atividades?: number | null
          total_investimentos?: number | null
          total_prospects?: number | null
          total_vendas?: number | null
          total_visitas?: number | null
          uf?: string
        }
        Relationships: []
      }
      ai_call_actions: {
        Row: {
          action_data: Json
          action_type: string
          call_id: string | null
          created_at: string | null
          id: string
        }
        Insert: {
          action_data?: Json
          action_type: string
          call_id?: string | null
          created_at?: string | null
          id?: string
        }
        Update: {
          action_data?: Json
          action_type?: string
          call_id?: string | null
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_call_actions_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "ai_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_call_transcriptions: {
        Row: {
          call_id: string | null
          created_at: string | null
          id: string
          message: string
          speaker: string
          timestamp_ms: number
        }
        Insert: {
          call_id?: string | null
          created_at?: string | null
          id?: string
          message: string
          speaker: string
          timestamp_ms: number
        }
        Update: {
          call_id?: string | null
          created_at?: string | null
          id?: string
          message?: string
          speaker?: string
          timestamp_ms?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_call_transcriptions_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "ai_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_calls: {
        Row: {
          audio_url: string | null
          call_duration: number | null
          call_status: string
          created_at: string | null
          id: string
          meeting_date: string | null
          meeting_scheduled: boolean | null
          prospect_id: string | null
          sentiment: string | null
          summary: string | null
          transcript: string | null
          updated_at: string | null
          vendedor_id: string | null
        }
        Insert: {
          audio_url?: string | null
          call_duration?: number | null
          call_status: string
          created_at?: string | null
          id?: string
          meeting_date?: string | null
          meeting_scheduled?: boolean | null
          prospect_id?: string | null
          sentiment?: string | null
          summary?: string | null
          transcript?: string | null
          updated_at?: string | null
          vendedor_id?: string | null
        }
        Update: {
          audio_url?: string | null
          call_duration?: number | null
          call_status?: string
          created_at?: string | null
          id?: string
          meeting_date?: string | null
          meeting_scheduled?: boolean | null
          prospect_id?: string | null
          sentiment?: string | null
          summary?: string | null
          transcript?: string | null
          updated_at?: string | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_calls_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_insights: {
        Row: {
          action_items: Json | null
          actioned_at: string | null
          actioned_by: string | null
          category: string | null
          confidence_score: number | null
          data_points: Json | null
          description: string | null
          dismissal_reason: string | null
          entity_id: string | null
          entity_type: string | null
          estimated_revenue_impact: number | null
          expires_at: string | null
          generated_at: string | null
          id: string
          impact_level: string | null
          insight_type: string | null
          priority: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          title: string
        }
        Insert: {
          action_items?: Json | null
          actioned_at?: string | null
          actioned_by?: string | null
          category?: string | null
          confidence_score?: number | null
          data_points?: Json | null
          description?: string | null
          dismissal_reason?: string | null
          entity_id?: string | null
          entity_type?: string | null
          estimated_revenue_impact?: number | null
          expires_at?: string | null
          generated_at?: string | null
          id?: string
          impact_level?: string | null
          insight_type?: string | null
          priority?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          title: string
        }
        Update: {
          action_items?: Json | null
          actioned_at?: string | null
          actioned_by?: string | null
          category?: string | null
          confidence_score?: number | null
          data_points?: Json | null
          description?: string | null
          dismissal_reason?: string | null
          entity_id?: string | null
          entity_type?: string | null
          estimated_revenue_impact?: number | null
          expires_at?: string | null
          generated_at?: string | null
          id?: string
          impact_level?: string | null
          insight_type?: string | null
          priority?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          title?: string
        }
        Relationships: []
      }
      analytics_metrics: {
        Row: {
          account_id: string | null
          avg_session_duration: number | null
          bounce_rate: number | null
          created_at: string
          device_data: Json | null
          geo_data: Json | null
          goal_completions: number | null
          id: string
          metric_date: string
          new_users: number | null
          pages_per_session: number | null
          pageviews: number | null
          revenue: number | null
          sessions: number | null
          source_medium_data: Json | null
          transactions: number | null
          users: number | null
        }
        Insert: {
          account_id?: string | null
          avg_session_duration?: number | null
          bounce_rate?: number | null
          created_at?: string
          device_data?: Json | null
          geo_data?: Json | null
          goal_completions?: number | null
          id?: string
          metric_date: string
          new_users?: number | null
          pages_per_session?: number | null
          pageviews?: number | null
          revenue?: number | null
          sessions?: number | null
          source_medium_data?: Json | null
          transactions?: number | null
          users?: number | null
        }
        Update: {
          account_id?: string | null
          avg_session_duration?: number | null
          bounce_rate?: number | null
          created_at?: string
          device_data?: Json | null
          geo_data?: Json | null
          goal_completions?: number | null
          id?: string
          metric_date?: string
          new_users?: number | null
          pages_per_session?: number | null
          pageviews?: number | null
          revenue?: number | null
          sessions?: number | null
          source_medium_data?: Json | null
          transactions?: number | null
          users?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_metrics_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ads_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_metrics_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ads_accounts_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      api_access_log: {
        Row: {
          created_at: string | null
          endpoint: string
          error_message: string | null
          format: string | null
          id: string
          include_photos: boolean | null
          ip_address: string | null
          record_count: number | null
          requested_at: string
          success: boolean
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          endpoint: string
          error_message?: string | null
          format?: string | null
          id?: string
          include_photos?: boolean | null
          ip_address?: string | null
          record_count?: number | null
          requested_at?: string
          success: boolean
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          error_message?: string | null
          format?: string | null
          id?: string
          include_photos?: boolean | null
          ip_address?: string | null
          record_count?: number | null
          requested_at?: string
          success?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      api_security_log: {
        Row: {
          api_key_used: boolean | null
          created_at: string | null
          endpoint: string
          error_message: string | null
          id: string
          ip_address: unknown
          method: string
          request_size_bytes: number | null
          response_time_ms: number | null
          success: boolean | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          api_key_used?: boolean | null
          created_at?: string | null
          endpoint: string
          error_message?: string | null
          id?: string
          ip_address?: unknown
          method: string
          request_size_bytes?: number | null
          response_time_ms?: number | null
          success?: boolean | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          api_key_used?: boolean | null
          created_at?: string | null
          endpoint?: string
          error_message?: string | null
          id?: string
          ip_address?: unknown
          method?: string
          request_size_bytes?: number | null
          response_time_ms?: number | null
          success?: boolean | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      assinaturas: {
        Row: {
          cancelado_em: string | null
          created_at: string
          data_fim: string | null
          data_inicio: string
          id: string
          plano_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          usuario_id: string
        }
        Insert: {
          cancelado_em?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          id?: string
          plano_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          usuario_id: string
        }
        Update: {
          cancelado_em?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          id?: string
          plano_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assinaturas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
        ]
      }
      atividades: {
        Row: {
          created_at: string | null
          data_atividade: string
          descricao: string
          id: string
          prospect_id: string
          proximo_followup: string | null
          resultado: Database["public"]["Enums"]["activity_result"] | null
          tipo: Database["public"]["Enums"]["activity_type"]
          vendedor_id: string
        }
        Insert: {
          created_at?: string | null
          data_atividade?: string
          descricao: string
          id: string
          prospect_id: string
          proximo_followup?: string | null
          resultado?: Database["public"]["Enums"]["activity_result"] | null
          tipo: Database["public"]["Enums"]["activity_type"]
          vendedor_id: string
        }
        Update: {
          created_at?: string | null
          data_atividade?: string
          descricao?: string
          id?: string
          prospect_id?: string
          proximo_followup?: string | null
          resultado?: Database["public"]["Enums"]["activity_result"] | null
          tipo?: Database["public"]["Enums"]["activity_type"]
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "atividades_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          metadata: Json | null
          new_data: Json | null
          old_data: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      auditoria_atribuicoes: {
        Row: {
          created_at: string | null
          detalhes: Json | null
          entidade_id: string
          entidade_tipo: string
          id: string
          tipo: string
          usuario_id: string | null
          vendedor_antigo_id: string | null
          vendedor_novo_id: string | null
        }
        Insert: {
          created_at?: string | null
          detalhes?: Json | null
          entidade_id: string
          entidade_tipo: string
          id?: string
          tipo: string
          usuario_id?: string | null
          vendedor_antigo_id?: string | null
          vendedor_novo_id?: string | null
        }
        Update: {
          created_at?: string | null
          detalhes?: Json | null
          entidade_id?: string
          entidade_tipo?: string
          id?: string
          tipo?: string
          usuario_id?: string | null
          vendedor_antigo_id?: string | null
          vendedor_novo_id?: string | null
        }
        Relationships: []
      }
      categoria_departamento: {
        Row: {
          categoria_nome: string
          created_at: string | null
          departamento_id: string
          id: string
        }
        Insert: {
          categoria_nome: string
          created_at?: string | null
          departamento_id: string
          id?: string
        }
        Update: {
          categoria_nome?: string
          created_at?: string | null
          departamento_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categoria_departamento_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categoria_departamento_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "mv_analise_departamentos"
            referencedColumns: ["departamento_id"]
          },
        ]
      }
      clientes: {
        Row: {
          bairro: string | null
          bairro_cobranca: string | null
          celular: string | null
          cep: string | null
          cep_cobranca: string | null
          cidade: string | null
          cidade_cobranca: string | null
          classificacao: number | null
          cnpj: string | null
          codigo: string
          comprador: string | null
          conceito: string | null
          contrato: number | null
          convenio: number | null
          created_at: string | null
          data_cadastro: string | null
          data_maior_compra: string | null
          data_ultima_compra: string | null
          email: string | null
          empresa_id: number | null
          endereco: string | null
          endereco_cobranca: string | null
          fax: string | null
          id: string
          inscricao_estadual: string | null
          limite_credito: number | null
          nome: string
          nome_abreviado: string | null
          observacoes: string | null
          portador: string | null
          ramo_atividade: number | null
          responsavel: string | null
          rota: string | null
          sincronizado_em: string | null
          status_bloqueio: string | null
          telefone: string | null
          tipo_cliente: number | null
          uf: string | null
          uf_cobranca: string | null
          updated_at: string | null
          valor_maior_compra: number | null
          valor_ultima_compra: number | null
        }
        Insert: {
          bairro?: string | null
          bairro_cobranca?: string | null
          celular?: string | null
          cep?: string | null
          cep_cobranca?: string | null
          cidade?: string | null
          cidade_cobranca?: string | null
          classificacao?: number | null
          cnpj?: string | null
          codigo: string
          comprador?: string | null
          conceito?: string | null
          contrato?: number | null
          convenio?: number | null
          created_at?: string | null
          data_cadastro?: string | null
          data_maior_compra?: string | null
          data_ultima_compra?: string | null
          email?: string | null
          empresa_id?: number | null
          endereco?: string | null
          endereco_cobranca?: string | null
          fax?: string | null
          id?: string
          inscricao_estadual?: string | null
          limite_credito?: number | null
          nome: string
          nome_abreviado?: string | null
          observacoes?: string | null
          portador?: string | null
          ramo_atividade?: number | null
          responsavel?: string | null
          rota?: string | null
          sincronizado_em?: string | null
          status_bloqueio?: string | null
          telefone?: string | null
          tipo_cliente?: number | null
          uf?: string | null
          uf_cobranca?: string | null
          updated_at?: string | null
          valor_maior_compra?: number | null
          valor_ultima_compra?: number | null
        }
        Update: {
          bairro?: string | null
          bairro_cobranca?: string | null
          celular?: string | null
          cep?: string | null
          cep_cobranca?: string | null
          cidade?: string | null
          cidade_cobranca?: string | null
          classificacao?: number | null
          cnpj?: string | null
          codigo?: string
          comprador?: string | null
          conceito?: string | null
          contrato?: number | null
          convenio?: number | null
          created_at?: string | null
          data_cadastro?: string | null
          data_maior_compra?: string | null
          data_ultima_compra?: string | null
          email?: string | null
          empresa_id?: number | null
          endereco?: string | null
          endereco_cobranca?: string | null
          fax?: string | null
          id?: string
          inscricao_estadual?: string | null
          limite_credito?: number | null
          nome?: string
          nome_abreviado?: string | null
          observacoes?: string | null
          portador?: string | null
          ramo_atividade?: number | null
          responsavel?: string | null
          rota?: string | null
          sincronizado_em?: string | null
          status_bloqueio?: string | null
          telefone?: string | null
          tipo_cliente?: number | null
          uf?: string | null
          uf_cobranca?: string | null
          updated_at?: string | null
          valor_maior_compra?: number | null
          valor_ultima_compra?: number | null
        }
        Relationships: []
      }
      clientes_alertas_credito: {
        Row: {
          cliente_codigo: string
          created_at: string | null
          dados_alerta: Json | null
          id: string
          lido: boolean | null
          mensagem: string | null
          resolvido: boolean | null
          resolvido_em: string | null
          resolvido_por: string | null
          severidade: string | null
          tipo_alerta: string
          titulo: string
        }
        Insert: {
          cliente_codigo: string
          created_at?: string | null
          dados_alerta?: Json | null
          id?: string
          lido?: boolean | null
          mensagem?: string | null
          resolvido?: boolean | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          severidade?: string | null
          tipo_alerta: string
          titulo: string
        }
        Update: {
          cliente_codigo?: string
          created_at?: string | null
          dados_alerta?: Json | null
          id?: string
          lido?: boolean | null
          mensagem?: string | null
          resolvido?: boolean | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          severidade?: string | null
          tipo_alerta?: string
          titulo?: string
        }
        Relationships: []
      }
      clientes_perfil_credito: {
        Row: {
          bloqueado_em: string | null
          bloqueado_por: string | null
          cliente_codigo: string
          cliente_nome: string | null
          comportamento_pagamento: string | null
          created_at: string | null
          dme: number | null
          historico_scores: Json | null
          id: string
          limite_credito: number | null
          limite_disponivel: number | null
          limite_utilizado: number | null
          maior_atraso_dias: number | null
          meses_maior_atraso: Json | null
          motivo_bloqueio: string | null
          pontualidade_percentual: number | null
          primeira_compra: string | null
          score_atual: number | null
          score_classificacao: string | null
          status: string | null
          tendencia_score: string | null
          titulos_pagos_em_atraso: number | null
          titulos_pagos_em_dia: number | null
          total_compras_historico: number | null
          total_pagamentos_historico: number | null
          total_titulos_historico: number | null
          ultima_compra: string | null
          ultimo_pagamento: string | null
          updated_at: string | null
          valor_medio_compra: number | null
        }
        Insert: {
          bloqueado_em?: string | null
          bloqueado_por?: string | null
          cliente_codigo: string
          cliente_nome?: string | null
          comportamento_pagamento?: string | null
          created_at?: string | null
          dme?: number | null
          historico_scores?: Json | null
          id?: string
          limite_credito?: number | null
          limite_disponivel?: number | null
          limite_utilizado?: number | null
          maior_atraso_dias?: number | null
          meses_maior_atraso?: Json | null
          motivo_bloqueio?: string | null
          pontualidade_percentual?: number | null
          primeira_compra?: string | null
          score_atual?: number | null
          score_classificacao?: string | null
          status?: string | null
          tendencia_score?: string | null
          titulos_pagos_em_atraso?: number | null
          titulos_pagos_em_dia?: number | null
          total_compras_historico?: number | null
          total_pagamentos_historico?: number | null
          total_titulos_historico?: number | null
          ultima_compra?: string | null
          ultimo_pagamento?: string | null
          updated_at?: string | null
          valor_medio_compra?: number | null
        }
        Update: {
          bloqueado_em?: string | null
          bloqueado_por?: string | null
          cliente_codigo?: string
          cliente_nome?: string | null
          comportamento_pagamento?: string | null
          created_at?: string | null
          dme?: number | null
          historico_scores?: Json | null
          id?: string
          limite_credito?: number | null
          limite_disponivel?: number | null
          limite_utilizado?: number | null
          maior_atraso_dias?: number | null
          meses_maior_atraso?: Json | null
          motivo_bloqueio?: string | null
          pontualidade_percentual?: number | null
          primeira_compra?: string | null
          score_atual?: number | null
          score_classificacao?: string | null
          status?: string | null
          tendencia_score?: string | null
          titulos_pagos_em_atraso?: number | null
          titulos_pagos_em_dia?: number | null
          total_compras_historico?: number | null
          total_pagamentos_historico?: number | null
          total_titulos_historico?: number | null
          ultima_compra?: string | null
          ultimo_pagamento?: string | null
          updated_at?: string | null
          valor_medio_compra?: number | null
        }
        Relationships: []
      }
      clientes_score_historico: {
        Row: {
          cliente_codigo: string
          created_at: string | null
          detalhes: Json | null
          id: string
          motivo: string | null
          score_anterior: number | null
          score_novo: number
        }
        Insert: {
          cliente_codigo: string
          created_at?: string | null
          detalhes?: Json | null
          id?: string
          motivo?: string | null
          score_anterior?: number | null
          score_novo: number
        }
        Update: {
          cliente_codigo?: string
          created_at?: string | null
          detalhes?: Json | null
          id?: string
          motivo?: string | null
          score_anterior?: number | null
          score_novo?: number
        }
        Relationships: []
      }
      cnpjbiz_audit: {
        Row: {
          created_at: string | null
          credits_used: number | null
          filters: Json | null
          id: string
          operation: string
          results_count: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          credits_used?: number | null
          filters?: Json | null
          id?: string
          operation: string
          results_count?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          credits_used?: number | null
          filters?: Json | null
          id?: string
          operation?: string
          results_count?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      cnpjbiz_cache: {
        Row: {
          cache_key: string
          created_at: string | null
          data: Json
          expires_at: string
          id: string
        }
        Insert: {
          cache_key: string
          created_at?: string | null
          data: Json
          expires_at: string
          id?: string
        }
        Update: {
          cache_key?: string
          created_at?: string | null
          data?: Json
          expires_at?: string
          id?: string
        }
        Relationships: []
      }
      cobranca_execucao_log: {
        Row: {
          detalhes: Json | null
          erro_mensagem: string | null
          executado_em: string | null
          id: string
          registros_processados: number | null
          status: string | null
          tipo: string
        }
        Insert: {
          detalhes?: Json | null
          erro_mensagem?: string | null
          executado_em?: string | null
          id?: string
          registros_processados?: number | null
          status?: string | null
          tipo: string
        }
        Update: {
          detalhes?: Json | null
          erro_mensagem?: string | null
          executado_em?: string | null
          id?: string
          registros_processados?: number | null
          status?: string | null
          tipo?: string
        }
        Relationships: []
      }
      cobrancas: {
        Row: {
          cliente_codigo: string | null
          conta_receber_id: string | null
          created_at: string | null
          data_acao: string | null
          data_acordo: string | null
          data_retorno: string | null
          id: string
          observacoes: string | null
          parcelas_acordo: number | null
          responsavel_id: string | null
          responsavel_nome: string | null
          status: string | null
          tipo_acao: string
          valor_acordo: number | null
        }
        Insert: {
          cliente_codigo?: string | null
          conta_receber_id?: string | null
          created_at?: string | null
          data_acao?: string | null
          data_acordo?: string | null
          data_retorno?: string | null
          id?: string
          observacoes?: string | null
          parcelas_acordo?: number | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status?: string | null
          tipo_acao: string
          valor_acordo?: number | null
        }
        Update: {
          cliente_codigo?: string | null
          conta_receber_id?: string | null
          created_at?: string | null
          data_acao?: string | null
          data_acordo?: string | null
          data_retorno?: string | null
          id?: string
          observacoes?: string | null
          parcelas_acordo?: number | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status?: string | null
          tipo_acao?: string
          valor_acordo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cobrancas_conta_receber_id_fkey"
            columns: ["conta_receber_id"]
            isOneToOne: false
            referencedRelation: "contas_receber"
            referencedColumns: ["id"]
          },
        ]
      }
      cobrancas_enviadas: {
        Row: {
          assunto: string | null
          canal: string
          cliente_codigo: string
          cliente_nome: string | null
          conta_receber_id: string | null
          created_at: string | null
          destinatario: string
          entregue_em: string | null
          enviado_em: string | null
          fila_id: string | null
          id: string
          lido_em: string | null
          mensagem: string
          provider_id: string | null
          provider_response: Json | null
          respondido_em: string | null
          status_envio: string
          status_resposta: string | null
        }
        Insert: {
          assunto?: string | null
          canal: string
          cliente_codigo: string
          cliente_nome?: string | null
          conta_receber_id?: string | null
          created_at?: string | null
          destinatario: string
          entregue_em?: string | null
          enviado_em?: string | null
          fila_id?: string | null
          id?: string
          lido_em?: string | null
          mensagem: string
          provider_id?: string | null
          provider_response?: Json | null
          respondido_em?: string | null
          status_envio?: string
          status_resposta?: string | null
        }
        Update: {
          assunto?: string | null
          canal?: string
          cliente_codigo?: string
          cliente_nome?: string | null
          conta_receber_id?: string | null
          created_at?: string | null
          destinatario?: string
          entregue_em?: string | null
          enviado_em?: string | null
          fila_id?: string | null
          id?: string
          lido_em?: string | null
          mensagem?: string
          provider_id?: string | null
          provider_response?: Json | null
          respondido_em?: string | null
          status_envio?: string
          status_resposta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cobrancas_enviadas_fila_id_fkey"
            columns: ["fila_id"]
            isOneToOne: false
            referencedRelation: "fila_cobrancas"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_comparison_photos: {
        Row: {
          competitor_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          photo_type: string
          photo_url: string
          store_id: string | null
        }
        Insert: {
          competitor_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          photo_type: string
          photo_url: string
          store_id?: string | null
        }
        Update: {
          competitor_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          photo_type?: string
          photo_url?: string
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competitor_comparison_photos_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_comparison_photos_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "mv_trade_performance"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "competitor_comparison_photos_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_comparison_photos_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_with_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_intelligence: {
        Row: {
          competitor_id: string | null
          display_type: string | null
          facings_count: number | null
          has_special_display: boolean | null
          id: string
          observations: string | null
          our_price: number | null
          photo_id: string | null
          positioning_height: string | null
          positioning_quality: string | null
          price: number | null
          price_difference_percentage: number | null
          product_name: string | null
          product_sku: string | null
          promotion_active: boolean | null
          promotion_description: string | null
          promotion_discount: number | null
          promotion_type: string | null
          recorded_at: string | null
          shelf_share_percentage: number | null
          shelf_space_cm: number | null
          store_id: string | null
          supervisor_id: string | null
          vendedor_id: string | null
          visibility_score: number | null
          visit_id: string | null
        }
        Insert: {
          competitor_id?: string | null
          display_type?: string | null
          facings_count?: number | null
          has_special_display?: boolean | null
          id?: string
          observations?: string | null
          our_price?: number | null
          photo_id?: string | null
          positioning_height?: string | null
          positioning_quality?: string | null
          price?: number | null
          price_difference_percentage?: number | null
          product_name?: string | null
          product_sku?: string | null
          promotion_active?: boolean | null
          promotion_description?: string | null
          promotion_discount?: number | null
          promotion_type?: string | null
          recorded_at?: string | null
          shelf_share_percentage?: number | null
          shelf_space_cm?: number | null
          store_id?: string | null
          supervisor_id?: string | null
          vendedor_id?: string | null
          visibility_score?: number | null
          visit_id?: string | null
        }
        Update: {
          competitor_id?: string | null
          display_type?: string | null
          facings_count?: number | null
          has_special_display?: boolean | null
          id?: string
          observations?: string | null
          our_price?: number | null
          photo_id?: string | null
          positioning_height?: string | null
          positioning_quality?: string | null
          price?: number | null
          price_difference_percentage?: number | null
          product_name?: string | null
          product_sku?: string | null
          promotion_active?: boolean | null
          promotion_description?: string | null
          promotion_discount?: number | null
          promotion_type?: string | null
          recorded_at?: string | null
          shelf_share_percentage?: number | null
          shelf_space_cm?: number | null
          store_id?: string | null
          supervisor_id?: string | null
          vendedor_id?: string | null
          visibility_score?: number | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competitor_intelligence_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_intelligence_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_intelligence_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "mv_trade_performance"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "competitor_intelligence_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_intelligence_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_with_sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_intelligence_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_intelligence_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_intelligence_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "competitor_intelligence_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_intelligence_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_intelligence_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "competitor_intelligence_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_products: {
        Row: {
          active: boolean | null
          category: string | null
          competitor_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          market_presence: string | null
          photos: Json | null
          price: number | null
          product_name: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          category?: string | null
          competitor_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          market_presence?: string | null
          photos?: Json | null
          price?: number | null
          product_name: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          category?: string | null
          competitor_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          market_presence?: string | null
          photos?: Json | null
          price?: number | null
          product_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competitor_products_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
        ]
      }
      competitors: {
        Row: {
          active: boolean | null
          brand: string | null
          category: string | null
          created_at: string | null
          id: string
          is_direct_competitor: boolean | null
          logo_url: string | null
          manufacturer: string | null
          market_share: number | null
          name: string
          notes: string | null
          threat_level: string | null
        }
        Insert: {
          active?: boolean | null
          brand?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          is_direct_competitor?: boolean | null
          logo_url?: string | null
          manufacturer?: string | null
          market_share?: number | null
          name: string
          notes?: string | null
          threat_level?: string | null
        }
        Update: {
          active?: boolean | null
          brand?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          is_direct_competitor?: boolean | null
          logo_url?: string | null
          manufacturer?: string | null
          market_share?: number | null
          name?: string
          notes?: string | null
          threat_level?: string | null
        }
        Relationships: []
      }
      configuracoes_cobranca: {
        Row: {
          api_key: string | null
          automacao_ativa: boolean | null
          created_at: string | null
          created_by: string | null
          email_remetente: string | null
          hora_fim_envio: string | null
          hora_inicio_envio: string | null
          id: string
          intervalo_minimo_dias: number | null
          max_envios_hora: number | null
          nome_remetente: string | null
          updated_at: string | null
          updated_by: string | null
          whatsapp_verify_token: string | null
        }
        Insert: {
          api_key?: string | null
          automacao_ativa?: boolean | null
          created_at?: string | null
          created_by?: string | null
          email_remetente?: string | null
          hora_fim_envio?: string | null
          hora_inicio_envio?: string | null
          id?: string
          intervalo_minimo_dias?: number | null
          max_envios_hora?: number | null
          nome_remetente?: string | null
          updated_at?: string | null
          updated_by?: string | null
          whatsapp_verify_token?: string | null
        }
        Update: {
          api_key?: string | null
          automacao_ativa?: boolean | null
          created_at?: string | null
          created_by?: string | null
          email_remetente?: string | null
          hora_fim_envio?: string | null
          hora_inicio_envio?: string | null
          id?: string
          intervalo_minimo_dias?: number | null
          max_envios_hora?: number | null
          nome_remetente?: string | null
          updated_at?: string | null
          updated_by?: string | null
          whatsapp_verify_token?: string | null
        }
        Relationships: []
      }
      contas_pagar: {
        Row: {
          ativo_dre: boolean | null
          categoria_codigo: string | null
          categoria_nome: string | null
          classificacao_corrigida_em: string | null
          classificacao_corrigida_por: string | null
          classificacao_justificativa: string | null
          classificacao_manual: boolean | null
          classificado_automaticamente: boolean | null
          classificado_em: string | null
          confianca_classificacao: number | null
          conta: string | null
          created_at: string | null
          data_emissao: string | null
          data_hash: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          departamento_id: string | null
          departamento_nome: string | null
          empresa_id: number
          empresa_nome: string | null
          erp_id: string
          fornecedor_codigo: string | null
          fornecedor_nome: string | null
          id: string
          numero_documento: string | null
          parcela: number | null
          plano_contas_codigo: string | null
          plano_contas_id: string | null
          plano_contas_nome: string | null
          portador: string | null
          sincronizado_em: string | null
          status: string | null
          tipo_documento: string | null
          updated_at: string | null
          valor_aberto: number | null
          valor_ajustes: number | null
          valor_desconto: number | null
          valor_juros: number | null
          valor_original: number | null
          valor_pago: number | null
        }
        Insert: {
          ativo_dre?: boolean | null
          categoria_codigo?: string | null
          categoria_nome?: string | null
          classificacao_corrigida_em?: string | null
          classificacao_corrigida_por?: string | null
          classificacao_justificativa?: string | null
          classificacao_manual?: boolean | null
          classificado_automaticamente?: boolean | null
          classificado_em?: string | null
          confianca_classificacao?: number | null
          conta?: string | null
          created_at?: string | null
          data_emissao?: string | null
          data_hash?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          departamento_id?: string | null
          departamento_nome?: string | null
          empresa_id: number
          empresa_nome?: string | null
          erp_id: string
          fornecedor_codigo?: string | null
          fornecedor_nome?: string | null
          id?: string
          numero_documento?: string | null
          parcela?: number | null
          plano_contas_codigo?: string | null
          plano_contas_id?: string | null
          plano_contas_nome?: string | null
          portador?: string | null
          sincronizado_em?: string | null
          status?: string | null
          tipo_documento?: string | null
          updated_at?: string | null
          valor_aberto?: number | null
          valor_ajustes?: number | null
          valor_desconto?: number | null
          valor_juros?: number | null
          valor_original?: number | null
          valor_pago?: number | null
        }
        Update: {
          ativo_dre?: boolean | null
          categoria_codigo?: string | null
          categoria_nome?: string | null
          classificacao_corrigida_em?: string | null
          classificacao_corrigida_por?: string | null
          classificacao_justificativa?: string | null
          classificacao_manual?: boolean | null
          classificado_automaticamente?: boolean | null
          classificado_em?: string | null
          confianca_classificacao?: number | null
          conta?: string | null
          created_at?: string | null
          data_emissao?: string | null
          data_hash?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          departamento_id?: string | null
          departamento_nome?: string | null
          empresa_id?: number
          empresa_nome?: string | null
          erp_id?: string
          fornecedor_codigo?: string | null
          fornecedor_nome?: string | null
          id?: string
          numero_documento?: string | null
          parcela?: number | null
          plano_contas_codigo?: string | null
          plano_contas_id?: string | null
          plano_contas_nome?: string | null
          portador?: string | null
          sincronizado_em?: string | null
          status?: string | null
          tipo_documento?: string | null
          updated_at?: string | null
          valor_aberto?: number | null
          valor_ajustes?: number | null
          valor_desconto?: number | null
          valor_juros?: number | null
          valor_original?: number | null
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contas_pagar_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "mv_analise_departamentos"
            referencedColumns: ["departamento_id"]
          },
          {
            foreignKeyName: "contas_pagar_plano_contas_id_fkey"
            columns: ["plano_contas_id"]
            isOneToOne: false
            referencedRelation: "trade_chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_pagar_historico: {
        Row: {
          campo_alterado: string
          conta_id: string
          created_at: string
          id: string
          justificativa: string | null
          tipo_alteracao: string
          usuario_id: string | null
          usuario_nome: string | null
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          campo_alterado: string
          conta_id: string
          created_at?: string
          id?: string
          justificativa?: string | null
          tipo_alteracao?: string
          usuario_id?: string | null
          usuario_nome?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          campo_alterado?: string
          conta_id?: string
          created_at?: string
          id?: string
          justificativa?: string | null
          tipo_alteracao?: string
          usuario_id?: string | null
          usuario_nome?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contas_pagar_historico_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas_pagar"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_pagar_revisao: {
        Row: {
          categoria_nome: string | null
          conta_id: string | null
          created_at: string | null
          criado_por: string | null
          data_vencimento: string | null
          departamento_id: string | null
          empresa_nome: string | null
          fornecedor_codigo: string | null
          fornecedor_nome: string | null
          id: string
          meta_reducao_percentual: number | null
          meta_reducao_valor: number | null
          numero_documento: string | null
          observacoes: string | null
          plano_contas_id: string | null
          prazo_revisao: string | null
          prioridade: string | null
          responsavel_id: string | null
          resultado_obtido: number | null
          status: string | null
          tipo_documento: string | null
          tipo_revisao: string
          updated_at: string | null
          valor_atual: number | null
        }
        Insert: {
          categoria_nome?: string | null
          conta_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_vencimento?: string | null
          departamento_id?: string | null
          empresa_nome?: string | null
          fornecedor_codigo?: string | null
          fornecedor_nome?: string | null
          id?: string
          meta_reducao_percentual?: number | null
          meta_reducao_valor?: number | null
          numero_documento?: string | null
          observacoes?: string | null
          plano_contas_id?: string | null
          prazo_revisao?: string | null
          prioridade?: string | null
          responsavel_id?: string | null
          resultado_obtido?: number | null
          status?: string | null
          tipo_documento?: string | null
          tipo_revisao: string
          updated_at?: string | null
          valor_atual?: number | null
        }
        Update: {
          categoria_nome?: string | null
          conta_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_vencimento?: string | null
          departamento_id?: string | null
          empresa_nome?: string | null
          fornecedor_codigo?: string | null
          fornecedor_nome?: string | null
          id?: string
          meta_reducao_percentual?: number | null
          meta_reducao_valor?: number | null
          numero_documento?: string | null
          observacoes?: string | null
          plano_contas_id?: string | null
          prazo_revisao?: string | null
          prioridade?: string | null
          responsavel_id?: string | null
          resultado_obtido?: number | null
          status?: string | null
          tipo_documento?: string | null
          tipo_revisao?: string
          updated_at?: string | null
          valor_atual?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contas_pagar_revisao_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas_pagar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_revisao_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_revisao_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "mv_analise_departamentos"
            referencedColumns: ["departamento_id"]
          },
          {
            foreignKeyName: "contas_pagar_revisao_plano_contas_id_fkey"
            columns: ["plano_contas_id"]
            isOneToOne: false
            referencedRelation: "trade_chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_receber: {
        Row: {
          cliente_codigo: string | null
          cliente_nome: string | null
          conta: string | null
          created_at: string | null
          data_emissao: string | null
          data_hash: string | null
          data_recebimento: string | null
          data_vencimento: string | null
          dias_atraso: number | null
          empresa_id: number
          empresa_nome: string | null
          erp_id: string
          id: string
          numero_documento: string | null
          parcela: number | null
          portador: string | null
          portador_id: string | null
          portador_nome: string | null
          sincronizado_em: string | null
          status: string | null
          tabela: string | null
          tabela_preco: string | null
          tipo_documento: string | null
          updated_at: string | null
          valor_aberto: number | null
          valor_ajustes: number | null
          valor_desconto: number | null
          valor_juros: number | null
          valor_original: number | null
          valor_recebido: number | null
          vendedor: string | null
          vendedor_codigo: string | null
          vendedor_nome: string | null
        }
        Insert: {
          cliente_codigo?: string | null
          cliente_nome?: string | null
          conta?: string | null
          created_at?: string | null
          data_emissao?: string | null
          data_hash?: string | null
          data_recebimento?: string | null
          data_vencimento?: string | null
          dias_atraso?: number | null
          empresa_id: number
          empresa_nome?: string | null
          erp_id: string
          id?: string
          numero_documento?: string | null
          parcela?: number | null
          portador?: string | null
          portador_id?: string | null
          portador_nome?: string | null
          sincronizado_em?: string | null
          status?: string | null
          tabela?: string | null
          tabela_preco?: string | null
          tipo_documento?: string | null
          updated_at?: string | null
          valor_aberto?: number | null
          valor_ajustes?: number | null
          valor_desconto?: number | null
          valor_juros?: number | null
          valor_original?: number | null
          valor_recebido?: number | null
          vendedor?: string | null
          vendedor_codigo?: string | null
          vendedor_nome?: string | null
        }
        Update: {
          cliente_codigo?: string | null
          cliente_nome?: string | null
          conta?: string | null
          created_at?: string | null
          data_emissao?: string | null
          data_hash?: string | null
          data_recebimento?: string | null
          data_vencimento?: string | null
          dias_atraso?: number | null
          empresa_id?: number
          empresa_nome?: string | null
          erp_id?: string
          id?: string
          numero_documento?: string | null
          parcela?: number | null
          portador?: string | null
          portador_id?: string | null
          portador_nome?: string | null
          sincronizado_em?: string | null
          status?: string | null
          tabela?: string | null
          tabela_preco?: string | null
          tipo_documento?: string | null
          updated_at?: string | null
          valor_aberto?: number | null
          valor_ajustes?: number | null
          valor_desconto?: number | null
          valor_juros?: number | null
          valor_original?: number | null
          valor_recebido?: number | null
          vendedor?: string | null
          vendedor_codigo?: string | null
          vendedor_nome?: string | null
        }
        Relationships: []
      }
      conversas: {
        Row: {
          created_at: string
          id: string
          nome: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversas_participantes: {
        Row: {
          conversa_id: string
          created_at: string
          id: string
          ultima_leitura: string | null
          usuario_id: string
        }
        Insert: {
          conversa_id: string
          created_at?: string
          id?: string
          ultima_leitura?: string | null
          usuario_id: string
        }
        Update: {
          conversa_id?: string
          created_at?: string
          id?: string
          ultima_leitura?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversas_participantes_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      departamento_permissoes_modulos: {
        Row: {
          created_at: string | null
          departamento_id: string
          id: string
          modulo_id: string
        }
        Insert: {
          created_at?: string | null
          departamento_id: string
          id?: string
          modulo_id: string
        }
        Update: {
          created_at?: string | null
          departamento_id?: string
          id?: string
          modulo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "departamento_permissoes_modulos_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departamento_permissoes_modulos_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "mv_analise_departamentos"
            referencedColumns: ["departamento_id"]
          },
          {
            foreignKeyName: "departamento_permissoes_modulos_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modulos_sistema"
            referencedColumns: ["id"]
          },
        ]
      }
      departamento_permissoes_telas: {
        Row: {
          created_at: string | null
          departamento_id: string
          id: string
          tela_id: string
        }
        Insert: {
          created_at?: string | null
          departamento_id: string
          id?: string
          tela_id: string
        }
        Update: {
          created_at?: string | null
          departamento_id?: string
          id?: string
          tela_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "departamento_permissoes_telas_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departamento_permissoes_telas_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "mv_analise_departamentos"
            referencedColumns: ["departamento_id"]
          },
          {
            foreignKeyName: "departamento_permissoes_telas_tela_id_fkey"
            columns: ["tela_id"]
            isOneToOne: false
            referencedRelation: "telas_sistema"
            referencedColumns: ["id"]
          },
        ]
      }
      departamentos: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          responsavel_id: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          responsavel_id?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          responsavel_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      estoque_distribuidoras: {
        Row: {
          ativo: boolean | null
          cidade: string | null
          cnpj: string
          created_at: string | null
          created_by: string | null
          email: string | null
          endereco: string | null
          id: string
          nome: string
          telefone: string | null
          uf: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          cidade?: string | null
          cnpj: string
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome: string
          telefone?: string | null
          uf?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          cidade?: string | null
          cnpj?: string
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          uf?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      estoque_movimentacoes: {
        Row: {
          created_at: string | null
          custo_unitario: number | null
          data_movimento: string | null
          destino: string | null
          documento_referencia: string | null
          estoque_id: string
          id: string
          n8n_transaction_id: string | null
          observacao: string | null
          origem: string | null
          quantidade: number
          quantidade_anterior: number
          quantidade_nova: number
          tipo_movimento: string
          usuario_id: string | null
          valor_total: number | null
        }
        Insert: {
          created_at?: string | null
          custo_unitario?: number | null
          data_movimento?: string | null
          destino?: string | null
          documento_referencia?: string | null
          estoque_id: string
          id?: string
          n8n_transaction_id?: string | null
          observacao?: string | null
          origem?: string | null
          quantidade: number
          quantidade_anterior: number
          quantidade_nova: number
          tipo_movimento: string
          usuario_id?: string | null
          valor_total?: number | null
        }
        Update: {
          created_at?: string | null
          custo_unitario?: number | null
          data_movimento?: string | null
          destino?: string | null
          documento_referencia?: string | null
          estoque_id?: string
          id?: string
          n8n_transaction_id?: string | null
          observacao?: string | null
          origem?: string | null
          quantidade?: number
          quantidade_anterior?: number
          quantidade_nova?: number
          tipo_movimento?: string
          usuario_id?: string | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_movimentacoes_estoque_id_fkey"
            columns: ["estoque_id"]
            isOneToOne: false
            referencedRelation: "estoque_saldos"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_produtos_distribuidora: {
        Row: {
          ativo: boolean | null
          codigo_produto_distribuidora: string
          created_at: string | null
          created_by: string | null
          distribuidora_id: string
          fator_conversao: number | null
          id: string
          nome_exibicao: string | null
          produto_master_id: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          codigo_produto_distribuidora: string
          created_at?: string | null
          created_by?: string | null
          distribuidora_id: string
          fator_conversao?: number | null
          id?: string
          nome_exibicao?: string | null
          produto_master_id: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          codigo_produto_distribuidora?: string
          created_at?: string | null
          created_by?: string | null
          distribuidora_id?: string
          fator_conversao?: number | null
          id?: string
          nome_exibicao?: string | null
          produto_master_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_produtos_distribuidora_distribuidora_id_fkey"
            columns: ["distribuidora_id"]
            isOneToOne: false
            referencedRelation: "estoque_distribuidoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_produtos_distribuidora_produto_master_id_fkey"
            columns: ["produto_master_id"]
            isOneToOne: false
            referencedRelation: "estoque_produtos_master"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_produtos_master: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          created_at: string | null
          created_by: string | null
          descricao: string | null
          id: string
          nome: string
          peso_bruto: number | null
          peso_liquido: number | null
          sku_master: string
          subcategoria: string | null
          unidade_medida: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          categoria?: string | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome: string
          peso_bruto?: number | null
          peso_liquido?: number | null
          sku_master: string
          subcategoria?: string | null
          unidade_medida?: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          categoria?: string | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          peso_bruto?: number | null
          peso_liquido?: number | null
          sku_master?: string
          subcategoria?: string | null
          unidade_medida?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      estoque_saldos: {
        Row: {
          created_at: string | null
          custo_medio: number | null
          data_validade: string | null
          distribuidora_id: string
          id: string
          localizacao: string | null
          lote: string | null
          produto_distribuidora_id: string
          quantidade_disponivel: number
          quantidade_reservada: number | null
          ultimo_movimento: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          custo_medio?: number | null
          data_validade?: string | null
          distribuidora_id: string
          id?: string
          localizacao?: string | null
          lote?: string | null
          produto_distribuidora_id: string
          quantidade_disponivel?: number
          quantidade_reservada?: number | null
          ultimo_movimento?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          custo_medio?: number | null
          data_validade?: string | null
          distribuidora_id?: string
          id?: string
          localizacao?: string | null
          lote?: string | null
          produto_distribuidora_id?: string
          quantidade_disponivel?: number
          quantidade_reservada?: number | null
          ultimo_movimento?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_saldos_distribuidora_id_fkey"
            columns: ["distribuidora_id"]
            isOneToOne: false
            referencedRelation: "estoque_distribuidoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_saldos_produto_distribuidora_id_fkey"
            columns: ["produto_distribuidora_id"]
            isOneToOne: false
            referencedRelation: "estoque_produtos_distribuidora"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_sync_logs: {
        Row: {
          created_at: string | null
          detalhes: Json | null
          duracao_ms: number | null
          erros: Json | null
          id: string
          ip_origem: string | null
          registros_enviados: number | null
          registros_erro: number | null
          registros_processados: number | null
          status: string
          tipo: string
        }
        Insert: {
          created_at?: string | null
          detalhes?: Json | null
          duracao_ms?: number | null
          erros?: Json | null
          id?: string
          ip_origem?: string | null
          registros_enviados?: number | null
          registros_erro?: number | null
          registros_processados?: number | null
          status?: string
          tipo: string
        }
        Update: {
          created_at?: string | null
          detalhes?: Json | null
          duracao_ms?: number | null
          erros?: Json | null
          id?: string
          ip_origem?: string | null
          registros_enviados?: number | null
          registros_erro?: number | null
          registros_processados?: number | null
          status?: string
          tipo?: string
        }
        Relationships: []
      }
      etl_changelog: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          changed_data: Json | null
          id: string
          operation: string
          record_id: string
          table_name: string
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          changed_data?: Json | null
          id?: string
          operation: string
          record_id: string
          table_name: string
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          changed_data?: Json | null
          id?: string
          operation?: string
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      fabrica_acoes_corretivas: {
        Row: {
          created_at: string | null
          created_by: string | null
          custos_acao: number | null
          data_conclusao: string | null
          descricao: string
          eficacia: string | null
          id: string
          nao_conformidade_id: string
          prazo_conclusao: string | null
          responsavel_id: string | null
          status: string | null
          tipo_acao: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          custos_acao?: number | null
          data_conclusao?: string | null
          descricao: string
          eficacia?: string | null
          id?: string
          nao_conformidade_id: string
          prazo_conclusao?: string | null
          responsavel_id?: string | null
          status?: string | null
          tipo_acao: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          custos_acao?: number | null
          data_conclusao?: string | null
          descricao?: string
          eficacia?: string | null
          id?: string
          nao_conformidade_id?: string
          prazo_conclusao?: string | null
          responsavel_id?: string | null
          status?: string | null
          tipo_acao?: string
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_acoes_corretivas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_acoes_corretivas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_acoes_corretivas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fabrica_acoes_corretivas_nao_conformidade_id_fkey"
            columns: ["nao_conformidade_id"]
            isOneToOne: false
            referencedRelation: "fabrica_nao_conformidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_acoes_corretivas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_acoes_corretivas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_acoes_corretivas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      fabrica_alertas_precos: {
        Row: {
          created_at: string
          dados_alerta: Json | null
          expires_at: string | null
          id: string
          lido: boolean | null
          mensagem: string | null
          produto_id: string | null
          resolvido: boolean | null
          resolvido_em: string | null
          resolvido_por: string | null
          severidade: string
          tabela_id: string | null
          tipo_alerta: string
          titulo: string
        }
        Insert: {
          created_at?: string
          dados_alerta?: Json | null
          expires_at?: string | null
          id?: string
          lido?: boolean | null
          mensagem?: string | null
          produto_id?: string | null
          resolvido?: boolean | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          severidade?: string
          tabela_id?: string | null
          tipo_alerta: string
          titulo: string
        }
        Update: {
          created_at?: string
          dados_alerta?: Json | null
          expires_at?: string | null
          id?: string
          lido?: boolean | null
          mensagem?: string | null
          produto_id?: string | null
          resolvido?: boolean | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          severidade?: string
          tabela_id?: string | null
          tipo_alerta?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_alertas_precos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "fabrica_produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_alertas_precos_tabela_id_fkey"
            columns: ["tabela_id"]
            isOneToOne: false
            referencedRelation: "fabrica_tabelas_preco"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_apontamentos: {
        Row: {
          created_at: string | null
          created_by: string | null
          duracao_minutos: number | null
          id: string
          localizacao_gps: Json | null
          maquina_id: string | null
          observacoes: string | null
          operador_id: string | null
          ordem_producao_id: string
          parametros_processo: Json | null
          pressao: number | null
          quantidade_apontada: number | null
          quantidade_refugo: number | null
          quantidade_retrabalho: number | null
          temperatura: number | null
          tempo_setup_minutos: number | null
          timestamp_evento: string
          tipo: string
          velocidade_producao: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          duracao_minutos?: number | null
          id?: string
          localizacao_gps?: Json | null
          maquina_id?: string | null
          observacoes?: string | null
          operador_id?: string | null
          ordem_producao_id: string
          parametros_processo?: Json | null
          pressao?: number | null
          quantidade_apontada?: number | null
          quantidade_refugo?: number | null
          quantidade_retrabalho?: number | null
          temperatura?: number | null
          tempo_setup_minutos?: number | null
          timestamp_evento?: string
          tipo: string
          velocidade_producao?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          duracao_minutos?: number | null
          id?: string
          localizacao_gps?: Json | null
          maquina_id?: string | null
          observacoes?: string | null
          operador_id?: string | null
          ordem_producao_id?: string
          parametros_processo?: Json | null
          pressao?: number | null
          quantidade_apontada?: number | null
          quantidade_refugo?: number | null
          quantidade_retrabalho?: number | null
          temperatura?: number | null
          tempo_setup_minutos?: number | null
          timestamp_evento?: string
          tipo?: string
          velocidade_producao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_apontamentos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_apontamentos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_apontamentos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fabrica_apontamentos_maquina_id_fkey"
            columns: ["maquina_id"]
            isOneToOne: false
            referencedRelation: "fabrica_maquinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_apontamentos_operador_id_fkey"
            columns: ["operador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_apontamentos_operador_id_fkey"
            columns: ["operador_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_apontamentos_operador_id_fkey"
            columns: ["operador_id"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fabrica_apontamentos_ordem_producao_id_fkey"
            columns: ["ordem_producao_id"]
            isOneToOne: false
            referencedRelation: "fabrica_ordens_producao"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_apuracao_fiscal: {
        Row: {
          created_at: string | null
          data_escrituracao: string | null
          data_fechamento: string | null
          escriturado_sped: boolean | null
          id: string
          periodo: string
          responsavel_id: string | null
          saldo_a_transportar: number | null
          saldo_anterior: number | null
          saldo_periodo: number | null
          status: string | null
          tipo_imposto: string
          total_creditos: number | null
          total_debitos: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data_escrituracao?: string | null
          data_fechamento?: string | null
          escriturado_sped?: boolean | null
          id?: string
          periodo: string
          responsavel_id?: string | null
          saldo_a_transportar?: number | null
          saldo_anterior?: number | null
          saldo_periodo?: number | null
          status?: string | null
          tipo_imposto: string
          total_creditos?: number | null
          total_debitos?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data_escrituracao?: string | null
          data_fechamento?: string | null
          escriturado_sped?: boolean | null
          id?: string
          periodo?: string
          responsavel_id?: string | null
          saldo_a_transportar?: number | null
          saldo_anterior?: number | null
          saldo_periodo?: number | null
          status?: string | null
          tipo_imposto?: string
          total_creditos?: number | null
          total_debitos?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fabrica_categorias_mp: {
        Row: {
          ativa: boolean | null
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          updated_at: string | null
        }
        Insert: {
          ativa?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string | null
        }
        Update: {
          ativa?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      fabrica_causas_refugo: {
        Row: {
          ativo: boolean | null
          codigo: string
          created_at: string | null
          descricao: string
          id: string
          tipo: string
        }
        Insert: {
          ativo?: boolean | null
          codigo: string
          created_at?: string | null
          descricao: string
          id?: string
          tipo: string
        }
        Update: {
          ativo?: boolean | null
          codigo?: string
          created_at?: string | null
          descricao?: string
          id?: string
          tipo?: string
        }
        Relationships: []
      }
      fabrica_codigos_fornecedor: {
        Row: {
          ativo: boolean | null
          codigo_fornecedor: string
          created_at: string | null
          descricao_fornecedor: string | null
          fator_conversao: number | null
          fornecedor_id: string | null
          id: string
          produto_interno_id: string | null
          regras: Json | null
          score_confianca: number | null
          unidade_fornecedor: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          codigo_fornecedor: string
          created_at?: string | null
          descricao_fornecedor?: string | null
          fator_conversao?: number | null
          fornecedor_id?: string | null
          id?: string
          produto_interno_id?: string | null
          regras?: Json | null
          score_confianca?: number | null
          unidade_fornecedor?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          codigo_fornecedor?: string
          created_at?: string | null
          descricao_fornecedor?: string | null
          fator_conversao?: number | null
          fornecedor_id?: string | null
          id?: string
          produto_interno_id?: string | null
          regras?: Json | null
          score_confianca?: number | null
          unidade_fornecedor?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_codigos_fornecedor_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fabrica_fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_codigos_fornecedor_produto_interno_id_fkey"
            columns: ["produto_interno_id"]
            isOneToOne: false
            referencedRelation: "fabrica_materias_primas"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_compras: {
        Row: {
          created_at: string | null
          data_entrega_prevista: string | null
          data_entrega_real: string | null
          data_pedido: string
          fornecedor_id: string | null
          id: string
          lote_recebido: string | null
          mp_id: string | null
          nota_fiscal: string | null
          preco_total: number
          preco_unitario: number
          quantidade: number
          responsavel_id: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          data_entrega_prevista?: string | null
          data_entrega_real?: string | null
          data_pedido: string
          fornecedor_id?: string | null
          id?: string
          lote_recebido?: string | null
          mp_id?: string | null
          nota_fiscal?: string | null
          preco_total: number
          preco_unitario: number
          quantidade: number
          responsavel_id?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          data_entrega_prevista?: string | null
          data_entrega_real?: string | null
          data_pedido?: string
          fornecedor_id?: string | null
          id?: string
          lote_recebido?: string | null
          mp_id?: string | null
          nota_fiscal?: string | null
          preco_total?: number
          preco_unitario?: number
          quantidade?: number
          responsavel_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_compras_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fabrica_fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_compras_mp_id_fkey"
            columns: ["mp_id"]
            isOneToOne: false
            referencedRelation: "fabrica_materias_primas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_compras_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_compras_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_compras_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      fabrica_conversoes_unidade: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          fator: number
          id: string
          unidade_destino: string
          unidade_origem: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          fator: number
          id?: string
          unidade_destino: string
          unidade_origem: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          fator?: number
          id?: string
          unidade_destino?: string
          unidade_origem?: string
        }
        Relationships: []
      }
      fabrica_creditos_tributarios: {
        Row: {
          aliquota: number | null
          base_calculo: number | null
          cfop: string | null
          created_at: string | null
          created_by: string | null
          cst: string | null
          data_credito: string
          data_utilizacao: string | null
          escriturado_sped: boolean | null
          id: string
          movimentacao_id: string | null
          nota_id: string | null
          observacoes: string | null
          periodo_apuracao: string
          periodo_escrituracao: string | null
          produto_id: string
          saldo_credito: number | null
          status: string
          tipo_credito: string
          updated_at: string | null
          valor_credito: number
          valor_utilizado: number | null
        }
        Insert: {
          aliquota?: number | null
          base_calculo?: number | null
          cfop?: string | null
          created_at?: string | null
          created_by?: string | null
          cst?: string | null
          data_credito: string
          data_utilizacao?: string | null
          escriturado_sped?: boolean | null
          id?: string
          movimentacao_id?: string | null
          nota_id?: string | null
          observacoes?: string | null
          periodo_apuracao: string
          periodo_escrituracao?: string | null
          produto_id: string
          saldo_credito?: number | null
          status?: string
          tipo_credito: string
          updated_at?: string | null
          valor_credito: number
          valor_utilizado?: number | null
        }
        Update: {
          aliquota?: number | null
          base_calculo?: number | null
          cfop?: string | null
          created_at?: string | null
          created_by?: string | null
          cst?: string | null
          data_credito?: string
          data_utilizacao?: string | null
          escriturado_sped?: boolean | null
          id?: string
          movimentacao_id?: string | null
          nota_id?: string | null
          observacoes?: string | null
          periodo_apuracao?: string
          periodo_escrituracao?: string | null
          produto_id?: string
          saldo_credito?: number | null
          status?: string
          tipo_credito?: string
          updated_at?: string | null
          valor_credito?: number
          valor_utilizado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_creditos_tributarios_movimentacao_id_fkey"
            columns: ["movimentacao_id"]
            isOneToOne: false
            referencedRelation: "fabrica_movimentacoes_estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_creditos_tributarios_nota_id_fkey"
            columns: ["nota_id"]
            isOneToOne: false
            referencedRelation: "fabrica_notas_fiscais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_creditos_tributarios_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "fabrica_materias_primas"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_cst_referencia: {
        Row: {
          codigo_cst: string
          created_at: string | null
          descricao: string
          gera_credito: boolean
          id: string
          observacoes: string | null
          tipo_credito: string | null
          tipo_imposto: string
        }
        Insert: {
          codigo_cst: string
          created_at?: string | null
          descricao: string
          gera_credito?: boolean
          id?: string
          observacoes?: string | null
          tipo_credito?: string | null
          tipo_imposto: string
        }
        Update: {
          codigo_cst?: string
          created_at?: string | null
          descricao?: string
          gera_credito?: boolean
          id?: string
          observacoes?: string | null
          tipo_credito?: string | null
          tipo_imposto?: string
        }
        Relationships: []
      }
      fabrica_custos_origem: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          created_by: string | null
          custo_base: number
          custo_fob: number | null
          custo_frete: number | null
          custo_impostos: number | null
          custo_seguro: number | null
          data_referencia: string
          id: string
          moeda_origem: string | null
          observacoes: string | null
          origem: string
          produto_id: string
          taxa_cambio: number | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          created_by?: string | null
          custo_base?: number
          custo_fob?: number | null
          custo_frete?: number | null
          custo_impostos?: number | null
          custo_seguro?: number | null
          data_referencia?: string
          id?: string
          moeda_origem?: string | null
          observacoes?: string | null
          origem: string
          produto_id: string
          taxa_cambio?: number | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          created_by?: string | null
          custo_base?: number
          custo_fob?: number | null
          custo_frete?: number | null
          custo_impostos?: number | null
          custo_seguro?: number | null
          data_referencia?: string
          id?: string
          moeda_origem?: string | null
          observacoes?: string | null
          origem?: string
          produto_id?: string
          taxa_cambio?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_custos_origem_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "fabrica_produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_custos_producao: {
        Row: {
          created_at: string | null
          created_by: string | null
          custo_unitario: number | null
          descricao: string
          id: string
          ordem_producao_id: string | null
          quantidade: number | null
          tipo_custo: string
          valor: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          custo_unitario?: number | null
          descricao: string
          id?: string
          ordem_producao_id?: string | null
          quantidade?: number | null
          tipo_custo: string
          valor: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          custo_unitario?: number | null
          descricao?: string
          id?: string
          ordem_producao_id?: string | null
          quantidade?: number | null
          tipo_custo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_custos_producao_ordem_producao_id_fkey"
            columns: ["ordem_producao_id"]
            isOneToOne: false
            referencedRelation: "fabrica_ordens_producao"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_dados_fiscais_produto: {
        Row: {
          aliquota_cofins: number | null
          aliquota_fcp: number | null
          aliquota_icms: number | null
          aliquota_ipi: number | null
          aliquota_pis: number | null
          altura: number | null
          bc_cofins: number | null
          bc_fcp: number | null
          bc_icms: number | null
          bc_ipi: number | null
          bc_pis: number | null
          caixa_padrao_compra: number | null
          cest: string | null
          cfop_padrao: string | null
          classificacao_fiscal: string | null
          classificacao_pis_cofins: string | null
          cod_nbm: string | null
          codigo_ean: string | null
          codigo_ean_tributavel: string | null
          codigo_enquadramento_ipi: string | null
          cofins_qtd_bc_prod: number | null
          cofins_v_aliq_prod: number | null
          comissao_cobranca: number | null
          comissao_venda: number | null
          comprimento: number | null
          created_at: string | null
          created_by: string | null
          cst_cofins: string | null
          cst_icms: string | null
          cst_ipi: string | null
          cst_pis: string | null
          cstp_pis: string | null
          curva_fisica: string | null
          curva_monetaria: string | null
          custo_icms: number | null
          custo_icms_percentual: number | null
          custo_medio: number | null
          desconto_compra: number | null
          desconto_entrada: number | null
          desconto_maximo: number | null
          estoque_maximo: number | null
          estoque_minimo: number | null
          excecao_ncm: string | null
          frete: number | null
          gera_credito_cofins: boolean | null
          gera_credito_icms: boolean | null
          gera_credito_ipi: boolean | null
          gera_credito_pis: boolean | null
          icms_diferido: boolean | null
          id: string
          indicador_composicao_total: number | null
          industrializacao_encomenda: boolean | null
          informacoes_adicionais: string | null
          largura: number | null
          markup_percentual: number | null
          modalidade_bc_icms: string | null
          motivo_desoneracao_icms: string | null
          ncm: string | null
          numero_drawback: string | null
          observacoes: string | null
          origem_mercadoria: string | null
          percentual_st: number | null
          peso_bruto: number | null
          peso_liquido: number | null
          pis_qtd_bc_prod: number | null
          pis_v_aliq_prod: number | null
          preco_custo: number | null
          preco_fabrica: number | null
          preco_maximo: number | null
          preco_venda: number | null
          produto_id: string
          qtd_max_dia_cliente: number | null
          qtd_max_dia_vendedor: number | null
          qtd_maxima: number | null
          qtd_minima: number | null
          regime_tributacao: string | null
          repasse_icm: number | null
          reserva: number | null
          substancia: string | null
          tem_drawback: boolean | null
          tipo_operacao: string | null
          unidade_compra: string | null
          unidade_venda: string | null
          updated_at: string | null
          v_icms_st_ret: number | null
          v_icms_substituto: number | null
          valor_cofins: number | null
          valor_fcp: number | null
          valor_icms: number | null
          valor_icms_desonerado: number | null
          valor_ipi: number | null
          valor_pis: number | null
          vbc_st_ret: number | null
          volume_m3: number | null
        }
        Insert: {
          aliquota_cofins?: number | null
          aliquota_fcp?: number | null
          aliquota_icms?: number | null
          aliquota_ipi?: number | null
          aliquota_pis?: number | null
          altura?: number | null
          bc_cofins?: number | null
          bc_fcp?: number | null
          bc_icms?: number | null
          bc_ipi?: number | null
          bc_pis?: number | null
          caixa_padrao_compra?: number | null
          cest?: string | null
          cfop_padrao?: string | null
          classificacao_fiscal?: string | null
          classificacao_pis_cofins?: string | null
          cod_nbm?: string | null
          codigo_ean?: string | null
          codigo_ean_tributavel?: string | null
          codigo_enquadramento_ipi?: string | null
          cofins_qtd_bc_prod?: number | null
          cofins_v_aliq_prod?: number | null
          comissao_cobranca?: number | null
          comissao_venda?: number | null
          comprimento?: number | null
          created_at?: string | null
          created_by?: string | null
          cst_cofins?: string | null
          cst_icms?: string | null
          cst_ipi?: string | null
          cst_pis?: string | null
          cstp_pis?: string | null
          curva_fisica?: string | null
          curva_monetaria?: string | null
          custo_icms?: number | null
          custo_icms_percentual?: number | null
          custo_medio?: number | null
          desconto_compra?: number | null
          desconto_entrada?: number | null
          desconto_maximo?: number | null
          estoque_maximo?: number | null
          estoque_minimo?: number | null
          excecao_ncm?: string | null
          frete?: number | null
          gera_credito_cofins?: boolean | null
          gera_credito_icms?: boolean | null
          gera_credito_ipi?: boolean | null
          gera_credito_pis?: boolean | null
          icms_diferido?: boolean | null
          id?: string
          indicador_composicao_total?: number | null
          industrializacao_encomenda?: boolean | null
          informacoes_adicionais?: string | null
          largura?: number | null
          markup_percentual?: number | null
          modalidade_bc_icms?: string | null
          motivo_desoneracao_icms?: string | null
          ncm?: string | null
          numero_drawback?: string | null
          observacoes?: string | null
          origem_mercadoria?: string | null
          percentual_st?: number | null
          peso_bruto?: number | null
          peso_liquido?: number | null
          pis_qtd_bc_prod?: number | null
          pis_v_aliq_prod?: number | null
          preco_custo?: number | null
          preco_fabrica?: number | null
          preco_maximo?: number | null
          preco_venda?: number | null
          produto_id: string
          qtd_max_dia_cliente?: number | null
          qtd_max_dia_vendedor?: number | null
          qtd_maxima?: number | null
          qtd_minima?: number | null
          regime_tributacao?: string | null
          repasse_icm?: number | null
          reserva?: number | null
          substancia?: string | null
          tem_drawback?: boolean | null
          tipo_operacao?: string | null
          unidade_compra?: string | null
          unidade_venda?: string | null
          updated_at?: string | null
          v_icms_st_ret?: number | null
          v_icms_substituto?: number | null
          valor_cofins?: number | null
          valor_fcp?: number | null
          valor_icms?: number | null
          valor_icms_desonerado?: number | null
          valor_ipi?: number | null
          valor_pis?: number | null
          vbc_st_ret?: number | null
          volume_m3?: number | null
        }
        Update: {
          aliquota_cofins?: number | null
          aliquota_fcp?: number | null
          aliquota_icms?: number | null
          aliquota_ipi?: number | null
          aliquota_pis?: number | null
          altura?: number | null
          bc_cofins?: number | null
          bc_fcp?: number | null
          bc_icms?: number | null
          bc_ipi?: number | null
          bc_pis?: number | null
          caixa_padrao_compra?: number | null
          cest?: string | null
          cfop_padrao?: string | null
          classificacao_fiscal?: string | null
          classificacao_pis_cofins?: string | null
          cod_nbm?: string | null
          codigo_ean?: string | null
          codigo_ean_tributavel?: string | null
          codigo_enquadramento_ipi?: string | null
          cofins_qtd_bc_prod?: number | null
          cofins_v_aliq_prod?: number | null
          comissao_cobranca?: number | null
          comissao_venda?: number | null
          comprimento?: number | null
          created_at?: string | null
          created_by?: string | null
          cst_cofins?: string | null
          cst_icms?: string | null
          cst_ipi?: string | null
          cst_pis?: string | null
          cstp_pis?: string | null
          curva_fisica?: string | null
          curva_monetaria?: string | null
          custo_icms?: number | null
          custo_icms_percentual?: number | null
          custo_medio?: number | null
          desconto_compra?: number | null
          desconto_entrada?: number | null
          desconto_maximo?: number | null
          estoque_maximo?: number | null
          estoque_minimo?: number | null
          excecao_ncm?: string | null
          frete?: number | null
          gera_credito_cofins?: boolean | null
          gera_credito_icms?: boolean | null
          gera_credito_ipi?: boolean | null
          gera_credito_pis?: boolean | null
          icms_diferido?: boolean | null
          id?: string
          indicador_composicao_total?: number | null
          industrializacao_encomenda?: boolean | null
          informacoes_adicionais?: string | null
          largura?: number | null
          markup_percentual?: number | null
          modalidade_bc_icms?: string | null
          motivo_desoneracao_icms?: string | null
          ncm?: string | null
          numero_drawback?: string | null
          observacoes?: string | null
          origem_mercadoria?: string | null
          percentual_st?: number | null
          peso_bruto?: number | null
          peso_liquido?: number | null
          pis_qtd_bc_prod?: number | null
          pis_v_aliq_prod?: number | null
          preco_custo?: number | null
          preco_fabrica?: number | null
          preco_maximo?: number | null
          preco_venda?: number | null
          produto_id?: string
          qtd_max_dia_cliente?: number | null
          qtd_max_dia_vendedor?: number | null
          qtd_maxima?: number | null
          qtd_minima?: number | null
          regime_tributacao?: string | null
          repasse_icm?: number | null
          reserva?: number | null
          substancia?: string | null
          tem_drawback?: boolean | null
          tipo_operacao?: string | null
          unidade_compra?: string | null
          unidade_venda?: string | null
          updated_at?: string | null
          v_icms_st_ret?: number | null
          v_icms_substituto?: number | null
          valor_cofins?: number | null
          valor_fcp?: number | null
          valor_icms?: number | null
          valor_icms_desonerado?: number | null
          valor_ipi?: number | null
          valor_pis?: number | null
          vbc_st_ret?: number | null
          volume_m3?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_dados_fiscais_produto_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: true
            referencedRelation: "fabrica_materias_primas"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_empresa_config: {
        Row: {
          cnpj: string
          contribuinte_ipi: boolean | null
          created_at: string | null
          created_by: string | null
          id: string
          inscricao_estadual: string | null
          observacoes: string | null
          razao_social: string
          regime_apuracao_icms: string | null
          regime_apuracao_pis_cofins: string | null
          regime_tributario: string
          uf: string
          updated_at: string | null
        }
        Insert: {
          cnpj: string
          contribuinte_ipi?: boolean | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          inscricao_estadual?: string | null
          observacoes?: string | null
          razao_social: string
          regime_apuracao_icms?: string | null
          regime_apuracao_pis_cofins?: string | null
          regime_tributario: string
          uf: string
          updated_at?: string | null
        }
        Update: {
          cnpj?: string
          contribuinte_ipi?: boolean | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          inscricao_estadual?: string | null
          observacoes?: string | null
          razao_social?: string
          regime_apuracao_icms?: string | null
          regime_apuracao_pis_cofins?: string | null
          regime_tributario?: string
          uf?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      fabrica_formula_alteracoes: {
        Row: {
          data_alteracao: string | null
          formula_id: string | null
          id: string
          motivo: string | null
          mp_anterior_id: string | null
          mp_nova_id: string | null
          quantidade_anterior: number | null
          quantidade_nova: number | null
          tipo_alteracao: string | null
          usuario_id: string | null
        }
        Insert: {
          data_alteracao?: string | null
          formula_id?: string | null
          id?: string
          motivo?: string | null
          mp_anterior_id?: string | null
          mp_nova_id?: string | null
          quantidade_anterior?: number | null
          quantidade_nova?: number | null
          tipo_alteracao?: string | null
          usuario_id?: string | null
        }
        Update: {
          data_alteracao?: string | null
          formula_id?: string | null
          id?: string
          motivo?: string | null
          mp_anterior_id?: string | null
          mp_nova_id?: string | null
          quantidade_anterior?: number | null
          quantidade_nova?: number | null
          tipo_alteracao?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_formula_alteracoes_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "fabrica_formulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_formula_alteracoes_mp_anterior_id_fkey"
            columns: ["mp_anterior_id"]
            isOneToOne: false
            referencedRelation: "fabrica_materias_primas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_formula_alteracoes_mp_nova_id_fkey"
            columns: ["mp_nova_id"]
            isOneToOne: false
            referencedRelation: "fabrica_materias_primas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_formula_alteracoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_formula_alteracoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_formula_alteracoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      fabrica_formula_itens: {
        Row: {
          created_at: string | null
          criticidade: string | null
          formula_id: string | null
          id: string
          mp_alternativa_id: string | null
          mp_id: string | null
          observacoes: string | null
          observacoes_tecnicas: string | null
          ordem: number | null
          ordem_adicao: number | null
          percentual: number | null
          permite_substituicao: boolean | null
          quantidade: number
        }
        Insert: {
          created_at?: string | null
          criticidade?: string | null
          formula_id?: string | null
          id?: string
          mp_alternativa_id?: string | null
          mp_id?: string | null
          observacoes?: string | null
          observacoes_tecnicas?: string | null
          ordem?: number | null
          ordem_adicao?: number | null
          percentual?: number | null
          permite_substituicao?: boolean | null
          quantidade: number
        }
        Update: {
          created_at?: string | null
          criticidade?: string | null
          formula_id?: string | null
          id?: string
          mp_alternativa_id?: string | null
          mp_id?: string | null
          observacoes?: string | null
          observacoes_tecnicas?: string | null
          ordem?: number | null
          ordem_adicao?: number | null
          percentual?: number | null
          permite_substituicao?: boolean | null
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_formula_itens_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "fabrica_formulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_formula_itens_mp_alternativa_id_fkey"
            columns: ["mp_alternativa_id"]
            isOneToOne: false
            referencedRelation: "fabrica_materias_primas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_formula_itens_mp_id_fkey"
            columns: ["mp_id"]
            isOneToOne: false
            referencedRelation: "fabrica_materias_primas"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_formula_versoes: {
        Row: {
          alterado_por: string | null
          aprovada_por: string | null
          changelog: Json | null
          created_at: string | null
          data_alteracao: string | null
          data_aprovacao: string | null
          formula_id: string | null
          id: string
          motivo_alteracao: string | null
          status: string | null
          versao_anterior_id: string | null
          versao_numero: number
        }
        Insert: {
          alterado_por?: string | null
          aprovada_por?: string | null
          changelog?: Json | null
          created_at?: string | null
          data_alteracao?: string | null
          data_aprovacao?: string | null
          formula_id?: string | null
          id?: string
          motivo_alteracao?: string | null
          status?: string | null
          versao_anterior_id?: string | null
          versao_numero: number
        }
        Update: {
          alterado_por?: string | null
          aprovada_por?: string | null
          changelog?: Json | null
          created_at?: string | null
          data_alteracao?: string | null
          data_aprovacao?: string | null
          formula_id?: string | null
          id?: string
          motivo_alteracao?: string | null
          status?: string | null
          versao_anterior_id?: string | null
          versao_numero?: number
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_formula_versoes_alterado_por_fkey"
            columns: ["alterado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_formula_versoes_alterado_por_fkey"
            columns: ["alterado_por"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_formula_versoes_alterado_por_fkey"
            columns: ["alterado_por"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fabrica_formula_versoes_aprovada_por_fkey"
            columns: ["aprovada_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_formula_versoes_aprovada_por_fkey"
            columns: ["aprovada_por"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_formula_versoes_aprovada_por_fkey"
            columns: ["aprovada_por"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fabrica_formula_versoes_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "fabrica_formulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_formula_versoes_versao_anterior_id_fkey"
            columns: ["versao_anterior_id"]
            isOneToOne: false
            referencedRelation: "fabrica_formula_versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_formulas: {
        Row: {
          ativa: boolean | null
          created_at: string | null
          created_by: string | null
          descricao: string | null
          id: string
          observacoes_tecnicas: string | null
          perdas_esperadas: number | null
          ph_ideal: number | null
          produto_id: string | null
          rendimento: number | null
          rendimento_real: number | null
          rendimento_teorico: number | null
          temperatura_ideal: number | null
          tempo_producao_minutos: number | null
          versao: number | null
        }
        Insert: {
          ativa?: boolean | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          id?: string
          observacoes_tecnicas?: string | null
          perdas_esperadas?: number | null
          ph_ideal?: number | null
          produto_id?: string | null
          rendimento?: number | null
          rendimento_real?: number | null
          rendimento_teorico?: number | null
          temperatura_ideal?: number | null
          tempo_producao_minutos?: number | null
          versao?: number | null
        }
        Update: {
          ativa?: boolean | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          id?: string
          observacoes_tecnicas?: string | null
          perdas_esperadas?: number | null
          ph_ideal?: number | null
          produto_id?: string | null
          rendimento?: number | null
          rendimento_real?: number | null
          rendimento_teorico?: number | null
          temperatura_ideal?: number | null
          tempo_producao_minutos?: number | null
          versao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_formulas_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "fabrica_produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_fornecedores: {
        Row: {
          ativo: boolean | null
          cnpj: string | null
          contato: string | null
          created_at: string | null
          email: string | null
          endereco: string | null
          id: string
          nome_fantasia: string | null
          razao_social: string
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          cnpj?: string | null
          contato?: string | null
          created_at?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome_fantasia?: string | null
          razao_social: string
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          cnpj?: string | null
          contato?: string | null
          created_at?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome_fantasia?: string | null
          razao_social?: string
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fabrica_historico_custos: {
        Row: {
          created_at: string | null
          custo_anterior: number | null
          custo_novo: number
          id: string
          motivo: string | null
          produto_id: string | null
          quantidade_movimento: number
          tipo_movimento: string
          usuario_id: string | null
        }
        Insert: {
          created_at?: string | null
          custo_anterior?: number | null
          custo_novo: number
          id?: string
          motivo?: string | null
          produto_id?: string | null
          quantidade_movimento: number
          tipo_movimento: string
          usuario_id?: string | null
        }
        Update: {
          created_at?: string | null
          custo_anterior?: number | null
          custo_novo?: number
          id?: string
          motivo?: string | null
          produto_id?: string | null
          quantidade_movimento?: number
          tipo_movimento?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_historico_custos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "fabrica_materias_primas"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_historico_precos: {
        Row: {
          alterado_por: string | null
          data_alteracao: string | null
          id: string
          motivo_alteracao: string | null
          preco_anterior: number | null
          preco_novo: number | null
          produto_id: string
          tabela_id: string
        }
        Insert: {
          alterado_por?: string | null
          data_alteracao?: string | null
          id?: string
          motivo_alteracao?: string | null
          preco_anterior?: number | null
          preco_novo?: number | null
          produto_id: string
          tabela_id: string
        }
        Update: {
          alterado_por?: string | null
          data_alteracao?: string | null
          id?: string
          motivo_alteracao?: string | null
          preco_anterior?: number | null
          preco_novo?: number | null
          produto_id?: string
          tabela_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_historico_precos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "fabrica_produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_historico_precos_tabela_id_fkey"
            columns: ["tabela_id"]
            isOneToOne: false
            referencedRelation: "fabrica_tabelas_preco"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_inspecoes_qualidade: {
        Row: {
          aprovado_por: string | null
          certificado_url: string | null
          created_at: string | null
          data_aprovacao: string | null
          data_inspecao: string
          id: string
          indice_conformidade: number | null
          inspetor_id: string
          lote_id: string | null
          observacoes: string | null
          ordem_producao_id: string | null
          plano_inspecao_id: string | null
          quantidade_aprovada: number | null
          quantidade_inspecionada: number | null
          quantidade_reprovada: number | null
          resultado: string
          resultados_checklist: Json
        }
        Insert: {
          aprovado_por?: string | null
          certificado_url?: string | null
          created_at?: string | null
          data_aprovacao?: string | null
          data_inspecao?: string
          id?: string
          indice_conformidade?: number | null
          inspetor_id: string
          lote_id?: string | null
          observacoes?: string | null
          ordem_producao_id?: string | null
          plano_inspecao_id?: string | null
          quantidade_aprovada?: number | null
          quantidade_inspecionada?: number | null
          quantidade_reprovada?: number | null
          resultado: string
          resultados_checklist: Json
        }
        Update: {
          aprovado_por?: string | null
          certificado_url?: string | null
          created_at?: string | null
          data_aprovacao?: string | null
          data_inspecao?: string
          id?: string
          indice_conformidade?: number | null
          inspetor_id?: string
          lote_id?: string | null
          observacoes?: string | null
          ordem_producao_id?: string | null
          plano_inspecao_id?: string | null
          quantidade_aprovada?: number | null
          quantidade_inspecionada?: number | null
          quantidade_reprovada?: number | null
          resultado?: string
          resultados_checklist?: Json
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_inspecoes_qualidade_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_inspecoes_qualidade_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_inspecoes_qualidade_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fabrica_inspecoes_qualidade_inspetor_id_fkey"
            columns: ["inspetor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_inspecoes_qualidade_inspetor_id_fkey"
            columns: ["inspetor_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_inspecoes_qualidade_inspetor_id_fkey"
            columns: ["inspetor_id"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fabrica_inspecoes_qualidade_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "fabrica_lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_inspecoes_qualidade_ordem_producao_id_fkey"
            columns: ["ordem_producao_id"]
            isOneToOne: false
            referencedRelation: "fabrica_ordens_producao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_inspecoes_qualidade_plano_inspecao_id_fkey"
            columns: ["plano_inspecao_id"]
            isOneToOne: false
            referencedRelation: "fabrica_planos_inspecao"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_itens_nf: {
        Row: {
          aliquota_icms_st: number | null
          aliquota_ipi: number | null
          base_cofins: number | null
          base_icms: number | null
          base_icms_st: number | null
          base_pis: number | null
          cfop: string | null
          codigo_fornecedor: string
          codigo_mapeado_id: string | null
          conferido: boolean | null
          created_at: string | null
          cst_ipi: string | null
          custo_total_entrada: number | null
          custo_unitario_entrada: number | null
          descricao: string
          divergencia_percentual: number | null
          id: string
          lote: string | null
          ncm: string | null
          nota_id: string | null
          numero_item: number
          observacoes_conferencia: string | null
          observacoes_fiscais: string | null
          produto_interno_id: string | null
          quantidade: number
          quantidade_conferida: number | null
          quantidade_convertida: number | null
          score_similaridade: number | null
          status_mapeamento: string | null
          teor: number | null
          unidade: string
          unidade_convertida: string | null
          validade: string | null
          validado_em: string | null
          validado_fiscalmente: boolean | null
          validado_por: string | null
          valor_icms_st: number | null
          valor_ipi: number | null
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          aliquota_icms_st?: number | null
          aliquota_ipi?: number | null
          base_cofins?: number | null
          base_icms?: number | null
          base_icms_st?: number | null
          base_pis?: number | null
          cfop?: string | null
          codigo_fornecedor: string
          codigo_mapeado_id?: string | null
          conferido?: boolean | null
          created_at?: string | null
          cst_ipi?: string | null
          custo_total_entrada?: number | null
          custo_unitario_entrada?: number | null
          descricao: string
          divergencia_percentual?: number | null
          id?: string
          lote?: string | null
          ncm?: string | null
          nota_id?: string | null
          numero_item: number
          observacoes_conferencia?: string | null
          observacoes_fiscais?: string | null
          produto_interno_id?: string | null
          quantidade: number
          quantidade_conferida?: number | null
          quantidade_convertida?: number | null
          score_similaridade?: number | null
          status_mapeamento?: string | null
          teor?: number | null
          unidade: string
          unidade_convertida?: string | null
          validade?: string | null
          validado_em?: string | null
          validado_fiscalmente?: boolean | null
          validado_por?: string | null
          valor_icms_st?: number | null
          valor_ipi?: number | null
          valor_total: number
          valor_unitario: number
        }
        Update: {
          aliquota_icms_st?: number | null
          aliquota_ipi?: number | null
          base_cofins?: number | null
          base_icms?: number | null
          base_icms_st?: number | null
          base_pis?: number | null
          cfop?: string | null
          codigo_fornecedor?: string
          codigo_mapeado_id?: string | null
          conferido?: boolean | null
          created_at?: string | null
          cst_ipi?: string | null
          custo_total_entrada?: number | null
          custo_unitario_entrada?: number | null
          descricao?: string
          divergencia_percentual?: number | null
          id?: string
          lote?: string | null
          ncm?: string | null
          nota_id?: string | null
          numero_item?: number
          observacoes_conferencia?: string | null
          observacoes_fiscais?: string | null
          produto_interno_id?: string | null
          quantidade?: number
          quantidade_conferida?: number | null
          quantidade_convertida?: number | null
          score_similaridade?: number | null
          status_mapeamento?: string | null
          teor?: number | null
          unidade?: string
          unidade_convertida?: string | null
          validade?: string | null
          validado_em?: string | null
          validado_fiscalmente?: boolean | null
          validado_por?: string | null
          valor_icms_st?: number | null
          valor_ipi?: number | null
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_itens_nf_codigo_mapeado_id_fkey"
            columns: ["codigo_mapeado_id"]
            isOneToOne: false
            referencedRelation: "fabrica_codigos_fornecedor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_itens_nf_nota_id_fkey"
            columns: ["nota_id"]
            isOneToOne: false
            referencedRelation: "fabrica_notas_fiscais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_itens_nf_produto_interno_id_fkey"
            columns: ["produto_interno_id"]
            isOneToOne: false
            referencedRelation: "fabrica_materias_primas"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_lotes: {
        Row: {
          codigo_lote: string
          created_at: string | null
          custo_unitario: number
          data_fabricacao: string | null
          data_validade: string | null
          id: string
          nota_fiscal_id: string | null
          observacoes: string | null
          produto_id: string | null
          quantidade_atual: number
          quantidade_inicial: number
          status: string | null
          updated_at: string | null
        }
        Insert: {
          codigo_lote: string
          created_at?: string | null
          custo_unitario: number
          data_fabricacao?: string | null
          data_validade?: string | null
          id?: string
          nota_fiscal_id?: string | null
          observacoes?: string | null
          produto_id?: string | null
          quantidade_atual: number
          quantidade_inicial: number
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          codigo_lote?: string
          created_at?: string | null
          custo_unitario?: number
          data_fabricacao?: string | null
          data_validade?: string | null
          id?: string
          nota_fiscal_id?: string | null
          observacoes?: string | null
          produto_id?: string | null
          quantidade_atual?: number
          quantidade_inicial?: number
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_lotes_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "fabrica_notas_fiscais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_lotes_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "fabrica_materias_primas"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_maquinas: {
        Row: {
          ano_fabricacao: number | null
          capacidade_hora: number | null
          centro_custo: string | null
          codigo: string
          created_at: string | null
          custo_hora: number | null
          fabricante: string | null
          id: string
          localizacao: string | null
          nome: string
          numero_serie: string | null
          observacoes: string | null
          proxima_manutencao: string | null
          status: string | null
          tipo: string | null
          ultima_manutencao: string | null
          unidade_capacidade: string | null
          updated_at: string | null
        }
        Insert: {
          ano_fabricacao?: number | null
          capacidade_hora?: number | null
          centro_custo?: string | null
          codigo: string
          created_at?: string | null
          custo_hora?: number | null
          fabricante?: string | null
          id?: string
          localizacao?: string | null
          nome: string
          numero_serie?: string | null
          observacoes?: string | null
          proxima_manutencao?: string | null
          status?: string | null
          tipo?: string | null
          ultima_manutencao?: string | null
          unidade_capacidade?: string | null
          updated_at?: string | null
        }
        Update: {
          ano_fabricacao?: number | null
          capacidade_hora?: number | null
          centro_custo?: string | null
          codigo?: string
          created_at?: string | null
          custo_hora?: number | null
          fabricante?: string | null
          id?: string
          localizacao?: string | null
          nome?: string
          numero_serie?: string | null
          observacoes?: string | null
          proxima_manutencao?: string | null
          status?: string | null
          tipo?: string | null
          ultima_manutencao?: string | null
          unidade_capacidade?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fabrica_materias_primas: {
        Row: {
          categoria_id: string | null
          codigo: string
          created_at: string | null
          created_by: string | null
          custo_unitario: number | null
          data_validade: string | null
          estoque_atual: number | null
          estoque_minimo: number | null
          estoque_seguranca: number | null
          fornecedor_id: string | null
          id: string
          lead_time_dias: number | null
          lote: string | null
          lote_minimo_compra: number | null
          metodo_custeio: string | null
          nome: string
          observacoes: string | null
          ponto_reposicao: number | null
          preco_medio_ponderado: number | null
          status: string | null
          ultima_compra_data: string | null
          ultima_compra_preco: number | null
          unidade_medida_id: string | null
          updated_at: string | null
        }
        Insert: {
          categoria_id?: string | null
          codigo: string
          created_at?: string | null
          created_by?: string | null
          custo_unitario?: number | null
          data_validade?: string | null
          estoque_atual?: number | null
          estoque_minimo?: number | null
          estoque_seguranca?: number | null
          fornecedor_id?: string | null
          id?: string
          lead_time_dias?: number | null
          lote?: string | null
          lote_minimo_compra?: number | null
          metodo_custeio?: string | null
          nome: string
          observacoes?: string | null
          ponto_reposicao?: number | null
          preco_medio_ponderado?: number | null
          status?: string | null
          ultima_compra_data?: string | null
          ultima_compra_preco?: number | null
          unidade_medida_id?: string | null
          updated_at?: string | null
        }
        Update: {
          categoria_id?: string | null
          codigo?: string
          created_at?: string | null
          created_by?: string | null
          custo_unitario?: number | null
          data_validade?: string | null
          estoque_atual?: number | null
          estoque_minimo?: number | null
          estoque_seguranca?: number | null
          fornecedor_id?: string | null
          id?: string
          lead_time_dias?: number | null
          lote?: string | null
          lote_minimo_compra?: number | null
          metodo_custeio?: string | null
          nome?: string
          observacoes?: string | null
          ponto_reposicao?: number | null
          preco_medio_ponderado?: number | null
          status?: string | null
          ultima_compra_data?: string | null
          ultima_compra_preco?: number | null
          unidade_medida_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_materias_primas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "fabrica_categorias_mp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_materias_primas_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fabrica_fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_materias_primas_unidade_medida_id_fkey"
            columns: ["unidade_medida_id"]
            isOneToOne: false
            referencedRelation: "fabrica_unidades_medida"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_motivos_parada: {
        Row: {
          ativo: boolean | null
          codigo: string
          created_at: string | null
          descricao: string
          id: string
          impacto_oee: boolean | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          codigo: string
          created_at?: string | null
          descricao: string
          id?: string
          impacto_oee?: boolean | null
          tipo: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          codigo?: string
          created_at?: string | null
          descricao?: string
          id?: string
          impacto_oee?: boolean | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      fabrica_movimentacoes: {
        Row: {
          created_at: string | null
          created_by: string | null
          custo_unitario: number | null
          data_validade: string | null
          documento: string | null
          estoque_anterior: number | null
          estoque_novo: number | null
          id: string
          item_nf_id: string | null
          lote: string | null
          motivo: string | null
          mp_id: string | null
          nota_fiscal_id: string | null
          observacoes: string | null
          ordem_producao_id: string | null
          quantidade: number
          tipo: string
          valor_total: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          custo_unitario?: number | null
          data_validade?: string | null
          documento?: string | null
          estoque_anterior?: number | null
          estoque_novo?: number | null
          id?: string
          item_nf_id?: string | null
          lote?: string | null
          motivo?: string | null
          mp_id?: string | null
          nota_fiscal_id?: string | null
          observacoes?: string | null
          ordem_producao_id?: string | null
          quantidade: number
          tipo: string
          valor_total?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          custo_unitario?: number | null
          data_validade?: string | null
          documento?: string | null
          estoque_anterior?: number | null
          estoque_novo?: number | null
          id?: string
          item_nf_id?: string | null
          lote?: string | null
          motivo?: string | null
          mp_id?: string | null
          nota_fiscal_id?: string | null
          observacoes?: string | null
          ordem_producao_id?: string | null
          quantidade?: number
          tipo?: string
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_movimentacoes_item_nf_id_fkey"
            columns: ["item_nf_id"]
            isOneToOne: false
            referencedRelation: "fabrica_itens_nf"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_movimentacoes_mp_id_fkey"
            columns: ["mp_id"]
            isOneToOne: false
            referencedRelation: "fabrica_materias_primas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_movimentacoes_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "fabrica_notas_fiscais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_movimentacoes_ordem_producao_id_fkey"
            columns: ["ordem_producao_id"]
            isOneToOne: false
            referencedRelation: "fabrica_ordens_producao"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_movimentacoes_estoque: {
        Row: {
          created_at: string | null
          created_by: string | null
          custo_total: number | null
          custo_unitario: number | null
          data_validade: string | null
          id: string
          lote: string | null
          mp_id: string | null
          nota_fiscal_id: string | null
          observacoes: string | null
          ordem_producao_id: string | null
          quantidade: number
          quantidade_anterior: number | null
          quantidade_nova: number | null
          responsavel_id: string | null
          tipo_movimento: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          custo_total?: number | null
          custo_unitario?: number | null
          data_validade?: string | null
          id?: string
          lote?: string | null
          mp_id?: string | null
          nota_fiscal_id?: string | null
          observacoes?: string | null
          ordem_producao_id?: string | null
          quantidade: number
          quantidade_anterior?: number | null
          quantidade_nova?: number | null
          responsavel_id?: string | null
          tipo_movimento: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          custo_total?: number | null
          custo_unitario?: number | null
          data_validade?: string | null
          id?: string
          lote?: string | null
          mp_id?: string | null
          nota_fiscal_id?: string | null
          observacoes?: string | null
          ordem_producao_id?: string | null
          quantidade?: number
          quantidade_anterior?: number | null
          quantidade_nova?: number | null
          responsavel_id?: string | null
          tipo_movimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_movimentacoes_estoque_mp_id_fkey"
            columns: ["mp_id"]
            isOneToOne: false
            referencedRelation: "fabrica_materias_primas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_movimentacoes_estoque_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "fabrica_notas_fiscais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_movimentacoes_estoque_ordem_producao_id_fkey"
            columns: ["ordem_producao_id"]
            isOneToOne: false
            referencedRelation: "fabrica_ordens_producao"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_nao_conformidades: {
        Row: {
          causa_raiz: string | null
          created_at: string | null
          custos_estimados: number | null
          descricao: string
          detectado_em: string | null
          detectado_por: string | null
          fotos: Json | null
          gravidade: string
          id: string
          inspecao_id: string | null
          ordem_producao_id: string | null
          quantidade_afetada: number | null
          status: string | null
          tipo: string
        }
        Insert: {
          causa_raiz?: string | null
          created_at?: string | null
          custos_estimados?: number | null
          descricao: string
          detectado_em?: string | null
          detectado_por?: string | null
          fotos?: Json | null
          gravidade: string
          id?: string
          inspecao_id?: string | null
          ordem_producao_id?: string | null
          quantidade_afetada?: number | null
          status?: string | null
          tipo: string
        }
        Update: {
          causa_raiz?: string | null
          created_at?: string | null
          custos_estimados?: number | null
          descricao?: string
          detectado_em?: string | null
          detectado_por?: string | null
          fotos?: Json | null
          gravidade?: string
          id?: string
          inspecao_id?: string | null
          ordem_producao_id?: string | null
          quantidade_afetada?: number | null
          status?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_nao_conformidades_detectado_por_fkey"
            columns: ["detectado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_nao_conformidades_detectado_por_fkey"
            columns: ["detectado_por"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_nao_conformidades_detectado_por_fkey"
            columns: ["detectado_por"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fabrica_nao_conformidades_inspecao_id_fkey"
            columns: ["inspecao_id"]
            isOneToOne: false
            referencedRelation: "fabrica_inspecoes_qualidade"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_nao_conformidades_ordem_producao_id_fkey"
            columns: ["ordem_producao_id"]
            isOneToOne: false
            referencedRelation: "fabrica_ordens_producao"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_ncm: {
        Row: {
          ativo: boolean | null
          codigo: string
          created_at: string | null
          created_by: string | null
          descricao: string
          ex: string | null
          id: string
          observacoes: string | null
          unidade_padrao: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          codigo: string
          created_at?: string | null
          created_by?: string | null
          descricao: string
          ex?: string | null
          id?: string
          observacoes?: string | null
          unidade_padrao?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          codigo?: string
          created_at?: string | null
          created_by?: string | null
          descricao?: string
          ex?: string | null
          id?: string
          observacoes?: string | null
          unidade_padrao?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fabrica_notas_fiscais: {
        Row: {
          chave_acesso: string
          conferido_por: string | null
          created_at: string | null
          data_conferencia: string | null
          data_emissao: string
          divergencias_conferencia: Json | null
          fornecedor_id: string | null
          id: string
          justificativa_divergencias: string | null
          motivo_rejeicao: string | null
          numero: string
          observacoes: string | null
          pdf_url: string | null
          processed_at: string | null
          serie: string | null
          status: string | null
          usuario_conferente: string | null
          valor_total: number
          xml_raw: string | null
        }
        Insert: {
          chave_acesso: string
          conferido_por?: string | null
          created_at?: string | null
          data_conferencia?: string | null
          data_emissao: string
          divergencias_conferencia?: Json | null
          fornecedor_id?: string | null
          id?: string
          justificativa_divergencias?: string | null
          motivo_rejeicao?: string | null
          numero: string
          observacoes?: string | null
          pdf_url?: string | null
          processed_at?: string | null
          serie?: string | null
          status?: string | null
          usuario_conferente?: string | null
          valor_total: number
          xml_raw?: string | null
        }
        Update: {
          chave_acesso?: string
          conferido_por?: string | null
          created_at?: string | null
          data_conferencia?: string | null
          data_emissao?: string
          divergencias_conferencia?: Json | null
          fornecedor_id?: string | null
          id?: string
          justificativa_divergencias?: string | null
          motivo_rejeicao?: string | null
          numero?: string
          observacoes?: string | null
          pdf_url?: string | null
          processed_at?: string | null
          serie?: string | null
          status?: string | null
          usuario_conferente?: string | null
          valor_total?: number
          xml_raw?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_notas_fiscais_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fabrica_fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_operadores: {
        Row: {
          centro_custo: string | null
          created_at: string | null
          custo_hora: number | null
          data_admissao: string | null
          funcao: string | null
          habilidades: string[] | null
          id: string
          matricula: string
          nivel_experiencia: string | null
          nome: string
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          centro_custo?: string | null
          created_at?: string | null
          custo_hora?: number | null
          data_admissao?: string | null
          funcao?: string | null
          habilidades?: string[] | null
          id?: string
          matricula: string
          nivel_experiencia?: string | null
          nome: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          centro_custo?: string | null
          created_at?: string | null
          custo_hora?: number | null
          data_admissao?: string | null
          funcao?: string | null
          habilidades?: string[] | null
          id?: string
          matricula?: string
          nivel_experiencia?: string | null
          nome?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      fabrica_ordens_producao: {
        Row: {
          created_at: string | null
          created_by: string | null
          custo_maquina_total: number | null
          custo_mod_total: number | null
          data_fim: string | null
          data_inicio: string | null
          data_prevista: string | null
          eficiencia_percentual: number | null
          formula_id: string | null
          id: string
          lote: string | null
          maquina_id: string | null
          numero: string
          observacoes: string | null
          operador_principal_id: string | null
          produto_id: string | null
          quantidade_planejada: number
          quantidade_produzida: number | null
          responsavel_id: string | null
          status: string | null
          tempo_producao_real_minutos: number | null
          tempo_setup_minutos: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          custo_maquina_total?: number | null
          custo_mod_total?: number | null
          data_fim?: string | null
          data_inicio?: string | null
          data_prevista?: string | null
          eficiencia_percentual?: number | null
          formula_id?: string | null
          id?: string
          lote?: string | null
          maquina_id?: string | null
          numero: string
          observacoes?: string | null
          operador_principal_id?: string | null
          produto_id?: string | null
          quantidade_planejada: number
          quantidade_produzida?: number | null
          responsavel_id?: string | null
          status?: string | null
          tempo_producao_real_minutos?: number | null
          tempo_setup_minutos?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          custo_maquina_total?: number | null
          custo_mod_total?: number | null
          data_fim?: string | null
          data_inicio?: string | null
          data_prevista?: string | null
          eficiencia_percentual?: number | null
          formula_id?: string | null
          id?: string
          lote?: string | null
          maquina_id?: string | null
          numero?: string
          observacoes?: string | null
          operador_principal_id?: string | null
          produto_id?: string | null
          quantidade_planejada?: number
          quantidade_produzida?: number | null
          responsavel_id?: string | null
          status?: string | null
          tempo_producao_real_minutos?: number | null
          tempo_setup_minutos?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_ordens_producao_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "fabrica_formulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_ordens_producao_maquina_id_fkey"
            columns: ["maquina_id"]
            isOneToOne: false
            referencedRelation: "fabrica_maquinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_ordens_producao_operador_principal_id_fkey"
            columns: ["operador_principal_id"]
            isOneToOne: false
            referencedRelation: "fabrica_operadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_ordens_producao_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "fabrica_produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_paradas: {
        Row: {
          acao_corretiva: string | null
          created_at: string | null
          descricao_adicional: string | null
          duracao_minutos: number | null
          id: string
          impacto_financeiro: number | null
          motivo_parada_id: string | null
          operador_responsavel_id: string | null
          ordem_producao_id: string
          timestamp_fim: string | null
          timestamp_inicio: string
        }
        Insert: {
          acao_corretiva?: string | null
          created_at?: string | null
          descricao_adicional?: string | null
          duracao_minutos?: number | null
          id?: string
          impacto_financeiro?: number | null
          motivo_parada_id?: string | null
          operador_responsavel_id?: string | null
          ordem_producao_id: string
          timestamp_fim?: string | null
          timestamp_inicio?: string
        }
        Update: {
          acao_corretiva?: string | null
          created_at?: string | null
          descricao_adicional?: string | null
          duracao_minutos?: number | null
          id?: string
          impacto_financeiro?: number | null
          motivo_parada_id?: string | null
          operador_responsavel_id?: string | null
          ordem_producao_id?: string
          timestamp_fim?: string | null
          timestamp_inicio?: string
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_paradas_motivo_parada_id_fkey"
            columns: ["motivo_parada_id"]
            isOneToOne: false
            referencedRelation: "fabrica_motivos_parada"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_paradas_operador_responsavel_id_fkey"
            columns: ["operador_responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_paradas_operador_responsavel_id_fkey"
            columns: ["operador_responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_paradas_operador_responsavel_id_fkey"
            columns: ["operador_responsavel_id"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fabrica_paradas_ordem_producao_id_fkey"
            columns: ["ordem_producao_id"]
            isOneToOne: false
            referencedRelation: "fabrica_ordens_producao"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_planejamento_necessidades: {
        Row: {
          compra_realizada_em: string | null
          created_at: string | null
          data_necessidade: string
          data_sugestao_compra: string | null
          id: string
          mp_id: string | null
          ordem_producao_id: string | null
          quantidade_a_comprar: number | null
          quantidade_disponivel: number | null
          quantidade_necessaria: number
          status: string | null
          sugestao_gerada_em: string | null
        }
        Insert: {
          compra_realizada_em?: string | null
          created_at?: string | null
          data_necessidade: string
          data_sugestao_compra?: string | null
          id?: string
          mp_id?: string | null
          ordem_producao_id?: string | null
          quantidade_a_comprar?: number | null
          quantidade_disponivel?: number | null
          quantidade_necessaria: number
          status?: string | null
          sugestao_gerada_em?: string | null
        }
        Update: {
          compra_realizada_em?: string | null
          created_at?: string | null
          data_necessidade?: string
          data_sugestao_compra?: string | null
          id?: string
          mp_id?: string | null
          ordem_producao_id?: string | null
          quantidade_a_comprar?: number | null
          quantidade_disponivel?: number | null
          quantidade_necessaria?: number
          status?: string | null
          sugestao_gerada_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_planejamento_necessidades_mp_id_fkey"
            columns: ["mp_id"]
            isOneToOne: false
            referencedRelation: "fabrica_materias_primas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_planejamento_necessidades_ordem_producao_id_fkey"
            columns: ["ordem_producao_id"]
            isOneToOne: false
            referencedRelation: "fabrica_ordens_producao"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_planos_inspecao: {
        Row: {
          ativo: boolean | null
          checklist: Json
          created_at: string | null
          created_by: string | null
          criterios_aprovacao: Json | null
          descricao: string | null
          frequencia: string | null
          id: string
          nome: string
          produto_id: string
          tamanho_amostra: number | null
          tipo_inspecao: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          checklist: Json
          created_at?: string | null
          created_by?: string | null
          criterios_aprovacao?: Json | null
          descricao?: string | null
          frequencia?: string | null
          id?: string
          nome: string
          produto_id: string
          tamanho_amostra?: number | null
          tipo_inspecao: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          checklist?: Json
          created_at?: string | null
          created_by?: string | null
          criterios_aprovacao?: Json | null
          descricao?: string | null
          frequencia?: string | null
          id?: string
          nome?: string
          produto_id?: string
          tamanho_amostra?: number | null
          tipo_inspecao?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_planos_inspecao_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_planos_inspecao_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_planos_inspecao_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fabrica_planos_inspecao_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "fabrica_produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_precos_produtos: {
        Row: {
          ativo: boolean | null
          atualizado_por: string | null
          custo_base: number | null
          custo_base_origem: string | null
          data_atualizacao: string | null
          id: string
          margem_lucro_percentual: number | null
          motivo_limite: string | null
          ordem_producao_id: string | null
          origem: string | null
          preco_calculado: number | null
          preco_final: number | null
          preco_limitado: boolean | null
          preco_manual: number | null
          preco_original_calculado: number | null
          produto_id: string
          tabela_id: string
        }
        Insert: {
          ativo?: boolean | null
          atualizado_por?: string | null
          custo_base?: number | null
          custo_base_origem?: string | null
          data_atualizacao?: string | null
          id?: string
          margem_lucro_percentual?: number | null
          motivo_limite?: string | null
          ordem_producao_id?: string | null
          origem?: string | null
          preco_calculado?: number | null
          preco_final?: number | null
          preco_limitado?: boolean | null
          preco_manual?: number | null
          preco_original_calculado?: number | null
          produto_id: string
          tabela_id: string
        }
        Update: {
          ativo?: boolean | null
          atualizado_por?: string | null
          custo_base?: number | null
          custo_base_origem?: string | null
          data_atualizacao?: string | null
          id?: string
          margem_lucro_percentual?: number | null
          motivo_limite?: string | null
          ordem_producao_id?: string | null
          origem?: string | null
          preco_calculado?: number | null
          preco_final?: number | null
          preco_limitado?: boolean | null
          preco_manual?: number | null
          preco_original_calculado?: number | null
          produto_id?: string
          tabela_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_precos_produtos_ordem_producao_id_fkey"
            columns: ["ordem_producao_id"]
            isOneToOne: false
            referencedRelation: "fabrica_ordens_producao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_precos_produtos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "fabrica_produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_precos_produtos_tabela_id_fkey"
            columns: ["tabela_id"]
            isOneToOne: false
            referencedRelation: "fabrica_tabelas_preco"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_processamento_logs: {
        Row: {
          created_at: string | null
          detalhes: Json | null
          etapa: string
          id: string
          mensagem: string
          nota_id: string | null
          tipo: string
          usuario_id: string | null
        }
        Insert: {
          created_at?: string | null
          detalhes?: Json | null
          etapa: string
          id?: string
          mensagem: string
          nota_id?: string | null
          tipo: string
          usuario_id?: string | null
        }
        Update: {
          created_at?: string | null
          detalhes?: Json | null
          etapa?: string
          id?: string
          mensagem?: string
          nota_id?: string | null
          tipo?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_processamento_logs_nota_id_fkey"
            columns: ["nota_id"]
            isOneToOne: false
            referencedRelation: "fabrica_notas_fiscais"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_produtos: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          codigo: string
          codigo_barras_ean: string | null
          codigo_legado: string | null
          created_at: string | null
          created_by: string | null
          descricao: string | null
          descricao_completa: string | null
          descricao_curta: string | null
          fabricante: string | null
          formula_id: string | null
          foto_url: string | null
          id: string
          linha: string | null
          marca: string | null
          modelo: string | null
          nome: string
          nome_comercial: string | null
          origem: string | null
          preco_maximo: number | null
          preco_minimo: number | null
          rendimento: number | null
          sku: string | null
          status: string | null
          status_lancamento: string | null
          subcategoria: string | null
          tempo_producao_minutos: number | null
          tipo: string | null
          unidade_medida_id: string | null
          updated_at: string | null
          versao_variacao: string | null
        }
        Insert: {
          ativo?: boolean | null
          categoria?: string | null
          codigo: string
          codigo_barras_ean?: string | null
          codigo_legado?: string | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          descricao_completa?: string | null
          descricao_curta?: string | null
          fabricante?: string | null
          formula_id?: string | null
          foto_url?: string | null
          id?: string
          linha?: string | null
          marca?: string | null
          modelo?: string | null
          nome: string
          nome_comercial?: string | null
          origem?: string | null
          preco_maximo?: number | null
          preco_minimo?: number | null
          rendimento?: number | null
          sku?: string | null
          status?: string | null
          status_lancamento?: string | null
          subcategoria?: string | null
          tempo_producao_minutos?: number | null
          tipo?: string | null
          unidade_medida_id?: string | null
          updated_at?: string | null
          versao_variacao?: string | null
        }
        Update: {
          ativo?: boolean | null
          categoria?: string | null
          codigo?: string
          codigo_barras_ean?: string | null
          codigo_legado?: string | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          descricao_completa?: string | null
          descricao_curta?: string | null
          fabricante?: string | null
          formula_id?: string | null
          foto_url?: string | null
          id?: string
          linha?: string | null
          marca?: string | null
          modelo?: string | null
          nome?: string
          nome_comercial?: string | null
          origem?: string | null
          preco_maximo?: number | null
          preco_minimo?: number | null
          rendimento?: number | null
          sku?: string | null
          status?: string | null
          status_lancamento?: string | null
          subcategoria?: string | null
          tempo_producao_minutos?: number | null
          tipo?: string | null
          unidade_medida_id?: string | null
          updated_at?: string | null
          versao_variacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_produtos_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "fabrica_formulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_produtos_unidade_medida_id_fkey"
            columns: ["unidade_medida_id"]
            isOneToOne: false
            referencedRelation: "fabrica_unidades_medida"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_refugos: {
        Row: {
          apontamento_id: string | null
          causa_refugo_id: string | null
          created_at: string | null
          created_by: string | null
          custo_estimado: number | null
          data_refugo: string | null
          descricao: string | null
          disposicao: string | null
          fotos: Json | null
          id: string
          lote_id: string | null
          operador_id: string | null
          ordem_producao_id: string
          quantidade: number
          unidade: string | null
        }
        Insert: {
          apontamento_id?: string | null
          causa_refugo_id?: string | null
          created_at?: string | null
          created_by?: string | null
          custo_estimado?: number | null
          data_refugo?: string | null
          descricao?: string | null
          disposicao?: string | null
          fotos?: Json | null
          id?: string
          lote_id?: string | null
          operador_id?: string | null
          ordem_producao_id: string
          quantidade: number
          unidade?: string | null
        }
        Update: {
          apontamento_id?: string | null
          causa_refugo_id?: string | null
          created_at?: string | null
          created_by?: string | null
          custo_estimado?: number | null
          data_refugo?: string | null
          descricao?: string | null
          disposicao?: string | null
          fotos?: Json | null
          id?: string
          lote_id?: string | null
          operador_id?: string | null
          ordem_producao_id?: string
          quantidade?: number
          unidade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_refugos_apontamento_id_fkey"
            columns: ["apontamento_id"]
            isOneToOne: false
            referencedRelation: "fabrica_apontamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_refugos_causa_refugo_id_fkey"
            columns: ["causa_refugo_id"]
            isOneToOne: false
            referencedRelation: "fabrica_causas_refugo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_refugos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_refugos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_refugos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fabrica_refugos_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "fabrica_lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_refugos_operador_id_fkey"
            columns: ["operador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_refugos_operador_id_fkey"
            columns: ["operador_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_refugos_operador_id_fkey"
            columns: ["operador_id"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fabrica_refugos_ordem_producao_id_fkey"
            columns: ["ordem_producao_id"]
            isOneToOne: false
            referencedRelation: "fabrica_ordens_producao"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_regras_fiscais: {
        Row: {
          aliquota: number
          ativo: boolean | null
          base_calculo_reduzida: number | null
          cfop: string
          created_at: string | null
          created_by: string | null
          cst: string
          id: string
          nome: string
          observacoes: string | null
          tipo_imposto: string
          updated_at: string | null
        }
        Insert: {
          aliquota: number
          ativo?: boolean | null
          base_calculo_reduzida?: number | null
          cfop: string
          created_at?: string | null
          created_by?: string | null
          cst: string
          id?: string
          nome: string
          observacoes?: string | null
          tipo_imposto: string
          updated_at?: string | null
        }
        Update: {
          aliquota?: number
          ativo?: boolean | null
          base_calculo_reduzida?: number | null
          cfop?: string
          created_at?: string | null
          created_by?: string | null
          cst?: string
          id?: string
          nome?: string
          observacoes?: string | null
          tipo_imposto?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      fabrica_regras_fiscais_ncm: {
        Row: {
          aliquota_cofins: number | null
          aliquota_fcp: number | null
          aliquota_icms: number | null
          aliquota_ipi: number | null
          aliquota_pis: number | null
          ativo: boolean | null
          cfop_entrada: string | null
          cfop_saida: string | null
          comentario: string | null
          created_at: string | null
          created_by: string | null
          cst_cofins: string | null
          cst_icms_entrada: string | null
          cst_icms_saida: string | null
          cst_ipi: string | null
          cst_pis: string | null
          id: string
          mva: number | null
          ncm_id: string
          reducao_base_icms: number | null
          tem_st: boolean | null
          uf_destino: string
          uf_origem: string
          updated_at: string | null
          vigencia_fim: string | null
          vigencia_inicio: string | null
        }
        Insert: {
          aliquota_cofins?: number | null
          aliquota_fcp?: number | null
          aliquota_icms?: number | null
          aliquota_ipi?: number | null
          aliquota_pis?: number | null
          ativo?: boolean | null
          cfop_entrada?: string | null
          cfop_saida?: string | null
          comentario?: string | null
          created_at?: string | null
          created_by?: string | null
          cst_cofins?: string | null
          cst_icms_entrada?: string | null
          cst_icms_saida?: string | null
          cst_ipi?: string | null
          cst_pis?: string | null
          id?: string
          mva?: number | null
          ncm_id: string
          reducao_base_icms?: number | null
          tem_st?: boolean | null
          uf_destino: string
          uf_origem: string
          updated_at?: string | null
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Update: {
          aliquota_cofins?: number | null
          aliquota_fcp?: number | null
          aliquota_icms?: number | null
          aliquota_ipi?: number | null
          aliquota_pis?: number | null
          ativo?: boolean | null
          cfop_entrada?: string | null
          cfop_saida?: string | null
          comentario?: string | null
          created_at?: string | null
          created_by?: string | null
          cst_cofins?: string | null
          cst_icms_entrada?: string | null
          cst_icms_saida?: string | null
          cst_ipi?: string | null
          cst_pis?: string | null
          id?: string
          mva?: number | null
          ncm_id?: string
          reducao_base_icms?: number | null
          tem_st?: boolean | null
          uf_destino?: string
          uf_origem?: string
          updated_at?: string | null
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_regras_fiscais_ncm_ncm_id_fkey"
            columns: ["ncm_id"]
            isOneToOne: false
            referencedRelation: "fabrica_ncm"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_retrabalhos: {
        Row: {
          created_at: string | null
          created_by: string | null
          custo_adicional: number | null
          data_conclusao: string | null
          data_inicio: string | null
          id: string
          lote_origem_id: string | null
          motivo: string
          nao_conformidade_id: string | null
          observacoes: string | null
          operador_responsavel_id: string | null
          ordem_producao_original_id: string | null
          ordem_producao_retrabalho_id: string | null
          quantidade: number
          resultado: string | null
          tempo_adicional_minutos: number | null
          tipo_retrabalho: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          custo_adicional?: number | null
          data_conclusao?: string | null
          data_inicio?: string | null
          id?: string
          lote_origem_id?: string | null
          motivo: string
          nao_conformidade_id?: string | null
          observacoes?: string | null
          operador_responsavel_id?: string | null
          ordem_producao_original_id?: string | null
          ordem_producao_retrabalho_id?: string | null
          quantidade: number
          resultado?: string | null
          tempo_adicional_minutos?: number | null
          tipo_retrabalho?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          custo_adicional?: number | null
          data_conclusao?: string | null
          data_inicio?: string | null
          id?: string
          lote_origem_id?: string | null
          motivo?: string
          nao_conformidade_id?: string | null
          observacoes?: string | null
          operador_responsavel_id?: string | null
          ordem_producao_original_id?: string | null
          ordem_producao_retrabalho_id?: string | null
          quantidade?: number
          resultado?: string | null
          tempo_adicional_minutos?: number | null
          tipo_retrabalho?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_retrabalhos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_retrabalhos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_retrabalhos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fabrica_retrabalhos_lote_origem_id_fkey"
            columns: ["lote_origem_id"]
            isOneToOne: false
            referencedRelation: "fabrica_lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_retrabalhos_nao_conformidade_id_fkey"
            columns: ["nao_conformidade_id"]
            isOneToOne: false
            referencedRelation: "fabrica_nao_conformidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_retrabalhos_operador_responsavel_id_fkey"
            columns: ["operador_responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_retrabalhos_operador_responsavel_id_fkey"
            columns: ["operador_responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_retrabalhos_operador_responsavel_id_fkey"
            columns: ["operador_responsavel_id"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fabrica_retrabalhos_ordem_producao_original_id_fkey"
            columns: ["ordem_producao_original_id"]
            isOneToOne: false
            referencedRelation: "fabrica_ordens_producao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_retrabalhos_ordem_producao_retrabalho_id_fkey"
            columns: ["ordem_producao_retrabalho_id"]
            isOneToOne: false
            referencedRelation: "fabrica_ordens_producao"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_roteiros_producao: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string
          formula_id: string
          id: string
          instrucoes: string | null
          maquina_sugerida_id: string | null
          parametros: Json | null
          pontos_criticos: string | null
          pressao_ideal: number | null
          sequencia: number
          temperatura_ideal: number | null
          tempo_estimado_minutos: number | null
          updated_at: string | null
          velocidade_ideal: number | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao: string
          formula_id: string
          id?: string
          instrucoes?: string | null
          maquina_sugerida_id?: string | null
          parametros?: Json | null
          pontos_criticos?: string | null
          pressao_ideal?: number | null
          sequencia: number
          temperatura_ideal?: number | null
          tempo_estimado_minutos?: number | null
          updated_at?: string | null
          velocidade_ideal?: number | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string
          formula_id?: string
          id?: string
          instrucoes?: string | null
          maquina_sugerida_id?: string | null
          parametros?: Json | null
          pontos_criticos?: string | null
          pressao_ideal?: number | null
          sequencia?: number
          temperatura_ideal?: number | null
          tempo_estimado_minutos?: number | null
          updated_at?: string | null
          velocidade_ideal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_roteiros_producao_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "fabrica_formulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_roteiros_producao_maquina_sugerida_id_fkey"
            columns: ["maquina_sugerida_id"]
            isOneToOne: false
            referencedRelation: "fabrica_maquinas"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_tabelas_preco: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          ativo: boolean | null
          codigo: string
          created_at: string | null
          created_by: string | null
          data_vigencia_fim: string | null
          data_vigencia_inicio: string | null
          descricao: string | null
          id: string
          nome: string
          observacoes: string | null
          ordem: number | null
          origem_aplicavel: string | null
          owner_cnpj: string | null
          status: string
          tabela_base_id: string | null
          tipo_base: string
          tipo_markup: string
          updated_at: string | null
          valor_markup: number
          visivel_para_cnpjs: string[] | null
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          ativo?: boolean | null
          codigo: string
          created_at?: string | null
          created_by?: string | null
          data_vigencia_fim?: string | null
          data_vigencia_inicio?: string | null
          descricao?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          ordem?: number | null
          origem_aplicavel?: string | null
          owner_cnpj?: string | null
          status?: string
          tabela_base_id?: string | null
          tipo_base?: string
          tipo_markup?: string
          updated_at?: string | null
          valor_markup?: number
          visivel_para_cnpjs?: string[] | null
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          ativo?: boolean | null
          codigo?: string
          created_at?: string | null
          created_by?: string | null
          data_vigencia_fim?: string | null
          data_vigencia_inicio?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          ordem?: number | null
          origem_aplicavel?: string | null
          owner_cnpj?: string | null
          status?: string
          tabela_base_id?: string | null
          tipo_base?: string
          tipo_markup?: string
          updated_at?: string | null
          valor_markup?: number
          visivel_para_cnpjs?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_tabelas_preco_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_tabelas_preco_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_tabelas_preco_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fabrica_tabelas_preco_tabela_base_id_fkey"
            columns: ["tabela_base_id"]
            isOneToOne: false
            referencedRelation: "fabrica_tabelas_preco"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_tabelas_preco_auditoria: {
        Row: {
          acao: string
          created_at: string | null
          diff: Json | null
          id: string
          mensagem: string | null
          tabela_id: string
          user_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string | null
          diff?: Json | null
          id?: string
          mensagem?: string | null
          tabela_id: string
          user_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string | null
          diff?: Json | null
          id?: string
          mensagem?: string | null
          tabela_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_tabelas_preco_auditoria_tabela_id_fkey"
            columns: ["tabela_id"]
            isOneToOne: false
            referencedRelation: "fabrica_tabelas_preco"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_tabelas_preco_versoes: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          created_at: string | null
          created_by: string | null
          id: string
          precos_snapshot: Json
          tabela_id: string
          versao: number
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          precos_snapshot: Json
          tabela_id: string
          versao: number
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          precos_snapshot?: Json
          tabela_id?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_tabelas_preco_versoes_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_tabelas_preco_versoes_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_tabelas_preco_versoes_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fabrica_tabelas_preco_versoes_tabela_id_fkey"
            columns: ["tabela_id"]
            isOneToOne: false
            referencedRelation: "fabrica_tabelas_preco"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_tarefas_ajuste_preco: {
        Row: {
          aplicada_em: string | null
          aplicada_por: string | null
          aprovada_em: string | null
          aprovada_por: string | null
          created_at: string
          custo_base: number | null
          diferenca_percentual: number | null
          id: string
          margem_resultante: number | null
          motivo_rejeicao: string | null
          ordem_na_cadeia: number
          preco_atual: number
          preco_sugerido: number
          produto_id: string
          rejeitada_em: string | null
          rejeitada_por: string | null
          status: string
          tabela_id: string
          tabela_limite_id: string
          updated_at: string
        }
        Insert: {
          aplicada_em?: string | null
          aplicada_por?: string | null
          aprovada_em?: string | null
          aprovada_por?: string | null
          created_at?: string
          custo_base?: number | null
          diferenca_percentual?: number | null
          id?: string
          margem_resultante?: number | null
          motivo_rejeicao?: string | null
          ordem_na_cadeia?: number
          preco_atual: number
          preco_sugerido: number
          produto_id: string
          rejeitada_em?: string | null
          rejeitada_por?: string | null
          status?: string
          tabela_id: string
          tabela_limite_id: string
          updated_at?: string
        }
        Update: {
          aplicada_em?: string | null
          aplicada_por?: string | null
          aprovada_em?: string | null
          aprovada_por?: string | null
          created_at?: string
          custo_base?: number | null
          diferenca_percentual?: number | null
          id?: string
          margem_resultante?: number | null
          motivo_rejeicao?: string | null
          ordem_na_cadeia?: number
          preco_atual?: number
          preco_sugerido?: number
          produto_id?: string
          rejeitada_em?: string | null
          rejeitada_por?: string | null
          status?: string
          tabela_id?: string
          tabela_limite_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_tarefas_ajuste_preco_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "fabrica_produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_tarefas_ajuste_preco_tabela_id_fkey"
            columns: ["tabela_id"]
            isOneToOne: false
            referencedRelation: "fabrica_tabelas_preco"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_tarefas_ajuste_preco_tabela_limite_id_fkey"
            columns: ["tabela_limite_id"]
            isOneToOne: false
            referencedRelation: "fabrica_tabelas_preco"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_produto"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "fabrica_produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_tabela"
            columns: ["tabela_id"]
            isOneToOne: false
            referencedRelation: "fabrica_tabelas_preco"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_tabela_limite"
            columns: ["tabela_limite_id"]
            isOneToOne: false
            referencedRelation: "fabrica_tabelas_preco"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_templates_lancamento: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          created_by: string | null
          descricao: string | null
          id: string
          nome: string
          tarefas: Json
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome: string
          tarefas?: Json
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          tarefas?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      fabrica_timesheets: {
        Row: {
          aprovado: boolean | null
          aprovado_em: string | null
          aprovado_por: string | null
          created_at: string | null
          created_by: string | null
          custo_hora_operador: number | null
          custo_total: number | null
          data_trabalho: string
          duracao_minutos: number | null
          hora_fim: string | null
          hora_inicio: string
          id: string
          maquina_id: string | null
          observacoes: string | null
          operador_id: string
          ordem_producao_id: string | null
          tipo_atividade: string | null
        }
        Insert: {
          aprovado?: boolean | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string | null
          created_by?: string | null
          custo_hora_operador?: number | null
          custo_total?: number | null
          data_trabalho: string
          duracao_minutos?: number | null
          hora_fim?: string | null
          hora_inicio: string
          id?: string
          maquina_id?: string | null
          observacoes?: string | null
          operador_id: string
          ordem_producao_id?: string | null
          tipo_atividade?: string | null
        }
        Update: {
          aprovado?: boolean | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string | null
          created_by?: string | null
          custo_hora_operador?: number | null
          custo_total?: number | null
          data_trabalho?: string
          duracao_minutos?: number | null
          hora_fim?: string | null
          hora_inicio?: string
          id?: string
          maquina_id?: string | null
          observacoes?: string | null
          operador_id?: string
          ordem_producao_id?: string | null
          tipo_atividade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_timesheets_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_timesheets_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_timesheets_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fabrica_timesheets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_timesheets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_timesheets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fabrica_timesheets_maquina_id_fkey"
            columns: ["maquina_id"]
            isOneToOne: false
            referencedRelation: "fabrica_maquinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_timesheets_operador_id_fkey"
            columns: ["operador_id"]
            isOneToOne: false
            referencedRelation: "fabrica_operadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_timesheets_ordem_producao_id_fkey"
            columns: ["ordem_producao_id"]
            isOneToOne: false
            referencedRelation: "fabrica_ordens_producao"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_unidades_medida: {
        Row: {
          created_at: string | null
          id: string
          nome: string
          sigla: string
          tipo: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome: string
          sigla: string
          tipo: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string
          sigla?: string
          tipo?: string
        }
        Relationships: []
      }
      fabrica_validacoes_fiscais: {
        Row: {
          ajustes_realizados: boolean | null
          created_at: string | null
          creditos_gerados: Json | null
          custo_entrada_calculado: number
          dados_originais: Json
          dados_validados: Json
          id: string
          item_nf_id: string
          nota_id: string
          tipos_ajustes: string[] | null
          validado_em: string | null
          validado_por: string
        }
        Insert: {
          ajustes_realizados?: boolean | null
          created_at?: string | null
          creditos_gerados?: Json | null
          custo_entrada_calculado: number
          dados_originais: Json
          dados_validados: Json
          id?: string
          item_nf_id: string
          nota_id: string
          tipos_ajustes?: string[] | null
          validado_em?: string | null
          validado_por: string
        }
        Update: {
          ajustes_realizados?: boolean | null
          created_at?: string | null
          creditos_gerados?: Json | null
          custo_entrada_calculado?: number
          dados_originais?: Json
          dados_validados?: Json
          id?: string
          item_nf_id?: string
          nota_id?: string
          tipos_ajustes?: string[] | null
          validado_em?: string | null
          validado_por?: string
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_validacoes_fiscais_item_nf_id_fkey"
            columns: ["item_nf_id"]
            isOneToOne: false
            referencedRelation: "fabrica_itens_nf"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_validacoes_fiscais_nota_id_fkey"
            columns: ["nota_id"]
            isOneToOne: false
            referencedRelation: "fabrica_notas_fiscais"
            referencedColumns: ["id"]
          },
        ]
      }
      fila_cobrancas: {
        Row: {
          agendado_para: string | null
          canal: string
          cliente_celular: string | null
          cliente_codigo: string
          cliente_email: string | null
          cliente_nome: string | null
          cliente_telefone: string | null
          conta_receber_id: string | null
          created_at: string | null
          criado_por: string | null
          dados_adicionais: Json | null
          erro_mensagem: string | null
          id: string
          max_tentativas: number | null
          mensagem_personalizada: string | null
          prioridade: number | null
          status: string
          template_id: string | null
          template_nome: string | null
          tentativas: number | null
          updated_at: string | null
        }
        Insert: {
          agendado_para?: string | null
          canal: string
          cliente_celular?: string | null
          cliente_codigo: string
          cliente_email?: string | null
          cliente_nome?: string | null
          cliente_telefone?: string | null
          conta_receber_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          dados_adicionais?: Json | null
          erro_mensagem?: string | null
          id?: string
          max_tentativas?: number | null
          mensagem_personalizada?: string | null
          prioridade?: number | null
          status?: string
          template_id?: string | null
          template_nome?: string | null
          tentativas?: number | null
          updated_at?: string | null
        }
        Update: {
          agendado_para?: string | null
          canal?: string
          cliente_celular?: string | null
          cliente_codigo?: string
          cliente_email?: string | null
          cliente_nome?: string | null
          cliente_telefone?: string | null
          conta_receber_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          dados_adicionais?: Json | null
          erro_mensagem?: string | null
          id?: string
          max_tentativas?: number | null
          mensagem_personalizada?: string | null
          prioridade?: number | null
          status?: string
          template_id?: string | null
          template_nome?: string | null
          tentativas?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fila_cobrancas_conta_receber_id_fkey"
            columns: ["conta_receber_id"]
            isOneToOne: false
            referencedRelation: "contas_receber"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fila_cobrancas_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates_cobranca"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string | null
          current_value: number | null
          goal_type: string
          id: string
          period_end: string
          period_start: string
          status: string | null
          target_value: number
          team_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          current_value?: number | null
          goal_type: string
          id?: string
          period_end: string
          period_start: string
          status?: string | null
          target_value: number
          team_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          current_value?: number | null
          goal_type?: string
          id?: string
          period_end?: string
          period_start?: string
          status?: string | null
          target_value?: number
          team_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      gondola_audits: {
        Row: {
          concorrentes_detalhes: Json | null
          concorrentes_presentes: boolean | null
          conforme_planograma: boolean | null
          created_at: string | null
          created_by: string | null
          estoque_loja: number | null
          id: string
          observacoes: string | null
          photo_ids: string[] | null
          preco_praticado: number | null
          product_id: string
          produto_descricao: string | null
          produto_ean: string | null
          produto_presente: boolean
          quantidade_frentes: number | null
          store_id: string
          vendedor_id: string | null
          visit_id: string | null
        }
        Insert: {
          concorrentes_detalhes?: Json | null
          concorrentes_presentes?: boolean | null
          conforme_planograma?: boolean | null
          created_at?: string | null
          created_by?: string | null
          estoque_loja?: number | null
          id?: string
          observacoes?: string | null
          photo_ids?: string[] | null
          preco_praticado?: number | null
          product_id: string
          produto_descricao?: string | null
          produto_ean?: string | null
          produto_presente?: boolean
          quantidade_frentes?: number | null
          store_id: string
          vendedor_id?: string | null
          visit_id?: string | null
        }
        Update: {
          concorrentes_detalhes?: Json | null
          concorrentes_presentes?: boolean | null
          conforme_planograma?: boolean | null
          created_at?: string | null
          created_by?: string | null
          estoque_loja?: number | null
          id?: string
          observacoes?: string | null
          photo_ids?: string[] | null
          preco_praticado?: number | null
          product_id?: string
          produto_descricao?: string | null
          produto_ean?: string | null
          produto_presente?: boolean
          quantidade_frentes?: number | null
          store_id?: string
          vendedor_id?: string | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gondola_audits_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gondola_audits_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "mv_trade_performance"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "gondola_audits_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gondola_audits_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_with_sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gondola_audits_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      gondola_competitive_analysis: {
        Row: {
          analysis_data: Json
          audit_id: string
          competitive_score: number | null
          created_at: string | null
          created_by: string | null
          id: string
          price_competitiveness: string | null
          recommendations: Json | null
          shelf_share_impact: string | null
        }
        Insert: {
          analysis_data: Json
          audit_id: string
          competitive_score?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          price_competitiveness?: string | null
          recommendations?: Json | null
          shelf_share_impact?: string | null
        }
        Update: {
          analysis_data?: Json
          audit_id?: string
          competitive_score?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          price_competitiveness?: string | null
          recommendations?: Json | null
          shelf_share_impact?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gondola_competitive_analysis_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "gondola_audits"
            referencedColumns: ["id"]
          },
        ]
      }
      historico_cobrancas: {
        Row: {
          cliente_codigo: string | null
          conta_receber_id: string | null
          created_at: string | null
          descricao: string | null
          id: string
          tipo_evento: string
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          cliente_codigo?: string | null
          conta_receber_id?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          tipo_evento: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          cliente_codigo?: string | null
          conta_receber_id?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          tipo_evento?: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historico_cobrancas_conta_receber_id_fkey"
            columns: ["conta_receber_id"]
            isOneToOne: false
            referencedRelation: "contas_receber"
            referencedColumns: ["id"]
          },
        ]
      }
      huggs_agent_config: {
        Row: {
          capabilities: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          max_tokens: number | null
          model: string | null
          n8n_webhook_url: string | null
          n8n_workflow_id: string | null
          name: string
          system_prompt: string | null
          temperature: number | null
          updated_at: string
        }
        Insert: {
          capabilities?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_tokens?: number | null
          model?: string | null
          n8n_webhook_url?: string | null
          n8n_workflow_id?: string | null
          name?: string
          system_prompt?: string | null
          temperature?: number | null
          updated_at?: string
        }
        Update: {
          capabilities?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_tokens?: number | null
          model?: string | null
          n8n_webhook_url?: string | null
          n8n_workflow_id?: string | null
          name?: string
          system_prompt?: string | null
          temperature?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      huggs_charts: {
        Row: {
          chart_config: Json
          chart_type: string
          created_at: string
          data: Json
          department: string | null
          id: string
          is_favorite: boolean | null
          message_id: string | null
          session_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          chart_config: Json
          chart_type: string
          created_at?: string
          data: Json
          department?: string | null
          id?: string
          is_favorite?: boolean | null
          message_id?: string | null
          session_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          chart_config?: Json
          chart_type?: string
          created_at?: string
          data?: Json
          department?: string | null
          id?: string
          is_favorite?: boolean | null
          message_id?: string | null
          session_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "huggs_charts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "huggs_chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "huggs_charts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "huggs_chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      huggs_chat_messages: {
        Row: {
          content: string
          content_type: string | null
          created_at: string
          id: string
          latency_ms: number | null
          metadata: Json | null
          role: string
          session_id: string
          tokens_used: number | null
          tool_calls: Json | null
          tool_results: Json | null
        }
        Insert: {
          content: string
          content_type?: string | null
          created_at?: string
          id?: string
          latency_ms?: number | null
          metadata?: Json | null
          role: string
          session_id: string
          tokens_used?: number | null
          tool_calls?: Json | null
          tool_results?: Json | null
        }
        Update: {
          content?: string
          content_type?: string | null
          created_at?: string
          id?: string
          latency_ms?: number | null
          metadata?: Json | null
          role?: string
          session_id?: string
          tokens_used?: number | null
          tool_calls?: Json | null
          tool_results?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "huggs_chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "huggs_chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      huggs_chat_sessions: {
        Row: {
          context: Json | null
          created_at: string
          department: string | null
          id: string
          last_message_at: string | null
          messages_count: number | null
          metadata: Json | null
          status: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          context?: Json | null
          created_at?: string
          department?: string | null
          id?: string
          last_message_at?: string | null
          messages_count?: number | null
          metadata?: Json | null
          status?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          context?: Json | null
          created_at?: string
          department?: string | null
          id?: string
          last_message_at?: string | null
          messages_count?: number | null
          metadata?: Json | null
          status?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      huggs_feedback: {
        Row: {
          comment: string | null
          created_at: string
          feedback_type: string | null
          id: string
          message_id: string
          rating: number | null
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          feedback_type?: string | null
          id?: string
          message_id: string
          rating?: number | null
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          feedback_type?: string | null
          id?: string
          message_id?: string
          rating?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "huggs_feedback_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "huggs_chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      huggs_reports: {
        Row: {
          content: string | null
          created_at: string
          date_range: Json | null
          department: string | null
          format: string | null
          id: string
          is_favorite: boolean | null
          message_id: string | null
          metadata: Json | null
          report_type: string | null
          session_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          date_range?: Json | null
          department?: string | null
          format?: string | null
          id?: string
          is_favorite?: boolean | null
          message_id?: string | null
          metadata?: Json | null
          report_type?: string | null
          session_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          date_range?: Json | null
          department?: string | null
          format?: string | null
          id?: string
          is_favorite?: boolean | null
          message_id?: string | null
          metadata?: Json | null
          report_type?: string | null
          session_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "huggs_reports_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "huggs_chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "huggs_reports_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "huggs_chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      huggs_usage_logs: {
        Row: {
          action: string
          created_at: string
          error_message: string | null
          id: string
          latency_ms: number | null
          metadata: Json | null
          session_id: string | null
          success: boolean | null
          tokens_input: number | null
          tokens_output: number | null
          tool_used: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          metadata?: Json | null
          session_id?: string | null
          success?: boolean | null
          tokens_input?: number | null
          tokens_output?: number | null
          tool_used?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          metadata?: Json | null
          session_id?: string | null
          success?: boolean | null
          tokens_input?: number | null
          tokens_output?: number | null
          tool_used?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "huggs_usage_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "huggs_chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ideal_pdv_photos: {
        Row: {
          category: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          photo_url: string
        }
        Insert: {
          category: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          photo_url: string
        }
        Update: {
          category?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          photo_url?: string
        }
        Relationships: []
      }
      integration_configs: {
        Row: {
          ativo: boolean | null
          auth_config: Json | null
          auth_type: string | null
          batch_size: number | null
          codigo: string
          created_at: string | null
          created_by: string | null
          descricao: string | null
          endpoint_url: string | null
          entidade_destino: string
          id: string
          nome: string
          rate_limit_requests: number | null
          rate_limit_window_seconds: number | null
          retry_attempts: number | null
          retry_delay_ms: number | null
          sistema_origem: string | null
          timeout_ms: number | null
          tipo: string
          ultima_execucao: string | null
          ultimo_erro: string | null
          ultimo_status: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          ativo?: boolean | null
          auth_config?: Json | null
          auth_type?: string | null
          batch_size?: number | null
          codigo: string
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          endpoint_url?: string | null
          entidade_destino: string
          id?: string
          nome: string
          rate_limit_requests?: number | null
          rate_limit_window_seconds?: number | null
          retry_attempts?: number | null
          retry_delay_ms?: number | null
          sistema_origem?: string | null
          timeout_ms?: number | null
          tipo?: string
          ultima_execucao?: string | null
          ultimo_erro?: string | null
          ultimo_status?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean | null
          auth_config?: Json | null
          auth_type?: string | null
          batch_size?: number | null
          codigo?: string
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          endpoint_url?: string | null
          entidade_destino?: string
          id?: string
          nome?: string
          rate_limit_requests?: number | null
          rate_limit_window_seconds?: number | null
          retry_attempts?: number | null
          retry_delay_ms?: number | null
          sistema_origem?: string | null
          timeout_ms?: number | null
          tipo?: string
          ultima_execucao?: string | null
          ultimo_erro?: string | null
          ultimo_status?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      integration_field_mappings: {
        Row: {
          ativo: boolean | null
          campo_destino: string
          campo_origem: string
          config_id: string
          created_at: string | null
          formato_destino: string | null
          formato_origem: string | null
          funcao_transformacao: string | null
          id: string
          obrigatorio: boolean | null
          ordem: number | null
          path_origem: string | null
          tipo_transformacao: string | null
          validacao_regex: string | null
          valor_default: string | null
        }
        Insert: {
          ativo?: boolean | null
          campo_destino: string
          campo_origem: string
          config_id: string
          created_at?: string | null
          formato_destino?: string | null
          formato_origem?: string | null
          funcao_transformacao?: string | null
          id?: string
          obrigatorio?: boolean | null
          ordem?: number | null
          path_origem?: string | null
          tipo_transformacao?: string | null
          validacao_regex?: string | null
          valor_default?: string | null
        }
        Update: {
          ativo?: boolean | null
          campo_destino?: string
          campo_origem?: string
          config_id?: string
          created_at?: string | null
          formato_destino?: string | null
          formato_origem?: string | null
          funcao_transformacao?: string | null
          id?: string
          obrigatorio?: boolean | null
          ordem?: number | null
          path_origem?: string | null
          tipo_transformacao?: string | null
          validacao_regex?: string | null
          valor_default?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_field_mappings_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "integration_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_logs: {
        Row: {
          codigo_integracao: string | null
          config_id: string | null
          direcao: string
          duracao_ms: number | null
          endpoint: string | null
          erro_mensagem: string | null
          erro_stack: string | null
          erro_tipo: string | null
          finalizado_em: string | null
          headers: Json | null
          id: string
          iniciado_em: string | null
          ip_address: unknown
          metodo: string | null
          payload_preview: string | null
          payload_size_bytes: number | null
          registros_erro: number | null
          registros_processados: number | null
          registros_recebidos: number | null
          registros_sucesso: number | null
          request_id: string | null
          response_preview: string | null
          status: string
          status_code: number | null
          user_agent: string | null
        }
        Insert: {
          codigo_integracao?: string | null
          config_id?: string | null
          direcao: string
          duracao_ms?: number | null
          endpoint?: string | null
          erro_mensagem?: string | null
          erro_stack?: string | null
          erro_tipo?: string | null
          finalizado_em?: string | null
          headers?: Json | null
          id?: string
          iniciado_em?: string | null
          ip_address?: unknown
          metodo?: string | null
          payload_preview?: string | null
          payload_size_bytes?: number | null
          registros_erro?: number | null
          registros_processados?: number | null
          registros_recebidos?: number | null
          registros_sucesso?: number | null
          request_id?: string | null
          response_preview?: string | null
          status: string
          status_code?: number | null
          user_agent?: string | null
        }
        Update: {
          codigo_integracao?: string | null
          config_id?: string | null
          direcao?: string
          duracao_ms?: number | null
          endpoint?: string | null
          erro_mensagem?: string | null
          erro_stack?: string | null
          erro_tipo?: string | null
          finalizado_em?: string | null
          headers?: Json | null
          id?: string
          iniciado_em?: string | null
          ip_address?: unknown
          metodo?: string | null
          payload_preview?: string | null
          payload_size_bytes?: number | null
          registros_erro?: number | null
          registros_processados?: number | null
          registros_recebidos?: number | null
          registros_sucesso?: number | null
          request_id?: string | null
          response_preview?: string | null
          status?: string
          status_code?: number | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_logs_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "integration_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_queue: {
        Row: {
          agendado_para: string | null
          config_id: string | null
          created_at: string | null
          created_by: string | null
          entidade: string
          entidade_id: string | null
          id: string
          max_tentativas: number | null
          operacao: string
          payload: Json
          prioridade: number | null
          processado_em: string | null
          status: string | null
          tentativas: number | null
          ultimo_erro: string | null
          ultimo_erro_em: string | null
        }
        Insert: {
          agendado_para?: string | null
          config_id?: string | null
          created_at?: string | null
          created_by?: string | null
          entidade: string
          entidade_id?: string | null
          id?: string
          max_tentativas?: number | null
          operacao: string
          payload: Json
          prioridade?: number | null
          processado_em?: string | null
          status?: string | null
          tentativas?: number | null
          ultimo_erro?: string | null
          ultimo_erro_em?: string | null
        }
        Update: {
          agendado_para?: string | null
          config_id?: string | null
          created_at?: string | null
          created_by?: string | null
          entidade?: string
          entidade_id?: string | null
          id?: string
          max_tentativas?: number | null
          operacao?: string
          payload?: Json
          prioridade?: number | null
          processado_em?: string | null
          status?: string | null
          tentativas?: number | null
          ultimo_erro?: string | null
          ultimo_erro_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_queue_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "integration_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_snapshots: {
        Row: {
          created_at: string | null
          id: string
          kpi_type: string
          metadata: Json | null
          snapshot_date: string
          value: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          kpi_type: string
          metadata?: Json | null
          snapshot_date: string
          value: number
        }
        Update: {
          created_at?: string | null
          id?: string
          kpi_type?: string
          metadata?: Json | null
          snapshot_date?: string
          value?: number
        }
        Relationships: []
      }
      kpis_tracking: {
        Row: {
          average_price: number | null
          avg_facings: number | null
          category: string | null
          compliance_score: number | null
          created_at: string | null
          date: string
          id: string
          numeric_distribution: number | null
          out_of_stock_rate: number | null
          price_index: number | null
          promotion_intensity: number | null
          region: string | null
          sales_value: number | null
          sales_volume: number | null
          shelf_share: number | null
          store_id: string | null
          value_share: number | null
          visit_completion_rate: number | null
          volume_share: number | null
          weighted_distribution: number | null
        }
        Insert: {
          average_price?: number | null
          avg_facings?: number | null
          category?: string | null
          compliance_score?: number | null
          created_at?: string | null
          date: string
          id?: string
          numeric_distribution?: number | null
          out_of_stock_rate?: number | null
          price_index?: number | null
          promotion_intensity?: number | null
          region?: string | null
          sales_value?: number | null
          sales_volume?: number | null
          shelf_share?: number | null
          store_id?: string | null
          value_share?: number | null
          visit_completion_rate?: number | null
          volume_share?: number | null
          weighted_distribution?: number | null
        }
        Update: {
          average_price?: number | null
          avg_facings?: number | null
          category?: string | null
          compliance_score?: number | null
          created_at?: string | null
          date?: string
          id?: string
          numeric_distribution?: number | null
          out_of_stock_rate?: number | null
          price_index?: number | null
          promotion_intensity?: number | null
          region?: string | null
          sales_value?: number | null
          sales_volume?: number | null
          shelf_share?: number | null
          store_id?: string | null
          value_share?: number | null
          visit_completion_rate?: number | null
          volume_share?: number | null
          weighted_distribution?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kpis_tracking_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "mv_trade_performance"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "kpis_tracking_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpis_tracking_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_with_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos_distribuidores: {
        Row: {
          created_at: string | null
          data_comunicacao: string | null
          distribuidora_id: string
          id: string
          lancamento_id: string
          observacoes: string | null
          status_comunicacao: string | null
        }
        Insert: {
          created_at?: string | null
          data_comunicacao?: string | null
          distribuidora_id: string
          id?: string
          lancamento_id: string
          observacoes?: string | null
          status_comunicacao?: string | null
        }
        Update: {
          created_at?: string | null
          data_comunicacao?: string | null
          distribuidora_id?: string
          id?: string
          lancamento_id?: string
          observacoes?: string | null
          status_comunicacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_distribuidores_distribuidora_id_fkey"
            columns: ["distribuidora_id"]
            isOneToOne: false
            referencedRelation: "estoque_distribuidoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_distribuidores_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "lancamentos_produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos_materiais: {
        Row: {
          aprovado: boolean | null
          created_at: string | null
          created_by: string | null
          id: string
          lancamento_id: string
          nome: string
          tipo: string
          url: string
          versao: number | null
        }
        Insert: {
          aprovado?: boolean | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          lancamento_id: string
          nome: string
          tipo: string
          url: string
          versao?: number | null
        }
        Update: {
          aprovado?: boolean | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          lancamento_id?: string
          nome?: string
          tipo?: string
          url?: string
          versao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_materiais_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_materiais_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_materiais_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "lancamentos_materiais_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "lancamentos_produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos_produtos: {
        Row: {
          created_at: string | null
          created_by: string | null
          data_efetiva: string | null
          data_prevista: string
          descricao: string | null
          id: string
          nome_lancamento: string
          observacoes: string | null
          prioridade: string
          produto_id: string | null
          responsavel_id: string | null
          status: string
          tabela_preco_id: string | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          data_efetiva?: string | null
          data_prevista: string
          descricao?: string | null
          id?: string
          nome_lancamento: string
          observacoes?: string | null
          prioridade?: string
          produto_id?: string | null
          responsavel_id?: string | null
          status?: string
          tabela_preco_id?: string | null
          tipo?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          data_efetiva?: string | null
          data_prevista?: string
          descricao?: string | null
          id?: string
          nome_lancamento?: string
          observacoes?: string | null
          prioridade?: string
          produto_id?: string | null
          responsavel_id?: string | null
          status?: string
          tabela_preco_id?: string | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_produtos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_produtos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_produtos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "lancamentos_produtos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "fabrica_produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_produtos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_produtos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_produtos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "lancamentos_produtos_tabela_preco_id_fkey"
            columns: ["tabela_preco_id"]
            isOneToOne: false
            referencedRelation: "fabrica_tabelas_preco"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos_tarefas_marketing: {
        Row: {
          alerta_gargalo: boolean | null
          aprovado_em: string | null
          aprovado_por: string | null
          arquivos_urls: string[] | null
          bloqueada: boolean | null
          campanha_id: string | null
          created_at: string | null
          data_conclusao: string | null
          data_prazo: string | null
          dependencia_tarefa_id: string | null
          descricao: string | null
          etapa_atual_id: string | null
          id: string
          lancamento_id: string
          metadata: Json | null
          motivo_bloqueio: string | null
          pontos_base: number | null
          pontos_bonus: number | null
          prioridade_ai: number | null
          responsavel_id: string | null
          sla_deadline: string | null
          sla_status: string | null
          status: string | null
          template_id: string | null
          tempo_estimado_horas: number | null
          tempo_real_horas: number | null
          tipo: string
          titulo: string
          updated_at: string | null
          versao: number | null
          workflow_status: string | null
        }
        Insert: {
          alerta_gargalo?: boolean | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          arquivos_urls?: string[] | null
          bloqueada?: boolean | null
          campanha_id?: string | null
          created_at?: string | null
          data_conclusao?: string | null
          data_prazo?: string | null
          dependencia_tarefa_id?: string | null
          descricao?: string | null
          etapa_atual_id?: string | null
          id?: string
          lancamento_id: string
          metadata?: Json | null
          motivo_bloqueio?: string | null
          pontos_base?: number | null
          pontos_bonus?: number | null
          prioridade_ai?: number | null
          responsavel_id?: string | null
          sla_deadline?: string | null
          sla_status?: string | null
          status?: string | null
          template_id?: string | null
          tempo_estimado_horas?: number | null
          tempo_real_horas?: number | null
          tipo: string
          titulo: string
          updated_at?: string | null
          versao?: number | null
          workflow_status?: string | null
        }
        Update: {
          alerta_gargalo?: boolean | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          arquivos_urls?: string[] | null
          bloqueada?: boolean | null
          campanha_id?: string | null
          created_at?: string | null
          data_conclusao?: string | null
          data_prazo?: string | null
          dependencia_tarefa_id?: string | null
          descricao?: string | null
          etapa_atual_id?: string | null
          id?: string
          lancamento_id?: string
          metadata?: Json | null
          motivo_bloqueio?: string | null
          pontos_base?: number | null
          pontos_bonus?: number | null
          prioridade_ai?: number | null
          responsavel_id?: string | null
          sla_deadline?: string | null
          sla_status?: string | null
          status?: string | null
          template_id?: string | null
          tempo_estimado_horas?: number | null
          tempo_real_horas?: number | null
          tipo?: string
          titulo?: string
          updated_at?: string | null
          versao?: number | null
          workflow_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_tarefas_marketing_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "marketing_campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_tarefas_marketing_dependencia_tarefa_id_fkey"
            columns: ["dependencia_tarefa_id"]
            isOneToOne: false
            referencedRelation: "lancamentos_tarefas_marketing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_tarefas_marketing_etapa_atual_id_fkey"
            columns: ["etapa_atual_id"]
            isOneToOne: false
            referencedRelation: "marketing_workflow_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_tarefas_marketing_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "lancamentos_produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_tarefas_marketing_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_tarefas_marketing_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_tarefas_marketing_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      marketing_alertas: {
        Row: {
          acao_url: string | null
          created_at: string
          dados: Json | null
          destinatario_id: string | null
          entidade_id: string | null
          entidade_tipo: string | null
          expires_at: string | null
          id: string
          lido: boolean | null
          lido_em: string | null
          mensagem: string | null
          severidade: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          acao_url?: string | null
          created_at?: string
          dados?: Json | null
          destinatario_id?: string | null
          entidade_id?: string | null
          entidade_tipo?: string | null
          expires_at?: string | null
          id?: string
          lido?: boolean | null
          lido_em?: string | null
          mensagem?: string | null
          severidade?: string | null
          tipo: string
          titulo: string
        }
        Update: {
          acao_url?: string | null
          created_at?: string
          dados?: Json | null
          destinatario_id?: string | null
          entidade_id?: string | null
          entidade_tipo?: string | null
          expires_at?: string | null
          id?: string
          lido?: boolean | null
          lido_em?: string | null
          mensagem?: string | null
          severidade?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      marketing_aprovacoes: {
        Row: {
          aprovador_id: string | null
          comentario: string | null
          created_at: string
          data_resposta: string | null
          data_solicitacao: string | null
          etapa_id: string | null
          id: string
          status: string | null
          tarefa_id: string
          versao: number | null
        }
        Insert: {
          aprovador_id?: string | null
          comentario?: string | null
          created_at?: string
          data_resposta?: string | null
          data_solicitacao?: string | null
          etapa_id?: string | null
          id?: string
          status?: string | null
          tarefa_id: string
          versao?: number | null
        }
        Update: {
          aprovador_id?: string | null
          comentario?: string | null
          created_at?: string
          data_resposta?: string | null
          data_solicitacao?: string | null
          etapa_id?: string | null
          id?: string
          status?: string | null
          tarefa_id?: string
          versao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_aprovacoes_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "marketing_workflow_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_aprovacoes_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "lancamentos_tarefas_marketing"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_assets: {
        Row: {
          created_at: string | null
          descricao: string | null
          id: string
          lancamento_id: string | null
          mime_type: string | null
          nome: string
          storage_path: string
          tags: string[] | null
          tamanho_bytes: number | null
          tarefa_id: string | null
          tipo: string
          updated_at: string | null
          uploaded_by: string | null
          url_publica: string
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          lancamento_id?: string | null
          mime_type?: string | null
          nome: string
          storage_path: string
          tags?: string[] | null
          tamanho_bytes?: number | null
          tarefa_id?: string | null
          tipo: string
          updated_at?: string | null
          uploaded_by?: string | null
          url_publica: string
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          lancamento_id?: string | null
          mime_type?: string | null
          nome?: string
          storage_path?: string
          tags?: string[] | null
          tamanho_bytes?: number | null
          tarefa_id?: string | null
          tipo?: string
          updated_at?: string | null
          uploaded_by?: string | null
          url_publica?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_assets_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "lancamentos_produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_assets_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "lancamentos_tarefas_marketing"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_automacoes: {
        Row: {
          acoes: Json
          ativo: boolean | null
          condicoes: Json
          created_at: string
          created_by: string | null
          descricao: string | null
          execucoes_count: number | null
          id: string
          nome: string
          prioridade: number | null
          tipo_gatilho: string
          ultima_execucao: string | null
          updated_at: string
        }
        Insert: {
          acoes?: Json
          ativo?: boolean | null
          condicoes?: Json
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          execucoes_count?: number | null
          id?: string
          nome: string
          prioridade?: number | null
          tipo_gatilho: string
          ultima_execucao?: string | null
          updated_at?: string
        }
        Update: {
          acoes?: Json
          ativo?: boolean | null
          condicoes?: Json
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          execucoes_count?: number | null
          id?: string
          nome?: string
          prioridade?: number | null
          tipo_gatilho?: string
          ultima_execucao?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      marketing_automacoes_log: {
        Row: {
          acoes_executadas: Json | null
          automacao_id: string | null
          entidade_id: string
          entidade_tipo: string
          erro_mensagem: string | null
          executado_em: string
          gatilho_dados: Json | null
          id: string
          sucesso: boolean | null
        }
        Insert: {
          acoes_executadas?: Json | null
          automacao_id?: string | null
          entidade_id: string
          entidade_tipo: string
          erro_mensagem?: string | null
          executado_em?: string
          gatilho_dados?: Json | null
          id?: string
          sucesso?: boolean | null
        }
        Update: {
          acoes_executadas?: Json | null
          automacao_id?: string | null
          entidade_id?: string
          entidade_tipo?: string
          erro_mensagem?: string | null
          executado_em?: string
          gatilho_dados?: Json | null
          id?: string
          sucesso?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_automacoes_log_automacao_id_fkey"
            columns: ["automacao_id"]
            isOneToOne: false
            referencedRelation: "marketing_automacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_badges: {
        Row: {
          codigo: string
          cor: string | null
          created_at: string | null
          descricao: string | null
          icone: string | null
          id: string
          nome: string
          pontos_necessarios: number | null
          tipo: string | null
        }
        Insert: {
          codigo: string
          cor?: string | null
          created_at?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          nome: string
          pontos_necessarios?: number | null
          tipo?: string | null
        }
        Update: {
          codigo?: string
          cor?: string | null
          created_at?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          nome?: string
          pontos_necessarios?: number | null
          tipo?: string | null
        }
        Relationships: []
      }
      marketing_campanhas: {
        Row: {
          created_at: string
          created_by: string | null
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          id: string
          kpis: Json | null
          lancamento_id: string | null
          nome: string
          objetivo: string | null
          orcamento: number | null
          orcamento_utilizado: number | null
          progresso: number | null
          responsavel_id: string | null
          status: string | null
          tipo: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          kpis?: Json | null
          lancamento_id?: string | null
          nome: string
          objetivo?: string | null
          orcamento?: number | null
          orcamento_utilizado?: number | null
          progresso?: number | null
          responsavel_id?: string | null
          status?: string | null
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          kpis?: Json | null
          lancamento_id?: string | null
          nome?: string
          objetivo?: string | null
          orcamento?: number | null
          orcamento_utilizado?: number | null
          progresso?: number | null
          responsavel_id?: string | null
          status?: string | null
          tipo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      marketing_notifications: {
        Row: {
          created_at: string | null
          id: string
          lida: boolean | null
          link: string | null
          mensagem: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          lida?: boolean | null
          link?: string | null
          mensagem?: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          lida?: boolean | null
          link?: string | null
          mensagem?: string | null
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      marketing_papeis: {
        Row: {
          ativo: boolean | null
          codigo: string
          created_at: string
          descricao: string | null
          id: string
          nome: string
          permissoes: Json | null
        }
        Insert: {
          ativo?: boolean | null
          codigo: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          permissoes?: Json | null
        }
        Update: {
          ativo?: boolean | null
          codigo?: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          permissoes?: Json | null
        }
        Relationships: []
      }
      marketing_points_history: {
        Row: {
          created_at: string | null
          descricao: string | null
          id: string
          pontos: number
          tarefa_id: string | null
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          pontos: number
          tarefa_id?: string | null
          tipo: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          pontos?: number
          tarefa_id?: string | null
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_points_history_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "lancamentos_tarefas_marketing"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_sla_config: {
        Row: {
          ativo: boolean | null
          created_at: string
          etapa_id: string | null
          horas_alerta: number | null
          horas_limite: number
          id: string
          tipo_tarefa: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          etapa_id?: string | null
          horas_alerta?: number | null
          horas_limite: number
          id?: string
          tipo_tarefa: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          etapa_id?: string | null
          horas_alerta?: number | null
          horas_limite?: number
          id?: string
          tipo_tarefa?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_sla_config_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "marketing_workflow_etapas"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_tarefas_dependencias: {
        Row: {
          created_at: string
          depende_de_id: string
          id: string
          tarefa_id: string
          tipo_dependencia: string | null
        }
        Insert: {
          created_at?: string
          depende_de_id: string
          id?: string
          tarefa_id: string
          tipo_dependencia?: string | null
        }
        Update: {
          created_at?: string
          depende_de_id?: string
          id?: string
          tarefa_id?: string
          tipo_dependencia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_tarefas_dependencias_depende_de_id_fkey"
            columns: ["depende_de_id"]
            isOneToOne: false
            referencedRelation: "lancamentos_tarefas_marketing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_tarefas_dependencias_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "lancamentos_tarefas_marketing"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_task_checklist: {
        Row: {
          concluido: boolean | null
          concluido_em: string | null
          concluido_por: string | null
          created_at: string | null
          created_by: string | null
          id: string
          ordem: number | null
          tarefa_id: string
          titulo: string
        }
        Insert: {
          concluido?: boolean | null
          concluido_em?: string | null
          concluido_por?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          ordem?: number | null
          tarefa_id: string
          titulo: string
        }
        Update: {
          concluido?: boolean | null
          concluido_em?: string | null
          concluido_por?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          ordem?: number | null
          tarefa_id?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_task_checklist_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "lancamentos_tarefas_marketing"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_task_comments: {
        Row: {
          anexo_url: string | null
          comentario: string
          created_at: string | null
          id: string
          posicao_x: number | null
          posicao_y: number | null
          tarefa_id: string
          tipo: string | null
          user_id: string
        }
        Insert: {
          anexo_url?: string | null
          comentario: string
          created_at?: string | null
          id?: string
          posicao_x?: number | null
          posicao_y?: number | null
          tarefa_id: string
          tipo?: string | null
          user_id: string
        }
        Update: {
          anexo_url?: string | null
          comentario?: string
          created_at?: string | null
          id?: string
          posicao_x?: number | null
          posicao_y?: number | null
          tarefa_id?: string
          tipo?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_task_comments_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "lancamentos_tarefas_marketing"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_task_files: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          created_at: string | null
          created_by: string | null
          id: string
          nome: string
          status: string | null
          tamanho_bytes: number | null
          tarefa_id: string
          tipo: string | null
          url: string
          versao: number | null
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          nome: string
          status?: string | null
          tamanho_bytes?: number | null
          tarefa_id: string
          tipo?: string | null
          url: string
          versao?: number | null
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          nome?: string
          status?: string | null
          tamanho_bytes?: number | null
          tarefa_id?: string
          tipo?: string | null
          url?: string
          versao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_task_files_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "lancamentos_tarefas_marketing"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_templates: {
        Row: {
          ativo: boolean | null
          checklist_padrao: Json | null
          configuracao: Json
          created_at: string
          created_by: string | null
          descricao: string | null
          etapas_workflow: Json | null
          id: string
          nome: string
          pontos_base: number | null
          sla_dias: number | null
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          checklist_padrao?: Json | null
          configuracao?: Json
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          etapas_workflow?: Json | null
          id?: string
          nome: string
          pontos_base?: number | null
          sla_dias?: number | null
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          checklist_padrao?: Json | null
          configuracao?: Json
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          etapas_workflow?: Json | null
          id?: string
          nome?: string
          pontos_base?: number | null
          sla_dias?: number | null
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_user_badges: {
        Row: {
          badge_id: string
          earned_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "marketing_badges"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_user_stats: {
        Row: {
          best_streak: number | null
          created_at: string | null
          current_streak: number | null
          id: string
          level: number | null
          tasks_completed: number | null
          tasks_on_time: number | null
          total_points: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          best_streak?: number | null
          created_at?: string | null
          current_streak?: number | null
          id?: string
          level?: number | null
          tasks_completed?: number | null
          tasks_on_time?: number | null
          total_points?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          best_streak?: number | null
          created_at?: string | null
          current_streak?: number | null
          id?: string
          level?: number | null
          tasks_completed?: number | null
          tasks_on_time?: number | null
          total_points?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      marketing_work_sessions: {
        Row: {
          created_at: string | null
          duracao_minutos: number | null
          fim: string | null
          id: string
          inicio: string
          observacoes: string | null
          tarefa_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          duracao_minutos?: number | null
          fim?: string | null
          id?: string
          inicio?: string
          observacoes?: string | null
          tarefa_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          duracao_minutos?: number | null
          fim?: string | null
          id?: string
          inicio?: string
          observacoes?: string | null
          tarefa_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_work_sessions_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "lancamentos_tarefas_marketing"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_workflow_etapas: {
        Row: {
          aprovador_papel: string | null
          ativo: boolean | null
          cor: string | null
          created_at: string
          descricao: string | null
          icone: string | null
          id: string
          nome: string
          ordem: number
          requer_aprovacao: boolean | null
          sla_horas: number | null
          tipo: string | null
          updated_at: string
        }
        Insert: {
          aprovador_papel?: string | null
          ativo?: boolean | null
          cor?: string | null
          created_at?: string
          descricao?: string | null
          icone?: string | null
          id?: string
          nome: string
          ordem?: number
          requer_aprovacao?: boolean | null
          sla_horas?: number | null
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          aprovador_papel?: string | null
          ativo?: boolean | null
          cor?: string | null
          created_at?: string
          descricao?: string | null
          icone?: string | null
          id?: string
          nome?: string
          ordem?: number
          requer_aprovacao?: boolean | null
          sla_horas?: number | null
          tipo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      measurement_guide_photos: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          order_index: number
          photo_url: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          order_index?: number
          photo_url: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          order_index?: number
          photo_url?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      mensagens: {
        Row: {
          conteudo: string
          conversa_id: string
          created_at: string
          id: string
          lida: boolean
          remetente_id: string
        }
        Insert: {
          conteudo: string
          conversa_id: string
          created_at?: string
          id?: string
          lida?: boolean
          remetente_id: string
        }
        Update: {
          conteudo?: string
          conversa_id?: string
          created_at?: string
          id?: string
          lida?: boolean
          remetente_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      modulos_sistema: {
        Row: {
          ativo: boolean | null
          codigo: string
          created_at: string | null
          descricao: string | null
          icone: string | null
          id: string
          nome: string
          ordem: number | null
        }
        Insert: {
          ativo?: boolean | null
          codigo: string
          created_at?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          nome: string
          ordem?: number | null
        }
        Update: {
          ativo?: boolean | null
          codigo?: string
          created_at?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          nome?: string
          ordem?: number | null
        }
        Relationships: []
      }
      municipios: {
        Row: {
          created_at: string | null
          id: string
          nome: string
          regiao: Database["public"]["Enums"]["region_type"]
          uf: string
          updated_at: string | null
          vendedor_id: string | null
          zona_padrao: Database["public"]["Enums"]["zona_geografica"] | null
        }
        Insert: {
          created_at?: string | null
          id: string
          nome: string
          regiao: Database["public"]["Enums"]["region_type"]
          uf: string
          updated_at?: string | null
          vendedor_id?: string | null
          zona_padrao?: Database["public"]["Enums"]["zona_geografica"] | null
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string
          regiao?: Database["public"]["Enums"]["region_type"]
          uf?: string
          updated_at?: string | null
          vendedor_id?: string | null
          zona_padrao?: Database["public"]["Enums"]["zona_geografica"] | null
        }
        Relationships: [
          {
            foreignKeyName: "municipios_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "municipios_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "municipios_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      municipios_usuarios: {
        Row: {
          created_at: string | null
          id: string
          municipio_id: string
          usuario_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          municipio_id: string
          usuario_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          municipio_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "municipios_usuarios_municipio_id_fkey"
            columns: ["municipio_id"]
            isOneToOne: false
            referencedRelation: "municipios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "municipios_usuarios_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "municipios_usuarios_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "municipios_usuarios_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      n8n_cache_contas_receber: {
        Row: {
          cliente_codigo: string | null
          conta_data: Json
          created_at: string | null
          erp_id: string | null
          id: number
          synced_at: string | null
        }
        Insert: {
          cliente_codigo?: string | null
          conta_data: Json
          created_at?: string | null
          erp_id?: string | null
          id?: number
          synced_at?: string | null
        }
        Update: {
          cliente_codigo?: string | null
          conta_data?: Json
          created_at?: string | null
          erp_id?: string | null
          id?: number
          synced_at?: string | null
        }
        Relationships: []
      }
      n8n_sync_control: {
        Row: {
          created_at: string | null
          error_message: string | null
          last_sync: string | null
          metadata: Json | null
          records_processed: number | null
          status: string | null
          table_name: string
          total_records: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          last_sync?: string | null
          metadata?: Json | null
          records_processed?: number | null
          status?: string | null
          table_name: string
          total_records?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          last_sync?: string | null
          metadata?: Json | null
          records_processed?: number | null
          status?: string | null
          table_name?: string
          total_records?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          digest_frequency: string | null
          email_enabled: boolean | null
          notification_types: Json | null
          push_enabled: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          digest_frequency?: string | null
          email_enabled?: boolean | null
          notification_types?: Json | null
          push_enabled?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          digest_frequency?: string | null
          email_enabled?: boolean | null
          notification_types?: Json | null
          push_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string | null
          id: string
          message: string
          read: boolean | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string | null
          id?: string
          message: string
          read?: boolean | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string | null
          id?: string
          message?: string
          read?: boolean | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      our_brands: {
        Row: {
          active: boolean | null
          brand_name: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_primary: boolean | null
          logo_url: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          brand_name: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_primary?: boolean | null
          logo_url?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          brand_name?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_primary?: boolean | null
          logo_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      our_products: {
        Row: {
          active: boolean | null
          category: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          name: string
          photos: Json | null
          sku: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          photos?: Json | null
          sku?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          photos?: Json | null
          sku?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      photo_analysis_queue: {
        Row: {
          attempts: number | null
          created_at: string | null
          created_by: string | null
          error_message: string | null
          id: string
          photo_id: string | null
          photo_url: string
          processed_at: string | null
          result: Json | null
          status: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          id?: string
          photo_id?: string | null
          photo_url: string
          processed_at?: string | null
          result?: Json | null
          status?: string | null
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          id?: string
          photo_id?: string | null
          photo_url?: string
          processed_at?: string | null
          result?: Json | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "photo_analysis_queue_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "photos"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          action_items: string[] | null
          ai_analysis: Json | null
          ai_processed: boolean | null
          approved: boolean | null
          approved_at: string | null
          approved_by: string | null
          category: string | null
          competitor_facings: number | null
          compliance_score: number | null
          detected_brands: Json | null
          detected_prices: Json | null
          detected_products: Json | null
          has_promotion: boolean | null
          has_rupture: boolean | null
          id: string
          observations: string | null
          our_facings: number | null
          photo_type: string
          photo_url: string
          processed_at: string | null
          quality_score: number | null
          requires_action: boolean | null
          section: string | null
          store_id: string | null
          supervisor_id: string | null
          thumbnail_url: string | null
          total_facings: number | null
          upload_date: string | null
          vendedor_id: string | null
          visit_id: string | null
        }
        Insert: {
          action_items?: string[] | null
          ai_analysis?: Json | null
          ai_processed?: boolean | null
          approved?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          competitor_facings?: number | null
          compliance_score?: number | null
          detected_brands?: Json | null
          detected_prices?: Json | null
          detected_products?: Json | null
          has_promotion?: boolean | null
          has_rupture?: boolean | null
          id?: string
          observations?: string | null
          our_facings?: number | null
          photo_type: string
          photo_url: string
          processed_at?: string | null
          quality_score?: number | null
          requires_action?: boolean | null
          section?: string | null
          store_id?: string | null
          supervisor_id?: string | null
          thumbnail_url?: string | null
          total_facings?: number | null
          upload_date?: string | null
          vendedor_id?: string | null
          visit_id?: string | null
        }
        Update: {
          action_items?: string[] | null
          ai_analysis?: Json | null
          ai_processed?: boolean | null
          approved?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          competitor_facings?: number | null
          compliance_score?: number | null
          detected_brands?: Json | null
          detected_prices?: Json | null
          detected_products?: Json | null
          has_promotion?: boolean | null
          has_rupture?: boolean | null
          id?: string
          observations?: string | null
          our_facings?: number | null
          photo_type?: string
          photo_url?: string
          processed_at?: string | null
          quality_score?: number | null
          requires_action?: boolean | null
          section?: string | null
          store_id?: string | null
          supervisor_id?: string | null
          thumbnail_url?: string | null
          total_facings?: number | null
          upload_date?: string | null
          vendedor_id?: string | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "photos_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "mv_trade_performance"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "photos_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_with_sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "photos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "photos_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_contas_auditoria: {
        Row: {
          campo_alterado: string
          conta_codigo: string | null
          conta_id: string | null
          conta_nome: string | null
          created_at: string
          id: string
          ip_address: string | null
          justificativa: string | null
          tipo_alteracao: string
          usuario_email: string | null
          usuario_id: string
          usuario_nome: string | null
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          campo_alterado: string
          conta_codigo?: string | null
          conta_id?: string | null
          conta_nome?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          justificativa?: string | null
          tipo_alteracao: string
          usuario_email?: string | null
          usuario_id: string
          usuario_nome?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          campo_alterado?: string
          conta_codigo?: string | null
          conta_id?: string | null
          conta_nome?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          justificativa?: string | null
          tipo_alteracao?: string
          usuario_email?: string | null
          usuario_id?: string
          usuario_nome?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plano_contas_auditoria_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "trade_chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      planos: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          limites: Json
          nome: string
          preco: number
          stripe_price_id: string | null
          stripe_product_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          limites?: Json
          nome: string
          preco?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          limites?: Json
          nome?: string
          preco?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      portal_cliente_logs: {
        Row: {
          acao: string
          created_at: string | null
          detalhes: Json | null
          id: string
          ip_address: string | null
          user_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string | null
          detalhes?: Json | null
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string | null
          detalhes?: Json | null
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      product_comparisons: {
        Row: {
          comparison_notes: string | null
          competitor_product_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          our_product_id: string | null
          similarity_score: number | null
        }
        Insert: {
          comparison_notes?: string | null
          competitor_product_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          our_product_id?: string | null
          similarity_score?: number | null
        }
        Update: {
          comparison_notes?: string | null
          competitor_product_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          our_product_id?: string | null
          similarity_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_comparisons_competitor_product_id_fkey"
            columns: ["competitor_product_id"]
            isOneToOne: false
            referencedRelation: "competitor_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_comparisons_our_product_id_fkey"
            columns: ["our_product_id"]
            isOneToOne: false
            referencedRelation: "our_products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean | null
          barcode: string | null
          brand: string | null
          category: string | null
          cost: number | null
          created_at: string | null
          ean13: string | null
          id: string
          ideal_position: string | null
          image_url: string | null
          is_focus: boolean | null
          is_our_product: boolean | null
          launch_date: string | null
          line: string | null
          manufacturer: string | null
          margin_percentage: number | null
          minimum_facings: number | null
          name: string
          price_reference: number | null
          size: string | null
          sku: string
          subcategory: string | null
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          barcode?: string | null
          brand?: string | null
          category?: string | null
          cost?: number | null
          created_at?: string | null
          ean13?: string | null
          id?: string
          ideal_position?: string | null
          image_url?: string | null
          is_focus?: boolean | null
          is_our_product?: boolean | null
          launch_date?: string | null
          line?: string | null
          manufacturer?: string | null
          margin_percentage?: number | null
          minimum_facings?: number | null
          name: string
          price_reference?: number | null
          size?: string | null
          sku: string
          subcategory?: string | null
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          barcode?: string | null
          brand?: string | null
          category?: string | null
          cost?: number | null
          created_at?: string | null
          ean13?: string | null
          id?: string
          ideal_position?: string | null
          image_url?: string | null
          is_focus?: boolean | null
          is_our_product?: boolean | null
          launch_date?: string | null
          line?: string | null
          manufacturer?: string | null
          margin_percentage?: number | null
          minimum_facings?: number | null
          name?: string
          price_reference?: number | null
          size?: string | null
          sku?: string
          subcategory?: string | null
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          aprovado: boolean
          created_at: string | null
          departamento_id: string | null
          email: string
          gerente_id: string | null
          id: string
          nome: string
          status: string
          supervisor_id: string | null
          updated_at: string | null
        }
        Insert: {
          aprovado?: boolean
          created_at?: string | null
          departamento_id?: string | null
          email: string
          gerente_id?: string | null
          id: string
          nome: string
          status?: string
          supervisor_id?: string | null
          updated_at?: string | null
        }
        Update: {
          aprovado?: boolean
          created_at?: string | null
          departamento_id?: string | null
          email?: string
          gerente_id?: string | null
          id?: string
          nome?: string
          status?: string
          supervisor_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "mv_analise_departamentos"
            referencedColumns: ["departamento_id"]
          },
          {
            foreignKeyName: "profiles_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "profiles_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      promotion_execution: {
        Row: {
          checked_at: string | null
          checked_by: string | null
          compliance_score: number | null
          corrective_actions: string[] | null
          estimated_sales: number | null
          id: string
          is_active: boolean | null
          is_compliant: boolean | null
          issues_found: string[] | null
          materials_missing: string[] | null
          materials_present: Json | null
          observations: string | null
          photo_evidence: string[] | null
          positioning_correct: boolean | null
          price_correct: boolean | null
          promotion_id: string | null
          stock_sufficient: boolean | null
          store_id: string | null
          supervisor_id: string | null
          vendedor_id: string | null
          visibility_adequate: boolean | null
          visit_id: string | null
        }
        Insert: {
          checked_at?: string | null
          checked_by?: string | null
          compliance_score?: number | null
          corrective_actions?: string[] | null
          estimated_sales?: number | null
          id?: string
          is_active?: boolean | null
          is_compliant?: boolean | null
          issues_found?: string[] | null
          materials_missing?: string[] | null
          materials_present?: Json | null
          observations?: string | null
          photo_evidence?: string[] | null
          positioning_correct?: boolean | null
          price_correct?: boolean | null
          promotion_id?: string | null
          stock_sufficient?: boolean | null
          store_id?: string | null
          supervisor_id?: string | null
          vendedor_id?: string | null
          visibility_adequate?: boolean | null
          visit_id?: string | null
        }
        Update: {
          checked_at?: string | null
          checked_by?: string | null
          compliance_score?: number | null
          corrective_actions?: string[] | null
          estimated_sales?: number | null
          id?: string
          is_active?: boolean | null
          is_compliant?: boolean | null
          issues_found?: string[] | null
          materials_missing?: string[] | null
          materials_present?: Json | null
          observations?: string | null
          photo_evidence?: string[] | null
          positioning_correct?: boolean | null
          price_correct?: boolean | null
          promotion_id?: string | null
          stock_sufficient?: boolean | null
          store_id?: string | null
          supervisor_id?: string | null
          vendedor_id?: string | null
          visibility_adequate?: boolean | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promotion_execution_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_execution_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "mv_trade_performance"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "promotion_execution_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_execution_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_with_sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_execution_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_execution_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_execution_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "promotion_execution_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_execution_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_execution_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "promotion_execution_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          budget: number | null
          checklist: Json | null
          code: string
          created_at: string | null
          created_by: string | null
          description: string | null
          discount_percentage: number | null
          discount_value: number | null
          end_date: string
          id: string
          materials_needed: string[] | null
          mechanics: string | null
          name: string
          performance_summary: Json | null
          product_ids: string[] | null
          promotion_type: string | null
          start_date: string
          status: string | null
          store_ids: string[] | null
          target_value: number | null
          updated_at: string | null
        }
        Insert: {
          budget?: number | null
          checklist?: Json | null
          code: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          discount_percentage?: number | null
          discount_value?: number | null
          end_date: string
          id?: string
          materials_needed?: string[] | null
          mechanics?: string | null
          name: string
          performance_summary?: Json | null
          product_ids?: string[] | null
          promotion_type?: string | null
          start_date: string
          status?: string | null
          store_ids?: string[] | null
          target_value?: number | null
          updated_at?: string | null
        }
        Update: {
          budget?: number | null
          checklist?: Json | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          discount_percentage?: number | null
          discount_value?: number | null
          end_date?: string
          id?: string
          materials_needed?: string[] | null
          mechanics?: string | null
          name?: string
          performance_summary?: Json | null
          product_ids?: string[] | null
          promotion_type?: string | null
          start_date?: string
          status?: string | null
          store_ids?: string[] | null
          target_value?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      prospects: {
        Row: {
          bairro: string | null
          capital_social: number | null
          categoria: Database["public"]["Enums"]["client_category"] | null
          cep: string | null
          cnae_codigo: string | null
          cnae_principal: string | null
          cnae_secundarios: string[] | null
          cnpj: string | null
          cnpj_raiz: string | null
          contato_principal: string | null
          created_at: string | null
          data_abertura: string | null
          demais_emails: string | null
          demais_telefones: string | null
          dominio: string | null
          email: string | null
          endereco: string | null
          faixa_faturamento: string | null
          faixa_funcionarios: string | null
          faixa_score_contactability: string | null
          faixa_score_propensao: string | null
          id: string
          importado_planilha: boolean | null
          logradouro: string | null
          municipio: string | null
          municipio_id: string | null
          natureza_juridica: string | null
          nivel_atividade: string | null
          nome_empresa: string
          nome_fantasia: string | null
          numero: string | null
          observacoes: string | null
          perfil_facebook: string | null
          perfil_instagram: string | null
          perfil_linkedin: string | null
          perfil_twitter: string | null
          porte_empresa: string | null
          proxima_acao: string | null
          score_propensao: number | null
          segmento: string | null
          situacao: string | null
          situacao_cadastral: string | null
          socios: Json | null
          status: Database["public"]["Enums"]["prospect_status"]
          subdistrito: string | null
          supervisor_id: string | null
          telefone: string | null
          tendencia_crescimento: string | null
          territorio: string | null
          tipo_entidade: string | null
          tipo_estabelecimento: string | null
          tipo_logradouro: string | null
          total_filiais: number | null
          total_funcionarios: number | null
          trm: string | null
          uf: string | null
          ultimo_contato: string | null
          updated_at: string | null
          url_company_page: string | null
          variacao_score_propensao: number | null
          vendedor_id: string | null
          zona: Database["public"]["Enums"]["zona_geografica"] | null
        }
        Insert: {
          bairro?: string | null
          capital_social?: number | null
          categoria?: Database["public"]["Enums"]["client_category"] | null
          cep?: string | null
          cnae_codigo?: string | null
          cnae_principal?: string | null
          cnae_secundarios?: string[] | null
          cnpj?: string | null
          cnpj_raiz?: string | null
          contato_principal?: string | null
          created_at?: string | null
          data_abertura?: string | null
          demais_emails?: string | null
          demais_telefones?: string | null
          dominio?: string | null
          email?: string | null
          endereco?: string | null
          faixa_faturamento?: string | null
          faixa_funcionarios?: string | null
          faixa_score_contactability?: string | null
          faixa_score_propensao?: string | null
          id: string
          importado_planilha?: boolean | null
          logradouro?: string | null
          municipio?: string | null
          municipio_id?: string | null
          natureza_juridica?: string | null
          nivel_atividade?: string | null
          nome_empresa: string
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          perfil_facebook?: string | null
          perfil_instagram?: string | null
          perfil_linkedin?: string | null
          perfil_twitter?: string | null
          porte_empresa?: string | null
          proxima_acao?: string | null
          score_propensao?: number | null
          segmento?: string | null
          situacao?: string | null
          situacao_cadastral?: string | null
          socios?: Json | null
          status?: Database["public"]["Enums"]["prospect_status"]
          subdistrito?: string | null
          supervisor_id?: string | null
          telefone?: string | null
          tendencia_crescimento?: string | null
          territorio?: string | null
          tipo_entidade?: string | null
          tipo_estabelecimento?: string | null
          tipo_logradouro?: string | null
          total_filiais?: number | null
          total_funcionarios?: number | null
          trm?: string | null
          uf?: string | null
          ultimo_contato?: string | null
          updated_at?: string | null
          url_company_page?: string | null
          variacao_score_propensao?: number | null
          vendedor_id?: string | null
          zona?: Database["public"]["Enums"]["zona_geografica"] | null
        }
        Update: {
          bairro?: string | null
          capital_social?: number | null
          categoria?: Database["public"]["Enums"]["client_category"] | null
          cep?: string | null
          cnae_codigo?: string | null
          cnae_principal?: string | null
          cnae_secundarios?: string[] | null
          cnpj?: string | null
          cnpj_raiz?: string | null
          contato_principal?: string | null
          created_at?: string | null
          data_abertura?: string | null
          demais_emails?: string | null
          demais_telefones?: string | null
          dominio?: string | null
          email?: string | null
          endereco?: string | null
          faixa_faturamento?: string | null
          faixa_funcionarios?: string | null
          faixa_score_contactability?: string | null
          faixa_score_propensao?: string | null
          id?: string
          importado_planilha?: boolean | null
          logradouro?: string | null
          municipio?: string | null
          municipio_id?: string | null
          natureza_juridica?: string | null
          nivel_atividade?: string | null
          nome_empresa?: string
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          perfil_facebook?: string | null
          perfil_instagram?: string | null
          perfil_linkedin?: string | null
          perfil_twitter?: string | null
          porte_empresa?: string | null
          proxima_acao?: string | null
          score_propensao?: number | null
          segmento?: string | null
          situacao?: string | null
          situacao_cadastral?: string | null
          socios?: Json | null
          status?: Database["public"]["Enums"]["prospect_status"]
          subdistrito?: string | null
          supervisor_id?: string | null
          telefone?: string | null
          tendencia_crescimento?: string | null
          territorio?: string | null
          tipo_entidade?: string | null
          tipo_estabelecimento?: string | null
          tipo_logradouro?: string | null
          total_filiais?: number | null
          total_funcionarios?: number | null
          trm?: string | null
          uf?: string | null
          ultimo_contato?: string | null
          updated_at?: string | null
          url_company_page?: string | null
          variacao_score_propensao?: number | null
          vendedor_id?: string | null
          zona?: Database["public"]["Enums"]["zona_geografica"] | null
        }
        Relationships: [
          {
            foreignKeyName: "prospects_municipio_id_fkey"
            columns: ["municipio_id"]
            isOneToOne: false
            referencedRelation: "municipios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "prospects_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      qa_chat_sessions: {
        Row: {
          created_at: string | null
          id: string
          messages: Json | null
          tests_failed: number | null
          tests_passed: number | null
          tests_run: number | null
          title: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          messages?: Json | null
          tests_failed?: number | null
          tests_passed?: number | null
          tests_run?: number | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          messages?: Json | null
          tests_failed?: number | null
          tests_passed?: number | null
          tests_run?: number | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      qa_issues: {
        Row: {
          auto_fixable: boolean | null
          category: string
          created_at: string | null
          description: string
          fixed_at: string | null
          fixed_by: string | null
          id: string
          severity: string
          status: string | null
          suggested_fix: string | null
        }
        Insert: {
          auto_fixable?: boolean | null
          category: string
          created_at?: string | null
          description: string
          fixed_at?: string | null
          fixed_by?: string | null
          id?: string
          severity: string
          status?: string | null
          suggested_fix?: string | null
        }
        Update: {
          auto_fixable?: boolean | null
          category?: string
          created_at?: string | null
          description?: string
          fixed_at?: string | null
          fixed_by?: string | null
          id?: string
          severity?: string
          status?: string | null
          suggested_fix?: string | null
        }
        Relationships: []
      }
      qa_test_results: {
        Row: {
          created_at: string | null
          details: Json | null
          duration_ms: number | null
          id: string
          message: string | null
          session_id: string | null
          status: string
          target: string
          test_type: string
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          duration_ms?: number | null
          id?: string
          message?: string | null
          session_id?: string | null
          status: string
          target: string
          test_type: string
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          duration_ms?: number | null
          id?: string
          message?: string | null
          session_id?: string | null
          status?: string
          target?: string
          test_type?: string
        }
        Relationships: []
      }
      regras_cobranca: {
        Row: {
          ativo: boolean | null
          canal: string
          created_at: string | null
          created_by: string | null
          descricao: string | null
          dias_atraso_max: number | null
          dias_atraso_min: number
          dias_semana: number[] | null
          horario_fim: string | null
          horario_inicio: string | null
          id: string
          intervalo_dias: number | null
          max_tentativas: number | null
          nome: string
          prioridade: number | null
          score_max: number | null
          score_min: number | null
          template_id: string | null
          updated_at: string | null
          valor_max: number | null
          valor_min: number | null
        }
        Insert: {
          ativo?: boolean | null
          canal: string
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          dias_atraso_max?: number | null
          dias_atraso_min: number
          dias_semana?: number[] | null
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string
          intervalo_dias?: number | null
          max_tentativas?: number | null
          nome: string
          prioridade?: number | null
          score_max?: number | null
          score_min?: number | null
          template_id?: string | null
          updated_at?: string | null
          valor_max?: number | null
          valor_min?: number | null
        }
        Update: {
          ativo?: boolean | null
          canal?: string
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          dias_atraso_max?: number | null
          dias_atraso_min?: number
          dias_semana?: number[] | null
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string
          intervalo_dias?: number | null
          max_tentativas?: number | null
          nome?: string
          prioridade?: number | null
          score_max?: number | null
          score_min?: number | null
          template_id?: string | null
          updated_at?: string | null
          valor_max?: number | null
          valor_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "regras_cobranca_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates_cobranca"
            referencedColumns: ["id"]
          },
        ]
      }
      report_history: {
        Row: {
          file_url: string | null
          filters: Json | null
          generated_at: string | null
          id: string
          report_type: string
          scheduled_report_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          file_url?: string | null
          filters?: Json | null
          generated_at?: string | null
          id?: string
          report_type: string
          scheduled_report_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          file_url?: string | null
          filters?: Json | null
          generated_at?: string | null
          id?: string
          report_type?: string
          scheduled_report_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_history_scheduled_report_id_fkey"
            columns: ["scheduled_report_id"]
            isOneToOne: false
            referencedRelation: "scheduled_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      revisao_eventos: {
        Row: {
          concluido: boolean | null
          created_at: string
          created_by: string | null
          data_evento: string
          data_lembrete: string | null
          descricao: string | null
          id: string
          revisao_id: string
          tipo_evento: string
          titulo: string
          valor_referencia: number | null
        }
        Insert: {
          concluido?: boolean | null
          created_at?: string
          created_by?: string | null
          data_evento?: string
          data_lembrete?: string | null
          descricao?: string | null
          id?: string
          revisao_id: string
          tipo_evento?: string
          titulo: string
          valor_referencia?: number | null
        }
        Update: {
          concluido?: boolean | null
          created_at?: string
          created_by?: string | null
          data_evento?: string
          data_lembrete?: string | null
          descricao?: string | null
          id?: string
          revisao_id?: string
          tipo_evento?: string
          titulo?: string
          valor_referencia?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "revisao_eventos_revisao_id_fkey"
            columns: ["revisao_id"]
            isOneToOne: false
            referencedRelation: "contas_pagar_revisao"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissoes_modulos: {
        Row: {
          created_at: string | null
          id: string
          modulo_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string | null
          id?: string
          modulo_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string | null
          id?: string
          modulo_id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissoes_modulos_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modulos_sistema"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissoes_telas: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tela_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tela_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tela_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissoes_telas_tela_id_fkey"
            columns: ["tela_id"]
            isOneToOne: false
            referencedRelation: "telas_sistema"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          actual_distance_km: number | null
          actual_duration_minutes: number | null
          created_at: string | null
          date: string
          end_location: Json | null
          estimated_distance_km: number | null
          estimated_duration_minutes: number | null
          id: string
          name: string
          start_location: Json | null
          status: string | null
          store_ids: string[] | null
          stores_completed: number | null
          user_id: string | null
        }
        Insert: {
          actual_distance_km?: number | null
          actual_duration_minutes?: number | null
          created_at?: string | null
          date: string
          end_location?: Json | null
          estimated_distance_km?: number | null
          estimated_duration_minutes?: number | null
          id?: string
          name: string
          start_location?: Json | null
          status?: string | null
          store_ids?: string[] | null
          stores_completed?: number | null
          user_id?: string | null
        }
        Update: {
          actual_distance_km?: number | null
          actual_duration_minutes?: number | null
          created_at?: string | null
          date?: string
          end_location?: Json | null
          estimated_distance_km?: number | null
          estimated_duration_minutes?: number | null
          id?: string
          name?: string
          start_location?: Json | null
          status?: string | null
          store_ids?: string[] | null
          stores_completed?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          created_at: string | null
          discount_percentage: number | null
          id: string
          notes: string | null
          product_code: string | null
          product_name: string
          quantity: number
          sale_id: string
          total_value: number
          unit_of_measure: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          discount_percentage?: number | null
          id?: string
          notes?: string | null
          product_code?: string | null
          product_name: string
          quantity: number
          sale_id: string
          total_value: number
          unit_of_measure?: string | null
          unit_price: number
        }
        Update: {
          created_at?: string | null
          discount_percentage?: number | null
          id?: string
          notes?: string | null
          product_code?: string | null
          product_name?: string
          quantity?: number
          sale_id?: string
          total_value?: number
          unit_of_measure?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          campaign_id: string | null
          converted_from_prospect: boolean | null
          created_at: string | null
          created_by: string | null
          delivery_date: string | null
          discount_value: number | null
          id: string
          net_value: number
          notes: string | null
          payment_method: string | null
          payment_terms: string | null
          prospect_id: string | null
          sale_code: string
          sale_date: string
          salesperson_id: string | null
          status: string | null
          store_id: string | null
          supervisor_id: string | null
          total_value: number
          updated_at: string | null
          vendedor_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          campaign_id?: string | null
          converted_from_prospect?: boolean | null
          created_at?: string | null
          created_by?: string | null
          delivery_date?: string | null
          discount_value?: number | null
          id?: string
          net_value: number
          notes?: string | null
          payment_method?: string | null
          payment_terms?: string | null
          prospect_id?: string | null
          sale_code: string
          sale_date: string
          salesperson_id?: string | null
          status?: string | null
          store_id?: string | null
          supervisor_id?: string | null
          total_value: number
          updated_at?: string | null
          vendedor_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          campaign_id?: string | null
          converted_from_prospect?: boolean | null
          created_at?: string | null
          created_by?: string | null
          delivery_date?: string | null
          discount_value?: number | null
          id?: string
          net_value?: number
          notes?: string | null
          payment_method?: string | null
          payment_terms?: string | null
          prospect_id?: string | null
          sale_code?: string
          sale_date?: string
          salesperson_id?: string | null
          status?: string | null
          store_id?: string | null
          supervisor_id?: string | null
          total_value?: number
          updated_at?: string | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "trade_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "mv_trade_performance"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "sales_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_with_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_reports: {
        Row: {
          active: boolean | null
          created_at: string | null
          filters: Json | null
          frequency: string
          id: string
          last_sent_at: string | null
          recipient_emails: string[] | null
          report_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          filters?: Json | null
          frequency: string
          id?: string
          last_sent_at?: string | null
          recipient_emails?: string[] | null
          report_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          filters?: Json | null
          frequency?: string
          id?: string
          last_sent_at?: string | null
          recipient_emails?: string[] | null
          report_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sensitive_access_log: {
        Row: {
          accessed_at: string | null
          action: string
          id: string
          ip_address: unknown
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          accessed_at?: string | null
          action: string
          id?: string
          ip_address?: unknown
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          accessed_at?: string | null
          action?: string
          id?: string
          ip_address?: unknown
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      shelf_measurements: {
        Row: {
          competitors_facings: number | null
          competitors_width_cm: number | null
          created_at: string | null
          created_by: string | null
          facing_share_percentage: number | null
          id: string
          measurement_date: string
          observations: string | null
          our_brands_facings: number | null
          our_brands_width_cm: number | null
          photo_ids: string[] | null
          shelf_section: string | null
          shelf_share_percentage: number | null
          store_id: string
          supervisor_id: string | null
          total_facings: number | null
          total_shelf_height_cm: number | null
          total_shelf_width_cm: number
          updated_at: string | null
          vendedor_id: string | null
          visit_id: string | null
        }
        Insert: {
          competitors_facings?: number | null
          competitors_width_cm?: number | null
          created_at?: string | null
          created_by?: string | null
          facing_share_percentage?: number | null
          id?: string
          measurement_date?: string
          observations?: string | null
          our_brands_facings?: number | null
          our_brands_width_cm?: number | null
          photo_ids?: string[] | null
          shelf_section?: string | null
          shelf_share_percentage?: number | null
          store_id: string
          supervisor_id?: string | null
          total_facings?: number | null
          total_shelf_height_cm?: number | null
          total_shelf_width_cm: number
          updated_at?: string | null
          vendedor_id?: string | null
          visit_id?: string | null
        }
        Update: {
          competitors_facings?: number | null
          competitors_width_cm?: number | null
          created_at?: string | null
          created_by?: string | null
          facing_share_percentage?: number | null
          id?: string
          measurement_date?: string
          observations?: string | null
          our_brands_facings?: number | null
          our_brands_width_cm?: number | null
          photo_ids?: string[] | null
          shelf_section?: string | null
          shelf_share_percentage?: number | null
          store_id?: string
          supervisor_id?: string | null
          total_facings?: number | null
          total_shelf_height_cm?: number | null
          total_shelf_width_cm?: number
          updated_at?: string | null
          vendedor_id?: string | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shelf_measurements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "mv_trade_performance"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "shelf_measurements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shelf_measurements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_with_sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shelf_measurements_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shelf_measurements_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shelf_measurements_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "shelf_measurements_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shelf_measurements_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shelf_measurements_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "shelf_measurements_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      shelf_share: {
        Row: {
          competitor_nearby: boolean | null
          compliance_items: Json | null
          expiry_check: boolean | null
          has_price_tag: boolean | null
          id: string
          in_stock: boolean | null
          near_expiry: boolean | null
          photo_id: string | null
          position_quality: number | null
          price_found: number | null
          price_tag_correct: boolean | null
          price_vs_reference: number | null
          product_condition: string | null
          product_id: string | null
          promotion_active: boolean | null
          promotion_mechanics: string | null
          promotion_type: string | null
          quantity_facings: number | null
          recorded_at: string | null
          shelf_position: string | null
          stock_level: string | null
          store_id: string | null
          supervisor_id: string | null
          vendedor_id: string | null
          visibility_score: number | null
          visit_id: string | null
        }
        Insert: {
          competitor_nearby?: boolean | null
          compliance_items?: Json | null
          expiry_check?: boolean | null
          has_price_tag?: boolean | null
          id?: string
          in_stock?: boolean | null
          near_expiry?: boolean | null
          photo_id?: string | null
          position_quality?: number | null
          price_found?: number | null
          price_tag_correct?: boolean | null
          price_vs_reference?: number | null
          product_condition?: string | null
          product_id?: string | null
          promotion_active?: boolean | null
          promotion_mechanics?: string | null
          promotion_type?: string | null
          quantity_facings?: number | null
          recorded_at?: string | null
          shelf_position?: string | null
          stock_level?: string | null
          store_id?: string | null
          supervisor_id?: string | null
          vendedor_id?: string | null
          visibility_score?: number | null
          visit_id?: string | null
        }
        Update: {
          competitor_nearby?: boolean | null
          compliance_items?: Json | null
          expiry_check?: boolean | null
          has_price_tag?: boolean | null
          id?: string
          in_stock?: boolean | null
          near_expiry?: boolean | null
          photo_id?: string | null
          position_quality?: number | null
          price_found?: number | null
          price_tag_correct?: boolean | null
          price_vs_reference?: number | null
          product_condition?: string | null
          product_id?: string | null
          promotion_active?: boolean | null
          promotion_mechanics?: string | null
          promotion_type?: string | null
          quantity_facings?: number | null
          recorded_at?: string | null
          shelf_position?: string | null
          stock_level?: string | null
          store_id?: string | null
          supervisor_id?: string | null
          vendedor_id?: string | null
          visibility_score?: number | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shelf_share_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shelf_share_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shelf_share_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "mv_trade_performance"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "shelf_share_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shelf_share_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_with_sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shelf_share_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shelf_share_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shelf_share_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "shelf_share_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shelf_share_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shelf_share_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "shelf_share_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      shelf_share_history: {
        Row: {
          competitor_facings: number | null
          competitor_width_cm: number | null
          created_at: string | null
          created_by: string | null
          facing_share_percentage: number | null
          id: string
          measurement_date: string
          notes: string | null
          our_facings: number | null
          our_width_cm: number | null
          products_count: number | null
          shelf_share_percentage: number | null
          store_id: string
          total_facings: number | null
          total_width_cm: number | null
        }
        Insert: {
          competitor_facings?: number | null
          competitor_width_cm?: number | null
          created_at?: string | null
          created_by?: string | null
          facing_share_percentage?: number | null
          id?: string
          measurement_date: string
          notes?: string | null
          our_facings?: number | null
          our_width_cm?: number | null
          products_count?: number | null
          shelf_share_percentage?: number | null
          store_id: string
          total_facings?: number | null
          total_width_cm?: number | null
        }
        Update: {
          competitor_facings?: number | null
          competitor_width_cm?: number | null
          created_at?: string | null
          created_by?: string | null
          facing_share_percentage?: number | null
          id?: string
          measurement_date?: string
          notes?: string | null
          our_facings?: number | null
          our_width_cm?: number | null
          products_count?: number | null
          shelf_share_percentage?: number | null
          store_id?: string
          total_facings?: number | null
          total_width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shelf_share_history_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "mv_trade_performance"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "shelf_share_history_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shelf_share_history_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_with_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      social_media_accounts: {
        Row: {
          access_token: string | null
          account_group: string | null
          account_name: string | null
          created_at: string
          error_message: string | null
          id: string
          last_sync_at: string | null
          platform: string
          region: string | null
          status: string | null
          updated_at: string
          user_id: string | null
          username: string
        }
        Insert: {
          access_token?: string | null
          account_group?: string | null
          account_name?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          last_sync_at?: string | null
          platform: string
          region?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string | null
          username: string
        }
        Update: {
          access_token?: string | null
          account_group?: string | null
          account_name?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          last_sync_at?: string | null
          platform?: string
          region?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string | null
          username?: string
        }
        Relationships: []
      }
      social_media_credentials: {
        Row: {
          access_token: string
          created_at: string | null
          expires_at: string | null
          id: string
          platform: string
          refresh_token: string | null
          scope: string | null
          token_type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          platform: string
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          platform?: string
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      social_media_metrics_history: {
        Row: {
          account_id: string | null
          comments: number | null
          created_at: string
          engagement: number | null
          followers: number | null
          id: string
          likes: number | null
          platform: string
          posts: number | null
          reach: number | null
          sentiment_label: string | null
          sentiment_score: number | null
          shares: number | null
          username: string
        }
        Insert: {
          account_id?: string | null
          comments?: number | null
          created_at?: string
          engagement?: number | null
          followers?: number | null
          id?: string
          likes?: number | null
          platform: string
          posts?: number | null
          reach?: number | null
          sentiment_label?: string | null
          sentiment_score?: number | null
          shares?: number | null
          username: string
        }
        Update: {
          account_id?: string | null
          comments?: number | null
          created_at?: string
          engagement?: number | null
          followers?: number | null
          id?: string
          likes?: number | null
          platform?: string
          posts?: number | null
          reach?: number | null
          sentiment_label?: string | null
          sentiment_score?: number | null
          shares?: number | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_media_metrics_history_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "social_media_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_media_posts: {
        Row: {
          account_ids: string[]
          content: string
          created_at: string | null
          error_message: string | null
          id: string
          media_urls: string[] | null
          post_ids: Json | null
          published_at: string | null
          scheduled_at: string
          status: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          account_ids: string[]
          content: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          media_urls?: string[] | null
          post_ids?: Json | null
          published_at?: string | null
          scheduled_at: string
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          account_ids?: string[]
          content?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          media_urls?: string[] | null
          post_ids?: Json | null
          published_at?: string | null
          scheduled_at?: string
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      store_categories: {
        Row: {
          active: boolean | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      store_chains: {
        Row: {
          active: boolean | null
          cnpj: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          notes: string | null
        }
        Insert: {
          active?: boolean | null
          cnpj?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
        }
        Update: {
          active?: boolean | null
          cnpj?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
        }
        Relationships: []
      }
      store_products: {
        Row: {
          brand: string | null
          category: string | null
          created_at: string | null
          current_stock: number | null
          id: string
          max_stock: number | null
          min_stock: number | null
          product_code: string | null
          product_name: string
          store_id: string
          supervisor_id: string | null
          unit_price: number | null
          updated_at: string | null
          vendedor_id: string | null
        }
        Insert: {
          brand?: string | null
          category?: string | null
          created_at?: string | null
          current_stock?: number | null
          id?: string
          max_stock?: number | null
          min_stock?: number | null
          product_code?: string | null
          product_name: string
          store_id: string
          supervisor_id?: string | null
          unit_price?: number | null
          updated_at?: string | null
          vendedor_id?: string | null
        }
        Update: {
          brand?: string | null
          category?: string | null
          created_at?: string | null
          current_stock?: number | null
          id?: string
          max_stock?: number | null
          min_stock?: number | null
          product_code?: string | null
          product_name?: string
          store_id?: string
          supervisor_id?: string | null
          unit_price?: number | null
          updated_at?: string | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "mv_trade_performance"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "store_products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_with_sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_products_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_products_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_products_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "store_products_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_products_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_products_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      store_sellers: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_principal: boolean | null
          store_id: string
          vendedor_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_principal?: boolean | null
          store_id: string
          vendedor_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_principal?: boolean | null
          store_id?: string
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_sellers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "mv_trade_performance"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "store_sellers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_sellers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_with_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      store_sellout_items: {
        Row: {
          created_at: string | null
          id: string
          product_id: string
          quantity: number
          sellout_batch_id: string
          store_id: string
          total_amount: number | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          quantity: number
          sellout_batch_id: string
          store_id: string
          total_amount?: number | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          quantity?: number
          sellout_batch_id?: string
          store_id?: string
          total_amount?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "store_sellout_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_sellout_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "mv_trade_performance"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "store_sellout_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_sellout_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_with_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      store_sellouts: {
        Row: {
          batch_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          order_number: string | null
          product_id: string
          quantity: number
          sale_date: string
          store_id: string
          total_amount: number | null
          unit_price: number | null
          vendedor_id: string | null
        }
        Insert: {
          batch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          order_number?: string | null
          product_id: string
          quantity: number
          sale_date?: string
          store_id: string
          total_amount?: number | null
          unit_price?: number | null
          vendedor_id?: string | null
        }
        Update: {
          batch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          order_number?: string | null
          product_id?: string
          quantity?: number
          sale_date?: string
          store_id?: string
          total_amount?: number | null
          unit_price?: number | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_sellouts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_sellouts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "mv_trade_performance"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "store_sellouts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_sellouts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_with_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      store_stock_movements: {
        Row: {
          created_by: string | null
          id: string
          movement_date: string | null
          movement_type: string
          new_stock: number | null
          notes: string | null
          previous_stock: number | null
          product_id: string
          quantity: number
          reason: string | null
          store_id: string
        }
        Insert: {
          created_by?: string | null
          id?: string
          movement_date?: string | null
          movement_type: string
          new_stock?: number | null
          notes?: string | null
          previous_stock?: number | null
          product_id: string
          quantity: number
          reason?: string | null
          store_id: string
        }
        Update: {
          created_by?: string | null
          id?: string
          movement_date?: string | null
          movement_type?: string
          new_stock?: number | null
          notes?: string | null
          previous_stock?: number | null
          product_id?: string
          quantity?: number
          reason?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_stock_movements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "mv_trade_performance"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "store_stock_movements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_stock_movements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_with_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          category: string | null
          chain: string | null
          city: string | null
          cnpj: string | null
          code: string
          created_at: string | null
          created_by: string | null
          email: string | null
          id: string
          latitude: number | null
          longitude: number | null
          manager_name: string | null
          manager_phone: string | null
          monthly_revenue: number | null
          name: string
          notes: string | null
          phone: string | null
          priority: string | null
          size: string | null
          state: string | null
          status: string | null
          supervisor_id: string | null
          updated_at: string | null
          vendedor_id: string | null
          visit_frequency: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          category?: string | null
          chain?: string | null
          city?: string | null
          cnpj?: string | null
          code: string
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          manager_name?: string | null
          manager_phone?: string | null
          monthly_revenue?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          priority?: string | null
          size?: string | null
          state?: string | null
          status?: string | null
          supervisor_id?: string | null
          updated_at?: string | null
          vendedor_id?: string | null
          visit_frequency?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          category?: string | null
          chain?: string | null
          city?: string | null
          cnpj?: string | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          manager_name?: string | null
          manager_phone?: string | null
          monthly_revenue?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          priority?: string | null
          size?: string | null
          state?: string | null
          status?: string | null
          supervisor_id?: string | null
          updated_at?: string | null
          vendedor_id?: string | null
          visit_frequency?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      sync_chunks_log: {
        Row: {
          chunk_id: number
          created_at: string | null
          duracao_ms: number | null
          empresa_id: number | null
          entidade: string
          error_details: Json | null
          erros: number | null
          id: string
          registros_processados: number
          registros_recebidos: number
          status: string | null
          total_chunks: number | null
        }
        Insert: {
          chunk_id: number
          created_at?: string | null
          duracao_ms?: number | null
          empresa_id?: number | null
          entidade: string
          error_details?: Json | null
          erros?: number | null
          id?: string
          registros_processados: number
          registros_recebidos: number
          status?: string | null
          total_chunks?: number | null
        }
        Update: {
          chunk_id?: number
          created_at?: string | null
          duracao_ms?: number | null
          empresa_id?: number | null
          entidade?: string
          error_details?: Json | null
          erros?: number | null
          id?: string
          registros_processados?: number
          registros_recebidos?: number
          status?: string | null
          total_chunks?: number | null
        }
        Relationships: []
      }
      sync_chunks_tracking: {
        Row: {
          chunk_number: number
          completed_at: string | null
          created_at: string | null
          duration_ms: number | null
          entidade: string
          error_message: string | null
          id: string
          records_error: number | null
          records_in_chunk: number | null
          records_inserted: number | null
          records_processed: number | null
          records_skipped: number | null
          records_updated: number | null
          started_at: string | null
          status: string | null
          sync_id: string
          total_chunks: number | null
        }
        Insert: {
          chunk_number: number
          completed_at?: string | null
          created_at?: string | null
          duration_ms?: number | null
          entidade: string
          error_message?: string | null
          id?: string
          records_error?: number | null
          records_in_chunk?: number | null
          records_inserted?: number | null
          records_processed?: number | null
          records_skipped?: number | null
          records_updated?: number | null
          started_at?: string | null
          status?: string | null
          sync_id: string
          total_chunks?: number | null
        }
        Update: {
          chunk_number?: number
          completed_at?: string | null
          created_at?: string | null
          duration_ms?: number | null
          entidade?: string
          error_message?: string | null
          id?: string
          records_error?: number | null
          records_in_chunk?: number | null
          records_inserted?: number | null
          records_processed?: number | null
          records_skipped?: number | null
          records_updated?: number | null
          started_at?: string | null
          status?: string | null
          sync_id?: string
          total_chunks?: number | null
        }
        Relationships: []
      }
      sync_control: {
        Row: {
          created_at: string | null
          duracao_ms: number | null
          empresa_id: number | null
          entidade: string
          erro_mensagem: string | null
          id: string
          registros_atualizados: number | null
          registros_ignorados: number | null
          registros_inseridos: number | null
          status: string | null
          total_registros: number | null
          ultima_sync: string | null
        }
        Insert: {
          created_at?: string | null
          duracao_ms?: number | null
          empresa_id?: number | null
          entidade: string
          erro_mensagem?: string | null
          id?: string
          registros_atualizados?: number | null
          registros_ignorados?: number | null
          registros_inseridos?: number | null
          status?: string | null
          total_registros?: number | null
          ultima_sync?: string | null
        }
        Update: {
          created_at?: string | null
          duracao_ms?: number | null
          empresa_id?: number | null
          entidade?: string
          erro_mensagem?: string | null
          id?: string
          registros_atualizados?: number | null
          registros_ignorados?: number | null
          registros_inseridos?: number | null
          status?: string | null
          total_registros?: number | null
          ultima_sync?: string | null
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          created_at: string | null
          detalhes: Json | null
          erro_mensagem: string | null
          id: string
          registros_processados: number | null
          status: string
          tipo: string
        }
        Insert: {
          created_at?: string | null
          detalhes?: Json | null
          erro_mensagem?: string | null
          id?: string
          registros_processados?: number | null
          status?: string
          tipo: string
        }
        Update: {
          created_at?: string | null
          detalhes?: Json | null
          erro_mensagem?: string | null
          id?: string
          registros_processados?: number | null
          status?: string
          tipo?: string
        }
        Relationships: []
      }
      sync_rate_limiter: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          locked_at: string | null
          request_id: string
          slot_key: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          locked_at?: string | null
          request_id: string
          slot_key: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          locked_at?: string | null
          request_id?: string
          slot_key?: string
        }
        Relationships: []
      }
      sync_sessions: {
        Row: {
          chunks_processados: number | null
          completed_at: string | null
          entidade: string
          id: string
          metadata: Json | null
          started_at: string | null
          status: string | null
          total_chunks: number | null
          total_esperado: number | null
          total_processado: number | null
        }
        Insert: {
          chunks_processados?: number | null
          completed_at?: string | null
          entidade: string
          id?: string
          metadata?: Json | null
          started_at?: string | null
          status?: string | null
          total_chunks?: number | null
          total_esperado?: number | null
          total_processado?: number | null
        }
        Update: {
          chunks_processados?: number | null
          completed_at?: string | null
          entidade?: string
          id?: string
          metadata?: Json | null
          started_at?: string | null
          status?: string | null
          total_chunks?: number | null
          total_esperado?: number | null
          total_processado?: number | null
        }
        Relationships: []
      }
      sync_tracking: {
        Row: {
          created_at: string | null
          duration_ms: number | null
          entidade: string
          error_message: string | null
          id: string
          last_sync: string | null
          last_sync_at: string
          metadata: Json | null
          records_inserted: number | null
          records_processed: number | null
          records_skipped: number | null
          records_updated: number | null
          status: string | null
          sync_name: string | null
          tipo_sync: string
          total_records: number | null
        }
        Insert: {
          created_at?: string | null
          duration_ms?: number | null
          entidade: string
          error_message?: string | null
          id?: string
          last_sync?: string | null
          last_sync_at?: string
          metadata?: Json | null
          records_inserted?: number | null
          records_processed?: number | null
          records_skipped?: number | null
          records_updated?: number | null
          status?: string | null
          sync_name?: string | null
          tipo_sync: string
          total_records?: number | null
        }
        Update: {
          created_at?: string | null
          duration_ms?: number | null
          entidade?: string
          error_message?: string | null
          id?: string
          last_sync?: string | null
          last_sync_at?: string
          metadata?: Json | null
          records_inserted?: number | null
          records_processed?: number | null
          records_skipped?: number | null
          records_updated?: number | null
          status?: string | null
          sync_name?: string | null
          tipo_sync?: string
          total_records?: number | null
        }
        Relationships: []
      }
      telas_sistema: {
        Row: {
          ativo: boolean | null
          codigo: string
          created_at: string | null
          descricao: string | null
          icone: string | null
          id: string
          modulo_codigo: string | null
          nome: string
          ordem: number | null
          rota: string
        }
        Insert: {
          ativo?: boolean | null
          codigo: string
          created_at?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          modulo_codigo?: string | null
          nome: string
          ordem?: number | null
          rota: string
        }
        Update: {
          ativo?: boolean | null
          codigo?: string
          created_at?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          modulo_codigo?: string | null
          nome?: string
          ordem?: number | null
          rota?: string
        }
        Relationships: [
          {
            foreignKeyName: "telas_sistema_modulo_codigo_fkey"
            columns: ["modulo_codigo"]
            isOneToOne: false
            referencedRelation: "modulos_sistema"
            referencedColumns: ["codigo"]
          },
        ]
      }
      templates_cobranca: {
        Row: {
          assunto: string | null
          ativo: boolean | null
          canal: string
          conteudo: string
          created_at: string | null
          created_by: string | null
          descricao: string | null
          id: string
          nome: string
          updated_at: string | null
          variaveis: Json | null
        }
        Insert: {
          assunto?: string | null
          ativo?: boolean | null
          canal: string
          conteudo: string
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string | null
          variaveis?: Json | null
        }
        Update: {
          assunto?: string | null
          ativo?: boolean | null
          canal?: string
          conteudo?: string
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string | null
          variaveis?: Json | null
        }
        Relationships: []
      }
      trade_action_points: {
        Row: {
          action_code: string
          action_name: string
          base_points: number
          created_at: string | null
          id: string
          is_active: boolean | null
          multiplier_conditions: Json | null
          updated_at: string | null
        }
        Insert: {
          action_code: string
          action_name: string
          base_points?: number
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          multiplier_conditions?: Json | null
          updated_at?: string | null
        }
        Update: {
          action_code?: string
          action_name?: string
          base_points?: number
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          multiplier_conditions?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      trade_approval_levels: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          level_number: number
          max_approval_amount: number
          role_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          level_number: number
          max_approval_amount: number
          role_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          level_number?: number
          max_approval_amount?: number
          role_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      trade_approvals: {
        Row: {
          amount: number
          approval_level: number
          approved_at: string | null
          approver_user_id: string
          comments: string | null
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
          status: string
        }
        Insert: {
          amount: number
          approval_level: number
          approved_at?: string | null
          approver_user_id: string
          comments?: string | null
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          status: string
        }
        Update: {
          amount?: number
          approval_level?: number
          approved_at?: string | null
          approver_user_id?: string
          comments?: string | null
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          status?: string
        }
        Relationships: []
      }
      trade_bank_accounts: {
        Row: {
          account_number: string
          account_type: string | null
          agency: string | null
          bank_name: string
          created_at: string | null
          created_by: string | null
          current_balance: number
          id: string
          initial_balance: number
          is_active: boolean | null
          notes: string | null
          store_id: string | null
          updated_at: string | null
        }
        Insert: {
          account_number: string
          account_type?: string | null
          agency?: string | null
          bank_name: string
          created_at?: string | null
          created_by?: string | null
          current_balance?: number
          id?: string
          initial_balance?: number
          is_active?: boolean | null
          notes?: string | null
          store_id?: string | null
          updated_at?: string | null
        }
        Update: {
          account_number?: string
          account_type?: string | null
          agency?: string | null
          bank_name?: string
          created_at?: string | null
          created_by?: string | null
          current_balance?: number
          id?: string
          initial_balance?: number
          is_active?: boolean | null
          notes?: string | null
          store_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_bank_accounts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "mv_trade_performance"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "trade_bank_accounts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_bank_accounts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_with_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_bank_daily_balances: {
        Row: {
          balance_date: string
          bank_account_id: string | null
          closing_balance: number
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          opening_balance: number
          total_credits: number
          total_debits: number
          updated_at: string
        }
        Insert: {
          balance_date: string
          bank_account_id?: string | null
          closing_balance?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          opening_balance?: number
          total_credits?: number
          total_debits?: number
          updated_at?: string
        }
        Update: {
          balance_date?: string
          bank_account_id?: string | null
          closing_balance?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          opening_balance?: number
          total_credits?: number
          total_debits?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_bank_daily_balances_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "trade_bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_bank_transactions: {
        Row: {
          amount: number
          balance_after: number
          bank_account_id: string
          created_at: string | null
          description: string
          financial_entry_id: string | null
          id: string
          investment_id: string | null
          reference_number: string | null
          transaction_date: string
          transaction_type: string
        }
        Insert: {
          amount: number
          balance_after: number
          bank_account_id: string
          created_at?: string | null
          description: string
          financial_entry_id?: string | null
          id?: string
          investment_id?: string | null
          reference_number?: string | null
          transaction_date: string
          transaction_type: string
        }
        Update: {
          amount?: number
          balance_after?: number
          bank_account_id?: string
          created_at?: string | null
          description?: string
          financial_entry_id?: string | null
          id?: string
          investment_id?: string | null
          reference_number?: string | null
          transaction_date?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_bank_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "trade_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_bank_transactions_financial_entry_id_fkey"
            columns: ["financial_entry_id"]
            isOneToOne: false
            referencedRelation: "trade_financial_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_bank_transactions_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "trade_investments"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_budget_reserves: {
        Row: {
          budget_id: string
          campaign_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          released_at: string | null
          reserved_amount: number
          reserved_at: string | null
          status: string | null
        }
        Insert: {
          budget_id: string
          campaign_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          released_at?: string | null
          reserved_amount: number
          reserved_at?: string | null
          status?: string | null
        }
        Update: {
          budget_id?: string
          campaign_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          released_at?: string | null
          reserved_amount?: number
          reserved_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_budget_reserves_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "trade_budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_budget_reserves_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "trade_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_budgets: {
        Row: {
          account_id: string | null
          allocated_amount: number | null
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          available_amount: number | null
          code: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          name: string
          notes: string | null
          period_end: string
          period_start: string
          rejection_reason: string | null
          requested_by: string | null
          reserved_amount: number | null
          spent_amount: number | null
          status: string | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          allocated_amount?: number | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          available_amount?: number | null
          code: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          notes?: string | null
          period_end: string
          period_start: string
          rejection_reason?: string | null
          requested_by?: string | null
          reserved_amount?: number | null
          spent_amount?: number | null
          status?: string | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          allocated_amount?: number | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          available_amount?: number | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          rejection_reason?: string | null
          requested_by?: string | null
          reserved_amount?: number | null
          spent_amount?: number | null
          status?: string | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_budgets_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "trade_chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_budgets_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_budgets_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_budgets_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "trade_budgets_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_budgets_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_budgets_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      trade_campaigns: {
        Row: {
          actual_cost: number | null
          actual_revenue: number | null
          budget_id: string | null
          campaign_type: string
          code: string
          created_at: string | null
          created_by: string | null
          description: string | null
          end_date: string
          estimated_cost: number
          id: string
          name: string
          region: string | null
          responsible_user_id: string
          start_date: string
          status: string | null
          target_revenue: number | null
          target_stores: string[] | null
          updated_at: string | null
        }
        Insert: {
          actual_cost?: number | null
          actual_revenue?: number | null
          budget_id?: string | null
          campaign_type: string
          code: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date: string
          estimated_cost: number
          id?: string
          name: string
          region?: string | null
          responsible_user_id: string
          start_date: string
          status?: string | null
          target_revenue?: number | null
          target_stores?: string[] | null
          updated_at?: string | null
        }
        Update: {
          actual_cost?: number | null
          actual_revenue?: number | null
          budget_id?: string | null
          campaign_type?: string
          code?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string
          estimated_cost?: number
          id?: string
          name?: string
          region?: string | null
          responsible_user_id?: string
          start_date?: string
          status?: string | null
          target_revenue?: number | null
          target_stores?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_campaigns_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "trade_budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_challenges: {
        Row: {
          bonus_points: number
          challenge_name: string
          challenge_type: string
          created_at: string | null
          created_by: string | null
          description: string | null
          end_date: string
          id: string
          is_active: boolean | null
          start_date: string
          target_action_code: string | null
          target_quantity: number | null
        }
        Insert: {
          bonus_points?: number
          challenge_name: string
          challenge_type: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date: string
          id?: string
          is_active?: boolean | null
          start_date: string
          target_action_code?: string | null
          target_quantity?: number | null
        }
        Update: {
          bonus_points?: number
          challenge_name?: string
          challenge_type?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string
          id?: string
          is_active?: boolean | null
          start_date?: string
          target_action_code?: string | null
          target_quantity?: number | null
        }
        Relationships: []
      }
      trade_chart_of_accounts: {
        Row: {
          account_type: string
          categoria_dre: string | null
          centro_custo: string | null
          code: string
          codigo_dre_gerencial: string | null
          created_at: string | null
          departamento: string | null
          departamento_confianca: number | null
          departamento_definido_manualmente: boolean | null
          departamento_id: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_group: boolean | null
          name: string
          natureza: string | null
          nivel: number | null
          ordem: number | null
          parent_account_id: string | null
          permite_lancamento: boolean | null
          updated_at: string | null
        }
        Insert: {
          account_type: string
          categoria_dre?: string | null
          centro_custo?: string | null
          code: string
          codigo_dre_gerencial?: string | null
          created_at?: string | null
          departamento?: string | null
          departamento_confianca?: number | null
          departamento_definido_manualmente?: boolean | null
          departamento_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_group?: boolean | null
          name: string
          natureza?: string | null
          nivel?: number | null
          ordem?: number | null
          parent_account_id?: string | null
          permite_lancamento?: boolean | null
          updated_at?: string | null
        }
        Update: {
          account_type?: string
          categoria_dre?: string | null
          centro_custo?: string | null
          code?: string
          codigo_dre_gerencial?: string | null
          created_at?: string | null
          departamento?: string | null
          departamento_confianca?: number | null
          departamento_definido_manualmente?: boolean | null
          departamento_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_group?: boolean | null
          name?: string
          natureza?: string | null
          nivel?: number | null
          ordem?: number | null
          parent_account_id?: string | null
          permite_lancamento?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_chart_of_accounts_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_chart_of_accounts_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "mv_analise_departamentos"
            referencedColumns: ["departamento_id"]
          },
          {
            foreignKeyName: "trade_chart_of_accounts_parent_account_id_fkey"
            columns: ["parent_account_id"]
            isOneToOne: false
            referencedRelation: "trade_chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_financial_entries: {
        Row: {
          account_id: string
          amount: number
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          bank_account_id: string | null
          budget_id: string | null
          campaign_id: string | null
          created_at: string | null
          created_by: string | null
          description: string
          document_url: string | null
          entry_date: string
          entry_type: string
          id: string
          investment_id: string | null
          notes: string | null
          reference_number: string | null
          rejected_reason: string | null
          status: string | null
          store_id: string | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          amount: number
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bank_account_id?: string | null
          budget_id?: string | null
          campaign_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description: string
          document_url?: string | null
          entry_date: string
          entry_type: string
          id?: string
          investment_id?: string | null
          notes?: string | null
          reference_number?: string | null
          rejected_reason?: string | null
          status?: string | null
          store_id?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          amount?: number
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bank_account_id?: string | null
          budget_id?: string | null
          campaign_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          document_url?: string | null
          entry_date?: string
          entry_type?: string
          id?: string
          investment_id?: string | null
          notes?: string | null
          reference_number?: string | null
          rejected_reason?: string | null
          status?: string | null
          store_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_financial_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "trade_chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_financial_entries_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "trade_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_financial_entries_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "trade_budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_financial_entries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "trade_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_financial_entries_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "trade_investments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_financial_entries_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "mv_trade_performance"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "trade_financial_entries_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_financial_entries_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_with_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_investments: {
        Row: {
          amount: number
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          bank_account_id: string | null
          campaign_id: string | null
          category: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          investment_date: string
          notes: string | null
          payment_method: string | null
          receipt_url: string | null
          rejected_reason: string | null
          status: string | null
          store_id: string
          supervisor_id: string | null
          updated_at: string | null
          vendedor_id: string | null
          visit_id: string | null
        }
        Insert: {
          amount: number
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bank_account_id?: string | null
          campaign_id?: string | null
          category: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          investment_date: string
          notes?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          rejected_reason?: string | null
          status?: string | null
          store_id: string
          supervisor_id?: string | null
          updated_at?: string | null
          vendedor_id?: string | null
          visit_id?: string | null
        }
        Update: {
          amount?: number
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bank_account_id?: string | null
          campaign_id?: string | null
          category?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          investment_date?: string
          notes?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          rejected_reason?: string | null
          status?: string | null
          store_id?: string
          supervisor_id?: string | null
          updated_at?: string | null
          vendedor_id?: string | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_investments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "trade_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_investments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "trade_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_investments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "mv_trade_performance"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "trade_investments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_investments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_with_sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_investments_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_investments_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_investments_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "trade_investments_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_investments_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_investments_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "trade_investments_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_points_config: {
        Row: {
          action_code: string
          config_key: string | null
          config_type: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          points_value: number
          updated_at: string | null
        }
        Insert: {
          action_code: string
          config_key?: string | null
          config_type: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          points_value: number
          updated_at?: string | null
        }
        Update: {
          action_code?: string
          config_key?: string | null
          config_type?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          points_value?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      trade_rewards: {
        Row: {
          banner_url: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          fixed_amount: number | null
          id: string
          is_active: boolean | null
          max_points: number | null
          min_points: number | null
          period_type: string | null
          points_value: number | null
          requires_approval: boolean | null
          reward_name: string
          reward_type: string
          updated_at: string | null
        }
        Insert: {
          banner_url?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          fixed_amount?: number | null
          id?: string
          is_active?: boolean | null
          max_points?: number | null
          min_points?: number | null
          period_type?: string | null
          points_value?: number | null
          requires_approval?: boolean | null
          reward_name: string
          reward_type: string
          updated_at?: string | null
        }
        Update: {
          banner_url?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          fixed_amount?: number | null
          id?: string
          is_active?: boolean | null
          max_points?: number | null
          min_points?: number | null
          period_type?: string | null
          points_value?: number | null
          requires_approval?: boolean | null
          reward_name?: string
          reward_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      transacoes_financeiras: {
        Row: {
          classificado_automaticamente: boolean | null
          confianca_classificacao: number | null
          conta_id: string | null
          created_at: string | null
          created_by: string | null
          dados_originais: Json | null
          data_transacao: string
          departamento_id: string | null
          descricao: string
          id: string
          observacoes: string | null
          origem: string
          origem_id: string | null
          tipo: string
          updated_at: string | null
          valor: number
        }
        Insert: {
          classificado_automaticamente?: boolean | null
          confianca_classificacao?: number | null
          conta_id?: string | null
          created_at?: string | null
          created_by?: string | null
          dados_originais?: Json | null
          data_transacao: string
          departamento_id?: string | null
          descricao: string
          id?: string
          observacoes?: string | null
          origem?: string
          origem_id?: string | null
          tipo: string
          updated_at?: string | null
          valor: number
        }
        Update: {
          classificado_automaticamente?: boolean | null
          confianca_classificacao?: number | null
          conta_id?: string | null
          created_at?: string | null
          created_by?: string | null
          dados_originais?: Json | null
          data_transacao?: string
          departamento_id?: string | null
          descricao?: string
          id?: string
          observacoes?: string | null
          origem?: string
          origem_id?: string | null
          tipo?: string
          updated_at?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "transacoes_financeiras_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "trade_chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_financeiras_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_financeiras_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "mv_analise_departamentos"
            referencedColumns: ["departamento_id"]
          },
        ]
      }
      user_challenge_progress: {
        Row: {
          bonus_awarded: boolean | null
          challenge_id: string
          completed: boolean | null
          completed_at: string | null
          current_progress: number | null
          id: string
          user_id: string
        }
        Insert: {
          bonus_awarded?: boolean | null
          challenge_id: string
          completed?: boolean | null
          completed_at?: string | null
          current_progress?: number | null
          id?: string
          user_id: string
        }
        Update: {
          bonus_awarded?: boolean | null
          challenge_id?: string
          completed?: boolean | null
          completed_at?: string | null
          current_progress?: number | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_challenge_progress_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "trade_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_cnpj: {
        Row: {
          cnpj: string
          created_at: string | null
          user_id: string
        }
        Insert: {
          cnpj: string
          created_at?: string | null
          user_id: string
        }
        Update: {
          cnpj?: string
          created_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_points_history: {
        Row: {
          action_code: string
          base_points: number
          earned_at: string | null
          entity_id: string | null
          entity_type: string | null
          final_points: number
          id: string
          metadata: Json | null
          multiplier: number | null
          period_month: string
          user_id: string
        }
        Insert: {
          action_code: string
          base_points: number
          earned_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          final_points: number
          id?: string
          metadata?: Json | null
          multiplier?: number | null
          period_month: string
          user_id: string
        }
        Update: {
          action_code?: string
          base_points?: number
          earned_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          final_points?: number
          id?: string
          metadata?: Json | null
          multiplier?: number | null
          period_month?: string
          user_id?: string
        }
        Relationships: []
      }
      user_price_table_access: {
        Row: {
          can_approve: boolean | null
          can_edit: boolean | null
          can_view: boolean | null
          granted_at: string | null
          granted_by: string | null
          id: string
          notes: string | null
          tabela_id: string
          user_id: string
        }
        Insert: {
          can_approve?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          notes?: string | null
          tabela_id: string
          user_id: string
        }
        Update: {
          can_approve?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          notes?: string | null
          tabela_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_price_table_access_tabela_id_fkey"
            columns: ["tabela_id"]
            isOneToOne: false
            referencedRelation: "fabrica_tabelas_preco"
            referencedColumns: ["id"]
          },
        ]
      }
      user_rankings: {
        Row: {
          badges: Json | null
          created_at: string | null
          id: string
          last_activity_date: string | null
          level_name: string | null
          level_number: number | null
          period_key: string
          period_type: string
          ranking_position: number | null
          region: string | null
          streak_days: number | null
          total_points: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          badges?: Json | null
          created_at?: string | null
          id?: string
          last_activity_date?: string | null
          level_name?: string | null
          level_number?: number | null
          period_key: string
          period_type: string
          ranking_position?: number | null
          region?: string | null
          streak_days?: number | null
          total_points?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          badges?: Json | null
          created_at?: string | null
          id?: string
          last_activity_date?: string | null
          level_name?: string | null
          level_number?: number | null
          period_key?: string
          period_type?: string
          ranking_position?: number | null
          region?: string | null
          streak_days?: number | null
          total_points?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_rewards_received: {
        Row: {
          amount_received: number | null
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          id: string
          paid_at: string | null
          period_key: string
          points_used: number
          rejection_reason: string | null
          reward_id: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          amount_received?: number | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          id?: string
          paid_at?: string | null
          period_key: string
          points_used: number
          rejection_reason?: string | null
          reward_id?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          amount_received?: number | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          id?: string
          paid_at?: string | null
          period_key?: string
          points_used?: number
          rejection_reason?: string | null
          reward_id?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_rewards_received_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "trade_rewards"
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
      user_whatsapp: {
        Row: {
          created_at: string
          id: string
          phone_number: string
          user_id: string | null
          verified: boolean | null
        }
        Insert: {
          created_at?: string
          id?: string
          phone_number: string
          user_id?: string | null
          verified?: boolean | null
        }
        Update: {
          created_at?: string
          id?: string
          phone_number?: string
          user_id?: string | null
          verified?: boolean | null
        }
        Relationships: []
      }
      usuario_permissoes_modulos: {
        Row: {
          created_at: string | null
          id: string
          modulo_id: string
          usuario_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          modulo_id: string
          usuario_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          modulo_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuario_permissoes_modulos_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modulos_sistema"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuario_permissoes_modulos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuario_permissoes_modulos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuario_permissoes_modulos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      usuario_permissoes_telas: {
        Row: {
          created_at: string | null
          id: string
          tela_id: string
          usuario_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          tela_id: string
          usuario_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          tela_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuario_permissoes_telas_tela_id_fkey"
            columns: ["tela_id"]
            isOneToOne: false
            referencedRelation: "telas_sistema"
            referencedColumns: ["id"]
          },
        ]
      }
      usuario_prospects: {
        Row: {
          created_at: string | null
          id: string
          prospect_id: string
          usuario_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          prospect_id: string
          usuario_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          prospect_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuario_prospects_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_availability: {
        Row: {
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean | null
          start_time: string
          vendedor_id: string | null
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean | null
          start_time: string
          vendedor_id?: string | null
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean | null
          start_time?: string
          vendedor_id?: string | null
        }
        Relationships: []
      }
      verbas_orcamentarias: {
        Row: {
          ano: number
          created_at: string | null
          departamento_id: string
          id: string
          mes: number
          observacoes: string | null
          updated_at: string | null
          valor_orcado: number
          valor_realizado: number | null
        }
        Insert: {
          ano: number
          created_at?: string | null
          departamento_id: string
          id?: string
          mes: number
          observacoes?: string | null
          updated_at?: string | null
          valor_orcado?: number
          valor_realizado?: number | null
        }
        Update: {
          ano?: number
          created_at?: string | null
          departamento_id?: string
          id?: string
          mes?: number
          observacoes?: string | null
          updated_at?: string | null
          valor_orcado?: number
          valor_realizado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "verbas_orcamentarias_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verbas_orcamentarias_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "mv_analise_departamentos"
            referencedColumns: ["departamento_id"]
          },
        ]
      }
      visits: {
        Row: {
          atribuido_por: string | null
          check_in_latitude: number | null
          check_in_longitude: number | null
          check_in_time: string | null
          check_out_latitude: number | null
          check_out_longitude: number | null
          check_out_time: string | null
          checklist_completed: boolean | null
          compliance_score: number | null
          created_at: string | null
          duration_minutes: number | null
          id: string
          issues_found: number | null
          notes: string | null
          objectives: string[] | null
          photos_count: number | null
          scheduled_date: string
          scheduled_time: string | null
          signature_url: string | null
          status: string | null
          store_id: string | null
          supervisor_id: string | null
          updated_at: string | null
          user_id: string | null
          vendedor_id: string | null
          visit_code: string
          visit_type: string | null
          weather: string | null
        }
        Insert: {
          atribuido_por?: string | null
          check_in_latitude?: number | null
          check_in_longitude?: number | null
          check_in_time?: string | null
          check_out_latitude?: number | null
          check_out_longitude?: number | null
          check_out_time?: string | null
          checklist_completed?: boolean | null
          compliance_score?: number | null
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          issues_found?: number | null
          notes?: string | null
          objectives?: string[] | null
          photos_count?: number | null
          scheduled_date: string
          scheduled_time?: string | null
          signature_url?: string | null
          status?: string | null
          store_id?: string | null
          supervisor_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          vendedor_id?: string | null
          visit_code: string
          visit_type?: string | null
          weather?: string | null
        }
        Update: {
          atribuido_por?: string | null
          check_in_latitude?: number | null
          check_in_longitude?: number | null
          check_in_time?: string | null
          check_out_latitude?: number | null
          check_out_longitude?: number | null
          check_out_time?: string | null
          checklist_completed?: boolean | null
          compliance_score?: number | null
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          issues_found?: number | null
          notes?: string | null
          objectives?: string[] | null
          photos_count?: number | null
          scheduled_date?: string
          scheduled_time?: string | null
          signature_url?: string | null
          status?: string | null
          store_id?: string | null
          supervisor_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          vendedor_id?: string | null
          visit_code?: string
          visit_type?: string | null
          weather?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visits_atribuido_por_fkey"
            columns: ["atribuido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_atribuido_por_fkey"
            columns: ["atribuido_por"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_atribuido_por_fkey"
            columns: ["atribuido_por"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "visits_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "mv_trade_performance"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "visits_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_with_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          context: Json | null
          created_at: string
          id: string
          phone_number: string
          sentiment: string | null
          sentiment_analyzed_at: string | null
          sentiment_score: number | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          id?: string
          phone_number: string
          sentiment?: string | null
          sentiment_analyzed_at?: string | null
          sentiment_score?: number | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          id?: string
          phone_number?: string
          sentiment?: string | null
          sentiment_analyzed_at?: string | null
          sentiment_score?: number | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          content: string
          conversation_id: string | null
          id: string
          media_type: string | null
          media_url: string | null
          message_id: string | null
          sender: string
          timestamp: string
        }
        Insert: {
          content: string
          conversation_id?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_id?: string | null
          sender: string
          timestamp?: string
        }
        Update: {
          content?: string
          conversation_id?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_id?: string | null
          sender?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      ads_accounts_safe: {
        Row: {
          account_id: string | null
          account_name: string | null
          created_at: string | null
          id: string | null
          is_active: boolean | null
          last_sync_at: string | null
          platform: string | null
          sync_status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          account_id?: string | null
          account_name?: string | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          last_sync_at?: string | null
          platform?: string | null
          sync_status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          account_id?: string | null
          account_name?: string | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          last_sync_at?: string | null
          platform?: string | null
          sync_status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      clientes_safe: {
        Row: {
          celular_masked: string | null
          cidade: string | null
          classificacao: number | null
          cnpj: string | null
          codigo: string | null
          conceito: string | null
          created_at: string | null
          data_maior_compra: string | null
          data_ultima_compra: string | null
          email_masked: string | null
          empresa_id: number | null
          id: string | null
          limite_credito: number | null
          nome: string | null
          nome_abreviado: string | null
          status_bloqueio: string | null
          telefone_masked: string | null
          uf: string | null
          updated_at: string | null
          valor_maior_compra: number | null
          valor_ultima_compra: number | null
        }
        Insert: {
          celular_masked?: never
          cidade?: string | null
          classificacao?: number | null
          cnpj?: string | null
          codigo?: string | null
          conceito?: string | null
          created_at?: string | null
          data_maior_compra?: string | null
          data_ultima_compra?: string | null
          email_masked?: never
          empresa_id?: number | null
          id?: string | null
          limite_credito?: number | null
          nome?: string | null
          nome_abreviado?: string | null
          status_bloqueio?: string | null
          telefone_masked?: never
          uf?: string | null
          updated_at?: string | null
          valor_maior_compra?: number | null
          valor_ultima_compra?: number | null
        }
        Update: {
          celular_masked?: never
          cidade?: string | null
          classificacao?: number | null
          cnpj?: string | null
          codigo?: string | null
          conceito?: string | null
          created_at?: string | null
          data_maior_compra?: string | null
          data_ultima_compra?: string | null
          email_masked?: never
          empresa_id?: number | null
          id?: string | null
          limite_credito?: number | null
          nome?: string | null
          nome_abreviado?: string | null
          status_bloqueio?: string | null
          telefone_masked?: never
          uf?: string | null
          updated_at?: string | null
          valor_maior_compra?: number | null
          valor_ultima_compra?: number | null
        }
        Relationships: []
      }
      mv_analise_departamentos: {
        Row: {
          classificacoes_automaticas: number | null
          classificacoes_manuais: number | null
          confianca_media: number | null
          departamento_id: string | null
          departamento_nome: string | null
          periodo_mes: string | null
          tipo: string | null
          total_transacoes: number | null
          valor_medio: number | null
          valor_total: number | null
        }
        Relationships: []
      }
      mv_conversion_funnel: {
        Row: {
          com_vendedor: number | null
          convertidos: number | null
          regiao: Database["public"]["Enums"]["region_type"] | null
          semana: string | null
          status: Database["public"]["Enums"]["prospect_status"] | null
          total_atividades: number | null
          total_prospects: number | null
          uf: string | null
        }
        Relationships: []
      }
      mv_sales_performance: {
        Row: {
          mes: string | null
          regiao: Database["public"]["Enums"]["region_type"] | null
          salesperson_id: string | null
          ticket_medio: number | null
          total_descontos: number | null
          total_vendas: number | null
          uf: string | null
          valor_liquido: number | null
          vendedor: string | null
        }
        Relationships: []
      }
      mv_trade_performance: {
        Row: {
          auditorias_conformes: number | null
          city: string | null
          media_frentes: number | null
          mes: string | null
          produtos_faltantes: number | null
          state: string | null
          store_id: string | null
          store_name: string | null
          total_auditorias: number | null
          total_investimentos: number | null
          total_visitas: number | null
        }
        Relationships: []
      }
      profiles_safe: {
        Row: {
          aprovado: boolean | null
          created_at: string | null
          departamento_id: string | null
          email: string | null
          gerente_id: string | null
          id: string | null
          nome: string | null
          status: string | null
          supervisor_id: string | null
          updated_at: string | null
        }
        Insert: {
          aprovado?: boolean | null
          created_at?: string | null
          departamento_id?: string | null
          email?: never
          gerente_id?: string | null
          id?: string | null
          nome?: string | null
          status?: string | null
          supervisor_id?: string | null
          updated_at?: string | null
        }
        Update: {
          aprovado?: boolean | null
          created_at?: string | null
          departamento_id?: string | null
          email?: never
          gerente_id?: string | null
          id?: string | null
          nome?: string | null
          status?: string | null
          supervisor_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "mv_analise_departamentos"
            referencedColumns: ["departamento_id"]
          },
          {
            foreignKeyName: "profiles_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "profiles_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      stores_with_sellers: {
        Row: {
          address: string | null
          category: string | null
          chain: string | null
          city: string | null
          cnpj: string | null
          code: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          id: string | null
          latitude: number | null
          longitude: number | null
          manager_name: string | null
          manager_phone: string | null
          monthly_revenue: number | null
          name: string | null
          notes: string | null
          phone: string | null
          priority: string | null
          size: string | null
          state: string | null
          status: string | null
          supervisor_id: string | null
          updated_at: string | null
          vendedor_id: string | null
          vendedor_principal_id: string | null
          vendedores: Json | null
          visit_frequency: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          category?: string | null
          chain?: string | null
          city?: string | null
          cnpj?: string | null
          code?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string | null
          latitude?: number | null
          longitude?: number | null
          manager_name?: string | null
          manager_phone?: string | null
          monthly_revenue?: number | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          priority?: string | null
          size?: string | null
          state?: string | null
          status?: string | null
          supervisor_id?: string | null
          updated_at?: string | null
          vendedor_id?: string | null
          vendedor_principal_id?: never
          vendedores?: never
          visit_frequency?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          category?: string | null
          chain?: string | null
          city?: string | null
          cnpj?: string | null
          code?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string | null
          latitude?: number | null
          longitude?: number | null
          manager_name?: string | null
          manager_phone?: string | null
          monthly_revenue?: number | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          priority?: string | null
          size?: string | null
          state?: string | null
          status?: string | null
          supervisor_id?: string | null
          updated_at?: string | null
          vendedor_id?: string | null
          vendedor_principal_id?: never
          vendedores?: never
          visit_frequency?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      sync_chunks_progress: {
        Row: {
          completed_chunks: number | null
          entidade: string | null
          error_chunks: number | null
          last_completed_at: string | null
          overall_status: string | null
          started_at: string | null
          sync_id: string | null
          total_chunks: number | null
          total_duration_ms: number | null
          total_inserted: number | null
          total_processed: number | null
          total_skipped: number | null
          total_updated: number | null
        }
        Relationships: []
      }
      sync_tracking_summary: {
        Row: {
          avg_duration_ms: number | null
          completed_count: number | null
          entidade: string | null
          failed_count: number | null
          last_sync_at: string | null
          tipo_sync: string | null
          total_records_processed: number | null
          total_syncs: number | null
        }
        Relationships: []
      }
      team_performance_view: {
        Row: {
          audits_this_month: number | null
          avg_compliance: number | null
          current_level: string | null
          last_activity: string | null
          measurements_this_month: number | null
          monthly_points: number | null
          monthly_position: number | null
          photos_this_month: number | null
          role: Database["public"]["Enums"]["app_role"] | null
          supervisor_id: string | null
          user_id: string | null
          user_name: string | null
          visits_this_month: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "team_performance_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      vw_analise_departamentos_completa: {
        Row: {
          classificacoes_automaticas: number | null
          classificacoes_manuais: number | null
          departamento_id: string | null
          departamento_nome: string | null
          periodo_mes: string | null
          tipo: string | null
          total_transacoes: number | null
          valor_total: number | null
        }
        Relationships: []
      }
      vw_clientes_cobranca: {
        Row: {
          celular: string | null
          cidade: string | null
          cliente_codigo: string | null
          cliente_id: string | null
          cliente_nome: string | null
          cnpj: string | null
          comportamento_pagamento: string | null
          dme: number | null
          email: string | null
          endereco: string | null
          limite_credito: number | null
          maior_atraso_dias: number | null
          pontualidade_percentual: number | null
          rota: string | null
          score_atual: number | null
          score_classificacao: string | null
          status_bloqueio: string | null
          telefone: string | null
          total_titulos_abertos: number | null
          uf: string | null
          valor_total_aberto: number | null
          vencimento_mais_antigo: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      atualizar_perfil_credito_cliente: {
        Args: { p_cliente_codigo: string }
        Returns: string
      }
      bulk_upsert_contas_pagar_v2:
        | { Args: { p_records: Json }; Returns: Json }
        | { Args: { p_force_update?: boolean; p_records: Json }; Returns: Json }
      bulk_upsert_contas_receber: { Args: { p_records: Json }; Returns: Json }
      bulk_upsert_contas_receber_v2: {
        Args: { p_records: Json }
        Returns: Json
      }
      bulk_upsert_estoque_movimentacoes_v2: {
        Args: { p_records: Json }
        Returns: Json
      }
      buscar_dados_cliente_cobranca: {
        Args: { p_cliente_codigo: string }
        Returns: {
          cliente_celular: string
          cliente_cidade: string
          cliente_email: string
          cliente_endereco: string
          cliente_nome: string
          cliente_telefone: string
          cliente_uf: string
          limite_credito: number
          status_bloqueio: string
        }[]
      }
      buscar_regra_fiscal_item: {
        Args: {
          p_ncm: string
          p_tipo_operacao?: string
          p_uf_destino: string
          p_uf_origem: string
        }
        Returns: {
          aliquota_cofins: number
          aliquota_fcp: number
          aliquota_icms: number
          aliquota_ipi: number
          aliquota_pis: number
          cfop_entrada: string
          cfop_saida: string
          comentario: string
          cst_entrada: string
          cst_saida: string
          mva: number
          reducao_base: number
          regra_id: string
          tem_st: boolean
        }[]
      }
      buscar_regra_fiscal_ncm: {
        Args: {
          p_ncm_codigo: string
          p_uf_destino: string
          p_uf_origem: string
        }
        Returns: Json
      }
      calcular_custo_entrada: {
        Args: {
          p_outras_despesas?: number
          p_valor_desconto?: number
          p_valor_frete?: number
          p_valor_icms_st?: number
          p_valor_ipi?: number
          p_valor_produto: number
          p_valor_seguro?: number
        }
        Returns: number
      }
      calcular_custo_medio_fifo: {
        Args: { p_produto_id: string; p_quantidade_saida: number }
        Returns: number
      }
      calcular_custo_medio_ponderado: {
        Args: { p_produto_id: string }
        Returns: number
      }
      calcular_custo_mod_op:
        | {
            Args: {
              _custo_hora_mao_obra: number
              _quantidade_produzida: number
              _tempo_producao_minutos: number
            }
            Returns: number
          }
        | { Args: { p_ordem_producao_id: string }; Returns: number }
      calcular_score_cliente: {
        Args: { p_cliente_codigo: string }
        Returns: number
      }
      calcular_status_financeiro:
        | {
            Args: {
              p_data_pagamento: string
              p_data_vencimento: string
              p_valor_original: number
              p_valor_pago: number
            }
            Returns: string
          }
        | {
            Args: { p_dias_atraso: number; p_valor_aberto: number }
            Returns: string
          }
      calculate_user_level: {
        Args: { points: number }
        Returns: {
          level_name: string
          level_number: number
        }[]
      }
      calculate_visit_points: { Args: { visit_id: string }; Returns: number }
      can_access_ads_account: {
        Args: { account_user_id: string; viewer_id: string }
        Returns: boolean
      }
      can_access_cliente: { Args: { viewer_id: string }; Returns: boolean }
      can_access_notas_fiscais: {
        Args: { viewer_id: string }
        Returns: boolean
      }
      can_view_profile: {
        Args: { target_profile_id: string; viewer_id: string }
        Returns: boolean
      }
      cleanup_expired_rate_limiter_slots: { Args: never; Returns: undefined }
      complete_sync: {
        Args: {
          p_duration_ms?: number
          p_error_message?: string
          p_records_inserted?: number
          p_records_processed?: number
          p_records_skipped?: number
          p_records_updated?: number
          p_status?: string
          p_sync_id: string
        }
        Returns: undefined
      }
      consume_budget_credit: {
        Args: { p_amount: number; p_budget_id: string }
        Returns: undefined
      }
      enfileirar_cobrancas_automaticas: { Args: never; Returns: number }
      exec_sql: { Args: { sql_query: string }; Returns: undefined }
      gerar_creditos_tributarios: {
        Args: { p_item_nf_id: string }
        Returns: Json
      }
      get_activity_counts_by_date: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: {
          activity_count: number
          activity_date: string
        }[]
      }
      get_all_user_permissions: {
        Args: { p_user_id: string }
        Returns: {
          is_admin: boolean
          modules: string[]
          role: string
          screens: string[]
        }[]
      }
      get_analise_departamentos: {
        Args: {
          p_departamento_id?: string
          p_periodo_fim?: string
          p_periodo_inicio?: string
        }
        Returns: {
          classificacoes_automaticas: number
          classificacoes_manuais: number
          confianca_media: number
          departamento_id: string
          departamento_nome: string
          periodo_mes: string
          tipo: string
          total_transacoes: number
          valor_medio: number
          valor_total: number
        }[]
      }
      get_analise_departamentos_completa:
        | {
            Args: { p_periodo_fim: string; p_periodo_inicio: string }
            Returns: {
              departamento_id: string
              departamento_nome: string
              periodo_mes: string
              tipo: string
              total_transacoes: number
              valor_total: number
            }[]
          }
        | {
            Args: {
              p_departamento_id?: string
              p_periodo_fim: string
              p_periodo_inicio: string
            }
            Returns: {
              classificacoes_automaticas: number
              classificacoes_manuais: number
              departamento_id: string
              departamento_nome: string
              periodo_mes: string
              tipo: string
              total_transacoes: number
              valor_total: number
            }[]
          }
      get_contas_receber_aging: {
        Args: {
          p_ano?: number
          p_conta?: string
          p_empresas?: number[]
          p_mes?: number
          p_portador?: string
        }
        Returns: Json
      }
      get_contas_receber_calendario: {
        Args: {
          p_ano?: number
          p_conta?: string
          p_empresas?: number[]
          p_portador?: string
        }
        Returns: {
          data_vencimento: string
          qtd_pendente: number
          qtd_recebido: number
          qtd_titulos: number
          qtd_vencido: number
          valor_pendente: number
          valor_recebido: number
          valor_total: number
          valor_vencido: number
        }[]
      }
      get_contas_receber_dashboard_kpis:
        | {
            Args: {
              p_ano?: number
              p_conta?: string
              p_empresas?: number[]
              p_mes?: number
              p_portador?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_ano?: number
              p_conta?: string
              p_data_recebimento?: string
              p_data_vencimento?: string
              p_empresas?: number[]
              p_mes?: number
              p_portador?: string
            }
            Returns: Json
          }
      get_contas_receber_evolucao_mensal: {
        Args: {
          p_ano?: number
          p_conta?: string
          p_empresas?: number[]
          p_portador?: string
        }
        Returns: {
          mes: string
          pendente: number
          recebido: number
        }[]
      }
      get_contas_receber_filter_options: {
        Args: { p_anos?: number[] }
        Returns: Json
      }
      get_contas_receber_filtros: { Args: { p_ano?: number }; Returns: Json }
      get_contas_receber_pmr_detalhes: {
        Args: {
          p_ano?: number
          p_conta?: string
          p_empresas?: number[]
          p_mes?: number
          p_portador?: string
        }
        Returns: Json
      }
      get_contas_receber_status_dist: {
        Args: {
          p_ano?: number
          p_conta?: string
          p_empresas?: number[]
          p_mes?: number
          p_portador?: string
        }
        Returns: {
          percentual: number
          quantidade: number
          status: string
          valor: number
        }[]
      }
      get_contas_receber_top_clientes: {
        Args: {
          p_ano?: number
          p_conta?: string
          p_empresas?: number[]
          p_mes?: number
          p_portador?: string
        }
        Returns: Json
      }
      get_conversion_funnel: {
        Args: never
        Returns: {
          com_vendedor: number | null
          convertidos: number | null
          regiao: Database["public"]["Enums"]["region_type"] | null
          semana: string | null
          status: Database["public"]["Enums"]["prospect_status"] | null
          total_atividades: number | null
          total_prospects: number | null
          uf: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "mv_conversion_funnel"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_estoque_consolidado_por_produto_master: {
        Args: never
        Returns: {
          categoria: string
          distribuidoras: Json
          nome_produto: string
          produto_master_id: string
          sku_master: string
          total_distribuidoras: number
          total_quantidade: number
          unidade_medida: string
        }[]
      }
      get_estoque_por_codigo_distribuidora: {
        Args: { p_codigo: string; p_distribuidora_id: string }
        Returns: {
          codigo_distribuidora: string
          data_validade: string
          estoque_id: string
          localizacao: string
          lote: string
          nome_produto: string
          produto_master_id: string
          quantidade_disponivel: number
          quantidade_reservada: number
          sku_master: string
        }[]
      }
      get_last_sync_timestamp: {
        Args: { p_entidade: string; p_tipo?: string }
        Returns: string
      }
      get_sales_performance: {
        Args: never
        Returns: {
          mes: string | null
          regiao: Database["public"]["Enums"]["region_type"] | null
          salesperson_id: string | null
          ticket_medio: number | null
          total_descontos: number | null
          total_vendas: number | null
          uf: string | null
          valor_liquido: number | null
          vendedor: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "mv_sales_performance"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_subordinados: {
        Args: { _user_id: string }
        Returns: {
          subordinado_id: string
        }[]
      }
      get_subordinates: {
        Args: { _user_id: string }
        Returns: {
          nivel: number
          subordinate_id: string
        }[]
      }
      get_trade_performance: {
        Args: never
        Returns: {
          auditorias_conformes: number | null
          city: string | null
          media_frentes: number | null
          mes: string | null
          produtos_faltantes: number | null
          state: string | null
          store_id: string | null
          store_name: string | null
          total_auditorias: number | null
          total_investimentos: number | null
          total_visitas: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "mv_trade_performance"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_user_combined_module_permissions: {
        Args: { _user_id: string }
        Returns: {
          modulo_codigo: string
        }[]
      }
      get_user_combined_screen_permissions: {
        Args: { _user_id: string }
        Returns: {
          tela_codigo: string
        }[]
      }
      get_user_module_permissions: {
        Args: { _user_id: string }
        Returns: {
          modulo_codigo: string
        }[]
      }
      get_user_screen_permissions: {
        Args: { _user_id: string }
        Returns: {
          tela_codigo: string
        }[]
      }
      has_finance_access: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role_or_higher: {
        Args: {
          _min_role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_strict_finance_access: { Args: { user_id: string }; Returns: boolean }
      icms_gera_credito: { Args: { p_cst: string }; Returns: boolean }
      icms_tipo_credito: { Args: { p_cst: string }; Returns: string }
      importar_clientes: { Args: { p_clientes: Json }; Returns: Json }
      is_admin_or_supervisor: { Args: { _user_id: string }; Returns: boolean }
      is_participant_of_conversa: {
        Args: { conversa_id_param: string; user_id_param: string }
        Returns: boolean
      }
      is_sales_team: { Args: { _user_id: string }; Returns: boolean }
      is_supervisor_of: {
        Args: { _supervisor_id: string; _user_id: string }
        Returns: boolean
      }
      log_audit: {
        Args: {
          p_action: string
          p_entity_id: string
          p_entity_type: string
          p_metadata?: Json
          p_new_data?: Json
          p_old_data?: Json
        }
        Returns: string
      }
      pis_cofins_gera_credito: { Args: { p_cst: string }; Returns: boolean }
      pis_cofins_tipo_credito: { Args: { p_cst: string }; Returns: string }
      refresh_all_materialized_views: { Args: never; Returns: undefined }
      refresh_analise_departamentos: { Args: never; Returns: undefined }
      refresh_daily_kpis: { Args: { target_date?: string }; Returns: undefined }
      register_action_points: {
        Args: {
          p_action_code: string
          p_entity_id?: string
          p_entity_type?: string
          p_metadata?: Json
          p_user_id: string
        }
        Returns: undefined
      }
      register_user_points: {
        Args: {
          p_action_code: string
          p_entity_id?: string
          p_entity_type?: string
          p_metadata?: Json
          p_user_id: string
        }
        Returns: number
      }
      registrar_acesso_portal: {
        Args: { p_acao: string; p_detalhes?: Json }
        Returns: string
      }
      similarity_score: {
        Args: { str1: string; str2: string }
        Returns: number
      }
      sincronizar_permissoes_usuario: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      start_sync: {
        Args: { p_entidade: string; p_metadata?: Json; p_tipo?: string }
        Returns: string
      }
      start_sync_session: {
        Args: {
          p_entidade: string
          p_total_chunks: number
          p_total_esperado: number
        }
        Returns: string
      }
      update_sync_progress: {
        Args: { p_records_processed: number; p_session_id: string }
        Returns: Json
      }
      update_user_ranking: {
        Args: { p_period_key: string; p_period_type: string; p_user_id: string }
        Returns: undefined
      }
      user_can_access_price_table: {
        Args: {
          _permission_type?: string
          _tabela_id: string
          _user_id: string
        }
        Returns: boolean
      }
      user_can_approve_price_table: {
        Args: { _tabela_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_store_access: {
        Args: { p_store_id: string; p_user_id?: string }
        Returns: boolean
      }
      user_tem_acesso_cnpj: {
        Args: { p_cnpj: string; p_user_id: string }
        Returns: boolean
      }
      usuario_tem_acesso_estoque: {
        Args: { _user_id: string }
        Returns: boolean
      }
      usuario_tem_acesso_loja: {
        Args: { _store_id: string; _user_id: string }
        Returns: boolean
      }
      usuario_tem_acesso_modulo: {
        Args: { _modulo_codigo: string; _user_id: string }
        Returns: boolean
      }
      usuario_tem_acesso_prospect: {
        Args: { _prospect_id: string; _user_id: string }
        Returns: boolean
      }
      usuario_tem_acesso_tela: {
        Args: { _tela_codigo: string; _user_id: string }
        Returns: boolean
      }
      usuario_tem_permissao_modulo: {
        Args: { _modulo_codigo: string; _user_id: string }
        Returns: boolean
      }
      usuario_tem_permissao_tela: {
        Args: { _tela_codigo: string; _user_id: string }
        Returns: boolean
      }
      validar_creditos_nota_fiscal: {
        Args: { p_nota_id: string }
        Returns: Json
      }
    }
    Enums: {
      activity_result: "positivo" | "neutro" | "negativo"
      activity_type: "ligacao" | "email" | "reuniao" | "visita" | "proposta"
      app_role:
        | "admin"
        | "supervisor"
        | "vendedor"
        | "promotora"
        | "promotor"
        | "cliente"
        | "gerente"
      client_category: "A" | "B" | "C" | "D"
      prospect_status:
        | "novo"
        | "em_contato"
        | "proposta_enviada"
        | "negociacao"
        | "ganho"
        | "perdido"
      region_type: "Norte" | "Sul" | "Leste" | "Oeste" | "Centro"
      user_type: "vendedor" | "supervisor" | "admin"
      zona_geografica:
        | "norte"
        | "sul"
        | "leste"
        | "oeste"
        | "centro"
        | "nordeste"
        | "noroeste"
        | "sudeste"
        | "sudoeste"
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
      activity_result: ["positivo", "neutro", "negativo"],
      activity_type: ["ligacao", "email", "reuniao", "visita", "proposta"],
      app_role: [
        "admin",
        "supervisor",
        "vendedor",
        "promotora",
        "promotor",
        "cliente",
        "gerente",
      ],
      client_category: ["A", "B", "C", "D"],
      prospect_status: [
        "novo",
        "em_contato",
        "proposta_enviada",
        "negociacao",
        "ganho",
        "perdido",
      ],
      region_type: ["Norte", "Sul", "Leste", "Oeste", "Centro"],
      user_type: ["vendedor", "supervisor", "admin"],
      zona_geografica: [
        "norte",
        "sul",
        "leste",
        "oeste",
        "centro",
        "nordeste",
        "noroeste",
        "sudeste",
        "sudoeste",
      ],
    },
  },
} as const
