import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Constants ──

export const CHECKLIST_TIPOS = [
  { key: "etiqueta_bula", label: "Etiqueta / Bula", short: "Etiq. Bula" },
  { key: "etiqueta_fundo", label: "Etiqueta de Fundo", short: "Etiq. Fundo" },
  { key: "tester", label: "Tester", short: "Tester" },
  { key: "etiqueta_teste", label: "Etiqueta de Teste", short: "Etiq. Teste" },
  { key: "display", label: "Display", short: "Display" },
] as const;

export type ChecklistTipo = typeof CHECKLIST_TIPOS[number]["key"];

export const ETAPAS = [
  { key: "criacao", label: "Criação", order: 0 },
  { key: "embalagem", label: "Embalagem", order: 1 },
  { key: "desenvolvimento", label: "Desenvolvimento", order: 2 },
  { key: "regulatorio", label: "Regulatório", order: 3 },
  { key: "af_final", label: "Arte Final", order: 4 },
] as const;

export type EtapaKey = typeof ETAPAS[number]["key"];

export const REGULATORIO_ITEMS = [
  { key: "inci_presente", label: "Composição INCI presente no rótulo?" },
  { key: "anvisa_visivel", label: "Número ANVISA / notificação visível?" },
  { key: "idioma_correto", label: "Idioma português correto?" },
  { key: "peso_liquido", label: "Peso líquido informado?" },
  { key: "prazo_validade", label: "Prazo de validade presente?" },
  { key: "sac_endereco", label: "SAC / endereço fabricante?" },
  { key: "advertencias", label: "Advertências legais?" },
] as const;

// ── Type-specific field defaults ──

export const CAMPOS_ESPECIFICOS_DEFAULT: Record<ChecklistTipo, Record<string, any>> = {
  etiqueta_bula: {
    double_sticker: false,
    finishing: "shiny",
    colors: "product_color",
  },
  etiqueta_fundo: {
    dimensoes_largura: "",
    dimensoes_altura: "",
    area_colagem: "",
    informacoes_verso: "",
  },
  tester: {
    tipo_tester: "expositor",
    quantidade_unidades: 0,
    material_tester: "",
  },
  etiqueta_teste: {
    finalidade: "qa_interno",
    campos_minimos: "",
    validade_provisoria: "",
  },
  display: {
    dimensoes_largura: "",
    dimensoes_altura: "",
    dimensoes_profundidade: "",
    capacidade: 0,
    tipo_display: "balcao",
    material: "papelao",
    faca_display_url: "",
  },
};

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

export type FluxoArte = {
  id: string;
  produto_id: string;
  sku: string;
  produto_nome: string;
  linha_marca: string | null;
  tipo_checklist: ChecklistTipo;
  numero_documento: string | null;
  etapa_atual: EtapaKey;
  status_geral: "em_andamento" | "aprovado" | "reprovado" | "aguardando";
  numero_rodada: number;
  campos_especificos: Record<string, any>;
  aprovacoes: AprovacaoEntry[];
  historico: HistoricoEntry[];
  regulatorio_checklist: RegulatorioItem[];
  arte_final_url: string | null;
  faca_url: string | null;
  fotos_referencia: string[];
  data_af_recebida: string | null;
  submissao_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type FluxoCor = {
  id: string;
  fluxo_id: string;
  codigo_cor: string;
  pantone_ref: string | null;
  cor_hex: string | null;
  swatch_url: string | null;
  arte_url: string | null;
  ordem: number;
  created_at: string;
};

// ── Queries ──

export function useAllFluxoArtes(filters?: { tipo?: ChecklistTipo; status?: string; produto_id?: string }) {
  return useQuery({
    queryKey: ["fluxo_artes_all", filters],
    queryFn: async () => {
      let query = supabase
        .from("produto_fluxo_artes")
        .select("*")
        .order("updated_at", { ascending: false });

      if (filters?.tipo) query = query.eq("tipo_checklist", filters.tipo as any);
      if (filters?.status) query = query.eq("status_geral", filters.status as any);
      if (filters?.produto_id) query = query.eq("produto_id", filters.produto_id);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as FluxoArte[];
    },
  });
}

export function useFluxoArteDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["fluxo_arte", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produto_fluxo_artes")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as unknown as FluxoArte;
    },
    enabled: !!id,
  });
}

export function useFluxoCores(fluxoId: string | undefined) {
  return useQuery({
    queryKey: ["fluxo_artes_cores", fluxoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produto_fluxo_artes_cores")
        .select("*")
        .eq("fluxo_id", fluxoId!)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as FluxoCor[];
    },
    enabled: !!fluxoId,
  });
}

// Gate check: all 5 types must be af_final for a product
export function useGateCheck(produtoId: string | undefined) {
  return useQuery({
    queryKey: ["fluxo_artes_gate", produtoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produto_fluxo_artes")
        .select("tipo_checklist, etapa_atual, status_geral")
        .eq("produto_id", produtoId!);
      if (error) throw error;

      const items = (data || []) as unknown as Pick<FluxoArte, "tipo_checklist" | "etapa_atual" | "status_geral">[];
      const gate: Record<string, boolean> = {};
      for (const t of CHECKLIST_TIPOS) {
        const found = items.find(i => i.tipo_checklist === t.key);
        gate[t.key] = found?.etapa_atual === "af_final" && found?.status_geral === "aprovado";
      }
      const allComplete = CHECKLIST_TIPOS.every(t => gate[t.key]);
      return { gate, allComplete, items };
    },
    enabled: !!produtoId,
  });
}

// Grouped by product for dashboard
export function useFluxoArtesAgrupado() {
  return useQuery({
    queryKey: ["fluxo_artes_agrupado"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produto_fluxo_artes")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;

      const items = (data || []) as unknown as FluxoArte[];
      const grouped = new Map<string, { produto_id: string; sku: string; produto_nome: string; fluxos: FluxoArte[] }>();

      for (const item of items) {
        const key = item.produto_id;
        if (!grouped.has(key)) {
          grouped.set(key, { produto_id: item.produto_id, sku: item.sku, produto_nome: item.produto_nome, fluxos: [] });
        }
        grouped.get(key)!.fluxos.push(item);
      }

      return Array.from(grouped.values());
    },
  });
}

// ── Mutations ──

export function useCreateFluxoArte() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      produto_id: string;
      sku: string;
      produto_nome: string;
      linha_marca?: string;
      tipo_checklist: ChecklistTipo;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      // Auto-generate document number
      const year = new Date().getFullYear();
      const { count } = await supabase
        .from("produto_fluxo_artes")
        .select("*", { count: "exact", head: true });
      const num = String((count || 0) + 1).padStart(3, "0");
      const numero_documento = `DOC-${year}-${num}`;

      const regulatorio_checklist = REGULATORIO_ITEMS.map(i => ({
        key: i.key, label: i.label, resultado: null, observacao: "",
      }));

      const campos_especificos = CAMPOS_ESPECIFICOS_DEFAULT[input.tipo_checklist] || {};

      const { data, error } = await supabase
        .from("produto_fluxo_artes")
        .insert({
          ...input,
          numero_documento,
          regulatorio_checklist,
          campos_especificos,
          status_geral: "em_andamento",
          created_by: user?.id,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as FluxoArte;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fluxo_artes_all"] });
      qc.invalidateQueries({ queryKey: ["fluxo_artes_agrupado"] });
      toast.success("Checklist criado com sucesso");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });
}

export function useUpdateFluxoArte() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FluxoArte> & { id: string }) => {
      const { error } = await supabase
        .from("produto_fluxo_artes")
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fluxo_artes_all"] });
      qc.invalidateQueries({ queryKey: ["fluxo_artes_agrupado"] });
      qc.invalidateQueries({ queryKey: ["fluxo_arte"] });
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });
}

export function useAvancarEtapaArte() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      fluxo,
      status,
      descricao,
    }: {
      id: string;
      fluxo: FluxoArte;
      status: "approved" | "approved_with_changes" | "not_approved";
      descricao?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const etapaAtualIdx = ETAPAS.findIndex(e => e.key === fluxo.etapa_atual);

      const newAprovacao: AprovacaoEntry = {
        etapa: fluxo.etapa_atual,
        status,
        responsavel_id: user?.id || "",
        data: new Date().toISOString(),
        descricao,
        rodada: fluxo.numero_rodada,
      };

      let nextEtapa: EtapaKey;
      let nextStatusGeral: FluxoArte["status_geral"] = "em_andamento";
      let nextRodada = fluxo.numero_rodada;

      if (status === "not_approved") {
        if (fluxo.etapa_atual === "regulatorio") {
          nextEtapa = "criacao";
        } else {
          const prevIdx = Math.max(0, etapaAtualIdx - 1);
          nextEtapa = ETAPAS[prevIdx].key as EtapaKey;
        }
        nextRodada = fluxo.numero_rodada + 1;
        nextStatusGeral = "reprovado";
      } else {
        const nextIdx = Math.min(ETAPAS.length - 1, etapaAtualIdx + 1);
        nextEtapa = ETAPAS[nextIdx].key as EtapaKey;
        if (nextEtapa === "af_final") {
          nextStatusGeral = "aguardando";
        }
      }

      const newHistorico: HistoricoEntry = {
        etapa_de: fluxo.etapa_atual,
        etapa_para: nextEtapa,
        acao: status,
        responsavel_id: user?.id || "",
        descricao,
        data: new Date().toISOString(),
        rodada: fluxo.numero_rodada,
      };

      const { error } = await supabase
        .from("produto_fluxo_artes")
        .update({
          etapa_atual: nextEtapa,
          status_geral: nextStatusGeral,
          numero_rodada: nextRodada,
          aprovacoes: [...(fluxo.aprovacoes || []), newAprovacao],
          historico: [...(fluxo.historico || []), newHistorico],
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fluxo_artes_all"] });
      qc.invalidateQueries({ queryKey: ["fluxo_artes_agrupado"] });
      qc.invalidateQueries({ queryKey: ["fluxo_arte"] });
      qc.invalidateQueries({ queryKey: ["fluxo_artes_gate"] });
      toast.success("Etapa atualizada com sucesso");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });
}

export function useConfirmarAFArte() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, arte_final_url }: { id: string; arte_final_url?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: fluxo } = await supabase
        .from("produto_fluxo_artes")
        .select("historico, aprovacoes, etapa_atual, numero_rodada")
        .eq("id", id)
        .single();

      const f = fluxo as any;
      const newHistorico: HistoricoEntry = {
        etapa_de: f?.etapa_atual || "af_final",
        etapa_para: "af_final",
        acao: "af_recebida",
        responsavel_id: user?.id || "",
        data: new Date().toISOString(),
        rodada: f?.numero_rodada || 1,
      };

      const { error } = await supabase
        .from("produto_fluxo_artes")
        .update({
          etapa_atual: "af_final",
          status_geral: "aprovado",
          arte_final_url: arte_final_url || null,
          data_af_recebida: new Date().toISOString(),
          historico: [...((f?.historico as any[]) || []), newHistorico],
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fluxo_artes_all"] });
      qc.invalidateQueries({ queryKey: ["fluxo_artes_agrupado"] });
      qc.invalidateQueries({ queryKey: ["fluxo_arte"] });
      qc.invalidateQueries({ queryKey: ["fluxo_artes_gate"] });
      toast.success("Arte Final recebida ✅");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });
}

// ── Color mutations ──

export function useAddFluxoCor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { fluxo_id: string; codigo_cor: string; pantone_ref?: string; cor_hex?: string; ordem?: number }) => {
      const { data, error } = await supabase
        .from("produto_fluxo_artes_cores")
        .insert(input as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["fluxo_artes_cores", vars.fluxo_id] });
      toast.success("Cor adicionada");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });
}

export function useDeleteFluxoCor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, fluxo_id }: { id: string; fluxo_id: string }) => {
      const { error } = await supabase.from("produto_fluxo_artes_cores").delete().eq("id", id);
      if (error) throw error;
      return fluxo_id;
    },
    onSuccess: (fluxo_id) => {
      qc.invalidateQueries({ queryKey: ["fluxo_artes_cores", fluxo_id] });
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });
}

// ── Upload ──

export async function uploadFluxoArteFile(folder: string, file: File) {
  const ext = file.name.split(".").pop();
  const path = `${folder}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("fluxo-artes")
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  const { data } = await supabase.storage.from("fluxo-artes").createSignedUrl(path, 31536000);
  return data?.signedUrl || path;
}

export function useDevolverEtapaArte() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id, fluxo, etapaDestino, justificativa, userInfo,
    }: {
      id: string;
      fluxo: FluxoArte;
      etapaDestino: string;
      justificativa: string;
      userInfo: { id: string; email: string; nome: string };
    }) => {
      const newHistorico: HistoricoEntry = {
        etapa_de: fluxo.etapa_atual,
        etapa_para: etapaDestino,
        acao: "devolucao",
        responsavel_id: userInfo.id,
        responsavel_nome: userInfo.nome,
        descricao: justificativa,
        data: new Date().toISOString(),
        rodada: fluxo.numero_rodada,
      };

      const { error } = await supabase
        .from("produto_fluxo_artes")
        .update({
          etapa_atual: etapaDestino,
          status_geral: "em_andamento",
          numero_rodada: fluxo.numero_rodada + 1,
          historico: [...(fluxo.historico || []), newHistorico],
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fluxo_artes_all"] });
      qc.invalidateQueries({ queryKey: ["fluxo_artes_agrupado"] });
      qc.invalidateQueries({ queryKey: ["fluxo_arte"] });
      toast.success("Etapa devolvida com sucesso");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });
}

// ── Helpers ──

export function getEtapaStatus(etapa: EtapaKey, fluxo: FluxoArte): "done" | "active" | "rejected" | "pending" {
  const etapaIdx = ETAPAS.findIndex(e => e.key === etapa);
  const atualIdx = ETAPAS.findIndex(e => e.key === fluxo.etapa_atual);

  if (etapa === fluxo.etapa_atual) {
    if (fluxo.status_geral === "reprovado") return "rejected";
    return "active";
  }

  const hasApproval = (fluxo.aprovacoes || []).some(
    a => a.etapa === etapa && (a.status === "approved" || a.status === "approved_with_changes")
  );
  if (hasApproval && etapaIdx < atualIdx) return "done";
  if (etapaIdx < atualIdx) return "done";
  return "pending";
}

export function getChecklistLabel(tipo: ChecklistTipo): string {
  return CHECKLIST_TIPOS.find(t => t.key === tipo)?.label || tipo;
}

export function getChecklistShort(tipo: ChecklistTipo): string {
  return CHECKLIST_TIPOS.find(t => t.key === tipo)?.short || tipo;
}

export function getFluxoStatusInfo(fluxo: FluxoArte): { color: string; label: string; icon: string } {
  if (fluxo.etapa_atual === "af_final" && fluxo.status_geral === "aprovado") {
    return { color: "text-green-600", label: "AF Recebida ✅", icon: "✅" };
  }
  if (fluxo.status_geral === "reprovado") {
    return { color: "text-red-600", label: `Reprovado R${fluxo.numero_rodada}`, icon: "🔴" };
  }
  const etapa = ETAPAS.find(e => e.key === fluxo.etapa_atual);
  return { color: "text-amber-600", label: `⏳ ${etapa?.label || fluxo.etapa_atual}`, icon: "⏳" };
}
