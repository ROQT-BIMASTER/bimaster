/**
 * useChinaDocThumbnail
 * ------------------------------------------------------------------
 * Compatibilidade: delega para o hook genérico `useDocThumbnail`
 * fixando o bucket `china-documentos`.
 */
import { useDocThumbnail, detectThumbKind, type DocThumbKind } from "./useDocThumbnail";

export { detectThumbKind };
export type { DocThumbKind };

interface Args {
  arquivoPath: string | null | undefined;
  arquivoUrl?: string | null | undefined;
  nomeArquivo: string | null | undefined;
  enabled?: boolean;
}

export function useChinaDocThumbnail(args: Args) {
  return useDocThumbnail({ ...args, bucket: "china-documentos" });
}
