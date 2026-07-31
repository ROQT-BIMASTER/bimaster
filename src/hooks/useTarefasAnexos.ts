/**
 * useTarefasAnexos
 * ------------------------------------------------------------------
 * Carrega, em uma única consulta agregada por projeto, os arquivos de
 * cada tarefa (anexos da tarefa + documentos da submissão China
 * vinculados), sem duplicar o mesmo arquivo.
 *
 * Usado pelos indicadores de anexo do quadro (Kanban).
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TarefaArquivoFamilia = "imagem" | "pdf" | "planilha" | "vetor" | "documento";

export interface TarefaArquivo {
  id: string;
  nome: string;
  storage_path: string | null;
  bucket: string;
  familia: TarefaArquivoFamilia;
  china_documento_id: string | null;
}

export interface TarefaArquivosResumo {
  total: number;
  imagens: number;
  arquivos: TarefaArquivo[];
}

export function familiaDoArquivo(nome: string | null | undefined): TarefaArquivoFamilia {
  const n = (nome || "").toLowerCase();
  if (/\.(jpg|jpeg|png|gif|webp|bmp|heic|tiff)$/.test(n)) return "imagem";
  if (/\.pdf$/.test(n)) return "pdf";
  if (/\.(xlsx|xls|csv|numbers)$/.test(n)) return "planilha";
  if (/\.(ai|eps|svg|psd|cdr)$/.test(n)) return "vetor";
  return "documento";
}

export type TarefasArquivosMap = Record<string, TarefaArquivosResumo>;

export function useTarefasAnexos(projetoId: string | undefined, tarefaIds: string[]) {
  const qc = useQueryClient();
  const idsKey = tarefaIds.length;

  const query = useQuery({
    queryKey: ["tarefas-anexos-resumo", projetoId, idsKey],
    enabled: !!projetoId && tarefaIds.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<TarefasArquivosMap> => {
      const map: TarefasArquivosMap = {};

      const push = (tarefaId: string, arq: TarefaArquivo) => {
        const bucketEntry = (map[tarefaId] ||= { total: 0, imagens: 0, arquivos: [] });
        const dup = bucketEntry.arquivos.some(
          (a) =>
            (arq.china_documento_id && a.china_documento_id === arq.china_documento_id) ||
            (!!arq.storage_path && a.storage_path === arq.storage_path),
        );
        if (dup) return;
        bucketEntry.arquivos.push(arq);
        bucketEntry.total += 1;
        if (arq.familia === "imagem") bucketEntry.imagens += 1;
      };

      // 1) Anexos da tarefa (inclui os espelhados da submissão China)
      const { data: anexos, error } = await supabase
        .from("projeto_tarefa_anexos")
        .select("id, tarefa_id, nome, storage_path, metadata")
        .in("tarefa_id", tarefaIds);
      if (error) throw error;

      for (const a of (anexos || []) as any[]) {
        const meta = (a.metadata || {}) as Record<string, any>;
        push(a.tarefa_id, {
          id: a.id,
          nome: a.nome || "arquivo",
          storage_path: a.storage_path || null,
          bucket: meta.bucket || "projeto-anexos",
          familia: familiaDoArquivo(a.nome || a.storage_path),
          china_documento_id: meta.china_documento_id || null,
        });
      }

      // 2) Documentos China vinculados que ainda não tenham anexo espelhado
      const { data: vinculos } = await (supabase
        .from("china_documento_tarefa_vinculos" as any)
        .select("id, tarefa_id, documento_id")
        .in("tarefa_id", tarefaIds) as any);

      const docIds = [...new Set(((vinculos || []) as any[]).map((v) => v.documento_id))];
      if (docIds.length > 0) {
        const { data: docs } = await supabase
          .from("china_produto_documentos")
          .select("id, nome_arquivo, arquivo_path, tipo_documento")
          .in("id", docIds);
        const docMap = Object.fromEntries(((docs || []) as any[]).map((d) => [d.id, d]));

        for (const v of (vinculos || []) as any[]) {
          const d = docMap[v.documento_id];
          if (!d) continue;
          push(v.tarefa_id, {
            id: `doc-${d.id}`,
            nome: d.nome_arquivo || d.tipo_documento || "documento",
            storage_path: d.arquivo_path || null,
            bucket: "china-documentos",
            familia: familiaDoArquivo(d.nome_arquivo || d.arquivo_path),
            china_documento_id: d.id,
          });
        }
      }

      return map;
    },
  });

  // Sincronização em tempo real: inclusão/exclusão/troca de arquivos
  useEffect(() => {
    if (!projetoId || tarefaIds.length === 0) return;
    const tarefaIdSet = new Set(tarefaIds);
    const invalidate = () => {
      void qc.invalidateQueries({ queryKey: ["tarefas-anexos-resumo", projetoId] });
    };
    const invalidateIfCurrentTask = (payload: { new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
      const changedTaskId = String(payload.new?.tarefa_id ?? payload.old?.tarefa_id ?? "");
      if (!tarefaIdSet.has(changedTaskId)) return;
      invalidate();
      void qc.invalidateQueries({ queryKey: ["tarefa-anexos", changedTaskId] });
      void qc.invalidateQueries({ queryKey: ["china-docs-da-tarefa", changedTaskId] });
    };
    const invalidateIfCurrentDocument = (payload: { new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
      const changedId = String(payload.new?.id ?? payload.old?.id ?? "");
      const current = qc.getQueryData<TarefasArquivosMap>(["tarefas-anexos-resumo", projetoId, idsKey]);
      const belongsToBoard = Object.values(current ?? {}).some((entry) =>
        entry.arquivos.some((arquivo) => arquivo.china_documento_id === changedId),
      );
      if (belongsToBoard) invalidate();
    };
    const channel = supabase
      .channel(`tarefas-anexos-${projetoId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "projeto_tarefa_anexos" }, invalidateIfCurrentTask)
      .on("postgres_changes", { event: "*", schema: "public", table: "china_documento_tarefa_vinculos" }, invalidateIfCurrentTask)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "china_produto_documentos" }, invalidateIfCurrentDocument)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [projetoId, idsKey, tarefaIds, qc]);

  return query;
}
