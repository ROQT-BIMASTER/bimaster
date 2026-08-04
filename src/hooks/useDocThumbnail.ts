/**
 * useDocThumbnail
 * ------------------------------------------------------------------
 * Resolve uma signed URL para um arquivo de storage quando ele é imagem,
 * para uso como miniatura em cards (Kanban, listas, caixa de entrada).
 *
 * Genérico: aceita qualquer bucket (`projeto-anexos`, `china-documentos`, ...).
 * - Detecta o tipo pelo nome/extensão (image | pdf | other).
 * - Só dispara a query quando `enabled === true` e o arquivo é imagem.
 * - Cache compartilhado via React Query (staleTime 50min, próximo ao TTL de 1h).
 */
import { useQuery } from "@tanstack/react-query";
import { getSignedUrl } from "@/lib/utils/storage-helper";

export type DocThumbKind = "image" | "pdf" | "other";

export function detectThumbKind(nomeArquivo: string | null | undefined): DocThumbKind {
  const name = (nomeArquivo || "").toLowerCase();
  if (/\.(jpg|jpeg|png|gif|webp|bmp|svg|heic|tiff)$/i.test(name)) return "image";
  if (/\.pdf$/i.test(name)) return "pdf";
  return "other";
}

interface Args {
  bucket?: string;
  arquivoPath: string | null | undefined;
  arquivoUrl?: string | null | undefined;
  nomeArquivo: string | null | undefined;
  /** Só busca quando true (usar com IntersectionObserver para lazy-load). */
  enabled?: boolean;
}

export function useDocThumbnail({
  bucket = "china-documentos",
  arquivoPath,
  arquivoUrl,
  nomeArquivo,
  enabled = true,
}: Args) {
  const kind = detectThumbKind(nomeArquivo || arquivoPath || "");
  const canFetch = enabled && kind === "image" && (!!arquivoPath || !!arquivoUrl);

  const q = useQuery({
    queryKey: ["doc-thumb", bucket, arquivoPath ?? arquivoUrl ?? null],
    enabled: canFetch && !!arquivoPath,
    staleTime: 50 * 60 * 1000,
    gcTime: 55 * 60 * 1000,
    queryFn: async () => {
      const { signedUrl } = await getSignedUrl(bucket, arquivoPath as string);
      return signedUrl;
    },
  });

  const url = arquivoPath ? q.data ?? null : arquivoUrl ?? null;
  return {
    kind,
    url: canFetch ? url : null,
    isLoading: q.isLoading,
  };
}
