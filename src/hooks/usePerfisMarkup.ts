import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { TipoMarkup } from "@/lib/fabrica/cascataPricing";
import type { TabelaNode } from "@/lib/fabrica/perfilSimulacao";

export interface PerfilMarkupItem {
  id: string;
  perfil_id: string;
  tabela_id: string | null;
  nome_linha: string | null;
  tipo_markup: TipoMarkup;
  valor_markup: number;
  ordem: number;
}

export interface PerfilMarkup {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  itens: PerfilMarkupItem[];
}

export function useTabelasCadeia() {
  return useQuery({
    queryKey: ["simulador-tabelas-cadeia"],
    queryFn: async (): Promise<TabelaNode[]> => {
      const { data, error } = await supabase
        .from("fabrica_tabelas_preco")
        .select("id, nome, tabela_base_id, tipo_markup, valor_markup, ativo, ordem")
        .eq("ativo", true);
      if (error) throw error;
      return ((data as any[]) || [])
        .filter((t) => t.tabela_base_id)
        .map((t) => ({
          id: t.id,
          nome: t.nome,
          tabela_base_id: t.tabela_base_id,
          tipo_markup: t.tipo_markup as TipoMarkup,
          valor_markup: Number(t.valor_markup || 0),
        }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function usePerfisMarkup() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["fabrica-perfis-markup"],
    queryFn: async (): Promise<PerfilMarkup[]> => {
      const { data, error } = await supabase
        .from("fabrica_perfis_markup")
        .select("id, nome, descricao, ativo, fabrica_perfis_markup_itens(*)")
        .eq("ativo", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return ((data as any[]) || []).map((p) => ({
        id: p.id,
        nome: p.nome,
        descricao: p.descricao,
        ativo: p.ativo,
        itens: (p.fabrica_perfis_markup_itens || [])
          .map((i: any) => ({
            id: i.id,
            perfil_id: i.perfil_id,
            tabela_id: i.tabela_id,
            nome_linha: i.nome_linha,
            tipo_markup: i.tipo_markup as TipoMarkup,
            valor_markup: Number(i.valor_markup || 0),
            ordem: Number(i.ordem || 0),
          }))
          .sort((a: PerfilMarkupItem, b: PerfilMarkupItem) => a.ordem - b.ordem),
      }));
    },
    staleTime: 60 * 1000,
  });

  const salvarItem = useMutation({
    mutationFn: async (input: { id: string; tipo_markup: TipoMarkup; valor_markup: number }) => {
      const { error } = await supabase
        .from("fabrica_perfis_markup_itens")
        .update({ tipo_markup: input.tipo_markup, valor_markup: input.valor_markup })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fabrica-perfis-markup"] });
      toast.success("Perfil atualizado");
    },
    onError: (e: any) => toast.error(e.message || "Não foi possível salvar o perfil"),
  });

  const duplicarPerfil = useMutation({
    mutationFn: async (perfil: PerfilMarkup) => {
      const { data: user } = await supabase.auth.getUser();
      const { data: novo, error } = await supabase
        .from("fabrica_perfis_markup")
        .insert({
          nome: `${perfil.nome} (cópia)`,
          descricao: perfil.descricao,
          created_by: user.user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (perfil.itens.length) {
        const { error: e2 } = await supabase.from("fabrica_perfis_markup_itens").insert(
          perfil.itens.map((i) => ({
            perfil_id: (novo as any).id,
            tabela_id: i.tabela_id,
            nome_linha: i.nome_linha,
            tipo_markup: i.tipo_markup,
            valor_markup: i.valor_markup,
            ordem: i.ordem,
          })),
        );
        if (e2) throw e2;
      }
      return (novo as any).id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fabrica-perfis-markup"] });
      toast.success("Perfil duplicado");
    },
    onError: (e: any) => toast.error(e.message || "Não foi possível duplicar o perfil"),
  });

  return { ...query, salvarItem, duplicarPerfil };
}
