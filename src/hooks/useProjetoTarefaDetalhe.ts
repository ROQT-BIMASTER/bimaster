import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useEffect } from "react";
import { logDocAudit } from "@/lib/productDocAudit";
import { useTarefaMentionableUsers } from "./useTarefaMentionableUsers";
import { uniqueChannelName } from "@/lib/realtime/channelName";
import { sanitizeStorageFilename } from "@/lib/utils/sanitizeStorageFilename";
import { validateFileForUpload, describeUploadError } from "@/lib/utils/file-security";
import { uploadTarefaAnexoToStorage } from "@/lib/utils/uploadTarefaAnexo";
import { isUUID } from "@/lib/utils/isUuid";

export interface TarefaComentario {
  id: string;
  tarefa_id: string;
  user_id: string;
  conteudo: string;
  mentions: string[];
  created_at: string;
  edited_at?: string | null;
  autor?: { nome: string; avatar_url: string | null };
}


export interface TarefaAnexo {
  id: string;
  tarefa_id: string;
  user_id: string;
  nome: string;
  storage_path: string;
  tipo_arquivo: string | null;
  tamanho: number | null;
  created_at: string;
}

export interface TarefaMessageAnexo {
  id: string;
  nome: string;
  storage_path: string;
  tipo_arquivo: string | null;
  tamanho: number | null;
}

export interface TarefaMessage {
  id: string;
  tarefa_id: string;
  user_id: string;
  conteudo: string;
  mentions: string[];
  created_at: string;
  anexo_id?: string | null;
  anexo?: TarefaMessageAnexo | null;
  autor?: { nome: string; avatar_url: string | null };
}

export interface ProdutoAcabado {
  id: string;
  codigo: string;
  nome: string;
  marca: string | null;
  linha: string | null;
  tipo: string | null;
  foto_url: string | null;
  filhos?: ProdutoAcabado[];
}

export function useProjetoTarefaDetalhe(tarefaId: string | undefined, produtoId?: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ===== Comentários =====
  const { data: comentarios = [] } = useQuery({
    queryKey: ["tarefa-comentarios", tarefaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_tarefa_comentarios")
        .select("*")
        .eq("tarefa_id", tarefaId!)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const userIds = [...new Set((data as any[]).map(c => c.user_id))];
      let profiles: Record<string, { nome: string; avatar_url: string | null }> = {};
      if (userIds.length > 0) {
        const { data: p } = await supabase.from("profiles").select("id, nome, avatar_url").in("id", userIds);
        if (p) profiles = Object.fromEntries(p.map(x => [x.id, { nome: x.nome, avatar_url: x.avatar_url }]));
      }

      return (data as any[]).map(c => ({
        ...c,
        mentions: c.mentions || [],
        autor: profiles[c.user_id] || { nome: "Usuário", avatar_url: null },
      })) as TarefaComentario[];
    },
    enabled: !!tarefaId && !!user,
  });

  const addComentario = useMutation({
    mutationFn: async ({ conteudo, mentions }: { conteudo: string; mentions?: string[] }) => {
      const { error } = await supabase.from("projeto_tarefa_comentarios").insert({
        tarefa_id: tarefaId!,
        user_id: user!.id,
        conteudo,
        mentions: mentions || [],
      } as any);
      if (error) throw error;
    },
    onMutate: async ({ conteudo, mentions }) => {
      const qk = ["tarefa-comentarios", tarefaId];
      await queryClient.cancelQueries({ queryKey: qk });
      const previous = queryClient.getQueryData<TarefaComentario[]>(qk);
      // Resolve autor a partir do cache de perfis (mesmo padrão do fetch).
      const profilesCache = queryClient.getQueryData<any[]>(["profiles-cache", user?.id]);
      const me = profilesCache?.find((p: any) => p.id === user?.id);
      const optimistic: TarefaComentario = {
        id: `temp-${crypto.randomUUID()}`,
        tarefa_id: tarefaId!,
        user_id: user!.id,
        conteudo,
        mentions: mentions || [],
        created_at: new Date().toISOString(),
        autor: me ? { nome: me.nome, avatar_url: me.avatar_url } : { nome: "Você", avatar_url: null },
      };
      queryClient.setQueryData<TarefaComentario[]>(qk, (old) => [...(old || []), optimistic]);
      return { previous };
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["tarefa-comentarios", tarefaId], ctx.previous);
      toast.error(err.message);
    },
    onSettled: () => {
      // refetchType:"none" mantém o patch otimista e evita flash/remount no painel de detalhes
      queryClient.invalidateQueries({ queryKey: ["tarefa-comentarios", tarefaId], refetchType: "none" });
    },
  });

  const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

  const editComentario = useMutation({
    mutationFn: async ({ id, conteudo }: { id: string; conteudo: string }) => {
      const { error } = await supabase
        .from("projeto_tarefa_comentarios")
        .update({ conteudo } as any)
        .eq("id", id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onMutate: async ({ id, conteudo }) => {
      const qk = ["tarefa-comentarios", tarefaId];
      await queryClient.cancelQueries({ queryKey: qk });
      const previous = queryClient.getQueryData<TarefaComentario[]>(qk);
      queryClient.setQueryData<TarefaComentario[]>(qk, (old) =>
        (old || []).map((c) => (c.id === id ? { ...c, conteudo, edited_at: new Date().toISOString() } : c)),
      );
      return { previous };
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["tarefa-comentarios", tarefaId], ctx.previous);
      toast.error(err.message || "Não foi possível editar o comentário");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tarefa-comentarios", tarefaId], refetchType: "none" });
    },
  });


  // Realtime subscription for comments
  useEffect(() => {
    if (!tarefaId) return;
    const channel = supabase
      .channel(uniqueChannelName(`tarefa-comentarios-${tarefaId}`))
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "projeto_tarefa_comentarios",
        filter: `tarefa_id=eq.${tarefaId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["tarefa-comentarios", tarefaId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tarefaId, queryClient]);

  // ===== Anexos =====
  const { data: anexos = [] } = useQuery({
    queryKey: ["tarefa-anexos", tarefaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_tarefa_anexos")
        .select("*")
        .eq("tarefa_id", tarefaId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as TarefaAnexo[];
    },
    enabled: !!tarefaId && !!user,
  });

  // ===== File validation constants =====



  type UploadAnexoInput = File | { file: File; notificarIds?: string[] };
  const normalizeUpload = (input: UploadAnexoInput): { file: File; notificarIds: string[] } => {
    if (input instanceof File) return { file: input, notificarIds: [] };
    return { file: input.file, notificarIds: input.notificarIds || [] };
  };

  const uploadAnexo = useMutation({
    mutationFn: async (input: UploadAnexoInput) => {
      const { file, notificarIds } = normalizeUpload(input);

      // Fluxo compartilhado com subtarefas / minhas tarefas:
      // validação + storage upload + insert em projeto_tarefa_anexos.
      const { id, row } = await uploadTarefaAnexoToStorage({
        file,
        userId: user!.id,
        tarefaId: tarefaId!,
        notificarIds,
      });

      // Audit log específico deste hook (mantém compat. com Cofre/produto).
      const cleanedNotificados = Array.from(
        new Set((notificarIds || []).filter((n) => n && n !== user!.id)),
      );
      await logDocAudit({
        produtoId: produtoId || undefined,
        acao: "upload",
        detalhes: {
          nome_arquivo: file.name,
          tamanho: file.size,
          tipo: file.type,
          tarefa_id: tarefaId,
          notificados: cleanedNotificados,
        },
      });

      return { id, nome: file.name, row: row as unknown as TarefaAnexo };
    },
    onMutate: async (input: UploadAnexoInput) => {
      const { file } = normalizeUpload(input);
      const qk = ["tarefa-anexos", tarefaId];
      await queryClient.cancelQueries({ queryKey: qk });
      const previous = queryClient.getQueryData<TarefaAnexo[]>(qk);
      // Placeholder com flag isUploading — em onSuccess é substituído pela
      // linha real do banco; em onError o rollback abaixo remove.
      const tempId = `temp-${crypto.randomUUID()}`;
      const optimistic: TarefaAnexo & { isUploading?: boolean } = {
        id: tempId,
        tarefa_id: tarefaId!,
        user_id: user!.id,
        nome: file.name,
        storage_path: "",
        tipo_arquivo: file.type,
        tamanho: file.size,
        created_at: new Date().toISOString(),
        isUploading: true,
      };
      queryClient.setQueryData<TarefaAnexo[]>(qk, (old) => [optimistic, ...(old || [])]);
      return { previous, tempId };
    },
    onError: (err: Error, _vars, ctx: any) => {
      const qk = ["tarefa-anexos", tarefaId];
      if (ctx?.previous) {
        queryClient.setQueryData(qk, ctx.previous);
      } else if (ctx?.tempId) {
        // Defesa extra: se algo alterou o cache entre onMutate e onError,
        // garante que o placeholder temp-… não fique órfão.
        queryClient.setQueryData<TarefaAnexo[]>(qk, (old) =>
          (old || []).filter((a) => a.id !== ctx.tempId),
        );
      }
      const { title, description } = describeUploadError(err.message);
      toast.error(title, { description });
    },
    onSuccess: (data, _vars, ctx: any) => {
      const qk = ["tarefa-anexos", tarefaId];
      // Substitui o placeholder pelo registro real preservando a posição na
      // lista — evita duplicidade e mantém o UUID definitivo do banco.
      queryClient.setQueryData<TarefaAnexo[]>(qk, (old) => {
        const list = old || [];
        const idx = list.findIndex((a) => a.id === ctx?.tempId);
        if (idx === -1) {
          // Placeholder já não existe (foi refetched em outro fluxo); só
          // adiciona no topo se ainda não estiver presente.
          return list.some((a) => a.id === data.row.id) ? list : [data.row, ...list];
        }
        const next = list.slice();
        next[idx] = data.row;
        return next;
      });
      toast.success("Anexo enviado!");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tarefa-anexos", tarefaId], refetchType: "none" });
    },
  });


  const deleteAnexo = useMutation({
    mutationFn: async (anexo: TarefaAnexo) => {
      // Guard: bloqueia ids temporários (placeholders otimistas) antes que
      // o Postgres devolva `invalid input syntax for type uuid`.
      if (!isUUID(anexo?.id)) {
        throw new Error("Aguarde o upload concluir antes de excluir este anexo.");
      }
      if (anexo.storage_path) {
        await supabase.storage.from("projeto-anexos").remove([anexo.storage_path]);
      }
      const { error } = await supabase.from("projeto_tarefa_anexos").delete().eq("id", anexo.id);
      if (error) throw error;
    },
    onMutate: async (anexo) => {
      const qk = ["tarefa-anexos", tarefaId];
      await queryClient.cancelQueries({ queryKey: qk });
      const previous = queryClient.getQueryData<TarefaAnexo[]>(qk);
      queryClient.setQueryData<TarefaAnexo[]>(qk, (old) => (old || []).filter(a => a.id !== anexo.id));
      return { previous };
    },
    onError: (err: Error, _vars, ctx: any) => {
      if (ctx?.previous) queryClient.setQueryData(["tarefa-anexos", tarefaId], ctx.previous);
      toast.error(err.message);
    },
    onSuccess: () => {
      toast.success("Anexo removido!");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tarefa-anexos", tarefaId], refetchType: "none" });
    },
  });

  const getAnexoUrl = async (storagePath: string) => {
    const { data } = await supabase.storage.from("projeto-anexos").createSignedUrl(storagePath, 3600);
    return data?.signedUrl || "";
  };

  // ===== Send to Cofre =====
  const sendToCofre = useMutation({
    mutationFn: async ({ anexoIds, produtoId, categoriasPorAnexo, projetoId, pastasPorAnexo }: { anexoIds: string[]; produtoId: string; categoriasPorAnexo: Record<string, string>; projetoId?: string; pastasPorAnexo?: Record<string, string | null> }) => {
      // === CRITICAL: Validate admin_cofre role before publishing ===
      if (projetoId) {
        const { data: canPublish } = await supabase.rpc("can_publish_to_cofre", {
          _user_id: user!.id,
          _projeto_id: projetoId,
        });
        if (!canPublish) {
          throw new Error("Apenas usuários com papel 'Admin. Cofre' ou 'Coordenador' podem enviar documentos ao Cofre.");
        }
      }

      const selectedAnexos = anexos.filter(a => anexoIds.includes(a.id));
      
      for (const anexo of selectedAnexos) {
        const destPath = `cofre/${produtoId}/${Date.now()}_${anexo.nome}`;
        const { data: signedUrl } = await supabase.storage.from("projeto-anexos").createSignedUrl(anexo.storage_path, 60);
        
        if (!signedUrl?.signedUrl) throw new Error("Erro ao acessar arquivo");

        const response = await fetch(signedUrl.signedUrl);
        const blob = await response.blob();
        
        const { error: uploadErr } = await supabase.storage
          .from("projeto-anexos")
          .upload(destPath, blob);
        if (uploadErr) throw uploadErr;

        // Insert into cofre
        const { data: cofreDoc } = await supabase.from("fabrica_revisao_documentos" as any).insert({
          produto_id: produtoId,
          nome_arquivo: anexo.nome,
          arquivo_path: destPath,
          tipo_arquivo: anexo.tipo_arquivo,
          tamanho: anexo.tamanho,
          categoria: categoriasPorAnexo[anexo.id] || "outro",
          pasta_id: pastasPorAnexo?.[anexo.id] ?? null,
          status: "ativo",
          enviado_por: user!.id,
          origem_projeto_tarefa_id: tarefaId || null,
          visivel_fabrica: false,
        } as any).select("id").single() as any;

        // Create version record with auto-increment
        if (cofreDoc?.data?.id) {
          // Count existing versions for this document name to auto-increment
          const { count: existingVersions } = await supabase
            .from("produto_documento_versoes" as any)
            .select("id", { count: "exact", head: true })
            .eq("documento_id", cofreDoc.data.id);
          
          const nextVersion = (existingVersions || 0) + 1;

          await supabase.from("produto_documento_versoes" as any).insert({
            documento_id: cofreDoc.data.id,
            versao: nextVersion,
            arquivo_path: destPath,
            tamanho: anexo.tamanho,
            enviado_por: user!.id,
            status: "rascunho",
          } as any);
        }
      }
    },
    onSuccess: (_, variables) => {
      variables.anexoIds.forEach(anexoId => {
        logDocAudit({
          produtoId: variables.produtoId,
          acao: "publicacao_cofre",
          detalhes: { anexo_id: anexoId, categoria: variables.categoriasPorAnexo[anexoId] },
        });
      });
      toast.success("Documentos enviados ao Cofre!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ===== Remove from Cofre (soft) =====
  const removeFromCofre = useMutation({
    mutationFn: async ({ cofreDocId, projetoId }: { cofreDocId: string; projetoId?: string }) => {
      // Mesma alçada da publicação: admin_cofre / coordenador
      if (projetoId) {
        const { data: canPublish } = await supabase.rpc("can_publish_to_cofre", {
          _user_id: user!.id,
          _projeto_id: projetoId,
        });
        if (!canPublish) {
          throw new Error("Apenas usuários com papel 'Admin. Cofre' ou 'Coordenador' podem retirar documentos do Cofre.");
        }
      }
      const { error } = await supabase
        .from("fabrica_revisao_documentos" as any)
        .update({
          status: "removido",
          removed_at: new Date().toISOString(),
          removed_by: user!.id,
        } as any)
        .eq("id", cofreDocId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cofre-docs-tarefa", tarefaId] });
      queryClient.invalidateQueries({ queryKey: ["cofre-docs"] });
      toast.success("Documento retirado do Cofre.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ===== Chat Messages (Realtime) =====
  const { data: messages = [] } = useQuery({
    queryKey: ["tarefa-messages", tarefaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_tarefa_messages" as any)
        .select("*")
        .eq("tarefa_id", tarefaId!)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const rows = (data as any[]) ?? [];
      const userIds = [...new Set(rows.map(m => m.user_id))];
      let profiles: Record<string, { nome: string; avatar_url: string | null }> = {};
      if (userIds.length > 0) {
        const { data: p } = await supabase.from("profiles").select("id, nome, avatar_url").in("id", userIds);
        if (p) profiles = Object.fromEntries(p.map(x => [x.id, { nome: x.nome, avatar_url: x.avatar_url }]));
      }

      const anexoIds = [...new Set(rows.map(m => m.anexo_id).filter(Boolean))] as string[];
      let anexosMap: Record<string, TarefaMessageAnexo> = {};
      if (anexoIds.length > 0) {
        const { data: aRows } = await supabase
          .from("projeto_tarefa_anexos")
          .select("id, nome, storage_path, tipo_arquivo, tamanho")
          .in("id", anexoIds);
        if (aRows) anexosMap = Object.fromEntries(aRows.map((x: any) => [x.id, x]));
      }

      return rows.map(m => ({
        ...m,
        mentions: m.mentions || [],
        autor: profiles[m.user_id] || { nome: "Usuário", avatar_url: null },
        anexo: m.anexo_id ? anexosMap[m.anexo_id] ?? null : null,
      })) as TarefaMessage[];
    },
    enabled: !!tarefaId && !!user,
  });

  // Realtime subscription for messages
  useEffect(() => {
    if (!tarefaId) return;
    const channel = supabase
      .channel(uniqueChannelName(`tarefa-chat-${tarefaId}`))
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "projeto_tarefa_messages",
        filter: `tarefa_id=eq.${tarefaId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["tarefa-messages", tarefaId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tarefaId, queryClient]);

  const sendMessage = useMutation({
    mutationFn: async ({ conteudo, mentions, anexoId }: { conteudo: string; mentions?: string[]; anexoId?: string | null }) => {
      const { error } = await supabase.from("projeto_tarefa_messages" as any).insert({
        tarefa_id: tarefaId!,
        user_id: user!.id,
        conteudo,
        mentions: mentions || [],
        anexo_id: anexoId ?? null,
      } as any);
      if (error) throw error;
    },
    onMutate: async ({ conteudo, mentions, anexoId }) => {
      const qk = ["tarefa-messages", tarefaId];
      await queryClient.cancelQueries({ queryKey: qk });
      const previous = queryClient.getQueryData<TarefaMessage[]>(qk);
      const profilesCache = queryClient.getQueryData<any[]>(["profiles-cache", user?.id]);
      const me = profilesCache?.find((p: any) => p.id === user?.id);
      const optimistic: TarefaMessage = {
        id: `temp-${crypto.randomUUID()}`,
        tarefa_id: tarefaId!,
        user_id: user!.id,
        conteudo,
        mentions: mentions || [],
        created_at: new Date().toISOString(),
        anexo_id: anexoId ?? null,
        autor: me ? { nome: me.nome, avatar_url: me.avatar_url } : { nome: "Você", avatar_url: null },
      };
      queryClient.setQueryData<TarefaMessage[]>(qk, (old) => [...(old || []), optimistic]);
      return { previous };
    },
    onError: (err: Error, _vars, ctx: any) => {
      if (ctx?.previous) queryClient.setQueryData(["tarefa-messages", tarefaId], ctx.previous);
      toast.error(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tarefa-messages", tarefaId], refetchType: "none" });
    },
  });

  // ===== Linked Product query (with filhos for DISPLAY) =====
  const { data: linkedProduto } = useQuery({
    queryKey: ["linked-produto", produtoId],
    queryFn: async () => {
      const { data } = await supabase
        .from("fabrica_produtos" as any)
        .select("id, codigo, nome, marca, linha, tipo, foto_url")
        .eq("id", produtoId!)
        .single();
      if (!data) return null;
      const produto = data as unknown as ProdutoAcabado;

      // If DISPLAY, fetch grade children
      if (produto.tipo === "DISPLAY") {
        const { data: gradeItens } = await supabase
          .from("fabrica_produto_grade_itens" as any)
          .select("produto_filho_id, quantidade, produto_filho:fabrica_produtos!produto_filho_id(id, codigo, nome, marca, linha, tipo, foto_url)")
          .eq("produto_pai_id", produto.id);
        if (gradeItens) {
          produto.filhos = (gradeItens as any[])
            .filter(i => i.produto_filho)
            .map(i => i.produto_filho as ProdutoAcabado);
        }
      }

      return produto;
    },
    enabled: !!produtoId,
  });

  // ===== Produtos Acabados search =====
  const searchProdutos = async (query?: string): Promise<ProdutoAcabado[]> => {
    let q = supabase
      .from("fabrica_produtos" as any)
      .select("id, codigo, nome, marca, linha, tipo, foto_url")
      .eq("ativo", true)
      .order("nome")
      .limit(20);
    if (query && query.length >= 1) {
      q = q.or(`nome.ilike.%${query}%,codigo.ilike.%${query}%`);
    }
    const { data } = await q;
    const produtos = (data || []) as unknown as ProdutoAcabado[];

    // Para produtos DISPLAY, buscar filhos da grade
    const displayIds = produtos.filter(p => p.tipo === "DISPLAY").map(p => p.id);
    if (displayIds.length > 0) {
      const { data: gradeItens } = await supabase
        .from("fabrica_produto_grade_itens" as any)
        .select("produto_pai_id, produto_filho_id, quantidade, produto_filho:fabrica_produtos!produto_filho_id(id, codigo, nome, marca, linha, tipo, foto_url)")
        .in("produto_pai_id", displayIds);

      if (gradeItens) {
        const filhosPorPai: Record<string, ProdutoAcabado[]> = {};
        for (const item of gradeItens as any[]) {
          const paiId = item.produto_pai_id;
          if (!filhosPorPai[paiId]) filhosPorPai[paiId] = [];
          if (item.produto_filho) {
            filhosPorPai[paiId].push(item.produto_filho as ProdutoAcabado);
          }
        }
        for (const p of produtos) {
          if (p.tipo === "DISPLAY" && filhosPorPai[p.id]) {
            p.filhos = filhosPorPai[p.id];
          }
        }
      }
    }

    return produtos;
  };

  // ===== Team members for @mention — apenas usuários vinculados ao processo =====
  const { data: teamMembers = [] } = useTarefaMentionableUsers(tarefaId);

  return {
    comentarios,
    addComentario,
    anexos,
    uploadAnexo,
    deleteAnexo,
    getAnexoUrl,
    sendToCofre,
    removeFromCofre,
    messages,
    sendMessage,
    searchProdutos,
    teamMembers,
    linkedProduto: linkedProduto || null,
  };
}
