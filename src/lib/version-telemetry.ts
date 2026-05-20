/**
 * Telemetria de versão do cliente — fire-and-forget.
 *
 * Registra qual `APP_VERSION` (bundle JS) o usuário está executando,
 * permitindo ao admin diagnosticar quem ficou preso em uma versão antiga
 * de cache/Service Worker. Falha silenciosa: nunca lança nem impacta o
 * fluxo de auth.
 *
 * Tabela: `public.client_version_telemetry` (RLS: cada usuário insere/atualiza
 * apenas o próprio registro; admins leem todos).
 */
import { supabase } from "@/integrations/supabase/client";
import { APP_VERSION } from "@/lib/version";
import { logger } from "@/lib/logger";

let lastReportedAt = 0;
const REPORT_INTERVAL_MS = 5 * 60 * 1000; // 5 min — evita spam por TOKEN_REFRESHED

export function reportClientVersion(userId: string): void {
  // Throttle: no máximo 1 report a cada 5 min por sessão.
  const now = Date.now();
  if (now - lastReportedAt < REPORT_INTERVAL_MS) return;
  lastReportedAt = now;

  const ua = typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null;

  // Fire-and-forget. Erros são silenciados (telemetria não pode quebrar login).
  supabase
    .from("client_version_telemetry")
    .upsert(
      {
        user_id: userId,
        app_version: APP_VERSION,
        user_agent: ua,
        last_seen: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .then(({ error }) => {
      if (error) logger.log("[version-telemetry] upsert failed (silenced):", error.message);
    });
}
