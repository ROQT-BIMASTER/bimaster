import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CofreConfigItem {
  id: string;
  nome_pt: string;
  nome_zh: string | null;
  tipo_anexo: string;
  qtd_minima: number;
  obrigatorio: boolean;
  aplicavel_a: any;
  status: string;
  ordem: number;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface CofreItemInstance {
  id: string;
  submissao_id: string;
  config_id: string | null;
  tipo_documento: string;
  nome_pt: string;
  nome_zh: string | null;
  obrigatorio: boolean;
  qtd_minima: number;
  tipo_anexo: string;
  status: string;
  observacao_brasil: string | null;
  adicionado_por: string | null;
  created_at: string;
}

export function useCofreProdutoConfig() {
  const [configs, setConfigs] = useState<CofreConfigItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("cofre_produto_config" as any)
      .select("*")
      .order("ordem", { ascending: true }) as any;

    if (error) {
      console.error("Erro ao carregar cofre config:", error);
      toast.error("Erro ao carregar configuração do cofre");
    } else {
      setConfigs(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const createConfig = async (item: Partial<CofreConfigItem>) => {
    const { data, error } = await supabase
      .from("cofre_produto_config" as any)
      .insert(item as any)
      .select()
      .single() as any;

    if (error) {
      toast.error("Erro ao criar item do cofre");
      return null;
    }
    toast.success("Item criado com sucesso");
    await fetchConfigs();
    return data;
  };

  const updateConfig = async (id: string, updates: Partial<CofreConfigItem>) => {
    const { error } = await supabase
      .from("cofre_produto_config" as any)
      .update({ ...updates, updated_at: new Date().toISOString() } as any)
      .eq("id", id) as any;

    if (error) {
      toast.error("Erro ao atualizar item");
      return false;
    }
    toast.success("Item atualizado");
    await fetchConfigs();
    return true;
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "ativo" ? "inativo" : "ativo";
    return updateConfig(id, { status: newStatus } as any);
  };

  const reorderConfigs = async (reordered: CofreConfigItem[]) => {
    setConfigs(reordered);
    // Update ordem for each item
    const promises = reordered.map((item, index) =>
      supabase
        .from("cofre_produto_config" as any)
        .update({ ordem: index } as any)
        .eq("id", item.id)
    );
    await Promise.all(promises);
  };

  return { configs, loading, fetchConfigs, createConfig, updateConfig, toggleStatus, reorderConfigs };
}

export function useCofreItensForSubmissao(submissaoId: string | null) {
  const [itens, setItens] = useState<CofreItemInstance[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchItens = useCallback(async () => {
    if (!submissaoId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("cofre_produto_itens" as any)
      .select("*")
      .eq("submissao_id", submissaoId)
      .order("created_at") as any;

    if (error) {
      console.error("Erro ao carregar itens do cofre:", error);
    } else {
      setItens(data || []);
    }
    setLoading(false);
  }, [submissaoId]);

  useEffect(() => {
    fetchItens();
  }, [fetchItens]);

  const initializeItens = async (configs: CofreConfigItem[], submId: string) => {
    // Check existing
    const { data: existing } = await supabase
      .from("cofre_produto_itens" as any)
      .select("config_id")
      .eq("submissao_id", submId) as any;

    const existingConfigIds = new Set((existing || []).map((e: any) => e.config_id));

    const activeConfigs = configs.filter(c => c.status === "ativo" && !existingConfigIds.has(c.id));
    if (activeConfigs.length === 0) return;

    const newItens = activeConfigs.map(c => ({
      submissao_id: submId,
      config_id: c.id,
      tipo_documento: c.nome_pt.toLowerCase().replace(/[^a-z0-9]/g, "_"),
      nome_pt: c.nome_pt,
      nome_zh: c.nome_zh,
      obrigatorio: c.obrigatorio,
      qtd_minima: c.qtd_minima,
      tipo_anexo: c.tipo_anexo,
      status: "pendente",
    }));

    const { error } = await supabase
      .from("cofre_produto_itens" as any)
      .insert(newItens as any) as any;

    if (error) {
      console.error("Erro ao inicializar itens:", error);
    }
    await fetchItens();
  };

  const addItensFromConfigs = async (configIds: string[], configs: CofreConfigItem[], submId: string) => {
    const selected = configs.filter(c => configIds.includes(c.id));
    const newItens = selected.map(c => ({
      submissao_id: submId,
      config_id: c.id,
      tipo_documento: c.nome_pt.toLowerCase().replace(/[^a-z0-9]/g, "_"),
      nome_pt: c.nome_pt,
      nome_zh: c.nome_zh,
      obrigatorio: c.obrigatorio,
      qtd_minima: c.qtd_minima,
      tipo_anexo: c.tipo_anexo,
      status: "pendente",
    }));

    const { error } = await supabase
      .from("cofre_produto_itens" as any)
      .insert(newItens as any) as any;

    if (error) {
      toast.error("Erro ao adicionar itens");
    } else {
      toast.success(`${selected.length} item(ns) adicionado(s)`);
    }
    await fetchItens();
  };

  return { itens, loading, fetchItens, initializeItens, addItensFromConfigs };
}
