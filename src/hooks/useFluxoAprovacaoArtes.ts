import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Types
export interface FluxoConfig {
  id: string;
  nome: string;
  checklist_tipo: string;
  descricao: string | null;
  ativo: boolean;
  created_by: string | null;
  created_at: string;
  etapas?: FluxoEtapa[];
}

export interface FluxoEtapa {
  id: string;
  config_id: string;
  nome: string;
  nome_cn: string | null;
  ordem: number;
  tipo_aprovacao: "simples" | "paralela";
  responsavel_id: string | null;
  responsavel_secundario_id: string | null;
  destino_aprovacao_ordem: number | null;
  destino_reprovacao_ordem: number | null;
  ativo: boolean;
}

export interface FluxoInstancia {
  id: string;
  config_id: string;
  submissao_id: string | null;
  projeto_id: string | null;
  produto_brasil_id: string | null;
  titulo: string | null;
  descricao: string | null;
  etapa_atual_ordem: number;
  status: string;
  rodada: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  config?: FluxoConfig;
  etapa_atual?: FluxoEtapa;
  aprovadores?: FluxoAprovador[];
  transicoes?: FluxoTransicao[];
}

export interface FluxoTransicao {
  id: string;
  instancia_id: string;
  etapa_id: string | null;
  etapa_nome: string | null;
  usuario_id: string | null;
  acao: string;
  observacao: string | null;
  rodada: number;
  created_at: string;
  usuario?: { nome: string; avatar_url: string | null };
}

export interface FluxoAprovador {
  id: string;
  instancia_id: string;
  etapa_id: string;
  responsavel_tipo: string;
  usuario_id: string | null;
  status: string;
  observacao: string | null;
  created_at: string;
  usuario?: { nome: string; avatar_url: string | null };
}

export interface FluxoAnexo {
  id: string;
  instancia_id: string;
  etapa_id: string | null;
  nome_arquivo: string;
  arquivo_url: string;
  tipo: string;
  versao: number;
  substituido_por: string | null;
  uploaded_by: string | null;
  observacao: string | null;
  created_at: string;
  uploaded_by_nome?: string;
}

export interface FluxoVinculo {
  id: string;
  instancia_id: string;
  tipo_vinculo: string;
  ref_id: string;
  ref_label: string;
  created_by: string | null;
  created_at: string;
}

// Hooks

export function useFluxoConfigs() {
  return useQuery({
    queryKey: ["fluxo-aprovacao-configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fluxo_aprovacao_config" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as FluxoConfig[];
    },
  });
}

export function useFluxoConfigDetail(configId: string | undefined) {
  return useQuery({
    queryKey: ["fluxo-aprovacao-config", configId],
    enabled: !!configId,
    queryFn: async () => {
      const { data: config, error } = await supabase
        .from("fluxo_aprovacao_config" as any)
        .select("*")
        .eq("id", configId)
        .single();
      if (error) throw error;

      const { data: etapas } = await supabase
        .from("fluxo_aprovacao_etapas" as any)
        .select("*")
        .eq("config_id", configId)
        .order("ordem");

      return {
        ...(config as any),
        etapas: (etapas || []) as unknown as FluxoEtapa[],
      } as FluxoConfig;
    },
  });
}

export function useSaveFluxoConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { nome: string; checklist_tipo: string; descricao?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("fluxo_aprovacao_config" as any)
        .insert({ ...payload, created_by: user?.id } as any)
        .select("id")
        .single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fluxo-aprovacao-configs"] });
      toast.success("Fluxo criado com sucesso!");
    },
    onError: () => toast.error("Erro ao criar fluxo"),
  });
}

export function useUpdateFluxoConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; nome?: string; descricao?: string; ativo?: boolean }) => {
      const { error } = await supabase
        .from("fluxo_aprovacao_config" as any)
        .update({ ...payload, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fluxo-aprovacao-configs"] });
      toast.success("Fluxo atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar"),
  });
}

export function useSaveFluxoEtapa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<FluxoEtapa> & { config_id: string; nome: string }) => {
      const { error } = await supabase
        .from("fluxo_aprovacao_etapas" as any)
        .insert(payload as any);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["fluxo-aprovacao-config", vars.config_id] });
      toast.success("Etapa adicionada!");
    },
    onError: () => toast.error("Erro ao adicionar etapa"),
  });
}

export function useUpdateFluxoEtapa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, config_id, ...payload }: Partial<FluxoEtapa> & { id: string; config_id: string }) => {
      const { error } = await supabase
        .from("fluxo_aprovacao_etapas" as any)
        .update(payload as any)
        .eq("id", id);
      if (error) throw error;
      return config_id;
    },
    onSuccess: (configId) => {
      qc.invalidateQueries({ queryKey: ["fluxo-aprovacao-config", configId] });
    },
    onError: () => toast.error("Erro ao atualizar etapa"),
  });
}

export function useDeleteFluxoEtapa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, config_id }: { id: string; config_id: string }) => {
      const { error } = await supabase
        .from("fluxo_aprovacao_etapas" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
      return config_id;
    },
    onSuccess: (configId) => {
      qc.invalidateQueries({ queryKey: ["fluxo-aprovacao-config", configId] });
      toast.success("Etapa removida!");
    },
    onError: () => toast.error("Erro ao remover etapa"),
  });
}

// Instances

export function useFluxoInstancias(filters?: { status?: string }) {
  return useQuery({
    queryKey: ["fluxo-aprovacao-instancias", filters],
    queryFn: async () => {
      let query = supabase
        .from("fluxo_aprovacao_instancias" as any)
        .select("*")
        .order("updated_at", { ascending: false });

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;

      const instancias = (data || []) as unknown as FluxoInstancia[];
      if (instancias.length === 0) return instancias;

      const configIds = [...new Set(instancias.map(i => i.config_id))];
      const { data: configs } = await supabase
        .from("fluxo_aprovacao_config" as any)
        .select("*")
        .in("id", configIds);

      const configMap = new Map((configs || []).map((c: any) => [c.id, c]));

      return instancias.map(i => ({
        ...i,
        config: configMap.get(i.config_id) as FluxoConfig | undefined,
      }));
    },
  });
}

export function useFluxoInstanciaDetail(instanciaId: string | undefined) {
  return useQuery({
    queryKey: ["fluxo-aprovacao-instancia", instanciaId],
    enabled: !!instanciaId,
    queryFn: async () => {
      const { data: inst, error } = await supabase
        .from("fluxo_aprovacao_instancias" as any)
        .select("*")
        .eq("id", instanciaId)
        .single();
      if (error) throw error;

      const instancia = inst as unknown as FluxoInstancia;

      const { data: config } = await supabase
        .from("fluxo_aprovacao_config" as any)
        .select("*")
        .eq("id", instancia.config_id)
        .single();

      const { data: etapas } = await supabase
        .from("fluxo_aprovacao_etapas" as any)
        .select("*")
        .eq("config_id", instancia.config_id)
        .order("ordem");

      const { data: aprovadores } = await supabase
        .from("fluxo_aprovacao_aprovadores" as any)
        .select("*")
        .eq("instancia_id", instanciaId);

      const { data: transicoes } = await supabase
        .from("fluxo_aprovacao_transicoes" as any)
        .select("*")
        .eq("instancia_id", instanciaId)
        .order("created_at", { ascending: false });

      const userIds = [
        ...new Set([
          ...(aprovadores || []).map((a: any) => a.usuario_id).filter(Boolean),
          ...(transicoes || []).map((t: any) => t.usuario_id).filter(Boolean),
        ]),
      ];

      let userMap = new Map();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, nome, avatar_url")
          .in("id", userIds);
        userMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      }

      const etapaAtual = ((etapas || []) as any[]).find(
        (e: any) => e.ordem === instancia.etapa_atual_ordem
      );

      return {
        ...instancia,
        config: {
          ...(config as any),
          etapas: (etapas || []) as unknown as FluxoEtapa[],
        },
        etapa_atual: etapaAtual as FluxoEtapa | undefined,
        aprovadores: ((aprovadores || []) as any[]).map((a: any) => ({
          ...a,
          usuario: userMap.get(a.usuario_id),
        })) as FluxoAprovador[],
        transicoes: ((transicoes || []) as any[]).map((t: any) => ({
          ...t,
          usuario: userMap.get(t.usuario_id),
        })) as FluxoTransicao[],
      };
    },
  });
}

export function useIniciarFluxo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      config_id: string;
      titulo?: string;
      descricao?: string;
      submissao_id?: string;
      projeto_id?: string;
      produto_brasil_id?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: inst, error } = await supabase
        .from("fluxo_aprovacao_instancias" as any)
        .insert({
          config_id: payload.config_id,
          titulo: payload.titulo || null,
          descricao: payload.descricao || null,
          submissao_id: payload.submissao_id || null,
          projeto_id: payload.projeto_id || null,
          produto_brasil_id: payload.produto_brasil_id || null,
          etapa_atual_ordem: 0,
          status: "em_andamento",
          created_by: user?.id,
        } as any)
        .select("id")
        .single();
      if (error) throw error;

      const instanciaId = (inst as any).id;

      const { data: etapas } = await supabase
        .from("fluxo_aprovacao_etapas" as any)
        .select("*")
        .eq("config_id", payload.config_id)
        .eq("ativo", true)
        .order("ordem")
        .limit(1);

      const firstStage = (etapas || [])[0] as any;

      if (firstStage) {
        if (firstStage.tipo_aprovacao === "paralela") {
          const approvers = [
            { responsavel_tipo: "principal", usuario_id: firstStage.responsavel_id },
            { responsavel_tipo: "secundario", usuario_id: firstStage.responsavel_secundario_id },
          ].filter(a => a.usuario_id);

          if (approvers.length > 0) {
            await supabase.from("fluxo_aprovacao_aprovadores" as any).insert(
              approvers.map(a => ({
                instancia_id: instanciaId,
                etapa_id: firstStage.id,
                ...a,
              })) as any
            );
          }
        }

        await supabase.from("fluxo_aprovacao_transicoes" as any).insert({
          instancia_id: instanciaId,
          etapa_id: firstStage.id,
          etapa_nome: firstStage.nome,
          usuario_id: user?.id,
          acao: "iniciar",
          rodada: 1,
        } as any);
      }

      return instanciaId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fluxo-aprovacao-instancias"] });
      toast.success("Fluxo de aprovação iniciado!");
    },
    onError: () => toast.error("Erro ao iniciar fluxo"),
  });
}

export function useAprovarEtapa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      instanciaId, etapaId, etapaNome, observacao, aprovadorId,
    }: {
      instanciaId: string; etapaId: string; etapaNome: string; observacao?: string; aprovadorId?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      if (aprovadorId) {
        await supabase
          .from("fluxo_aprovacao_aprovadores" as any)
          .update({ status: "aprovado", observacao, updated_at: new Date().toISOString() } as any)
          .eq("id", aprovadorId);

        const { data: allApprovers } = await supabase
          .from("fluxo_aprovacao_aprovadores" as any)
          .select("status")
          .eq("instancia_id", instanciaId)
          .eq("etapa_id", etapaId);

        const allApproved = ((allApprovers || []) as any[]).every((a: any) => a.status === "aprovado");
        if (!allApproved) {
          await supabase.from("fluxo_aprovacao_transicoes" as any).insert({
            instancia_id: instanciaId, etapa_id: etapaId, etapa_nome: etapaNome,
            usuario_id: user?.id, acao: "aprovar",
            observacao: `Aprovação parcial: ${observacao || ""}`, rodada: 1,
          } as any);
          return { advanced: false };
        }
      }

      const { data: inst } = await supabase
        .from("fluxo_aprovacao_instancias" as any)
        .select("*")
        .eq("id", instanciaId)
        .single();
      const instancia = inst as any;

      const { data: currentStage } = await supabase
        .from("fluxo_aprovacao_etapas" as any)
        .select("*")
        .eq("id", etapaId)
        .single();
      const stage = currentStage as any;
      const nextOrdem = stage?.destino_aprovacao_ordem ?? (instancia.etapa_atual_ordem + 1);

      const { data: nextStages } = await supabase
        .from("fluxo_aprovacao_etapas" as any)
        .select("*")
        .eq("config_id", instancia.config_id)
        .eq("ordem", nextOrdem)
        .eq("ativo", true);

      const nextStage = ((nextStages || []) as any[])[0];

      if (nextStage) {
        await supabase
          .from("fluxo_aprovacao_instancias" as any)
          .update({ etapa_atual_ordem: nextOrdem, updated_at: new Date().toISOString() } as any)
          .eq("id", instanciaId);

        if (nextStage.tipo_aprovacao === "paralela") {
          const approvers = [
            { responsavel_tipo: "principal", usuario_id: nextStage.responsavel_id },
            { responsavel_tipo: "secundario", usuario_id: nextStage.responsavel_secundario_id },
          ].filter(a => a.usuario_id);
          if (approvers.length > 0) {
            await supabase.from("fluxo_aprovacao_aprovadores" as any).insert(
              approvers.map(a => ({ instancia_id: instanciaId, etapa_id: nextStage.id, ...a })) as any
            );
          }
        }
      } else {
        await supabase
          .from("fluxo_aprovacao_instancias" as any)
          .update({ status: "aprovado", updated_at: new Date().toISOString() } as any)
          .eq("id", instanciaId);
      }

      await supabase.from("fluxo_aprovacao_transicoes" as any).insert({
        instancia_id: instanciaId, etapa_id: etapaId, etapa_nome: etapaNome,
        usuario_id: user?.id, acao: "aprovar", observacao, rodada: instancia.rodada,
      } as any);

      return { advanced: true };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["fluxo-aprovacao-instancias"] });
      qc.invalidateQueries({ queryKey: ["fluxo-aprovacao-instancia"] });
      if (result.advanced) toast.success("Etapa aprovada!");
      else toast.success("Aprovação registrada! Aguardando demais aprovadores.");
    },
    onError: () => toast.error("Erro ao aprovar"),
  });
}

export function useDevolverEtapaAprovacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      instanciaId, etapaId, etapaNome, etapaDestinoOrdem, justificativa, userInfo,
    }: {
      instanciaId: string; etapaId: string; etapaNome: string;
      etapaDestinoOrdem: number; justificativa: string;
      userInfo: { id: string; email: string; nome: string };
    }) => {
      const { data: inst } = await supabase
        .from("fluxo_aprovacao_instancias" as any)
        .select("*")
        .eq("id", instanciaId)
        .single();
      const instancia = inst as any;

      await supabase
        .from("fluxo_aprovacao_instancias" as any)
        .update({
          etapa_atual_ordem: etapaDestinoOrdem,
          status: "devolvido",
          rodada: instancia.rodada + 1,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", instanciaId);

      await supabase.from("fluxo_aprovacao_transicoes" as any).insert({
        instancia_id: instanciaId, etapa_id: etapaId, etapa_nome: etapaNome,
        usuario_id: userInfo.id, acao: "devolucao",
        observacao: `[Devolução com senha] ${justificativa}`,
        rodada: instancia.rodada,
      } as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fluxo-aprovacao-instancias"] });
      qc.invalidateQueries({ queryKey: ["fluxo-aprovacao-instancia"] });
      toast.success("Etapa devolvida com sucesso");
    },
    onError: () => toast.error("Erro ao devolver etapa"),
  });
}

export function useReprovarEtapa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      instanciaId, etapaId, etapaNome, observacao, aprovadorId,
    }: {
      instanciaId: string; etapaId: string; etapaNome: string; observacao: string; aprovadorId?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      if (aprovadorId) {
        await supabase
          .from("fluxo_aprovacao_aprovadores" as any)
          .update({ status: "reprovado", observacao, updated_at: new Date().toISOString() } as any)
          .eq("id", aprovadorId);
      }

      const { data: currentStage } = await supabase
        .from("fluxo_aprovacao_etapas" as any)
        .select("*")
        .eq("id", etapaId)
        .single();
      const stage = currentStage as any;

      const { data: inst } = await supabase
        .from("fluxo_aprovacao_instancias" as any)
        .select("*")
        .eq("id", instanciaId)
        .single();
      const instancia = inst as any;

      if (stage?.destino_reprovacao_ordem !== null && stage?.destino_reprovacao_ordem !== undefined) {
        await supabase
          .from("fluxo_aprovacao_instancias" as any)
          .update({
            etapa_atual_ordem: stage.destino_reprovacao_ordem,
            status: "devolvido", rodada: instancia.rodada + 1,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", instanciaId);
      } else {
        const prevOrdem = Math.max(0, instancia.etapa_atual_ordem - 1);
        await supabase
          .from("fluxo_aprovacao_instancias" as any)
          .update({
            etapa_atual_ordem: prevOrdem, status: "devolvido",
            rodada: instancia.rodada + 1, updated_at: new Date().toISOString(),
          } as any)
          .eq("id", instanciaId);
      }

      await supabase.from("fluxo_aprovacao_transicoes" as any).insert({
        instancia_id: instanciaId, etapa_id: etapaId, etapa_nome: etapaNome,
        usuario_id: user?.id, acao: "reprovar", observacao, rodada: instancia.rodada,
      } as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fluxo-aprovacao-instancias"] });
      qc.invalidateQueries({ queryKey: ["fluxo-aprovacao-instancia"] });
      toast.success("Etapa reprovada e devolvida!");
    },
    onError: () => toast.error("Erro ao reprovar"),
  });
}

// Anexos hooks

export function useFluxoAnexos(instanciaId: string | undefined) {
  return useQuery({
    queryKey: ["fluxo-aprovacao-anexos", instanciaId],
    enabled: !!instanciaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fluxo_aprovacao_anexos" as any)
        .select("*")
        .eq("instancia_id", instanciaId!)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const anexos = (data || []) as unknown as FluxoAnexo[];
      const userIds = [...new Set(anexos.map(a => a.uploaded_by).filter(Boolean))];
      let userMap = new Map();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, nome").in("id", userIds);
        userMap = new Map((profiles || []).map((p: any) => [p.id, p.nome]));
      }
      return anexos.map(a => ({ ...a, uploaded_by_nome: userMap.get(a.uploaded_by) || "—" }));
    },
  });
}

export function useUploadFluxoAnexo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ instanciaId, etapaId, file, tipo, observacao }: {
      instanciaId: string; etapaId?: string; file: File; tipo: string; observacao?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const filePath = `${instanciaId}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("aprovacao-artes").upload(filePath, file);
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("aprovacao-artes").getPublicUrl(filePath);

      const { error } = await supabase.from("fluxo_aprovacao_anexos" as any).insert({
        instancia_id: instanciaId,
        etapa_id: etapaId || null,
        nome_arquivo: file.name,
        arquivo_url: urlData.publicUrl,
        tipo,
        uploaded_by: user?.id,
        observacao: observacao || null,
      } as any);
      if (error) throw error;

      // Log transition
      await supabase.from("fluxo_aprovacao_transicoes" as any).insert({
        instancia_id: instanciaId,
        etapa_id: etapaId || null,
        etapa_nome: null,
        usuario_id: user?.id,
        acao: "anexo",
        observacao: `Documento anexado: ${file.name}`,
        rodada: 1,
      } as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fluxo-aprovacao-anexos"] });
      qc.invalidateQueries({ queryKey: ["fluxo-aprovacao-instancia"] });
      toast.success("Documento anexado!");
    },
    onError: () => toast.error("Erro ao anexar documento"),
  });
}

export function useSubstituirFluxoAnexo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ anexoAntigoId, instanciaId, etapaId, file, tipo, observacao }: {
      anexoAntigoId: string; instanciaId: string; etapaId?: string; file: File; tipo: string; observacao?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      // Get old version
      const { data: old } = await supabase
        .from("fluxo_aprovacao_anexos" as any)
        .select("versao")
        .eq("id", anexoAntigoId)
        .single();

      const newVersao = ((old as any)?.versao || 1) + 1;
      const filePath = `${instanciaId}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("aprovacao-artes").upload(filePath, file);
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("aprovacao-artes").getPublicUrl(filePath);

      const { data: newAnexo, error } = await supabase.from("fluxo_aprovacao_anexos" as any).insert({
        instancia_id: instanciaId,
        etapa_id: etapaId || null,
        nome_arquivo: file.name,
        arquivo_url: urlData.publicUrl,
        tipo,
        versao: newVersao,
        uploaded_by: user?.id,
        observacao: observacao || null,
      } as any).select("id").single();
      if (error) throw error;

      // Update old to point to new
      await supabase.from("fluxo_aprovacao_anexos" as any)
        .update({ substituido_por: (newAnexo as any).id } as any)
        .eq("id", anexoAntigoId);

      // Audit trail
      await supabase.from("fluxo_aprovacao_transicoes" as any).insert({
        instancia_id: instanciaId,
        usuario_id: user?.id,
        acao: "substituicao_doc",
        observacao: `Documento substituído: ${file.name} (v${newVersao})`,
        rodada: 1,
      } as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fluxo-aprovacao-anexos"] });
      qc.invalidateQueries({ queryKey: ["fluxo-aprovacao-instancia"] });
      toast.success("Documento substituído com nova versão!");
    },
    onError: () => toast.error("Erro ao substituir documento"),
  });
}

// Vinculos hooks

export function useFluxoVinculos(instanciaId: string | undefined) {
  return useQuery({
    queryKey: ["fluxo-aprovacao-vinculos", instanciaId],
    enabled: !!instanciaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fluxo_aprovacao_vinculos" as any)
        .select("*")
        .eq("instancia_id", instanciaId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as FluxoVinculo[];
    },
  });
}

export function useCreateFluxoVinculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      instancia_id: string; tipo_vinculo: string; ref_id: string; ref_label: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("fluxo_aprovacao_vinculos" as any).insert({
        ...params, created_by: user?.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fluxo-aprovacao-vinculos"] });
      toast.success("Vínculo criado!");
    },
    onError: () => toast.error("Erro ao criar vínculo"),
  });
}

export function useDeleteFluxoVinculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("fluxo_aprovacao_vinculos" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fluxo-aprovacao-vinculos"] });
      toast.success("Vínculo removido.");
    },
    onError: () => toast.error("Erro ao remover vínculo"),
  });
}
