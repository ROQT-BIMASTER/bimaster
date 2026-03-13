import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Types ──

export type AnaliseEmbalagem = {
  id: string;
  submissao_id: string;
  sku: string;
  linha_marca: string | null;
  produto_nome: string;
  tube_translucent: boolean;
  tube_shiny: boolean;
  cap_matte: boolean;
  cap_outro: string | null;
  finishing_embossed: boolean;
  finishing_translucent: boolean;
  finishing_outro: string | null;
  colors_product_color: boolean;
  colors_white: boolean;
  fotos_referencia: string[];
  status_aprovacao: string;
  descricao_alteracoes: string | null;
  aprovado_por: string | null;
  aprovado_em: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type EmbalagemCor = {
  id: string;
  analise_id: string;
  codigo_cor: string;
  pantone_ref: string | null;
  cor_hex: string | null;
  swatch_url: string | null;
  ordem: number;
  created_at: string;
};

export type SolicitacaoAmostra = {
  id: string;
  analise_id: string;
  submissao_id: string;
  numero_solicitacao: string;
  sku: string;
  data_solicitacao: string;
  sla_prazo: string;
  instrucao_ajuste: string | null;
  cores_solicitadas: string[];
  qtd_amostras: number;
  fotos_china: string[];
  video_url: string | null;
  video_path: string | null;
  numero_rodada: number;
  avaliacao_resultado: AvaliacaoItem[];
  avaliacao_status: string;
  aprovado_por: string | null;
  data_aprovacao: string | null;
  observacoes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AvaliacaoItem = {
  key: string;
  label: string;
  resultado: "conforme" | "nao_conforme" | null;
  observacao?: string;
};

export const AVALIACAO_ITEMS = [
  { key: "pantone", label: "Pantone confere?" },
  { key: "tube_cap", label: "Tube/Cap confere?" },
  { key: "finishing", label: "Special Finishing confere?" },
  { key: "acabamento", label: "Acabamento geral?" },
] as const;

// ── Queries ──

export function useAnalisesBySubmissao(submissaoId: string | undefined) {
  return useQuery({
    queryKey: ["analise_embalagem", submissaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produto_analise_embalagem")
        .select("*")
        .eq("submissao_id", submissaoId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as AnaliseEmbalagem[];
    },
    enabled: !!submissaoId,
  });
}

export function useEmbalagemCores(analiseId: string | undefined) {
  return useQuery({
    queryKey: ["embalagem_cores", analiseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produto_embalagem_cores")
        .select("*")
        .eq("analise_id", analiseId!)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as EmbalagemCor[];
    },
    enabled: !!analiseId,
  });
}

export function useSolicitacoesByAnalise(analiseId: string | undefined) {
  return useQuery({
    queryKey: ["solicitacao_amostra", analiseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produto_solicitacao_amostra")
        .select("*")
        .eq("analise_id", analiseId!)
        .order("numero_rodada", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as SolicitacaoAmostra[];
    },
    enabled: !!analiseId,
  });
}

export function useAllAnalises() {
  return useQuery({
    queryKey: ["analise_embalagem_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produto_analise_embalagem")
        .select("*, china_produto_submissoes!inner(produto_nome, produto_codigo)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

export function useAllSolicitacoes() {
  return useQuery({
    queryKey: ["solicitacao_amostra_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produto_solicitacao_amostra")
        .select("*, produto_analise_embalagem!inner(sku, produto_nome, submissao_id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

// ── Mutations ──

export function useCreateAnalise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      submissao_id: string;
      sku: string;
      produto_nome: string;
      linha_marca?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("produto_analise_embalagem")
        .insert({ ...input, created_by: user?.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["analise_embalagem"] });
      qc.invalidateQueries({ queryKey: ["analise_embalagem_all"] });
      toast.success("Análise de embalagem criada");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });
}

export function useUpdateAnalise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AnaliseEmbalagem> & { id: string }) => {
      const { error } = await supabase
        .from("produto_analise_embalagem")
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["analise_embalagem"] });
      qc.invalidateQueries({ queryKey: ["analise_embalagem_all"] });
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });
}

export function useAprovarAnalise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, descricao }: { id: string; status: "approved" | "approved_with_changes" | "not_approved"; descricao?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("produto_analise_embalagem")
        .update({
          status_aprovacao: status,
          descricao_alteracoes: descricao || null,
          aprovado_por: user?.id,
          aprovado_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["analise_embalagem"] });
      qc.invalidateQueries({ queryKey: ["analise_embalagem_all"] });
      toast.success("Status de aprovação atualizado");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });
}

// ── Cores Mutations ──

export function useAddCor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { analise_id: string; codigo_cor: string; pantone_ref?: string; cor_hex?: string; ordem?: number }) => {
      const { data, error } = await supabase
        .from("produto_embalagem_cores")
        .insert(input as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["embalagem_cores", vars.analise_id] });
      toast.success("Cor adicionada");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });
}

export function useDeleteCor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, analise_id }: { id: string; analise_id: string }) => {
      const { error } = await supabase.from("produto_embalagem_cores").delete().eq("id", id);
      if (error) throw error;
      return analise_id;
    },
    onSuccess: (analise_id) => {
      qc.invalidateQueries({ queryKey: ["embalagem_cores", analise_id] });
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });
}

// ── Solicitação Mutations ──

export function useCreateSolicitacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      analise_id: string;
      submissao_id: string;
      sku: string;
      sla_prazo: string;
      instrucao_ajuste?: string;
      cores_solicitadas?: string[];
      qtd_amostras?: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get next round
      const { data: existing } = await supabase
        .from("produto_solicitacao_amostra")
        .select("numero_rodada")
        .eq("analise_id", input.analise_id)
        .order("numero_rodada", { ascending: false })
        .limit(1);
      const nextRound = (existing?.[0]?.numero_rodada || 0) + 1;

      // Generate number
      const year = new Date().getFullYear();
      const num = String(nextRound).padStart(3, "0");
      const numero_solicitacao = `SOL-${year}-${num}`;

      const avaliacao_resultado = AVALIACAO_ITEMS.map(i => ({
        key: i.key, label: i.label, resultado: null, observacao: "",
      }));

      const { data, error } = await supabase
        .from("produto_solicitacao_amostra")
        .insert({
          ...input,
          numero_solicitacao,
          numero_rodada: nextRound,
          avaliacao_resultado,
          created_by: user?.id,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["solicitacao_amostra"] });
      qc.invalidateQueries({ queryKey: ["solicitacao_amostra_all"] });
      toast.success("Solicitação de amostra enviada à China");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });
}

export function useUpdateSolicitacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SolicitacaoAmostra> & { id: string }) => {
      const { error } = await supabase
        .from("produto_solicitacao_amostra")
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["solicitacao_amostra"] });
      qc.invalidateQueries({ queryKey: ["solicitacao_amostra_all"] });
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });
}

export function useAvaliarSolicitacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, avaliacao_resultado }: { id: string; status: "conforme" | "nao_conforme"; avaliacao_resultado: AvaliacaoItem[] }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("produto_solicitacao_amostra")
        .update({
          avaliacao_status: status,
          avaliacao_resultado,
          aprovado_por: status === "conforme" ? user?.id : null,
          data_aprovacao: status === "conforme" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["solicitacao_amostra"] });
      qc.invalidateQueries({ queryKey: ["solicitacao_amostra_all"] });
      toast.success(vars.status === "conforme" ? "Amostra aprovada — avança no pipeline!" : "Amostra reprovada — nova rodada necessária.");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });
}

// ── Upload helpers ──

export async function uploadEmbalagemFile(folder: string, file: File) {
  const ext = file.name.split(".").pop();
  const path = `${folder}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("embalagem-analise")
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("embalagem-analise").getPublicUrl(path);
  return data.publicUrl;
}

// ── SLA helpers ──

export function getSlaStatus(slaPrazo: string): "ok" | "warning" | "vencido" {
  const hoje = new Date();
  const prazo = new Date(slaPrazo);
  const diffDays = Math.ceil((prazo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "vencido";
  if (diffDays <= 3) return "warning";
  return "ok";
}
