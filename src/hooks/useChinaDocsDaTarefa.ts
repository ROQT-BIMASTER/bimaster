import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ChinaDocDaTarefa {
  vinculo_id: string;
  documento_id: string;
  tarefa_id: string;
  projeto_id: string;
  created_at: string;
  created_by: string | null;
  responsavel_id: string | null;
  // documento
  nome_arquivo: string | null;
  tipo_documento: string;
  arquivo_path: string | null;
  arquivo_url: string | null;
  status: string;
  submissao_id: string;
  produto_codigo: string | null;
  produto_nome: string | null;
  // perfil de quem vinculou
  vinculado_por_nome: string | null;
  vinculado_por_avatar: string | null;
}

export function useChinaDocsDaTarefa(tarefaId: string | undefined) {
  return useQuery({
    queryKey: ["china-docs-da-tarefa", tarefaId],
    enabled: !!tarefaId,
    queryFn: async () => {
      const { data: vinculos, error } = await (supabase
        .from("china_documento_tarefa_vinculos" as any)
        .select("id, documento_id, tarefa_id, projeto_id, created_at, created_by, responsavel_id")
        .eq("tarefa_id", tarefaId!)
        .order("created_at", { ascending: false }) as any);
      if (error) throw error;
      const list = (vinculos || []) as Array<any>;
      if (list.length === 0) return [] as ChinaDocDaTarefa[];

      const docIds = list.map((v) => v.documento_id);
      const userIds = [...new Set(list.map((v) => v.created_by).filter(Boolean))] as string[];

      const [docsRes, profilesRes] = await Promise.all([
        supabase
          .from("china_produto_documentos")
          .select("id, nome_arquivo, tipo_documento, arquivo_path, arquivo_url, status, submissao_id")
          .in("id", docIds),
        userIds.length > 0
          ? supabase.from("profiles").select("id, nome, avatar_url").in("id", userIds)
          : Promise.resolve({ data: [] as any[] } as any),
      ]);

      const docs = (docsRes.data || []) as any[];
      const submissaoIds = [...new Set(docs.map((d) => d.submissao_id).filter(Boolean))];
      const subsRes = submissaoIds.length > 0
        ? await supabase
            .from("china_produto_submissoes")
            .select("id, produto_codigo, produto_nome")
            .in("id", submissaoIds)
        : { data: [] as any[] } as any;

      const docMap = Object.fromEntries(docs.map((d: any) => [d.id, d]));
      const profMap = Object.fromEntries(((profilesRes as any).data || []).map((p: any) => [p.id, p]));
      const subMap = Object.fromEntries(((subsRes as any).data || []).map((s: any) => [s.id, s]));

      return list.map((v) => {
        const doc = docMap[v.documento_id] || {};
        const sub = subMap[doc.submissao_id] || {};
        const prof = v.created_by ? profMap[v.created_by] : null;
        return {
          vinculo_id: v.id,
          documento_id: v.documento_id,
          tarefa_id: v.tarefa_id,
          projeto_id: v.projeto_id,
          created_at: v.created_at,
          created_by: v.created_by,
          responsavel_id: v.responsavel_id,
          nome_arquivo: doc.nome_arquivo,
          tipo_documento: doc.tipo_documento,
          arquivo_path: doc.arquivo_path,
          arquivo_url: doc.arquivo_url,
          status: doc.status,
          submissao_id: doc.submissao_id,
          produto_codigo: sub.produto_codigo || null,
          produto_nome: sub.produto_nome || null,
          vinculado_por_nome: prof?.nome || null,
          vinculado_por_avatar: prof?.avatar_url || null,
        } as ChinaDocDaTarefa;
      });
    },
  });
}
