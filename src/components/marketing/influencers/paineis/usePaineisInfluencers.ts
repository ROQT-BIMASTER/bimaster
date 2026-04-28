import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { PainelFiltros } from "./painelFilters";
import { PAINEL_GERAL } from "./painelFilters";

export interface InfluencerPainel {
  id: string;
  user_id: string;
  nome: string;
  descricao: string | null;
  cor: string;
  icone: string;
  compartilhado: boolean;
  ordem: number;
  filtros: PainelFiltros;
  created_at: string;
  updated_at: string;
}

const STORAGE_KEY = "influencer_painel_ativo";

export function usePaineisInfluencers() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [painelAtivoId, setPainelAtivoIdState] = useState<string>(PAINEL_GERAL);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setPainelAtivoIdState(saved);
  }, []);

  const setPainelAtivoId = (id: string) => {
    setPainelAtivoIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  const { data: paineis = [], isLoading } = useQuery({
    queryKey: ["influencer_paineis", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("influencer_paineis")
        .select("*")
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as InfluencerPainel[];
    },
  });

  const painelAtivo = paineis.find((p) => p.id === painelAtivoId) || null;

  const criar = useMutation({
    mutationFn: async (input: {
      nome: string;
      descricao?: string;
      cor?: string;
      icone?: string;
      compartilhado?: boolean;
      filtros?: PainelFiltros;
    }) => {
      if (!user) throw new Error("Usuário não autenticado");
      const { data, error } = await (supabase as any)
        .from("influencer_paineis")
        .insert({
          user_id: user.id,
          nome: input.nome,
          descricao: input.descricao || null,
          cor: input.cor || "#E91E78",
          icone: input.icone || "LayoutGrid",
          compartilhado: !!input.compartilhado,
          filtros: input.filtros || {},
          ordem: paineis.length,
        })
        .select()
        .single();
      if (error) throw error;
      return data as InfluencerPainel;
    },
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["influencer_paineis"] });
      setPainelAtivoId(p.id);
      toast.success("Painel criado");
    },
    onError: (e: Error) => toast.error("Erro ao criar painel: " + e.message),
  });

  const atualizar = useMutation({
    mutationFn: async (input: { id: string; patch: Partial<InfluencerPainel> }) => {
      const { error } = await (supabase as any)
        .from("influencer_paineis")
        .update(input.patch)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["influencer_paineis"] });
      toast.success("Painel atualizado");
    },
    onError: (e: Error) => toast.error("Erro ao atualizar painel: " + e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("influencer_paineis")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_v, id) => {
      qc.invalidateQueries({ queryKey: ["influencer_paineis"] });
      if (painelAtivoId === id) setPainelAtivoId(PAINEL_GERAL);
      toast.success("Painel excluído");
    },
    onError: (e: Error) => toast.error("Erro ao excluir painel: " + e.message),
  });

  const duplicar = useMutation({
    mutationFn: async (origem: InfluencerPainel) => {
      if (!user) throw new Error("Usuário não autenticado");
      const { data, error } = await (supabase as any)
        .from("influencer_paineis")
        .insert({
          user_id: user.id,
          nome: `${origem.nome} (cópia)`,
          descricao: origem.descricao,
          cor: origem.cor,
          icone: origem.icone,
          compartilhado: false,
          filtros: origem.filtros,
          ordem: paineis.length,
        })
        .select()
        .single();
      if (error) throw error;
      return data as InfluencerPainel;
    },
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["influencer_paineis"] });
      setPainelAtivoId(p.id);
      toast.success("Painel duplicado");
    },
    onError: (e: Error) => toast.error("Erro ao duplicar: " + e.message),
  });

  return {
    paineis,
    painelAtivo,
    painelAtivoId,
    setPainelAtivoId,
    isLoading,
    criar,
    atualizar,
    excluir,
    duplicar,
    isOwner: (p: InfluencerPainel) => !!user && p.user_id === user.id,
  };
}
