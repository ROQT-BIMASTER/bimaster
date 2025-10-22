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
          id?: string
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
        ]
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
        ]
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
          id?: string
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
        ]
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
          thumbnail_url: string | null
          total_facings: number | null
          upload_date: string | null
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
          thumbnail_url?: string | null
          total_facings?: number | null
          upload_date?: string | null
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
          thumbnail_url?: string | null
          total_facings?: number | null
          upload_date?: string | null
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
            foreignKeyName: "photos_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
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
          email: string
          id: string
          nome: string
          status: string
          supervisor_id: string | null
          updated_at: string | null
        }
        Insert: {
          aprovado?: boolean
          created_at?: string | null
          email: string
          id: string
          nome: string
          status?: string
          supervisor_id?: string | null
          updated_at?: string | null
        }
        Update: {
          aprovado?: boolean
          created_at?: string | null
          email?: string
          id?: string
          nome?: string
          status?: string
          supervisor_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
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
          id?: string
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
            foreignKeyName: "prospects_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          total_value: number
          updated_at: string | null
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
          total_value: number
          updated_at?: string | null
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
          total_value?: number
          updated_at?: string | null
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
            foreignKeyName: "shelf_share_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
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
          updated_at: string | null
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
          updated_at?: string | null
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
          updated_at?: string | null
          visit_frequency?: string | null
          zip_code?: string | null
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
          nome?: string
          ordem?: number | null
          rota?: string
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
          available_amount: number | null
          code: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          name: string
          period_end: string
          period_start: string
          reserved_amount: number | null
          spent_amount: number | null
          status: string | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          allocated_amount?: number | null
          available_amount?: number | null
          code: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          period_end: string
          period_start: string
          reserved_amount?: number | null
          spent_amount?: number | null
          status?: string | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          allocated_amount?: number | null
          available_amount?: number | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          period_end?: string
          period_start?: string
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
      trade_chart_of_accounts: {
        Row: {
          account_type: string
          centro_custo: string | null
          code: string
          created_at: string | null
          departamento: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_account_id: string | null
          updated_at: string | null
        }
        Insert: {
          account_type: string
          centro_custo?: string | null
          code: string
          created_at?: string | null
          departamento?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_account_id?: string | null
          updated_at?: string | null
        }
        Update: {
          account_type?: string
          centro_custo?: string | null
          code?: string
          created_at?: string | null
          departamento?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_account_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
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
          updated_at: string | null
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
          updated_at?: string | null
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
          updated_at?: string | null
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
            foreignKeyName: "trade_investments_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
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
      visits: {
        Row: {
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
          updated_at: string | null
          user_id: string | null
          visit_code: string
          visit_type: string | null
          weather: string | null
        }
        Insert: {
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
          updated_at?: string | null
          user_id?: string | null
          visit_code: string
          visit_type?: string | null
          weather?: string | null
        }
        Update: {
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
          updated_at?: string | null
          user_id?: string | null
          visit_code?: string
          visit_type?: string | null
          weather?: string | null
        }
        Relationships: [
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
        ]
      }
    }
    Views: {
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
    }
    Functions: {
      consume_budget_credit: {
        Args: { p_amount: number; p_budget_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_supervisor: { Args: { _user_id: string }; Returns: boolean }
      is_participant_of_conversa: {
        Args: { conversa_id_param: string; user_id_param: string }
        Returns: boolean
      }
      refresh_all_materialized_views: { Args: never; Returns: undefined }
      refresh_daily_kpis: { Args: { target_date?: string }; Returns: undefined }
      sincronizar_permissoes_usuario: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      usuario_tem_acesso_prospect: {
        Args: { _prospect_id: string; _user_id: string }
        Returns: boolean
      }
      usuario_tem_permissao_tela: {
        Args: { _tela_codigo: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      activity_result: "positivo" | "neutro" | "negativo"
      activity_type: "ligacao" | "email" | "reuniao" | "visita" | "proposta"
      app_role: "admin" | "supervisor" | "vendedor"
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
      app_role: ["admin", "supervisor", "vendedor"],
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
