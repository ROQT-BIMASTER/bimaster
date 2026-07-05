// Controle de sincronização do painel Result.
// pull -> conector lê solicitações pendentes; done -> conector reporta status.
// Auth: Bearer RUBYSP_SYNC_TOKEN.
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const PullSchema = z.object({ action: z.literal("pull") }).strict();
const DoneSchema = z.object({
  action: z.literal("done"),
  alvo: z.enum(["pedidos", "historico", "contas_pagar"]),
  status: z.enum(["rodando", "ok", "erro"]),
}).strict();
const BodySchema = z.union([PullSchema, DoneSchema]);

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(secureHandler(
  { auth: "none", rateLimit: 120, rateLimitPrefix: "sync-control-rubysp", skipWaf: true },
  async (req) => {
    const cors = getCorsHeaders(req);
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, "Content-Type": "application/json" },
      });

    if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

    // Aceita o token Rubysp OU o token Futura, para um único bearer no conector.
    const tokRubysp = Deno.env.get("RUBYSP_SYNC_TOKEN") ?? "";
    const tokFutura = Deno.env.get("FUTURA_SYNC_TOKEN") ?? "";
    if (!tokRubysp && !tokFutura) return json(500, { error: "server_misconfigured" });

    const authHeader = req.headers.get("Authorization") ?? "";
    const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const ok =
      (!!tokRubysp && constantTimeEquals(provided, tokRubysp)) ||
      (!!tokFutura && constantTimeEquals(provided, tokFutura));
    if (!provided || !ok) {
      return json(401, { error: "unauthorized" });
    }

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return json(400, { error: "invalid_json" });
    }
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return json(400, { error: "validation_error", details: parsed.error.flatten() });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    try {
      if (parsed.data.action === "pull") {
        const { data, error } = await supabase
          .from("sync_control_rubysp")
          .select("solicitar_pedidos_em, solicitar_historico_em, solicitar_contas_pagar_em, ultima_exec_pedidos, ultima_exec_historico, ultima_exec_contas_pagar, status_pedidos, status_historico, status_contas_pagar, updated_at")
          .eq("id", 1)
          .maybeSingle();
        if (error) throw error;
        return json(200, data ?? {});
      }

      const { alvo, status } = parsed.data;
      const now = new Date().toISOString();
      const patch: Record<string, unknown> = { updated_at: now };
      if (alvo === "pedidos") {
        patch.status_pedidos = status;
        if (status === "ok") patch.ultima_exec_pedidos = now;
      } else if (alvo === "contas_pagar") {
        patch.status_contas_pagar = status;
        if (status === "ok") patch.ultima_exec_contas_pagar = now;
      } else {
        patch.status_historico = status;
        if (status === "ok") patch.ultima_exec_historico = now;
      }

      const { data, error } = await supabase
        .from("sync_control_rubysp")
        .update(patch)
        .eq("id", 1)
        .select()
        .maybeSingle();
      if (error) throw error;
      return json(200, data ?? {});
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return json(500, { error: "internal_error", details: msg });
    }
  },
));
