import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ProcessoOperacional {
  id: string;
  nome: string;
  descricao: string | null;
  fila_dona_id: string;
  versao: number;
  ativo: boolean;
  cor: string | null;
  created_at: string;
}

export interface ProcessoEtapa {
  id: string;
  processo_id: string;
  rotina_fixa_id: string;
  nome_override: string | null;
  ordem: number;
  sla_minutos: number | null;
  horario_corte: string | null;
  posicao_x: number;
  posicao_y: number;
}

export interface ProcessoLigacao {
  id: string;
  processo_id: string;
  de_etapa_id: string;
  para_etapa_id: string;
  condicao: "sempre" | "se_concluida" | "em_excecao";
  sla_handoff_minutos: number | null;
  rotulo: string | null;
}

/** Lista os processos visíveis para o usuário atual. */
export function useProcessos() {
  return useQuery({
    queryKey: ["processos-operacionais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos_operacionais" as any)
        .select("*")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as ProcessoOperacional[];
    },
  });
}

/** Retorna etapas + ligações do processo. */
export function useProcesso(processoId: string | null | undefined) {
  return useQuery({
    enabled: !!processoId,
    queryKey: ["processo", processoId],
    queryFn: async () => {
      const [processo, etapas, ligacoes] = await Promise.all([
        supabase.from("processos_operacionais" as any).select("*").eq("id", processoId!).maybeSingle(),
        supabase.from("processo_etapas" as any).select("*").eq("processo_id", processoId!).order("ordem"),
        supabase.from("processo_ligacoes" as any).select("*").eq("processo_id", processoId!),
      ]);
      if (processo.error) throw processo.error;
      if (etapas.error) throw etapas.error;
      if (ligacoes.error) throw ligacoes.error;
      return {
        processo: processo.data as unknown as ProcessoOperacional,
        etapas: (etapas.data ?? []) as unknown as ProcessoEtapa[],
        ligacoes: (ligacoes.data ?? []) as unknown as ProcessoLigacao[],
      };
    },
  });
}

/** Retorna, para uma rotina, o processo em que ela participa + próximas etapas. */
export function useEncadeamentoDaRotina(rotinaId: string | null | undefined) {
  return useQuery({
    enabled: !!rotinaId,
    queryKey: ["processo", "por-rotina", rotinaId],
    queryFn: async () => {
      const { data: etapa, error } = await supabase
        .from("processo_etapas" as any)
        .select("id, processo_id, sla_minutos")
        .eq("rotina_fixa_id", rotinaId!)
        .maybeSingle();
      if (error) throw error;
      if (!etapa) return { processo_id: null, etapa_id: null, proximas: [], sla_handoff: null };
      const e = etapa as unknown as { id: string; processo_id: string; sla_minutos: number | null };
      const { data: lig, error: le } = await supabase
        .from("processo_ligacoes" as any)
        .select("para_etapa_id, sla_handoff_minutos")
        .eq("de_etapa_id", e.id);
      if (le) throw le;
      const ligs = (lig ?? []) as unknown as Array<{ para_etapa_id: string; sla_handoff_minutos: number | null }>;
      const proxIds = ligs.map((x) => x.para_etapa_id);
      let proxRotinas: string[] = [];
      if (proxIds.length) {
        const { data: proxEtapas, error: pe } = await supabase
          .from("processo_etapas" as any)
          .select("rotina_fixa_id")
          .in("id", proxIds);
        if (pe) throw pe;
        proxRotinas = (proxEtapas ?? []).map((r: any) => r.rotina_fixa_id as string);
      }
      return {
        processo_id: e.processo_id,
        etapa_id: e.id,
        proximas: proxRotinas,
        sla_handoff: ligs[0]?.sla_handoff_minutos ?? null,
      };
    },
  });
}

interface VincularArgs {
  rotina_id: string;
  fila_id: string;
  processo_id: string | null;
  novo_processo_nome?: string | null;
  proximas_rotinas: string[];
  sla_handoff_minutos: number | null;
}

/** Cria/atualiza o vínculo da rotina a um processo, e as ligações para as próximas rotinas. */
export function useVincularRotinaAoProcesso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: VincularArgs) => {
      let processoId = args.processo_id;

      // 1) Se pediu "novo processo", cria
      if (!processoId && args.novo_processo_nome && args.novo_processo_nome.trim()) {
        const { data: uid } = await supabase.auth.getUser();
        const { data: novo, error } = await supabase
          .from("processos_operacionais" as any)
          .insert({
            nome: args.novo_processo_nome.trim(),
            fila_dona_id: args.fila_id,
            criador_id: uid.user?.id ?? null,
          } as any)
          .select("id")
          .single();
        if (error) throw error;
        processoId = (novo as any).id as string;
      }

      // Sem processo → nada mais a fazer (rotina fica avulsa)
      if (!processoId) return { processo_id: null };

      // 2) Garante etapa desta rotina no processo
      let etapaId: string;
      const { data: existente } = await supabase
        .from("processo_etapas" as any)
        .select("id")
        .eq("processo_id", processoId)
        .eq("rotina_fixa_id", args.rotina_id)
        .maybeSingle();

      if (existente) {
        etapaId = (existente as any).id;
      } else {
        // pega próxima ordem
        const { data: ord } = await supabase
          .from("processo_etapas" as any)
          .select("ordem")
          .eq("processo_id", processoId)
          .order("ordem", { ascending: false })
          .limit(1)
          .maybeSingle();
        const proxOrdem = ((ord as any)?.ordem ?? 0) + 1;
        const { data: nova, error } = await supabase
          .from("processo_etapas" as any)
          .insert({
            processo_id: processoId,
            rotina_fixa_id: args.rotina_id,
            ordem: proxOrdem,
            posicao_x: proxOrdem * 280,
            posicao_y: 100,
          } as any)
          .select("id")
          .single();
        if (error) throw error;
        etapaId = (nova as any).id;
      }

      // 3) Garante etapas para cada próxima rotina
      const proxEtapaIds: string[] = [];
      for (const rid of args.proximas_rotinas) {
        const { data: exist } = await supabase
          .from("processo_etapas" as any)
          .select("id")
          .eq("processo_id", processoId)
          .eq("rotina_fixa_id", rid)
          .maybeSingle();
        if (exist) {
          proxEtapaIds.push((exist as any).id);
        } else {
          const { data: ord } = await supabase
            .from("processo_etapas" as any)
            .select("ordem")
            .eq("processo_id", processoId)
            .order("ordem", { ascending: false })
            .limit(1)
            .maybeSingle();
          const proxOrdem = ((ord as any)?.ordem ?? 0) + 1;
          const { data: nova, error } = await supabase
            .from("processo_etapas" as any)
            .insert({
              processo_id: processoId,
              rotina_fixa_id: rid,
              ordem: proxOrdem,
              posicao_x: proxOrdem * 280,
              posicao_y: 100,
            } as any)
            .select("id")
            .single();
          if (error) throw error;
          proxEtapaIds.push((nova as any).id);
        }
      }

      // 4) Reseta ligações partindo desta etapa e recria com base nas novas escolhas
      await supabase.from("processo_ligacoes" as any).delete().eq("de_etapa_id", etapaId);
      if (proxEtapaIds.length) {
        const rows = proxEtapaIds.map((pid) => ({
          processo_id: processoId!,
          de_etapa_id: etapaId,
          para_etapa_id: pid,
          condicao: "se_concluida" as const,
          sla_handoff_minutos: args.sla_handoff_minutos,
        }));
        const { error } = await supabase.from("processo_ligacoes" as any).insert(rows as any);
        if (error) throw error;
      }

      return { processo_id: processoId };
    },
    onSuccess: (_, args) => {
      qc.invalidateQueries({ queryKey: ["processos-operacionais"] });
      qc.invalidateQueries({ queryKey: ["processo"] });
      qc.invalidateQueries({ queryKey: ["processo", "por-rotina", args.rotina_id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao vincular processo."),
  });
}

/** Remove o vínculo desta rotina com o processo (mantém o processo e demais etapas). */
export function useDesvincularRotinaDoProcesso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rotinaId: string) => {
      // Deleta a etapa (ligações caem em cascade)
      const { error } = await supabase
        .from("processo_etapas" as any)
        .delete()
        .eq("rotina_fixa_id", rotinaId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["processos-operacionais"] });
      qc.invalidateQueries({ queryKey: ["processo"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao desvincular."),
  });
}
