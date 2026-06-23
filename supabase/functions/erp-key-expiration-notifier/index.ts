// Daily job: cria notificações para administradores quando uma chave ERP
// está próxima do vencimento (30/15/5 dias) ou expirada (idempotente por dia + threshold).
// Disparado por cron via pg_net (passa apikey) — auth: "any" aceita JWT ou apikey.
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const THRESHOLDS = [30, 15, 5, 0] as const;

Deno.serve(secureHandler(
  { auth: "any", rateLimit: 10, rateLimitPrefix: "erp-key-expiration-notifier" },
  async (req) => {
    const cors = getCorsHeaders(req);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    try {
      const { data: keys, error } = await supabase
        .from("erp_config")
        .select("empresa_id, api_key_expira_em, ativo")
        .eq("config_key", "api_key")
        .eq("ativo", true)
        .not("api_key_expira_em", "is", null);
      if (error) throw error;

      const today = new Date();
      const todayIso = today.toISOString().slice(0, 10);
      const buckets: Array<{ empresa_id: number; threshold: number; expira: string; dias: number }> = [];

      for (const k of keys ?? []) {
        const expira = new Date(k.api_key_expira_em as string);
        const dias = Math.ceil((expira.getTime() - today.getTime()) / 86400000);
        const hit = THRESHOLDS.find((t) => dias === t || (t === 0 && dias < 0));
        if (hit !== undefined && k.empresa_id != null) {
          buckets.push({ empresa_id: k.empresa_id, threshold: hit, expira: expira.toISOString(), dias });
        }
      }

      if (buckets.length === 0) {
        return new Response(JSON.stringify({ ok: true, processed: 0 }), {
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      const adminIds = (admins ?? []).map((r) => r.user_id as string);
      if (adminIds.length === 0) {
        return new Response(JSON.stringify({ ok: true, processed: 0, reason: "no admins" }), {
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      let inserted = 0;
      for (const b of buckets) {
        const dedupeType = `erp_key_expiration:${b.empresa_id}:${b.threshold}:${todayIso}`;
        // skip if any admin already received this exact type today
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("type", dedupeType)
          .limit(1);
        if ((existing ?? []).length > 0) continue;

        const title = b.dias < 0
          ? `Chave ERP da empresa ${b.empresa_id} EXPIRADA`
          : `Chave ERP da empresa ${b.empresa_id} expira em ${b.dias} dia(s)`;
        const message = b.dias < 0
          ? `A chave de API ERP da empresa ${b.empresa_id} expirou em ${b.expira.slice(0, 10)}. Rotacione imediatamente para restaurar a integração.`
          : `Rotação recomendada. Acesse Saúde das Integrações para gerar uma nova chave com período de graça.`;
        const rows = adminIds.map((uid) => ({
          user_id: uid,
          type: dedupeType,
          title,
          message,
          action_url: "/admin/integracoes-saude",
        }));
        const { error: insErr } = await supabase.from("notifications").insert(rows);
        if (!insErr) inserted += rows.length;
      }

      return new Response(JSON.stringify({ ok: true, buckets: buckets.length, notifications: inserted }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: String(e) }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
  },
));
