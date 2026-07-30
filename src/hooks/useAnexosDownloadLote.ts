/**
 * useAnexosDownloadLote
 * ------------------------------------------------------------------
 * Baixa em lote (pacote .zip) os anexos selecionados no quadro (Kanban)
 * e registra o histórico do download em `anexos_download_log`.
 *
 * Regras:
 * - Download sempre via SDK (Blob) — nunca `window.open`.
 * - Histórico imutável: apenas inserção e leitura dos próprios registros.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { triggerBlobDownload } from "@/lib/utils/storage-download";
import type { TarefaArquivo } from "@/hooks/useTarefasAnexos";

export interface AnexoSelecionado extends TarefaArquivo {
  tarefaId: string;
  tarefaTitulo: string;
}

export interface DownloadLogItem {
  id: string;
  created_at: string;
  projeto_id: string | null;
  origem: string;
  total_arquivos: number;
  total_falhas: number;
  tamanho_bytes: number;
  pacote_nome: string | null;
  arquivos: { nome: string; tarefa: string; bucket: string; path: string | null }[];
}

/** Remove caracteres inválidos para nomes de arquivo/pasta dentro do zip. */
function sanitize(nome: string): string {
  return (nome || "arquivo").replace(/[\\/:*?"<>|]+/g, "-").trim().slice(0, 120) || "arquivo";
}

export function useAnexosDownloadHistorico(projetoId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["anexos-download-log", projetoId],
    enabled: !!projetoId && enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<DownloadLogItem[]> => {
      const { data, error } = await supabase
        .from("anexos_download_log")
        .select("id, created_at, projeto_id, origem, total_arquivos, total_falhas, tamanho_bytes, pacote_nome, arquivos")
        .eq("projeto_id", projetoId as string)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as DownloadLogItem[];
    },
  });
}

export function useAnexosDownloadLote(projetoId: string | undefined, projetoNome?: string) {
  const qc = useQueryClient();
  const [progresso, setProgresso] = useState<{ atual: number; total: number } | null>(null);

  const mutation = useMutation({
    mutationFn: async (arquivos: AnexoSelecionado[]) => {
      if (arquivos.length === 0) throw new Error("Selecione ao menos um anexo.");

      const zip = new JSZip();
      const usados = new Set<string>();
      const registrados: DownloadLogItem["arquivos"] = [];
      const falhas: string[] = [];
      let bytes = 0;

      setProgresso({ atual: 0, total: arquivos.length });

      for (let i = 0; i < arquivos.length; i++) {
        const arq = arquivos[i];
        setProgresso({ atual: i + 1, total: arquivos.length });
        if (!arq.storage_path) {
          falhas.push(arq.nome);
          continue;
        }
        const { data, error } = await supabase.storage.from(arq.bucket).download(arq.storage_path);
        if (error || !data) {
          falhas.push(arq.nome);
          continue;
        }
        const pasta = sanitize(arq.tarefaTitulo);
        let caminho = `${pasta}/${sanitize(arq.nome)}`;
        let n = 2;
        while (usados.has(caminho)) {
          caminho = `${pasta}/(${n}) ${sanitize(arq.nome)}`;
          n++;
        }
        usados.add(caminho);
        zip.file(caminho, data);
        bytes += data.size;
        registrados.push({
          nome: arq.nome,
          tarefa: arq.tarefaTitulo,
          bucket: arq.bucket,
          path: arq.storage_path,
        });
      }

      if (registrados.length === 0) {
        throw new Error("Nenhum arquivo pôde ser baixado.");
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const carimbo = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const pacote = `${sanitize(projetoNome || "anexos")}-anexos-${carimbo}.zip`;
      triggerBlobDownload(URL.createObjectURL(blob), pacote);

      const { data: sessao } = await supabase.auth.getUser();
      const userId = sessao?.user?.id;
      if (userId) {
        await supabase.from("anexos_download_log").insert({
          user_id: userId,
          projeto_id: projetoId ?? null,
          origem: "kanban",
          total_arquivos: registrados.length,
          total_falhas: falhas.length,
          tamanho_bytes: bytes,
          pacote_nome: pacote,
          arquivos: JSON.parse(JSON.stringify(registrados)),
        });
      }

      return { total: registrados.length, falhas };
    },
    onSettled: () => {
      setProgresso(null);
      qc.invalidateQueries({ queryKey: ["anexos-download-log", projetoId] });
    },
  });

  return { ...mutation, progresso };
}
