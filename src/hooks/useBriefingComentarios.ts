import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invokeChat } from "@/lib/ai/invokeChat";
import { toast } from "sonner";

export interface BriefingComentario {
  id: string;
  briefing_id: string;
  campo_key: string;
  parent_id: string | null;
  author_id: string;
  body: string;
  resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  ai_status: "none" | "pending" | "applied" | "proposed" | "dismissed";
  ai_request_id: string | null;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any> | null;
}

export interface ReworkResult {
  ok: boolean;
  mode: "apply" | "propose";
  novo_texto?: string;
  texto_anterior?: string;
  racional?: string;
  mudancas?: { tipo: string; descricao: string }[];
  message_id?: string;
  ai_request_id?: string;
}

export function useBriefingComentarios(briefingId: string | undefined) {
  const [comentarios, setComentarios] = useState<BriefingComentario[]>([]);
  const [authors, setAuthors] = useState<Record<string, { nome: string | null; avatar: string | null }>>({});
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!briefingId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("briefing_comentarios")
      .select("*")
      .eq("briefing_id", briefingId)
      .order("created_at", { ascending: true });
    setLoading(false);
    if (error) {
      console.error("[useBriefingComentarios]", error);
      return;
    }
    const list = (data ?? []) as BriefingComentario[];
    setComentarios(list);
    const missing = Array.from(new Set(list.map((c) => c.author_id))).filter((id) => !authors[id]);
    if (missing.length > 0) {
      const { data: profs } = await (supabase as any)
        .from("profiles")
        .select("id, nome, avatar_url")
        .in("id", missing);
      const next = { ...authors };
      (profs ?? []).forEach((p: any) => {
        next[p.id] = { nome: p.nome ?? null, avatar: p.avatar_url ?? null };
      });
      setAuthors(next);
    }
  }, [briefingId, authors]);

  useEffect(() => {
    fetchAll();
  }, [briefingId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!briefingId) return;
    const ch = supabase
      .channel(`briefing_coments_${briefingId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "briefing_comentarios", filter: `briefing_id=eq.${briefingId}` },
        () => fetchAll(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [briefingId, fetchAll]);

  const countsByCampo = useMemo(() => {
    const map: Record<string, { total: number; abertos: number }> = {};
    comentarios.forEach((c) => {
      const m = map[c.campo_key] ?? { total: 0, abertos: 0 };
      m.total += 1;
      if (!c.resolved) m.abertos += 1;
      map[c.campo_key] = m;
    });
    return map;
  }, [comentarios]);

  const byCampo = useCallback(
    (campoKey: string) => comentarios.filter((c) => c.campo_key === campoKey),
    [comentarios],
  );

  const add = useCallback(async (params: { campo_key: string; body: string; parent_id?: string | null; mentions?: string[]; metadata?: Record<string, any> }) => {
    if (!briefingId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Faça login para comentar"); return; }
    const mentions = (params.mentions ?? []).filter((id) => id && id !== user.id);
    const { error } = await supabase.from("briefing_comentarios").insert({
      briefing_id: briefingId,
      campo_key: params.campo_key,
      body: params.body.trim(),
      parent_id: params.parent_id ?? null,
      author_id: user.id,
      ...(mentions.length > 0 ? { mentions } : {}),
      ...(params.metadata ? { metadata: params.metadata } : {}),
    });
    if (error) { toast.error("Erro ao salvar comentário"); return; }
  }, [briefingId]);

  const updateMetadata = useCallback(async (id: string, metadata: Record<string, any>) => {
    const { error } = await supabase
      .from("briefing_comentarios")
      .update({ metadata } as any)
      .eq("id", id);
    if (error) toast.error("Erro ao vincular documento");
  }, []);


  const updateBody = useCallback(async (id: string, body: string) => {
    const { error } = await supabase
      .from("briefing_comentarios")
      .update({ body: body.trim() })
      .eq("id", id);
    if (error) toast.error("Erro ao editar");
  }, []);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from("briefing_comentarios").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir");
  }, []);

  const toggleResolved = useCallback(async (c: BriefingComentario) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("briefing_comentarios")
      .update({
        resolved: !c.resolved,
        resolved_by: !c.resolved ? user?.id ?? null : null,
        resolved_at: !c.resolved ? new Date().toISOString() : null,
      })
      .eq("id", c.id);
    if (error) toast.error("Erro ao atualizar status");
  }, []);

  const rework = useCallback(async (params: {
    campo_key: string;
    comment_ids: string[];
    mode: "apply" | "propose";
  }): Promise<ReworkResult | null> => {
    if (!briefingId) return null;
    const { data, error } = await invokeChat<ReworkResult>(
      "briefing-rework-field",
      { briefing_id: briefingId, ...params },
      { timeoutMs: 90_000 },
    );
    if (error) { toast.error(error.userMessage); return null; }
    return data;
  }, [briefingId]);

  return {
    comentarios, authors, loading, countsByCampo,
    byCampo, add, updateBody, updateMetadata, remove, toggleResolved, rework, refresh: fetchAll,
  };
}
