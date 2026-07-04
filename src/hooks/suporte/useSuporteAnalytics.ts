import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, subDays, differenceInCalendarDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type {
  SuporteMetrica,
  SuporteDimensao,
} from "@/lib/suporte/analyticsFormat";

const sb = supabase as any;

export interface SuporteKpisData {
  novos: number;
  resolvidos: number;
  reabertos: number;
  escalados: number;
  violados: number;
  frt_media_h: number | null;
  resolucao_media_h: number | null;
  pct_sla_resolucao: number | null;
  pct_sla_primeira: number | null;
  csat_media: number | null;
  csat_respostas: number;
  transferencias: number;
  backlog_atual: number;
}

export interface KpisComparados {
  atual: SuporteKpisData | null;
  anterior: SuporteKpisData | null;
  isLoading: boolean;
  error: unknown;
}

/** KPIs do período atual + período anterior de mesma duração (para deltas). */
export function useSuporteKpis(de: string, ate: string, filaId?: string | null): KpisComparados {
  const dias = Math.max(1, differenceInCalendarDays(new Date(ate), new Date(de)) + 1);
  const deAnt = format(subDays(new Date(de), dias), "yyyy-MM-dd");
  const ateAnt = format(subDays(new Date(ate), dias), "yyyy-MM-dd");

  const atualQ = useQuery({
    queryKey: ["suporte", "kpis", de, ate, filaId ?? null],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await sb.rpc("suporte_kpis", {
        p_de: de,
        p_ate: ate,
        p_fila_id: filaId ?? null,
      });
      if (error) throw error;
      return data as SuporteKpisData;
    },
  });

  const antQ = useQuery({
    queryKey: ["suporte", "kpis", deAnt, ateAnt, filaId ?? null, "prev"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await sb.rpc("suporte_kpis", {
        p_de: deAnt,
        p_ate: ateAnt,
        p_fila_id: filaId ?? null,
      });
      if (error) throw error;
      return data as SuporteKpisData;
    },
  });

  return {
    atual: atualQ.data ?? null,
    anterior: antQ.data ?? null,
    isLoading: atualQ.isLoading || antQ.isLoading,
    error: atualQ.error ?? antQ.error,
  };
}

export interface SuporteAnaliseParams {
  metrica: SuporteMetrica;
  dimensao: SuporteDimensao;
  de: string;
  ate: string;
  fila_id?: string | null;
  canal?: string | null;
  prioridade?: string | null;
  categoria?: string | null;
  limit?: number;
  enabled?: boolean;
}

const TEMPORAIS: SuporteDimensao[] = ["dia", "semana", "mes"];

export function useSuporteAnalise(p: SuporteAnaliseParams) {
  return useQuery({
    queryKey: ["suporte", "analise", p],
    enabled: p.enabled !== false && !!p.de && !!p.ate,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await sb.rpc("suporte_analise", {
        p_metrica: p.metrica,
        p_dimensao: p.dimensao,
        p_de: p.de,
        p_ate: p.ate,
        p_fila_id: p.fila_id ?? null,
        p_canal: p.canal ?? null,
        p_prioridade: p.prioridade ?? null,
        p_categoria: p.categoria ?? null,
        p_limit: p.limit ?? 50,
      });
      if (error) throw error;
      const rows = ((data || []) as any[]).map((r) => ({
        label: String(r.label ?? ""),
        valor: Number(r.valor ?? 0),
      }));
      if (TEMPORAIS.includes(p.dimensao)) {
        rows.sort((a, b) => a.label.localeCompare(b.label));
      }
      return rows;
    },
  });
}

// ---------------- Análises salvas ----------------

export interface SuporteAnaliseSalva {
  id: string;
  user_id: string;
  nome: string;
  descricao: string | null;
  fila_id: string | null;
  compartilhada: boolean;
  config: {
    metrica: SuporteMetrica;
    dimensao: SuporteDimensao;
    tipo: string;
    canal?: string | null;
    prioridade?: string | null;
    categoria?: string | null;
  };
  created_at: string;
  updated_at: string;
}

export function useAnalisesSalvas() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["suporte", "analises-salvas", user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await sb
        .from("suporte_analises_salvas")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown) as SuporteAnaliseSalva[];
    },
  });
}

export function useSalvarAnalise() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      nome: string;
      config: SuporteAnaliseSalva["config"];
      fila_id?: string | null;
      compartilhada?: boolean;
      descricao?: string | null;
    }) => {
      if (!user?.id) throw new Error("Não autenticado");
      const { data, error } = await sb
        .from("suporte_analises_salvas")
        .insert({
          user_id: user.id,
          nome: input.nome,
          descricao: input.descricao ?? null,
          fila_id: input.fila_id ?? null,
          compartilhada: !!input.compartilhada,
          config: input.config,
        })
        .select()
        .single();
      if (error) throw error;
      return data as SuporteAnaliseSalva;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suporte", "analises-salvas"] }),
  });
}

export function useExcluirAnalise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("suporte_analises_salvas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suporte", "analises-salvas"] }),
  });
}

export function useToggleCompartilhar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; compartilhada: boolean; fila_id?: string | null }) => {
      const patch: any = { compartilhada: input.compartilhada };
      if (input.fila_id !== undefined) patch.fila_id = input.fila_id;
      const { error } = await sb
        .from("suporte_analises_salvas")
        .update(patch)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suporte", "analises-salvas"] }),
  });
}

// ---------------- Transferências (para o Sankey) ----------------

export interface TransferenciaFluxo {
  de_fila_id: string | null;
  para_fila_id: string;
  count: number;
}

export function useTransferenciasFluxo(de: string, ate: string, filaId?: string | null) {
  return useQuery({
    queryKey: ["suporte", "transferencias-fluxo", de, ate, filaId ?? null],
    staleTime: 60_000,
    queryFn: async (): Promise<TransferenciaFluxo[]> => {
      let q = sb
        .from("suporte_transferencias")
        .select("de_fila_id, para_fila_id, ticket_id")
        .gte("created_at", `${de}T00:00:00-03:00`)
        .lt("created_at", `${ate}T23:59:59.999-03:00`)
        .limit(5000);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as { de_fila_id: string | null; para_fila_id: string; ticket_id: string }[];
      // Se filaId fornecido: filtrar por origem OU destino igual à fila
      const filtrado = filaId
        ? rows.filter((r) => r.de_fila_id === filaId || r.para_fila_id === filaId)
        : rows;
      const map = new Map<string, TransferenciaFluxo>();
      for (const r of filtrado) {
        const k = `${r.de_fila_id ?? "∅"}→${r.para_fila_id}`;
        const cur = map.get(k) ?? { de_fila_id: r.de_fila_id, para_fila_id: r.para_fila_id, count: 0 };
        cur.count++;
        map.set(k, cur);
      }
      return Array.from(map.values());
    },
  });
}

// ---------------- CSAT: distribuição 1-5 ----------------

export interface CsatDist {
  score: number;
  count: number;
}

export function useCsatDistribuicao(de: string, ate: string, filaId?: string | null) {
  return useQuery({
    queryKey: ["suporte", "csat-dist", de, ate, filaId ?? null],
    staleTime: 60_000,
    queryFn: async (): Promise<CsatDist[]> => {
      const { data, error } = await sb
        .from("suporte_csat")
        .select("score, ticket_id, suporte_tickets!inner(fila_id, created_at)")
        .gte("suporte_tickets.created_at", `${de}T00:00:00-03:00`)
        .lt("suporte_tickets.created_at", `${ate}T23:59:59.999-03:00`)
        .limit(5000);
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const filt = filaId
        ? rows.filter((r) => r.suporte_tickets?.fila_id === filaId)
        : rows;
      return [1, 2, 3, 4, 5].map((s) => ({
        score: s,
        count: filt.filter((r) => Number(r.score) === s).length,
      }));
    },
  });
}

