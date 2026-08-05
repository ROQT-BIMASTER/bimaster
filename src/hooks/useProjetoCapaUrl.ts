import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const PROJETO_CAPAS_BUCKET = "projeto-capas";

/**
 * Resolve o caminho da foto do projeto (armazenado em `projetos.imagem_url`)
 * para uma URL assinada temporária. Aceita também URLs completas (legado/externas).
 */
export function useProjetoCapaUrl(imagemUrl: string | null | undefined): string | undefined {
  const [resolved, setResolved] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!imagemUrl) {
      setResolved(undefined);
      return;
    }

    if (/^https?:\/\//i.test(imagemUrl)) {
      setResolved(imagemUrl);
      return;
    }

    let cancelled = false;
    supabase.storage
      .from(PROJETO_CAPAS_BUCKET)
      .createSignedUrl(imagemUrl, 3600)
      .then(({ data }) => {
        if (!cancelled) setResolved(data?.signedUrl || undefined);
      });

    return () => {
      cancelled = true;
    };
  }, [imagemUrl]);

  return resolved;
}

export { PROJETO_CAPAS_BUCKET };
