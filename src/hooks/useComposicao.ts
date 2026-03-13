import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const FUNCAO_OPTIONS = [
  { value: "colorant", label: "Corante" },
  { value: "fragrance", label: "Fragrância" },
  { value: "moisturizer", label: "Hidratante" },
  { value: "preservative", label: "Conservante" },
  { value: "antioxidant", label: "Antioxidante" },
  { value: "emollient", label: "Emoliente" },
  { value: "conditioner", label: "Condicionador" },
  { value: "surfactant", label: "Surfactante" },
  { value: "thickener", label: "Espessante" },
  { value: "film_forming", label: "Film-forming Agent" },
  { value: "skin_conditioning", label: "Skin Conditioning" },
  { value: "perfume", label: "Perfume" },
  { value: "outros", label: "Outros" },
] as const;

export const STATUS_ANVISA_OPTIONS = [
  { value: "pendente", label: "Pendente", icon: "⏳" },
  { value: "conforme", label: "Conforme", icon: "✅" },
  { value: "atencao", label: "Atenção", icon: "⚠️" },
  { value: "restrito", label: "Restrito ANVISA", icon: "❌" },
] as const;

export type Composicao = {
  id: string;
  submissao_id: string;
  versao: number;
  nome_chines: string | null;
  inci_name: string;
  cas_no: string | null;
  funcao: string;
  percentual_por_cor: Record<string, number>;
  status_anvisa: string;
  observacao_anvisa: string | null;
  aprovado_por: string | null;
  data_aprovacao: string | null;
  justificativa_correcao: string | null;
  created_at: string;
  updated_at: string;
};

export type ComposicaoVersao = {
  id: string;
  submissao_id: string;
  versao: number;
  status: string;
  submetido_por: string | null;
  submetido_em: string | null;
  aprovado_por: string | null;
  aprovado_em: string | null;
  observacoes: string | null;
  created_at: string;
};

export type GateCriacao = {
  id: string;
  submissao_id: string;
  composicao_ok: boolean;
  composicao_aprovada_por: string | null;
  composicao_aprovada_em: string | null;
  arte_primaria_ok: boolean;
  arte_aprovada_por: string | null;
  arte_aprovada_em: string | null;
  pacote_liberado: boolean;
  pacote_liberado_em: string | null;
  notificacao_criacao_enviada: boolean;
};

export type Peticionamento = {
  id: string;
  submissao_id: string;
  documento_composicao_id: string | null;
  documento_embalagem_id: string | null;
  tipo_grau: string;
  numero_processo: string | null;
  data_envio: string | null;
  data_aprovacao: string | null;
  taxa: number | null;
  status: string;
  observacoes: string | null;
  criado_por: string | null;
  checklist_composicao_ok: boolean;
  checklist_embalagem_ok: boolean;
  created_at: string;
  updated_at: string;
};

// ── Composição Ingredientes ──

export function useComposicaoBySubmissao(submissaoId: string | undefined, versao?: number) {
  return useQuery({
    queryKey: ["composicao", submissaoId, versao],
    queryFn: async () => {
      let query = supabase
        .from("produto_composicao")
        .select("*")
        .eq("submissao_id", submissaoId!)
        .order("created_at", { ascending: true });

      if (versao) query = query.eq("versao", versao);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as Composicao[];
    },
    enabled: !!submissaoId,
  });
}

export function useUpsertComposicao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: Partial<Composicao>[]) => {
      const { data, error } = await supabase
        .from("produto_composicao")
        .upsert(items as any, { onConflict: "id" })
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["composicao"] });
      toast.success("Composição salva com sucesso");
    },
    onError: (err: any) => toast.error("Erro ao salvar composição: " + err.message),
  });
}

export function useDeleteComposicaoItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("produto_composicao").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["composicao"] });
    },
  });
}

export function useUpdateComposicaoStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status_anvisa, observacao_anvisa }: { id: string; status_anvisa: string; observacao_anvisa?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const updates: any = { status_anvisa, observacao_anvisa: observacao_anvisa || null, updated_at: new Date().toISOString() };
      if (status_anvisa === "conforme") {
        updates.aprovado_por = user?.id;
        updates.data_aprovacao = new Date().toISOString();
      }
      const { error } = await supabase.from("produto_composicao").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["composicao"] });
      toast.success("Status atualizado");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });
}

export function useAjustarPercentual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, percentual_por_cor, justificativa_correcao }: { id: string; percentual_por_cor: Record<string, number>; justificativa_correcao: string }) => {
      const { error } = await supabase
        .from("produto_composicao")
        .update({ percentual_por_cor, justificativa_correcao, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["composicao"] });
      toast.success("Percentual ajustado");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });
}

// ── Versões ──

export function useComposicaoVersoes(submissaoId: string | undefined) {
  return useQuery({
    queryKey: ["composicao_versoes", submissaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produto_composicao_versoes")
        .select("*")
        .eq("submissao_id", submissaoId!)
        .order("versao", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ComposicaoVersao[];
    },
    enabled: !!submissaoId,
  });
}

export function useSubmeterComposicao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ submissaoId, versao }: { submissaoId: string; versao: number }) => {
      const { data: { user } } = await supabase.auth.getUser();

      // Create or update version record
      const { error: vErr } = await supabase.from("produto_composicao_versoes").upsert({
        submissao_id: submissaoId,
        versao,
        status: "submetido",
        submetido_por: user?.id,
        submetido_em: new Date().toISOString(),
      } as any, { onConflict: "submissao_id,versao" as any });

      // Also ensure gate record exists
      await supabase.from("produto_gate_criacao").upsert({
        submissao_id: submissaoId,
      } as any, { onConflict: "submissao_id" as any });

      if (vErr) throw vErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["composicao_versoes"] });
      toast.success("Composição submetida para análise regulatória");
    },
    onError: (err: any) => toast.error("Erro ao submeter: " + err.message),
  });
}

// ── Gate de Criação ──

export function useGateCriacao(submissaoId: string | undefined) {
  return useQuery({
    queryKey: ["gate_criacao", submissaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produto_gate_criacao")
        .select("*")
        .eq("submissao_id", submissaoId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as GateCriacao | null;
    },
    enabled: !!submissaoId,
  });
}

export function useUpdateGate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ submissaoId, updates }: { submissaoId: string; updates: Partial<GateCriacao> }) => {
      const { error } = await supabase
        .from("produto_gate_criacao")
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("submissao_id", submissaoId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gate_criacao"] });
    },
  });
}

// ── Peticionamento ──

export function usePeticionamento(submissaoId: string | undefined) {
  return useQuery({
    queryKey: ["peticionamento", submissaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produto_peticionamento")
        .select("*")
        .eq("submissao_id", submissaoId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Peticionamento | null;
    },
    enabled: !!submissaoId,
  });
}

export function useCreatePeticionamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Peticionamento>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("produto_peticionamento").insert({
        ...data,
        criado_por: user?.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["peticionamento"] });
      toast.success("Peticionamento criado");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });
}

export function useUpdatePeticionamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Peticionamento> & { id: string }) => {
      const { error } = await supabase
        .from("produto_peticionamento")
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["peticionamento"] });
      toast.success("Peticionamento atualizado");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });
}

export function useDevolverComposicao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      submissaoId, versao, justificativa, userInfo,
    }: {
      submissaoId: string;
      versao: number;
      justificativa: string;
      userInfo: { id: string; email: string; nome: string };
    }) => {
      const { error } = await supabase
        .from("produto_composicao_versoes")
        .update({
          status: "devolvido",
          observacoes: `[Devolução por ${userInfo.nome}] ${justificativa}`,
        } as any)
        .eq("submissao_id", submissaoId)
        .eq("versao", versao);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["composicao_versoes"] });
      qc.invalidateQueries({ queryKey: ["composicao"] });
      toast.success("Composição devolvida para correção");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });
}

// ── Validação de percentuais ──

export function validarPercentuais(items: Composicao[]): { corKey: string; soma: number; valido: boolean }[] {
  if (items.length === 0) return [];

  // Collect all color keys
  const allCores = new Set<string>();
  items.forEach(item => {
    Object.keys(item.percentual_por_cor || {}).forEach(k => allCores.add(k));
  });

  return Array.from(allCores).map(corKey => {
    const soma = items.reduce((sum, item) => sum + (item.percentual_por_cor?.[corKey] || 0), 0);
    return { corKey, soma: Math.round(soma * 100) / 100, valido: Math.abs(soma - 100) < 0.01 };
  });
}
