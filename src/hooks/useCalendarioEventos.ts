import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/** Evento avulso do Calendário Geral (não pertence a nenhum projeto). */
export interface CalendarioEvento {
  id: string;
  titulo: string;
  descricao: string | null;
  data_inicio: string;          // Y-M-D
  data_fim: string;             // Y-M-D
  dia_inteiro: boolean;
  hora_inicio: string | null;   // HH:mm[:ss]
  hora_fim: string | null;
  local: string | null;
  cor: string;
  categoria: string;
  visibilidade: "pessoal" | "compartilhado";
  criado_por: string;
  recorrencia_id: string | null;
  participantes: string[];
  tags: string[];
}

export interface EventoInput {
  titulo: string;
  descricao?: string | null;
  data_inicio: string;
  data_fim: string;
  dia_inteiro: boolean;
  hora_inicio?: string | null;
  hora_fim?: string | null;
  local?: string | null;
  cor: string;
  categoria: string;
  participantes: string[];
  tags?: string[];
  lembrete?: {
    ativo: boolean;
    antecedenciaMinutos: number;
    email: boolean;
    notificacao: boolean;
  };
  recorrencia?: {
    frequencia: "nenhuma" | "semanal" | "mensal";
    intervalo: number;
    ate: string | null;
  };
}

const QUERY_KEY = ["calendario-eventos"];

/** Gera as datas de uma série recorrente a partir da data base. */
function gerarOcorrencias(
  inicio: string,
  fim: string,
  freq: "semanal" | "mensal",
  intervalo: number,
  ate: string,
): Array<{ inicio: string; fim: string }> {
  const out: Array<{ inicio: string; fim: string }> = [];
  const [ay, am, ad] = inicio.split("-").map(Number);
  const [by, bm, bd] = fim.split("-").map(Number);
  const [cy, cm, cd] = ate.split("-").map(Number);
  const limite = new Date(cy, cm - 1, cd);
  const duracaoDias = Math.round(
    (new Date(by, bm - 1, bd).getTime() - new Date(ay, am - 1, ad).getTime()) / 86_400_000,
  );

  let cursor = new Date(ay, am - 1, ad);
  let guard = 0;
  while (cursor <= limite && guard < 200) {
    const f = new Date(cursor);
    f.setDate(f.getDate() + duracaoDias);
    out.push({ inicio: fmt(cursor), fim: fmt(f) });
    const next = new Date(cursor);
    if (freq === "semanal") next.setDate(next.getDate() + 7 * intervalo);
    else next.setMonth(next.getMonth() + intervalo);
    cursor = next;
    guard += 1;
  }
  return out;
}

function fmt(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const dd = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dd}`;
}

/** Eventos avulsos visíveis para o usuário (autor ou participante). */
export function useCalendarioEventos() {
  return useQuery({
    queryKey: QUERY_KEY,
    staleTime: 60_000,
    queryFn: async (): Promise<CalendarioEvento[]> => {
      const { data, error } = await (supabase as any)
        .from("calendario_eventos")
        .select("*, calendario_evento_participantes(user_id)")
        .order("data_inicio", { ascending: true });
      if (error) throw error;

      return (data || []).map((e: any): CalendarioEvento => ({
        id: e.id,
        titulo: e.titulo,
        descricao: e.descricao ?? null,
        data_inicio: e.data_inicio,
        data_fim: e.data_fim,
        dia_inteiro: !!e.dia_inteiro,
        hora_inicio: e.hora_inicio ?? null,
        hora_fim: e.hora_fim ?? null,
        local: e.local ?? null,
        cor: e.cor || "#6366f1",
        categoria: e.categoria || "geral",
        visibilidade: e.visibilidade === "compartilhado" ? "compartilhado" : "pessoal",
        criado_por: e.criado_por,
        recorrencia_id: e.recorrencia_id ?? null,
        participantes: (e.calendario_evento_participantes || []).map((p: any) => p.user_id),
        tags: Array.isArray(e.tags) ? e.tags : [],
      }));
    },
  });
}

/** Criação, edição e exclusão de eventos avulsos. */
export function useCalendarioEventosMutations() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const invalidate = () => qc.invalidateQueries({ queryKey: QUERY_KEY });

  const salvarParticipantesELembrete = async (
    eventoIds: string[],
    input: EventoInput,
    userId: string,
  ) => {
    if (input.participantes.length) {
      const rows = eventoIds.flatMap((eventoId) =>
        input.participantes.map((uid) => ({ evento_id: eventoId, user_id: uid })),
      );
      const { error } = await (supabase as any)
        .from("calendario_evento_participantes")
        .upsert(rows, { onConflict: "evento_id,user_id" });
      if (error) throw error;
    }

    if (input.lembrete?.ativo) {
      // Índice único é parcial (evento_id IS NOT NULL), então não é inferível
      // por ON CONFLICT: limpamos e reinserimos.
      const { error: delErr } = await (supabase as any)
        .from("calendario_lembretes")
        .delete()
        .in("evento_id", eventoIds)
        .eq("user_id", userId);
      if (delErr) throw delErr;

      const rows = eventoIds.map((eventoId) => ({
        evento_id: eventoId,
        user_id: userId,
        antecedencia_minutos: input.lembrete!.antecedenciaMinutos,
        canal_email: input.lembrete!.email,
        canal_notificacao: input.lembrete!.notificacao,
        ativo: true,
      }));
      const { error } = await (supabase as any).from("calendario_lembretes").insert(rows);
      if (error) throw error;
    }
  };

  const criar = useMutation({
    mutationFn: async (input: EventoInput) => {
      if (!user?.id) throw new Error("Sessão expirada.");

      const base = {
        titulo: input.titulo.trim(),
        descricao: input.descricao?.trim() || null,
        dia_inteiro: input.dia_inteiro,
        hora_inicio: input.dia_inteiro ? null : input.hora_inicio || null,
        hora_fim: input.dia_inteiro ? null : input.hora_fim || null,
        local: input.local?.trim() || null,
        cor: input.cor,
        categoria: input.categoria,
        visibilidade: input.participantes.length ? "compartilhado" : "pessoal",
        criado_por: user.id,
      };

      const rec = input.recorrencia;
      const datas =
        rec && rec.frequencia !== "nenhuma" && rec.ate
          ? gerarOcorrencias(input.data_inicio, input.data_fim, rec.frequencia, rec.intervalo, rec.ate)
          : [{ inicio: input.data_inicio, fim: input.data_fim }];

      const recorrenciaId = datas.length > 1 ? crypto.randomUUID() : null;

      const { data, error } = await (supabase as any)
        .from("calendario_eventos")
        .insert(
          datas.map((d) => ({
            ...base,
            data_inicio: d.inicio,
            data_fim: d.fim,
            recorrencia_id: recorrenciaId,
            ocorrencia_data: recorrenciaId ? d.inicio : null,
          })),
        )
        .select("id");
      if (error) throw error;

      await salvarParticipantesELembrete((data || []).map((r: any) => r.id), input, user.id);
      return (data || []).length;
    },
    onSuccess: invalidate,
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: EventoInput }) => {
      if (!user?.id) throw new Error("Sessão expirada.");

      const { error } = await (supabase as any)
        .from("calendario_eventos")
        .update({
          titulo: input.titulo.trim(),
          descricao: input.descricao?.trim() || null,
          data_inicio: input.data_inicio,
          data_fim: input.data_fim,
          dia_inteiro: input.dia_inteiro,
          hora_inicio: input.dia_inteiro ? null : input.hora_inicio || null,
          hora_fim: input.dia_inteiro ? null : input.hora_fim || null,
          local: input.local?.trim() || null,
          cor: input.cor,
          categoria: input.categoria,
          visibilidade: input.participantes.length ? "compartilhado" : "pessoal",
        })
        .eq("id", id);
      if (error) throw error;

      const { error: delErr } = await (supabase as any)
        .from("calendario_evento_participantes")
        .delete()
        .eq("evento_id", id);
      if (delErr) throw delErr;

      await salvarParticipantesELembrete([id], input, user.id);
    },
    onSuccess: invalidate,
  });

  const excluir = useMutation({
    mutationFn: async ({ id, serie }: { id: string; serie?: string | null }) => {
      const q = (supabase as any).from("calendario_eventos").delete();
      const { error } = serie ? await q.eq("recorrencia_id", serie) : await q.eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /**
   * Reagenda um evento deslocando início e fim pelo mesmo número de dias.
   * Quando `serie` é informado, todas as ocorrências recebem o mesmo deslocamento.
   */
  const reagendar = useMutation({
    mutationFn: async ({
      id, deltaDias, serie,
    }: { id: string; deltaDias: number; serie?: string | null }) => {
      if (!deltaDias) return;

      const query = (supabase as any)
        .from("calendario_eventos")
        .select("id, data_inicio, data_fim, recorrencia_id");
      const { data, error } = serie
        ? await query.eq("recorrencia_id", serie)
        : await query.eq("id", id);
      if (error) throw error;

      const shift = (iso: string) => {
        const [y, m, d] = iso.split("-").map(Number);
        return fmt(new Date(y, m - 1, d + deltaDias));
      };

      for (const row of (data || []) as Array<{ id: string; data_inicio: string; data_fim: string }>) {
        const novoInicio = shift(row.data_inicio);
        const novoFim = shift(row.data_fim || row.data_inicio);
        const { error: upErr } = await (supabase as any)
          .from("calendario_eventos")
          .update({
            data_inicio: novoInicio,
            data_fim: novoFim,
            ...(serie ? { ocorrencia_data: novoInicio } : {}),
          })
          .eq("id", row.id);
        if (upErr) throw upErr;
      }
    },
    onSuccess: invalidate,
  });

  return { criar, atualizar, excluir, reagendar };
}
