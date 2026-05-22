// crm-blip-test-connection
// Testa uma chave de bot Blip enviando um comando "get /ping" ao postmaster.
// Aceita { botId } (busca chave cifrada) ou { key } (para validar antes de salvar).
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const Body = z
  .object({
    botId: z.string().uuid().optional(),
    key: z.string().min(10).max(500).optional(),
  })
  .strict()
  .refine((b) => !!b.botId || !!b.key, { message: "botId ou key obrigatório" });

Deno.serve(
  secureHandler(
    { auth: "jwt", rateLimit: 20, rateLimitPrefix: "crm-blip-test" },
    async (req, _ctx) => {
      const cors = getCorsHeaders(req);
      let payload: unknown;
      try {
        payload = await req.json();
      } catch {
        return new Response(JSON.stringify({ error: "JSON inválido" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      const parsed = Body.safeParse(payload);
      if (!parsed.success) {
        return new Response(
          JSON.stringify({ error: parsed.error.flatten() }),
          { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }

      let key = parsed.data.key ?? null;

      if (!key && parsed.data.botId) {
        const sb = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        const { data, error } = await sb.rpc("crm_bot_get_key", {
          p_bot_id: parsed.data.botId,
        });
        if (error || !data) {
          return new Response(
            JSON.stringify({ ok: false, error: "Chave não encontrada" }),
            { status: 404, headers: { ...cors, "Content-Type": "application/json" } },
          );
        }
        key = data as string;
      }

      if (!key) {
        return new Response(JSON.stringify({ ok: false, error: "Chave ausente" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      // Blip HTTP API: envia comando GET /ping para o postmaster
      const t0 = Date.now();
      try {
        const resp = await fetch("https://http.msging.net/commands", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Key ${key}`,
          },
          body: JSON.stringify({
            id: crypto.randomUUID(),
            to: "postmaster@msging.net",
            method: "get",
            uri: "/ping",
          }),
        });
        const elapsed = Date.now() - t0;
        const text = await resp.text();
        let body: unknown = text;
        try {
          body = JSON.parse(text);
        } catch { /* ignore */ }

        if (resp.status === 401 || resp.status === 403) {
          return new Response(
            JSON.stringify({
              ok: false,
              status: resp.status,
              error: "Chave inválida ou sem permissão",
              elapsed_ms: elapsed,
            }),
            { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({
            ok: resp.ok,
            status: resp.status,
            elapsed_ms: elapsed,
            response: body,
          }),
          { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
        );
      } catch (e) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: e instanceof Error ? e.message : "Erro de rede",
            elapsed_ms: Date.now() - t0,
          }),
          { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }
    },
  ),
);
