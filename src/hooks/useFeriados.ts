import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Feriado {
  id: string;
  data: string;
  nome: string;
  tipo: "nacional" | "estadual" | "municipal" | "empresa";
  uf: string | null;
  fonte: "brasilapi" | "manual";
  ano: number;
}

export function useFeriados(ano?: number) {
  const queryClient = useQueryClient();
  const anoFiltro = ano ?? new Date().getFullYear();

  const { data: feriados = [], isLoading } = useQuery({
    queryKey: ["feriados", anoFiltro],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feriados" as any)
        .select("*")
        .eq("ano", anoFiltro)
        .order("data", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Feriado[];
    },
    staleTime: 5 * 60_000,
  });

  const sincronizar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-feriados");
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["feriados"] });
      toast.success(
        `Feriados sincronizados: ${data?.inserted ?? 0} novos, ${data?.updated ?? 0} atualizados`,
      );
    },
    onError: (err: Error) => toast.error("Erro ao sincronizar: " + err.message),
  });

  const criarFeriado = useMutation({
    mutationFn: async (
      f: Omit<Feriado, "id" | "fonte"> & { fonte?: Feriado["fonte"] },
    ) => {
      const { error } = await supabase
        .from("feriados" as any)
        .insert({ ...f, fonte: f.fonte ?? "manual" } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feriados"] });
      toast.success("Feriado adicionado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removerFeriado = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("feriados" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feriados"] });
      toast.success("Feriado removido");
    },
  });

  return { feriados, isLoading, sincronizar, criarFeriado, removerFeriado };
}

/**
 * Calcula a data de fim somando dias úteis a uma data base.
 * regime: "corridos" | "dias_uteis" | "uteis_com_sabado"
 */
export function calcularDataUtil(
  base: Date,
  dias: number,
  regime: "corridos" | "dias_uteis" | "uteis_com_sabado" = "dias_uteis",
  feriados: Set<string> = new Set(),
): Date {
  if (regime === "corridos") {
    const d = new Date(base);
    d.setDate(d.getDate() + dias);
    return d;
  }
  let restantes = dias;
  const d = new Date(base);
  while (restantes > 0) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (regime === "dias_uteis" && (dow === 0 || dow === 6)) continue;
    if (regime === "uteis_com_sabado" && dow === 0) continue;
    const key = d.toISOString().slice(0, 10);
    if (feriados.has(key)) continue;
    restantes--;
  }
  return d;
}

/** Conta dias úteis entre duas datas (inclusivo no início, exclusivo no fim) */
export function contarDiasUteis(
  inicio: Date,
  fim: Date,
  regime: "corridos" | "dias_uteis" | "uteis_com_sabado" = "dias_uteis",
  feriados: Set<string> = new Set(),
): number {
  if (regime === "corridos") {
    return Math.max(
      0,
      Math.ceil((fim.getTime() - inicio.getTime()) / 86400000),
    );
  }
  let count = 0;
  const d = new Date(inicio);
  while (d < fim) {
    const dow = d.getDay();
    const key = d.toISOString().slice(0, 10);
    const isHoliday = feriados.has(key);
    const isWeekend =
      regime === "dias_uteis"
        ? dow === 0 || dow === 6
        : regime === "uteis_com_sabado"
          ? dow === 0
          : false;
    if (!isWeekend && !isHoliday) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}
