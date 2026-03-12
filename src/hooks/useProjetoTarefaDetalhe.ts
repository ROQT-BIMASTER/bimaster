import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useEffect } from "react";
import { logDocAudit } from "@/lib/productDocAudit";

export interface TarefaComentario {
  id: string;
  tarefa_id: string;
  user_id: string;
  conteudo: string;
  mentions: string[];
  created_at: string;
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

export interface TarefaMessage {
  id: string;
  tarefa_id: string;
  user_id: string;
  conteudo: string;
  mentions: string[];
  created_at: string;
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tarefa-comentarios", tarefaId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

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
  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
  const ALLOWED_TYPES = [
    "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
    "application/pdf",
    "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain", "text/csv",
  ];

  const uploadAnexo = useMutation({
    mutationFn: async (file: File) => {
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`Arquivo "${file.name}" excede o limite de 20MB (${(file.size / 1048576).toFixed(1)}MB).`);
      }
      // Validate file type
      if (ALLOWED_TYPES.length > 0 && !ALLOWED_TYPES.includes(file.type) && file.type !== "") {
        throw new Error(`Tipo de arquivo não permitido: ${file.type}. Use PDF, imagens, Excel, Word ou texto.`);
      }

      const filePath = `${tarefaId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("projeto-anexos")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { error } = await supabase.from("projeto_tarefa_anexos").insert({
        tarefa_id: tarefaId!,
        user_id: user!.id,
        nome: file.name,
        storage_path: filePath,
        tipo_arquivo: file.type,
        tamanho: file.size,
      });
      if (error) throw error;

      // Log audit with produtoId from hook param
      await logDocAudit({
        produtoId: produtoId || undefined,
        acao: "upload",
        detalhes: { nome_arquivo: file.name, tamanho: file.size, tipo: file.type, tarefa_id: tarefaId },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tarefa-anexos", tarefaId] });
      toast.success("Anexo enviado!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteAnexo = useMutation({
    mutationFn: async (anexo: TarefaAnexo) => {
      await supabase.storage.from("projeto-anexos").remove([anexo.storage_path]);
      const { error } = await supabase.from("projeto_tarefa_anexos").delete().eq("id", anexo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tarefa-anexos", tarefaId] });
      toast.success("Anexo removido!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const getAnexoUrl = async (storagePath: string) => {
    const { data } = await supabase.storage.from("projeto-anexos").createSignedUrl(storagePath, 3600);
    return data?.signedUrl || "";
  };

  // ===== Send to Cofre =====
  const sendToCofre = useMutation({
    mutationFn: async ({ anexoIds, produtoId, categoriasPorAnexo, projetoId }: { anexoIds: string[]; produtoId: string; categoriasPorAnexo: Record<string, string>; projetoId?: string }) => {
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

      const userIds = [...new Set((data as any[]).map(m => m.user_id))];
      let profiles: Record<string, { nome: string; avatar_url: string | null }> = {};
      if (userIds.length > 0) {
        const { data: p } = await supabase.from("profiles").select("id, nome, avatar_url").in("id", userIds);
        if (p) profiles = Object.fromEntries(p.map(x => [x.id, { nome: x.nome, avatar_url: x.avatar_url }]));
      }

      return (data as any[]).map(m => ({
        ...m,
        mentions: m.mentions || [],
        autor: profiles[m.user_id] || { nome: "Usuário", avatar_url: null },
      })) as TarefaMessage[];
    },
    enabled: !!tarefaId && !!user,
  });

  // Realtime subscription for messages
  useEffect(() => {
    if (!tarefaId) return;
    const channel = supabase
      .channel(`tarefa-chat-${tarefaId}`)
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
    mutationFn: async ({ conteudo, mentions }: { conteudo: string; mentions?: string[] }) => {
      const { error } = await supabase.from("projeto_tarefa_messages" as any).insert({
        tarefa_id: tarefaId!,
        user_id: user!.id,
        conteudo,
        mentions: mentions || [],
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tarefa-messages", tarefaId] });
    },
    onError: (err: Error) => toast.error(err.message),
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

  // ===== Team members for @mention =====
  const { data: teamMembers = [] } = useQuery({
    queryKey: ["team-members-mentions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nome, avatar_url")
        .order("nome");
      return (data || []) as { id: string; nome: string; avatar_url: string | null }[];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  return {
    comentarios,
    addComentario,
    anexos,
    uploadAnexo,
    deleteAnexo,
    getAnexoUrl,
    sendToCofre,
    messages,
    sendMessage,
    searchProdutos,
    teamMembers,
    linkedProduto: linkedProduto || null,
  };
}
