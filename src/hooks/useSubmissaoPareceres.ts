import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ParecerAnexo {
  id: string;
  parecer_id: string;
  storage_path: string;
  nome_arquivo: string;
  mime: string | null;
  tamanho: number | null;
  uploaded_by: string;
  created_at: string;
}

export interface Parecer {
  id: string;
  submissao_id: string;
  autor_id: string;
  autor_lado: "brasil" | "china";
  texto: string;
  critico: boolean;
  traducao_pt: string | null;
  traducao_en: string | null;
  traducao_zh: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  anexos: ParecerAnexo[];
  autor_nome?: string | null;
}

const KEY = (submissaoId: string) => ["china-submissao-pareceres", submissaoId];

export function useSubmissaoPareceres(submissaoId: string | null | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: KEY(submissaoId || "_"),
    enabled: !!submissaoId,
    queryFn: async (): Promise<Parecer[]> => {
      const { data: pareceres, error } = await supabase
        .from("china_submissao_pareceres" as any)
        .select("*")
        .eq("submissao_id", submissaoId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const list = (pareceres || []) as any as Parecer[];
      if (list.length === 0) return [];

      const ids = list.map((p) => p.id);
      const { data: anexos } = await supabase
        .from("china_submissao_parecer_anexos" as any)
        .select("*")
        .in("parecer_id", ids);
      const byParecer = new Map<string, ParecerAnexo[]>();
      ((anexos as any) || []).forEach((a: ParecerAnexo) => {
        const arr = byParecer.get(a.parecer_id) || [];
        arr.push(a);
        byParecer.set(a.parecer_id, arr);
      });

      const autorIds = Array.from(new Set(list.map((p) => p.autor_id)));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome_completo")
        .in("id", autorIds);
      const nomes = new Map<string, string>();
      (profiles || []).forEach((p: any) => nomes.set(p.id, p.nome_completo));

      return list.map((p) => ({
        ...p,
        anexos: byParecer.get(p.id) || [],
        autor_nome: nomes.get(p.autor_id) || null,
      }));
    },
  });

  useEffect(() => {
    if (!submissaoId) return;
    const ch = supabase
      .channel(`china-pareceres-${submissaoId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "china_submissao_pareceres", filter: `submissao_id=eq.${submissaoId}` },
        () => qc.invalidateQueries({ queryKey: KEY(submissaoId) }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "china_submissao_parecer_anexos" },
        () => qc.invalidateQueries({ queryKey: KEY(submissaoId) }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [submissaoId, qc]);

  const publicar = useMutation({
    mutationFn: async (args: {
      texto: string;
      critico: boolean;
      lado: "brasil" | "china";
      anexos: File[];
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Usuário não autenticado");

      const { data: inserted, error } = await supabase
        .from("china_submissao_pareceres" as any)
        .insert({
          submissao_id: submissaoId,
          autor_id: uid,
          autor_lado: args.lado,
          texto: args.texto.trim(),
          critico: args.critico,
        })
        .select("id")
        .single();
      if (error) throw error;
      const parecerId = (inserted as any).id as string;

      for (const file of args.anexos) {
        if (file.size > 20 * 1024 * 1024) continue;
        const path = `${uid}/${submissaoId}/${parecerId}/${crypto.randomUUID()}-${file.name}`;
        const { error: upErr } = await supabase.storage
          .from("china-pareceres")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) continue;
        await supabase.from("china_submissao_parecer_anexos" as any).insert({
          parecer_id: parecerId,
          storage_path: path,
          nome_arquivo: file.name,
          mime: file.type || null,
          tamanho: file.size,
          uploaded_by: uid,
        });
      }
      return parecerId;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(submissaoId || "_") }),
  });

  const editar = useMutation({
    mutationFn: async (args: { id: string; texto: string }) => {
      const { error } = await supabase
        .from("china_submissao_pareceres" as any)
        .update({ texto: args.texto.trim() })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(submissaoId || "_") }),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("china_submissao_pareceres" as any)
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(submissaoId || "_") }),
  });

  return {
    pareceres: query.data || [],
    loading: query.isLoading,
    publicar,
    editar,
    excluir,
  };
}
