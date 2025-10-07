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
      prospects: {
        Row: {
          bairro: string | null
          categoria: Database["public"]["Enums"]["client_category"] | null
          cep: string | null
          cnae_codigo: string | null
          cnae_principal: string | null
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
          categoria?: Database["public"]["Enums"]["client_category"] | null
          cep?: string | null
          cnae_codigo?: string | null
          cnae_principal?: string | null
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
          categoria?: Database["public"]["Enums"]["client_category"] | null
          cep?: string | null
          cnae_codigo?: string | null
          cnae_principal?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_supervisor: {
        Args: { _user_id: string }
        Returns: boolean
      }
      is_participant_of_conversa: {
        Args: { conversa_id_param: string; user_id_param: string }
        Returns: boolean
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
