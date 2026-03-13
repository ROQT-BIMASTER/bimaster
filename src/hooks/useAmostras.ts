import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const ANGLE_TYPES = [
  { value: "frente", label: "Frente do produto" },
  { value: "verso", label: "Verso / Rótulo" },
  { value: "aberto", label: "Produto aberto / aplicado" },
  { value: "lateral", label: "Lateral" },
  { value: "detalhe", label: "Detalhe / Close-up" },
  { value: "embalagem", label: "Embalagem externa" },
  { value: "evidencia_nc", label: "Evidência Não Conforme" },
] as const;

export const CHECKLIST_ITEMS = [
  { key: "embalagem_arte", label: "Embalagem física confere com arte aprovada?" },
  { key: "cor_produto", label: "Cor do produto confere com padrão?" },
  { key: "rotulo_info", label: "Rótulo com informações corretas?" },
  { key: "formula_textura", label: "Produto interno (fórmula/textura) confere?" },
  { key: "aplicador_acabamento", label: "Aplicador/acabamento confere?" },
] as const;

export type Amostra = {
  id: string;
  submissao_id: string;
  numero_rodada: number;
  data_solicitacao: string;
  data_recebimento: string | null;
  qtd_unidades: number | null;
  qtd_cores: number | null;
  fotos: any[];
  video_url: string | null;
  video_path: string | null;
  checklist_resultado: ChecklistItem[];
  status: string;
  aprovado_por: string | null;
  aprovado_em: string | null;
  instrucao_correcao: string | null;
  prazo_reenvio: string | null;
  observacoes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ChecklistItem = {
  key: string;
  label: string;
  resultado: "conforme" | "nao_conforme" | null;
  observacao?: string;
  foto_evidencia_id?: string;
};

export type AmostraFoto = {
  id: string;
  amostra_id: string;
  arquivo_path: string;
  arquivo_url: string | null;
  angle_type: string;
  checklist_item_key: string | null;
  tipo: string;
  observacao: string | null;
  created_at: string;
};

// ── Queries ──

export function useAmostrasBySubmissao(submissaoId: string | undefined) {
  return useQuery({
    queryKey: ["amostras", submissaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produto_amostras")
        .select("*")
        .eq("submissao_id", submissaoId!)
        .order("numero_rodada", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Amostra[];
    },
    enabled: !!submissaoId,
  });
}

export function useAmostraFotos(amostraId: string | undefined) {
  return useQuery({
    queryKey: ["amostra_fotos", amostraId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produto_amostra_fotos")
        .select("*")
        .eq("amostra_id", amostraId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as AmostraFoto[];
    },
    enabled: !!amostraId,
  });
}

export function useAllAmostras() {
  return useQuery({
    queryKey: ["amostras_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produto_amostras")
        .select("*, china_produto_submissoes!inner(produto_nome, produto_codigo)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

// ── Mutations ──

export function useCreateAmostra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ submissaoId }: { submissaoId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      // Get next round number
      const { data: existing } = await supabase
        .from("produto_amostras")
        .select("numero_rodada")
        .eq("submissao_id", submissaoId)
        .order("numero_rodada", { ascending: false })
        .limit(1);
      const nextRound = (existing?.[0]?.numero_rodada || 0) + 1;

      const checklist = CHECKLIST_ITEMS.map(item => ({
        key: item.key, label: item.label, resultado: null, observacao: "",
      }));

      const { data, error } = await supabase.from("produto_amostras").insert({
        submissao_id: submissaoId,
        numero_rodada: nextRound,
        checklist_resultado: checklist,
        created_by: user?.id,
      } as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["amostras"] });
      qc.invalidateQueries({ queryKey: ["amostras_all"] });
      toast.success("Solicitação de amostra criada");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });
}

export function useUpdateAmostra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Amostra> & { id: string }) => {
      const { error } = await supabase
        .from("produto_amostras")
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["amostras"] });
      qc.invalidateQueries({ queryKey: ["amostras_all"] });
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });
}

export function useAprovarAmostra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("produto_amostras").update({
        status: "aprovada",
        aprovado_por: user?.id,
        aprovado_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["amostras"] });
      qc.invalidateQueries({ queryKey: ["amostras_all"] });
      toast.success("Amostra aprovada! Produto avança no pipeline.");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });
}

export function useReprovarAmostra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, instrucao_correcao, prazo_reenvio }: { id: string; instrucao_correcao: string; prazo_reenvio?: string }) => {
      const { error } = await supabase.from("produto_amostras").update({
        status: "reprovada",
        instrucao_correcao,
        prazo_reenvio: prazo_reenvio || null,
        updated_at: new Date().toISOString(),
      } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["amostras"] });
      qc.invalidateQueries({ queryKey: ["amostras_all"] });
      toast.success("Amostra devolvida para China com instruções de correção.");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });
}

// ── Upload helpers ──

export async function uploadAmostraFile(
  amostraId: string,
  file: File,
  angleType: string,
  tipo: "foto" | "video" = "foto",
  checklistItemKey?: string,
) {
  const ext = file.name.split(".").pop();
  const path = `${amostraId}/${tipo}_${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("amostras")
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from("amostras").getPublicUrl(path);

  const { data, error } = await supabase.from("produto_amostra_fotos").insert({
    amostra_id: amostraId,
    arquivo_path: path,
    arquivo_url: urlData.publicUrl,
    angle_type: angleType,
    tipo,
    checklist_item_key: checklistItemKey || null,
  } as any).select().single();
  if (error) throw error;

  return data as unknown as AmostraFoto;
}
