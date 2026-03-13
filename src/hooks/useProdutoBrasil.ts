import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ProdutoBrasil {
  id: string;
  submissao_china_id: string | null;
  vinculo_id: string | null;
  projeto_id: string | null;
  china_nome: string | null;
  china_codigo: string | null;
  china_ean: string | null;
  china_categoria: string | null;
  china_descricao: string | null;
  nome_brasil: string | null;
  codigo_brasil: string | null;
  categoria_brasil: string | null;
  descricao_brasil: string | null;
  observacoes: string | null;
  status: string;
  responsavel_precadastro_id: string | null;
  responsavel_regulatorio_id: string | null;
  numero_registro: string | null;
  status_anvisa: string | null;
  categoria_regulatoria: string | null;
  responsavel_tecnico: string | null;
  data_aprovacao_regulatorio: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  ncm: string | null;
  ean_unitario: string | null;
  ean_display: string | null;
  ean_caixa_master: string | null;
  tipo_produto: string | null;
  marca: string | null;
  linha: string | null;
  fabricante: string | null;
  sku: string | null;
  foto_url: string | null;
  origem: string | null;
  data_inicio_processo: string | null;
  data_previsao_chegada: string | null;
  data_cadastro_finalizado: string | null;
  processo_anvisa: string | null;
  nome_comercial: string | null;
  descricao_curta: string | null;
  descricao_completa: string | null;
  custo_unitario_china: number | null;
  itens_display: number | null;
  qty_per_display: number | null;
  peso_bruto: number | null;
  peso_liquido: number | null;
  // Phase 4 - new fields
  modo_uso: string | null;
  precaucoes: string | null;
  ativos: string | null;
  fragrancia: string | null;
  tipo_aplicador: string | null;
  composicao: string | null;
  // Phase 5 - ANVISA expanded
  anvisa_data_envio: string | null;
  anvisa_data_aprovacao: string | null;
  anvisa_taxa_paga: boolean | null;
  anvisa_observacoes: string | null;
  anvisa_pipeline_status: string | null;
}

export interface ProdutoBrasilCusto {
  id: string;
  produto_brasil_id: string;
  custo_nf: number;
  custo_servico: number;
  custo_condicao: number;
  custo_base_tipo: string;
  markup_tipo: string;
  markup_valor: number;
  impostos_percentual: number;
  frete_valor: number;
  margem_contribuicao: number;
  preco_sugerido: number;
  status: string;
  aprovado_por: string | null;
  aprovado_em: string | null;
  observacoes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProdutoBrasilSku {
  id: string;
  produto_brasil_id: string;
  cor: string | null;
  cor_hex: string | null;
  tamanho_grade: string | null;
  codigo_interno: string | null;
  ean: string | null;
  quantidade_inicial: number;
  ordem: number;
  foto_url: string | null;
  created_at: string;
}

export interface ProdutoBrasilChecklist {
  id: string;
  produto_brasil_id: string;
  item: string;
  concluido: boolean;
  concluido_por: string | null;
  concluido_em: string | null;
  observacao: string | null;
}

export interface ProdutoTeste {
  id: string;
  produto_brasil_id: string;
  tipo_teste: string;
  status: string;
  responsavel_id: string | null;
  resultado: string | null;
  fotos: string[];
  lote: string | null;
  fornecedor: string | null;
  data_solicitacao: string | null;
  data_recebimento: string | null;
  data_resultado: string | null;
  observacoes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AprovacaoFisica {
  id: string;
  produto_brasil_id: string;
  cor_conforme: boolean | null;
  textura_conforme: boolean | null;
  fragrancia_conforme: boolean | null;
  rotulagem_conforme: boolean | null;
  peso_conforme: boolean | null;
  resultado: string;
  avaliado_por: string | null;
  avaliado_em: string | null;
  observacoes: string | null;
  fotos: string[];
  created_at: string;
  updated_at: string;
}

export interface ProdutoRNC {
  id: string;
  produto_brasil_id: string;
  aprovacao_fisica_id: string | null;
  descricao: string;
  tipo_nao_conformidade: string;
  acao_corretiva: string | null;
  prazo_correcao: string | null;
  fornecedor_notificado: boolean;
  fornecedor_nome: string | null;
  fotos: string[];
  status: string;
  resolvida_em: string | null;
  resolvida_por: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const CHECKLIST_ITEMS = [
  "Conferência de rotulagem",
  "Conferência de composição",
  "Registro ou notificação (se aplicável)",
  "Categoria ANVISA",
  "Tradução e adequação da descrição",
  "Validação de imagens da embalagem",
  "Verificação de obrigatoriedade de lote e validade",
];

// Phase 4: Packaging checklist items
const CHECKLIST_EMBALAGEM = [
  "Faca primária",
  "Faca display",
  "Faca cartucho",
  "Faca tester",
  "Etiqueta fundo",
  "Etiqueta bula",
  "Etiqueta tester",
  "Medidas display",
  "Peso embalagem",
  "Arte aprovada",
  "Mockup aprovado",
  "Foto final",
];

export const ALL_CHECKLIST_ITEMS = [...CHECKLIST_ITEMS, ...CHECKLIST_EMBALAGEM];

// Phase 1: Expanded 12-stage pipeline
export const PRODUCT_STATUS_LABELS: Record<string, string> = {
  ideia: "Ideia / Conceito",
  projeto_vinculado: "Projeto Vinculado",
  precadastro: "Pré-cadastro",
  desenvolvimento: "Desenvolvimento",
  testes: "Testes / Amostras",
  embalagem: "Embalagem",
  regulatorio: "Regulatório",
  cadastro_final: "Cadastro Final",
  aprovacao: "Aprovação Física",
  producao: "Produção / Pedido",
  lancamento: "Lançamento",
  // Legacy statuses (mapped for backwards compatibility)
  produto_importado: "Produto Importado",
  aguardando_precadastro: "Aguardando Pré-cadastro",
  precadastro_em_andamento: "Pré-cadastro em Andamento",
  aguardando_regulatorio: "Aguardando Regulatório",
  aprovado_cadastro: "Aprovado para Cadastro",
  produto_ativo: "Produto Ativo",
};

export const PRODUCT_STATUS_COLORS: Record<string, string> = {
  ideia: "secondary",
  projeto_vinculado: "secondary",
  precadastro: "default",
  desenvolvimento: "default",
  testes: "warning",
  embalagem: "warning",
  regulatorio: "warning",
  cadastro_final: "default",
  aprovacao: "warning",
  producao: "success",
  lancamento: "success",
  // Legacy
  produto_importado: "secondary",
  aguardando_precadastro: "warning",
  precadastro_em_andamento: "default",
  aguardando_regulatorio: "warning",
  aprovado_cadastro: "success",
  produto_ativo: "success",
};

// Phase 5: ANVISA pipeline statuses
export const ANVISA_PIPELINE_LABELS: Record<string, string> = {
  analise_regulatoria: "Análise Regulatória",
  dossie_em_elaboracao: "Dossiê em Elaboração",
  enviado_anvisa: "Enviado ANVISA",
  em_aprovacao: "Em Aprovação",
  aprovado: "Aprovado",
};

// Test types for Phase 3
export const TIPO_TESTE_LABELS: Record<string, string> = {
  cor: "Teste de Cor",
  fragrancia: "Teste de Fragrância",
  textura: "Teste de Textura",
  aplicador: "Teste de Aplicador",
  estabilidade: "Teste de Estabilidade",
};

export const TESTE_STATUS_LABELS: Record<string, string> = {
  amostra_solicitada: "Amostra Solicitada",
  amostra_recebida: "Amostra Recebida",
  em_teste: "Em Teste",
  aprovada: "Aprovada",
  reprovada: "Reprovada",
  ajuste_solicitado: "Ajuste Solicitado",
};

// Fetch single produto brasil by ID
export function useProdutoBrasil(id: string | undefined) {
  return useQuery({
    queryKey: ["produto-brasil", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("produtos_brasil" as any)
        .select("*")
        .eq("id", id!)
        .single() as any);
      if (error) throw error;
      return data as ProdutoBrasil;
    },
  });
}

// Fetch SKUs for a produto brasil
export function useProdutoBrasilSkus(produtoBrasilId: string | undefined) {
  return useQuery({
    queryKey: ["produto-brasil-skus", produtoBrasilId],
    enabled: !!produtoBrasilId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("produto_brasil_skus" as any)
        .select("*")
        .eq("produto_brasil_id", produtoBrasilId!)
        .order("ordem")
        .order("created_at") as any);
      if (error) throw error;
      return (data || []) as ProdutoBrasilSku[];
    },
  });
}

// Fetch checklist for a produto brasil
export function useProdutoBrasilChecklist(produtoBrasilId: string | undefined) {
  return useQuery({
    queryKey: ["produto-brasil-checklist", produtoBrasilId],
    enabled: !!produtoBrasilId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("produto_brasil_checklist" as any)
        .select("*")
        .eq("produto_brasil_id", produtoBrasilId!) as any);
      if (error) throw error;
      return (data || []) as ProdutoBrasilChecklist[];
    },
  });
}

// Phase 3: Fetch tests for a produto
export function useProdutoTestes(produtoBrasilId: string | undefined) {
  return useQuery({
    queryKey: ["produto-testes", produtoBrasilId],
    enabled: !!produtoBrasilId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("produto_testes" as any)
        .select("*")
        .eq("produto_brasil_id", produtoBrasilId!)
        .order("created_at", { ascending: false }) as any);
      if (error) throw error;
      return (data || []) as ProdutoTeste[];
    },
  });
}

// Phase 6: Fetch physical approval
export function useAprovacaoFisica(produtoBrasilId: string | undefined) {
  return useQuery({
    queryKey: ["aprovacao-fisica", produtoBrasilId],
    enabled: !!produtoBrasilId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("produto_aprovacoes_fisicas" as any)
        .select("*")
        .eq("produto_brasil_id", produtoBrasilId!)
        .order("created_at", { ascending: false })
        .limit(1) as any);
      if (error) throw error;
      return (data?.[0] || null) as AprovacaoFisica | null;
    },
  });
}

// Phase 6: Fetch RNCs
export function useProdutoRNCs(produtoBrasilId: string | undefined) {
  return useQuery({
    queryKey: ["produto-rnc", produtoBrasilId],
    enabled: !!produtoBrasilId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("produto_rnc" as any)
        .select("*")
        .eq("produto_brasil_id", produtoBrasilId!)
        .order("created_at", { ascending: false }) as any);
      if (error) throw error;
      return (data || []) as ProdutoRNC[];
    },
  });
}

// Create produto brasil with checklist items (expanded with packaging items)
export function useCreateProdutoBrasil() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      submissao_china_id?: string;
      vinculo_id?: string;
      projeto_id?: string;
      china_nome?: string | null;
      china_codigo?: string;
      china_ean?: string;
      china_categoria?: string;
      china_descricao?: string;
      responsavel_precadastro_id?: string;
      nome_brasil?: string;
      marca?: string;
      linha?: string;
      categoria_brasil?: string;
      status?: string;
    }) => {
      const { data: produto, error } = await (supabase
        .from("produtos_brasil" as any)
        .insert({
          ...params,
          created_by: user?.id || null,
          status: params.status || "ideia",
        })
        .select()
        .single() as any);
      if (error) throw error;

      // Populate checklist with standard + packaging items
      const checklistInserts = ALL_CHECKLIST_ITEMS.map((item) => ({
        produto_brasil_id: produto.id,
        item,
        concluido: false,
      }));
      await (supabase
        .from("produto_brasil_checklist" as any)
        .insert(checklistInserts) as any);

      return produto as ProdutoBrasil;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produto-brasil"] });
    },
  });
}

// Update produto brasil fields
export function useUpdateProdutoBrasil() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProdutoBrasil> & { id: string }) => {
      const { error } = await (supabase
        .from("produtos_brasil" as any)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["produto-brasil", vars.id] });
      queryClient.invalidateQueries({ queryKey: ["produto-brasil"] });
      toast.success("Produto atualizado");
    },
    onError: () => {
      toast.error("Erro ao atualizar produto");
    },
  });
}

// Toggle checklist item
export function useToggleChecklistItem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, concluido }: { id: string; concluido: boolean; produtoBrasilId: string }) => {
      const { error } = await (supabase
        .from("produto_brasil_checklist" as any)
        .update({
          concluido,
          concluido_por: concluido ? user?.id : null,
          concluido_em: concluido ? new Date().toISOString() : null,
        })
        .eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["produto-brasil-checklist", vars.produtoBrasilId] });
    },
  });
}

// Phase 3: CRUD Testes
export function useCreateTeste() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: { produto_brasil_id: string; tipo_teste: string; responsavel_id?: string; lote?: string; fornecedor?: string; observacoes?: string }) => {
      const { error } = await (supabase
        .from("produto_testes" as any)
        .insert({ ...params, created_by: user?.id }) as any);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["produto-testes", vars.produto_brasil_id] });
      toast.success("Teste criado");
    },
  });
}

export function useUpdateTeste() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, produtoBrasilId, ...updates }: { id: string; produtoBrasilId: string } & Partial<ProdutoTeste>) => {
      const { error } = await (supabase
        .from("produto_testes" as any)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id) as any);
      if (error) throw error;
      return produtoBrasilId;
    },
    onSuccess: (produtoBrasilId) => {
      queryClient.invalidateQueries({ queryKey: ["produto-testes", produtoBrasilId] });
      toast.success("Teste atualizado");
    },
  });
}

// Phase 6: CRUD Aprovação Física
export function useCreateAprovacaoFisica() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: Partial<AprovacaoFisica> & { produto_brasil_id: string }) => {
      const { data, error } = await (supabase
        .from("produto_aprovacoes_fisicas" as any)
        .insert({ ...params, avaliado_por: user?.id, avaliado_em: new Date().toISOString() })
        .select()
        .single() as any);
      if (error) throw error;
      return data as AprovacaoFisica;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["aprovacao-fisica", vars.produto_brasil_id] });
      toast.success("Aprovação registrada");
    },
  });
}

// Phase 6: CRUD RNC
export function useCreateRNC() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: { produto_brasil_id: string; descricao: string; tipo_nao_conformidade: string; aprovacao_fisica_id?: string; fornecedor_nome?: string; acao_corretiva?: string; prazo_correcao?: string }) => {
      const { error } = await (supabase
        .from("produto_rnc" as any)
        .insert({ ...params, created_by: user?.id }) as any);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["produto-rnc", vars.produto_brasil_id] });
      toast.success("RNC registrada");
    },
  });
}

// CRUD SKUs
export function useAddSku() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { produto_brasil_id: string; cor?: string; cor_hex?: string; tamanho_grade?: string; codigo_interno?: string; ean?: string; quantidade_inicial?: number; ordem?: number; foto_url?: string }) => {
      const { error } = await (supabase
        .from("produto_brasil_skus" as any)
        .insert(params) as any);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["produto-brasil-skus", vars.produto_brasil_id] });
      toast.success("SKU adicionado");
    },
  });
}

export function useUpdateSku() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, produtoBrasilId, updates }: { id: string; produtoBrasilId: string; updates: Record<string, any> }) => {
      const { error } = await (supabase
        .from("produto_brasil_skus" as any)
        .update(updates)
        .eq("id", id) as any);
      if (error) throw error;
      return produtoBrasilId;
    },
    onSuccess: (produtoBrasilId) => {
      queryClient.invalidateQueries({ queryKey: ["produto-brasil-skus", produtoBrasilId] });
    },
  });
}

export function useDeleteSku() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, produtoBrasilId }: { id: string; produtoBrasilId: string }) => {
      const { error } = await (supabase
        .from("produto_brasil_skus" as any)
        .delete()
        .eq("id", id) as any);
      if (error) throw error;
      return produtoBrasilId;
    },
    onSuccess: (produtoBrasilId) => {
      queryClient.invalidateQueries({ queryKey: ["produto-brasil-skus", produtoBrasilId] });
      toast.success("SKU removido");
    },
  });
}

export function useImportSkusFromChina() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ produtoBrasilId, submissaoId }: { produtoBrasilId: string; submissaoId: string }) => {
      const { data: existing } = await (supabase
        .from("produto_brasil_skus" as any)
        .select("id")
        .eq("produto_brasil_id", produtoBrasilId)
        .limit(1) as any);

      if (existing && existing.length > 0) {
        toast.info("Grade já importada. Remova os itens existentes para reimportar.");
        return;
      }

      const { data: cores, error } = await (supabase
        .from("china_produto_cores" as any)
        .select("*")
        .eq("submissao_id", submissaoId)
        .order("ordem") as any);

      if (error) throw error;
      if (!cores || cores.length === 0) {
        toast.info("Nenhuma cor encontrada na submissão China.");
        return;
      }

      const skusToInsert = cores.map((cor: any, i: number) => ({
        produto_brasil_id: produtoBrasilId,
        cor: cor.cor_nome,
        cor_hex: cor.cor_hex || null,
        codigo_interno: cor.codigo_produto || null,
        ean: cor.codigo_barras_ean || null,
        quantidade_inicial: cor.quantidade || 0,
        ordem: i,
        foto_url: cor.foto_url || null,
      }));

      const { error: insertError } = await (supabase
        .from("produto_brasil_skus" as any)
        .insert(skusToInsert) as any);
      if (insertError) throw insertError;

      toast.success(`${skusToInsert.length} variação(ões) importada(s) da China!`);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["produto-brasil-skus", vars.produtoBrasilId] });
    },
    onError: () => toast.error("Erro ao importar grade da China"),
  });
}
