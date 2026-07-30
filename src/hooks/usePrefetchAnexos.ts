/**
 * usePrefetchAnexos
 * ------------------------------------------------------------------
 * Pré-carrega as pré-visualizações dos arquivos de uma tarefa quando o
 * usuário passa o mouse (ou foca) o card no quadro.
 *
 * - Reaproveita o cache local de URLs assinadas (thumbUrlCache).
 * - Aquece o cache HTTP do navegador decodificando as imagens.
 * - Debounce curto para não disparar em passagens rápidas de mouse.
 * - Executa uma única vez por tarefa enquanto o cache estiver válido.
 */
import { useCallback, useEffect, useRef } from "react";
import { getSignedUrl } from "@/lib/utils/storage-helper";
import { getThumbUrlCache, setThumbUrlCache } from "@/lib/utils/thumbUrlCache";
import type { TarefaArquivo, TarefaArquivosResumo } from "@/hooks/useTarefasAnexos";

/** Quantos arquivos aquecemos por card (evita rajadas de requisições). */
const MAX_PREFETCH = 6;
const DEBOUNCE_MS = 120;

async function aquecerArquivo(arquivo: TarefaArquivo) {
  if (!arquivo.storage_path) return;
  let url = getThumbUrlCache(arquivo.bucket, arquivo.storage_path);
  if (!url) {
    const { signedUrl } = await getSignedUrl(arquivo.bucket, arquivo.storage_path);
    if (!signedUrl) return;
    setThumbUrlCache(arquivo.bucket, arquivo.storage_path, signedUrl);
    url = signedUrl;
  }
  if (arquivo.familia === "imagem" && typeof Image !== "undefined") {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
  }
}

export function usePrefetchAnexos(resumo: TarefaArquivosResumo | undefined) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feito = useRef(false);

  useEffect(() => {
    feito.current = false;
  }, [resumo?.arquivos]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const prefetch = useCallback(() => {
    if (feito.current) return;
    const arquivos = (resumo?.arquivos ?? []).filter((a) => !!a.storage_path);
    if (arquivos.length === 0) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      feito.current = true;
      // Imagens primeiro: são as que abrem instantaneamente no visualizador.
      const ordenados = [...arquivos].sort(
        (a, b) => Number(b.familia === "imagem") - Number(a.familia === "imagem"),
      );
      for (const arquivo of ordenados.slice(0, MAX_PREFETCH)) {
        void aquecerArquivo(arquivo).catch(() => {
          /* pré-carregamento é best-effort */
        });
      }
    }, DEBOUNCE_MS);
  }, [resumo?.arquivos]);

  const cancelar = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  return { prefetch, cancelar };
}
