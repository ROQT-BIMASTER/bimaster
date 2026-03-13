import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Constants ──

export const ETAPAS = [
  { key: "criacao", label: "Criação", order: 0 },
  { key: "embalagem", label: "Embalagem", order: 1 },
  { key: "desenvolvimento", label: "Desenvolvimento", order: 2 },
  { key: "regulatorio", label: "Regulatório", order: 3 },
  { key: "af_recebida", label: "Arte Final", order: 4 },
] as const;

export const STATUS_MAP: Record<string, string> = {
  criacao: "rascunho",
  embalagem: "aguardando_embalagem",
  desenvolvimento: "aguardando_desenvolvimento",
  regulatorio: "aguardando_regulatorio",
  af_recebida: "aguardando_af",
};

export const REGULATORIO_ITEMS = [
  { key: "inci_presente", label: "Composição INCI presente no rótulo?" },
  { key: "anvisa_visivel", label: "Número ANVISA / notificação visível?" },
  { key: "idioma_correto", label: "Idioma português correto?" },
  { key: "peso_liquido", label: "Peso líquido informado?" },
  { key: "prazo_validade", label: "Prazo de validade presente?" },
  { key: "sac_endereco", label: "SAC / endereço fabricante?" },
  { key: "advertencias", label: "Advertências legais?" },
] as const;

// ── Types ──

export type AprovacaoEntry = {
  etapa: string;
  status: "approved" | "approved_with_changes" | "not_approved";
  responsavel_id: string;
  responsavel_nome?: string;
  descricao?: string;
  data: string;
  rodada: number;
};

export type HistoricoEntry = {
  etapa_de: string;
  etapa_para: string;
  acao: string;
  responsavel_id: string;
  responsavel_nome?: string;
  descricao?: string;
  data: string;
  rodada: number;
};

export type RegulatorioItem = {
  key: string;
  label: string;
  resultado: "conforme" | "nao_conforme" | null;
  observacao?: string;
};

export type EtiquetaBula = {
  id: string;
  submissao_id: string | null;
  sku: string;
  produto_nome: string;
  linha_marca: string | null;
  double_sticker: boolean;
  finishing: string;
  colors: string;
  arte_etiqueta_urls: string[];
  faca_url: string | null;
  fotos_referencia: string[];
  arte_final_url: string | null;
  data_af_recebida: string | null;
  etapa_atual: string;
  status_atual: string;
  numero_rodada: number;
  aprovacoes: AprovacaoEntry[];
  historico_completo: HistoricoEntry[];
  regulatorio_checklist: RegulatorioItem[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type EtiquetaCor = {
  id: string;
  etiqueta_id: string;
  codigo_cor: string;
  pantone_ref: string | null;
  cor_hex: string | null;
  swatch_url: string | null;
  arte_url: string | null;
  ordem: number;
  created_at: string;
};

// ── Queries ──

export function useAllEtiquetas() {
  return useQuery({
    queryKey: ["etiqueta_bula_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produto_etiqueta_bula")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as EtiquetaBula[];
    },
  });
}

export function useEtiquetaCores(etiquetaId: string | undefined) {
  return useQuery({
    queryKey: ["etiqueta_cores", etiquetaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produto_etiqueta_cores")
        .select("*")
        .eq("etiqueta_id", etiquetaId!)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as EtiquetaCor[];
    },
    enabled: !!etiquetaId,
  });
}

// ── Mutations ──

export function useCreateEtiqueta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { sku: string; produto_nome: string; linha_marca?: string; double_sticker?: boolean; submissao_id?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const regulatorio_checklist = REGULATORIO_ITEMS.map(i => ({
        key: i.key, label: i.label, resultado: null, observacao: "",
      }));
      const { data, error } = await supabase
        .from("produto_etiqueta_bula")
        .insert({ ...input, regulatorio_checklist, created_by: user?.id } as any)
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["etiqueta_bula_all"] });
      toast.success("Checklist de etiqueta/bula criado");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });
}

export function useUpdateEtiqueta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<EtiquetaBula> & { id: string }) => {
      const { error } = await supabase
        .from("produto_etiqueta_bula")
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["etiqueta_bula_all"] });
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });
}

export function useAvancarEtapa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id, etiqueta, status, descricao,
    }: {
      id: string;
      etiqueta: EtiquetaBula;
      status: "approved" | "approved_with_changes" | "not_approved";
      descricao?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const etapaAtualIdx = ETAPAS.findIndex(e => e.key === etiqueta.etapa_atual);
      
      const newAprovacao: AprovacaoEntry = {
        etapa: etiqueta.etapa_atual,
        status,
        responsavel_id: user?.id || "",
        data: new Date().toISOString(),
        descricao,
        rodada: etiqueta.numero_rodada,
      };

      let nextEtapa: string;
      let nextStatus: string;
      let nextRodada = etiqueta.numero_rodada;

      if (status === "not_approved") {
        // Reprovação: regulatório volta para criação, outros voltam para etapa anterior
        if (etiqueta.etapa_atual === "regulatorio") {
          nextEtapa = "criacao";
          nextStatus = "rascunho";
        } else {
          const prevIdx = Math.max(0, etapaAtualIdx - 1);
          nextEtapa = ETAPAS[prevIdx].key;
          nextStatus = STATUS_MAP[nextEtapa] || "rascunho";
        }
        nextRodada = etiqueta.numero_rodada + 1;
      } else {
        // Aprovação: avança para próxima etapa
        const nextIdx = Math.min(ETAPAS.length - 1, etapaAtualIdx + 1);
        nextEtapa = ETAPAS[nextIdx].key;
        nextStatus = nextEtapa === "af_recebida" ? "aguardando_af" : (STATUS_MAP[nextEtapa] || "concluido");
      }

      const newHistorico: HistoricoEntry = {
        etapa_de: etiqueta.etapa_atual,
        etapa_para: nextEtapa,
        acao: status,
        responsavel_id: user?.id || "",
        descricao,
        data: new Date().toISOString(),
        rodada: etiqueta.numero_rodada,
      };

      const { error } = await supabase
        .from("produto_etiqueta_bula")
        .update({
          etapa_atual: nextEtapa,
          status_atual: nextStatus,
          numero_rodada: nextRodada,
          aprovacoes: [...(etiqueta.aprovacoes || []), newAprovacao],
          historico_completo: [...(etiqueta.historico_completo || []), newHistorico],
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["etiqueta_bula_all"] });
      toast.success("Etapa atualizada com sucesso");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });
}

export function useConfirmarAF() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, arte_final_url }: { id: string; arte_final_url?: string }) => {
      const { error } = await supabase
        .from("produto_etiqueta_bula")
        .update({
          etapa_atual: "af_recebida",
          status_atual: "concluido",
          arte_final_url: arte_final_url || null,
          data_af_recebida: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["etiqueta_bula_all"] });
      toast.success("Arte Final recebida ✅");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });
}

// ── Cor mutations ──

export function useAddEtiquetaCor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { etiqueta_id: string; codigo_cor: string; pantone_ref?: string; cor_hex?: string; ordem?: number }) => {
      const { data, error } = await supabase
        .from("produto_etiqueta_cores")
        .insert(input as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["etiqueta_cores", vars.etiqueta_id] });
      toast.success("Cor adicionada");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });
}

export function useDeleteEtiquetaCor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, etiqueta_id }: { id: string; etiqueta_id: string }) => {
      const { error } = await supabase.from("produto_etiqueta_cores").delete().eq("id", id);
      if (error) throw error;
      return etiqueta_id;
    },
    onSuccess: (etiqueta_id) => {
      qc.invalidateQueries({ queryKey: ["etiqueta_cores", etiqueta_id] });
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });
}

// ── Upload ──

export async function uploadEtiquetaFile(folder: string, file: File) {
  const ext = file.name.split(".").pop();
  const path = `${folder}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("etiqueta-bula")
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("etiqueta-bula").getPublicUrl(path);
  return data.publicUrl;
}

// ── Helpers ──

export function getEtapaColor(etapa: string, etapaAtual: string, aprovacoes: AprovacaoEntry[]): "done" | "active" | "pending" {
  const etapaIdx = ETAPAS.findIndex(e => e.key === etapa);
  const atualIdx = ETAPAS.findIndex(e => e.key === etapaAtual);
  
  const approved = aprovacoes.some(a => a.etapa === etapa && (a.status === "approved" || a.status === "approved_with_changes"));
  if (approved && etapaIdx < atualIdx) return "done";
  if (etapa === etapaAtual) return "active";
  return "pending";
}
