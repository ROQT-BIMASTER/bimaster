import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export interface UseCopyToClipboardOptions {
  /** Mensagem do toast em caso de sucesso. Passe `false` para suprimir o toast. */
  successMsg?: string | false;
  /** Mensagem do toast em caso de erro. Passe `false` para suprimir o toast. */
  errorMsg?: string | false;
  /** Tempo em ms para resetar o estado `copied`. Default 2000. */
  resetMs?: number;
}

export type CopyFn = (text: string, overrideSuccessMsg?: string) => Promise<boolean>;

/**
 * Hook padronizado para copy-to-clipboard com feedback visual.
 *
 * @example
 * const [copy, copied] = useCopyToClipboard({ successMsg: "Link copiado" });
 * <Button onClick={() => copy(url)}>
 *   {copied ? <Check /> : <Copy />}
 * </Button>
 */
export function useCopyToClipboard(
  options: UseCopyToClipboardOptions = {},
): [CopyFn, boolean] {
  const {
    successMsg = "Copiado!",
    errorMsg = "Falha ao copiar",
    resetMs = 2000,
  } = options;

  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const copy = useCallback<CopyFn>(
    async (text, overrideSuccessMsg) => {
      const showSuccess = (msg: string | false | undefined) => {
        if (msg === false) return;
        const finalMsg = overrideSuccessMsg ?? (msg as string | undefined);
        if (finalMsg) toast.success(finalMsg);
      };

      const markCopied = () => {
        setCopied(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopied(false), resetMs);
      };

      try {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          markCopied();
          showSuccess(successMsg);
          return true;
        }

        // Fallback para contextos sem Clipboard API (HTTP, iframes restritos)
        if (typeof document !== "undefined") {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.setAttribute("readonly", "");
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          const ok = document.execCommand("copy");
          document.body.removeChild(ta);
          if (ok) {
            markCopied();
            showSuccess(successMsg);
            return true;
          }
        }
        throw new Error("Clipboard API indisponível");
      } catch (err) {
        console.error("[useCopyToClipboard]", err);
        if (errorMsg !== false) toast.error(errorMsg);
        return false;
      }
    },
    [successMsg, errorMsg, resetMs],
  );

  return [copy, copied];
}

export default useCopyToClipboard;
