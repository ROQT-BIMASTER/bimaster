import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Comentario {
  id: string;
  roteiro_id: string;
  user_id: string;
  autor_nome: string | null;
  cena_index: number | null;
  mensagem: string;
  resolvido: boolean;
  resolvido_em: string | null;
  created_at: string;
  updated_at: string;
}

export interface HistoricoEntrada {
  id: string;
  roteiro_id: string;
  user_id: string;
  autor_nome: string | null;
  evento: string;
  descricao: string | null;
  cena_index: number | null;
  campo: string | null;
  valor_anterior: string | null;
  valor_novo: string | null;
  created_at: string;
}

export function useRoteiristaRevisao(roteiroId: string | null) {
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [historico, setHistorico] = useState<HistoricoEntrada[]>([]);
  const [loading, setLoading] = useState(false);
  const [autorNome, setAutorNome] = useState<string>("");

  // Carrega nome do autor a partir do perfil
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const meta = user.user_metadata as Record<string, unknown> | null;
      const nome =
        (meta?.full_name as string) ||
        (meta?.name as string) ||
        user.email ||
        "Usuário";
      setAutorNome(nome);
    })();
  }, []);

  const carregar = useCallback(async () => {
    if (!roteiroId) {
      setComentarios([]);
      setHistorico([]);
      return;
    }
    setLoading(true);
    try {
      const [c, h] = await Promise.all([
        supabase
          .from("roteirista_comentarios")
          .select("*")
          .eq("roteiro_id", roteiroId)
          .order("created_at", { ascending: true }),
        supabase
          .from("roteirista_historico")
          .select("*")
          .eq("roteiro_id", roteiroId)
          .order("created_at", { ascending: false })
          .limit(200),
      ]);
      if (c.error) throw c.error;
      if (h.error) throw h.error;
      setComentarios((c.data as Comentario[]) || []);
      setHistorico((h.data as HistoricoEntrada[]) || []);
    } catch (e) {
      console.error("[useRoteiristaRevisao] erro:", e);
    } finally {
      setLoading(false);
    }
  }, [roteiroId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Realtime: comentários e histórico
  useEffect(() => {
    if (!roteiroId) return;
    const channel = supabase
      .channel(`roteirista-revisao-${roteiroId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "roteirista_comentarios", filter: `roteiro_id=eq.${roteiroId}` },
        () => carregar()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "roteirista_historico", filter: `roteiro_id=eq.${roteiroId}` },
        () => carregar()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roteiroId, carregar]);

  const adicionarComentario = useCallback(
    async (mensagem: string, cenaIndex: number | null) => {
      if (!roteiroId || !mensagem.trim()) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from("roteirista_comentarios").insert({
        roteiro_id: roteiroId,
        user_id: user.id,
        autor_nome: autorNome,
        cena_index: cenaIndex,
        mensagem: mensagem.trim(),
      });
      if (error) {
        toast.error("Erro ao adicionar comentário");
        return;
      }
      await registrarEvento(
        cenaIndex === null ? "comentario_geral" : "comentario_cena",
        cenaIndex === null
          ? "Adicionou comentário no roteiro"
          : `Adicionou comentário na cena ${cenaIndex + 1}`,
        cenaIndex
      );
      toast.success("Comentário adicionado");
    },
    [roteiroId, autorNome] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const alternarResolvido = useCallback(
    async (comentario: Comentario) => {
      const novo = !comentario.resolvido;
      const { error } = await supabase
        .from("roteirista_comentarios")
        .update({ resolvido: novo, resolvido_em: novo ? new Date().toISOString() : null })
        .eq("id", comentario.id);
      if (error) {
        toast.error("Erro ao atualizar comentário");
        return;
      }
      await registrarEvento(
        novo ? "comentario_resolvido" : "comentario_reaberto",
        novo
          ? `Marcou comentário como resolvido${comentario.cena_index !== null ? ` (cena ${comentario.cena_index + 1})` : ""}`
          : `Reabriu comentário${comentario.cena_index !== null ? ` (cena ${comentario.cena_index + 1})` : ""}`,
        comentario.cena_index
      );
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const excluirComentario = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("roteirista_comentarios").delete().eq("id", id);
      if (error) {
        toast.error("Erro ao excluir");
        return;
      }
      toast.success("Comentário excluído");
    },
    []
  );

  const registrarEvento = useCallback(
    async (
      evento: string,
      descricao: string,
      cenaIndex: number | null = null,
      extras?: { campo?: string; valor_anterior?: string; valor_novo?: string; snapshot?: unknown }
    ) => {
      if (!roteiroId) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("roteirista_historico").insert({
        roteiro_id: roteiroId,
        user_id: user.id,
        autor_nome: autorNome,
        evento,
        descricao,
        cena_index: cenaIndex,
        campo: extras?.campo ?? null,
        valor_anterior: extras?.valor_anterior ?? null,
        valor_novo: extras?.valor_novo ?? null,
        snapshot: (extras?.snapshot as never) ?? null,
      });
    },
    [roteiroId, autorNome]
  );

  const totalAbertos = comentarios.filter(c => !c.resolvido).length;
  const totalResolvidos = comentarios.length - totalAbertos;
  const comentariosPorCena = (idx: number) =>
    comentarios.filter(c => c.cena_index === idx);

  return {
    comentarios,
    historico,
    loading,
    autorNome,
    totalAbertos,
    totalResolvidos,
    comentariosPorCena,
    adicionarComentario,
    alternarResolvido,
    excluirComentario,
    registrarEvento,
    recarregar: carregar,
  };
}
