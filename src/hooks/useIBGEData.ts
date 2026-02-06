import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface IBGEEstado {
  id: number;
  sigla: string;
  nome: string;
  regiao_id: number | null;
  regiao_sigla: string | null;
  regiao_nome: string | null;
  populacao: number | null;
  pib_mil_reais: number | null;
}

export interface IBGEMunicipio {
  id: number;
  nome: string;
  uf_id: number | null;
  uf_sigla: string | null;
  microrregiao_id: number | null;
  microrregiao_nome: string | null;
  mesorregiao_id: number | null;
  mesorregiao_nome: string | null;
  regiao_nome: string | null;
  populacao_estimada: number | null;
  pib_mil_reais: number | null;
  pib_per_capita: number | null;
  ano_populacao: number | null;
  ano_pib: number | null;
}

export interface IBGEMicrorregiao {
  id: number;
  nome: string;
  mesorregiao_id: number | null;
  mesorregiao_nome: string | null;
  uf_id: number | null;
  regiao_nome: string | null;
}

export interface IBGEFilters {
  regiao: string;
  uf: string;
  microrregiao: string;
  search: string;
}

export function useIBGESync() {
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const queryClient = useQueryClient();

  const startSync = async () => {
    setSyncing(true);
    setSyncMessage("Iniciando sincronização com IBGE...");

    try {
      const { data, error } = await supabase.functions.invoke("ibge-sync");

      if (error) throw error;

      if (data?.success) {
        const lastResult = data.results?.[data.results.length - 1];
        setSyncMessage(lastResult?.message || "Sincronização concluída!");
        toast({
          title: "Sincronização concluída",
          description: lastResult?.message || "Dados do IBGE atualizados com sucesso.",
        });
        queryClient.invalidateQueries({ queryKey: ["ibge"] });
      } else {
        throw new Error(data?.error || "Erro desconhecido");
      }
    } catch (err: any) {
      const msg = err.message || "Erro na sincronização";
      setSyncMessage(`Erro: ${msg}`);
      toast({
        title: "Erro na sincronização",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  return { syncing, syncMessage, startSync };
}

export function useIBGEEstados() {
  return useQuery({
    queryKey: ["ibge", "estados"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ibge_estados")
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data || []) as IBGEEstado[];
    },
  });
}

export function useIBGEMicrorregioes(ufId?: number) {
  return useQuery({
    queryKey: ["ibge", "microrregioes", ufId],
    queryFn: async () => {
      let query = supabase.from("ibge_microrregioes").select("*").order("nome");
      if (ufId) query = query.eq("uf_id", ufId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as IBGEMicrorregiao[];
    },
  });
}

export function useIBGEMunicipios(filters: IBGEFilters, page = 0, pageSize = 50) {
  return useQuery({
    queryKey: ["ibge", "municipios", filters, page, pageSize],
    queryFn: async () => {
      let query = supabase
        .from("ibge_municipios")
        .select("*", { count: "exact" });

      if (filters.regiao) query = query.eq("regiao_nome", filters.regiao);
      if (filters.uf) query = query.eq("uf_id", parseInt(filters.uf));
      if (filters.microrregiao) query = query.eq("microrregiao_id", parseInt(filters.microrregiao));
      if (filters.search) query = query.ilike("nome", `%${filters.search}%`);

      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query
        .order("nome")
        .range(from, to);

      if (error) throw error;
      return { data: (data || []) as IBGEMunicipio[], count: count || 0 };
    },
  });
}

export function useIBGEStats() {
  return useQuery({
    queryKey: ["ibge", "stats"],
    queryFn: async () => {
      const [estadosRes, municipiosRes] = await Promise.all([
        supabase.from("ibge_estados").select("*"),
        supabase.from("ibge_municipios").select("id, populacao_estimada, pib_mil_reais, regiao_nome", { count: "exact" }),
      ]);

      const estados = (estadosRes.data || []) as IBGEEstado[];
      const totalMunicipios = municipiosRes.count || 0;

      const populacaoTotal = estados.reduce((s, e) => s + (e.populacao || 0), 0);
      const pibTotal = estados.reduce((s, e) => s + (e.pib_mil_reais || 0), 0);

      const regioes = new Map<string, { populacao: number; pib: number; estados: number }>();
      for (const e of estados) {
        const r = e.regiao_nome || "Desconhecida";
        if (!regioes.has(r)) regioes.set(r, { populacao: 0, pib: 0, estados: 0 });
        const agg = regioes.get(r)!;
        agg.populacao += e.populacao || 0;
        agg.pib += e.pib_mil_reais || 0;
        agg.estados += 1;
      }

      return {
        totalEstados: estados.length,
        totalMunicipios,
        populacaoTotal,
        pibTotal,
        regioes: Array.from(regioes.entries()).map(([nome, d]) => ({
          nome,
          ...d,
        })),
      };
    },
  });
}
