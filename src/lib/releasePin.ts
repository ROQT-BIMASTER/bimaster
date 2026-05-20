/**
 * Kill switch remoto de versão (Fase 4).
 *
 * O admin insere uma linha em `app_release_pins` com `min_version`. Quando
 * `APP_VERSION` do bundle local < `min_version`, sinalizamos atualização
 * obrigatória. Detecção em dois caminhos:
 *
 * 1. **Pull inicial** (`fetchLatestPin`): chamada ao montar o PWAProvider.
 * 2. **Push contínuo** (`subscribeToReleasePins`): canal Realtime; novos
 *    INSERTs disparam o callback em segundos para todos os clientes
 *    conectados, sem que precisem recarregar.
 *
 * Falha silenciosa em ambos os caminhos — kill switch nunca pode quebrar
 * o app.
 */
import { supabase } from "@/integrations/supabase/client";
import { APP_VERSION } from "@/lib/version";
import { logger } from "@/lib/logger";

export interface ReleasePin {
  min_version: string;
  mensagem: string | null;
  criado_em: string;
}

/** Compara semver simples `X.Y.Z`. Retorna -1/0/1. */
function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da < db ? -1 : 1;
  }
  return 0;
}

/** True se a versão local está abaixo do pin remoto. */
export function isBelowPin(pin: ReleasePin | null): boolean {
  if (!pin) return false;
  try {
    return compareSemver(APP_VERSION, pin.min_version) < 0;
  } catch {
    return false;
  }
}

/** Busca o pin mais recente. null se nenhum, indefinido se erro. */
export async function fetchLatestPin(): Promise<ReleasePin | null> {
  try {
    const { data, error } = await supabase
      .from("app_release_pins")
      .select("min_version, mensagem, criado_em")
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      logger.log("[releasePin] fetch failed (silenced):", error.message);
      return null;
    }
    return data ?? null;
  } catch {
    return null;
  }
}

/**
 * Subscribe a INSERTs em `app_release_pins`. Retorna função de cleanup.
 * Callback chamado com o pin novo. Silencioso em erros de canal.
 */
export function subscribeToReleasePins(onPin: (pin: ReleasePin) => void): () => void {
  try {
    const channel = supabase
      .channel("app-release-pins")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "app_release_pins" },
        (payload) => {
          const row = payload.new as Partial<ReleasePin>;
          if (row?.min_version) {
            onPin({
              min_version: row.min_version,
              mensagem: row.mensagem ?? null,
              criado_em: row.criado_em ?? new Date().toISOString(),
            });
          }
        },
      )
      .subscribe();
    return () => {
      try { supabase.removeChannel(channel); } catch { /* noop */ }
    };
  } catch {
    return () => { /* noop */ };
  }
}
