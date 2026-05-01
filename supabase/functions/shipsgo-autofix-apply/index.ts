// shipsgo-autofix-apply — aplica plano de auto-fix gerado pela IA.
// Exige reautenticação via senha (verify_user_password RPC).
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { z, validateBody } from "../_shared/validate.ts";

const Schema = z.object({
  analise_id: z.string().uuid(),
  password: z.string().min(1).max(200),
  acoes_selecionadas: z.array(z.number().int().nonnegative()).optional(),
}).strict();

Deno.serve(
  secureHandler(
    { auth: "jwt", rateLimit: 5, rateLimitPrefix: "shipsgo-autofix-apply" },
    async (req, ctx) => {
      const cors = getCorsHeaders(req);
      const json = { ...cors, "Content-Type": "application/json" };

      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      const { data: roleRow } = await sb.from("user_roles")
        .select("role").eq("user_id", ctx.userId!).eq("role", "admin").maybeSingle();
      if (!roleRow) {
        return new Response(JSON.stringify({ error: "Acesso restrito" }), { status: 403, headers: json });
      }

      const body = await req.json().catch(() => ({}));
      const { analise_id, password, acoes_selecionadas } = validateBody(body, Schema);

      // Verifica senha do usuário
      const { data: pwOk, error: pwErr } = await sb.rpc("verify_user_password", { password });
      if (pwErr || !pwOk) {
        return new Response(JSON.stringify({ error: "Senha incorreta" }), { status: 401, headers: json });
      }

      const { data: analise, error: aErr } = await sb
        .from("shipsgo_ia_analises").select("id, plano_autofix, aplicado_em")
        .eq("id", analise_id).maybeSingle();
      if (aErr || !analise) {
        return new Response(JSON.stringify({ error: "Análise não encontrada" }), { status: 404, headers: json });
      }
      if (analise.aplicado_em) {
        return new Response(JSON.stringify({ error: "Análise já aplicada anteriormente" }), { status: 409, headers: json });
      }

      const plano: any[] = Array.isArray(analise.plano_autofix) ? analise.plano_autofix : [];
      const acoes = acoes_selecionadas
        ? plano.filter((_, i) => acoes_selecionadas.includes(i))
        : plano;

      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const authHeader = req.headers.get("Authorization") ?? "";

      const resultados: any[] = [];
      for (const acao of acoes) {
        try {
          if (acao.acao === "sync" || acao.acao === "criar_tracking") {
            const r = await fetch(`${SUPABASE_URL}/functions/v1/shipsgo-sync-shipment`, {
              method: "POST",
              headers: { Authorization: authHeader, "Content-Type": "application/json" },
              body: JSON.stringify({
                container_number: acao.container,
                shipment_id: acao.shipment_id,
                embarque_id: acao.embarque_id,
              }),
            });
            resultados.push({ acao, status: r.status, ok: r.ok });
          } else if (acao.acao === "desvincular" && acao.shipment_id) {
            const { error } = await sb.from("shipsgo_shipments")
              .update({ embarque_id: null, ordem_compra_id: null })
              .eq("id", acao.shipment_id);
            resultados.push({ acao, ok: !error, error: error?.message });
          } else if (acao.acao === "reprocessar_webhook" && acao.shipment_id) {
            resultados.push({ acao, ok: false, error: "Reprocessamento via Logs (manual)" });
          } else {
            resultados.push({ acao, ok: false, error: "Ação não suportada ou parâmetros faltando" });
          }
        } catch (e: any) {
          resultados.push({ acao, ok: false, error: e?.message ?? "erro" });
        }
      }

      const total = resultados.length;
      const sucesso = resultados.filter((r) => r.ok).length;

      await sb.from("shipsgo_ia_analises").update({
        aplicado_em: new Date().toISOString(),
        aplicado_por: ctx.userId!,
        resultado_autofix: { total, sucesso, falha: total - sucesso, resultados },
      }).eq("id", analise_id);

      return new Response(JSON.stringify({ total, sucesso, falha: total - sucesso, resultados }), { headers: json });
    },
  ),
);
