// webhook-subscriptions-api — CRUD for webhook subscriptions
import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCors, getCorsHeaders } from "../_shared/cors.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { validateAnyAuth, AuthError } from "../_shared/auth.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";

const AVAILABLE_EVENTS = [
  { evento: "cliente.criado", descricao: "Novo cliente/fornecedor criado" },
  { evento: "cliente.alterado", descricao: "Cliente/fornecedor atualizado" },
  { evento: "cliente.excluido", descricao: "Cliente/fornecedor removido" },
  { evento: "conta_pagar.criado", descricao: "Novo título a pagar criado" },
  { evento: "conta_pagar.alterado", descricao: "Título a pagar atualizado" },
  { evento: "conta_pagar.pago", descricao: "Pagamento registrado" },
  { evento: "conta_pagar.cancelado", descricao: "Título a pagar cancelado" },
  { evento: "conta_receber.criado", descricao: "Novo título a receber" },
  { evento: "conta_receber.recebido", descricao: "Recebimento registrado" },
  { evento: "departamento.criado", descricao: "Novo departamento criado" },
  { evento: "departamento.alterado", descricao: "Departamento atualizado" },
  { evento: "categoria.criado", descricao: "Nova categoria criada" },
  { evento: "categoria.alterado", descricao: "Categoria atualizada" },
  { evento: "projeto.criado", descricao: "Novo projeto criado" },
  { evento: "projeto.alterado", descricao: "Projeto atualizado" },
  { evento: "conta_corrente.criado", descricao: "Nova conta corrente" },
  { evento: "conta_corrente.alterado", descricao: "Conta corrente atualizada" },
  { evento: "lancamento_cc.criado", descricao: "Novo lançamento CC" },
  { evento: "tarefa.criado", descricao: "Nova tarefa criada" },
  { evento: "tarefa.alterado", descricao: "Tarefa atualizada" },
  { evento: "tarefa.concluido", descricao: "Tarefa concluída" },
];

function json(body: unknown, status: number, req: Request) {
  const cors = getCorsHeaders(req);
  const headers = withSecurityHeaders(
    { ...cors, "Content-Type": "application/json" },
    status === 401 || status === 403
  );
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/webhook-subscriptions-api\/?/, "/").replace(/\/+$/, "") || "/";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Health check
  if (req.method === "GET" && path === "/status") {
    return json({ status: "ok", service: "webhook-subscriptions-api" }, 200, req);
  }

  // Available events (no auth)
  if (req.method === "GET" && path === "/eventos") {
    return json({ eventos: AVAILABLE_EVENTS }, 200, req);
  }

  // Auth
  let auth;
  try {
    auth = await validateAnyAuth(req);
    await checkRateLimit({ prefix: "webhook-subs", limit: 60, req, userId: auth.userId });
  } catch (e) {
    if (e instanceof RateLimitError) return json({ error: e.message }, 429, req);
    const status = e instanceof AuthError ? e.status : 401;
    return json({ error: (e as Error).message }, status, req);
  }

  try {
    // ── GET /listar ────────────────────────────────────────
    if (req.method === "GET" && path === "/listar") {
      const { data, error } = await supabase
        .from("webhook_subscriptions")
        .select("id, empresa_id, url, eventos, ativo, descricao, max_retries, created_at, updated_at")
        .order("created_at", { ascending: false });

      if (error) return json({ error: error.message }, 500, req);
      return json({ subscriptions: data }, 200, req);
    }

    // ── GET /consultar?id=xxx ──────────────────────────────
    if (req.method === "GET" && path === "/consultar") {
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "Parâmetro 'id' é obrigatório" }, 400, req);

      const { data, error } = await supabase
        .from("webhook_subscriptions")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) return json({ error: error.message }, 500, req);
      if (!data) return json({ error: "Inscrição não encontrada" }, 404, req);

      // Mask secret
      const masked = { ...data, secret: data.secret.substring(0, 8) + "..." };
      return json({ subscription: masked }, 200, req);
    }

    // ── POST /incluir ──────────────────────────────────────
    if (req.method === "POST" && path === "/incluir") {
      const body = await req.json();
      const { empresa_id, url: webhookUrl, secret, eventos, descricao, headers_customizados, max_retries } = body;

      if (!empresa_id || !webhookUrl || !secret || !eventos || !Array.isArray(eventos) || eventos.length === 0) {
        return json({ error: "Campos obrigatórios: empresa_id, url, secret, eventos (array)" }, 400, req);
      }

      // Validate events
      const validEvents = AVAILABLE_EVENTS.map(e => e.evento);
      const invalid = eventos.filter((e: string) => !validEvents.includes(e));
      if (invalid.length > 0) {
        return json({ error: `Eventos inválidos: ${invalid.join(", ")}`, eventos_disponiveis: validEvents }, 400, req);
      }

      const { data, error } = await supabase
        .from("webhook_subscriptions")
        .insert({
          empresa_id,
          url: webhookUrl,
          secret,
          eventos,
          descricao: descricao || null,
          headers_customizados: headers_customizados || {},
          max_retries: max_retries || 3,
        })
        .select("id, empresa_id, url, eventos, ativo")
        .single();

      if (error) return json({ error: error.message }, 500, req);
      return json({ subscription: data, message: "Inscrição criada com sucesso" }, 201, req);
    }

    // ── PUT /alterar ───────────────────────────────────────
    if (req.method === "PUT" && path === "/alterar") {
      const body = await req.json();
      const { id, ...updates } = body;
      if (!id) return json({ error: "Campo 'id' é obrigatório" }, 400, req);

      // Validate events if provided
      if (updates.eventos && Array.isArray(updates.eventos)) {
        const validEvents = AVAILABLE_EVENTS.map(e => e.evento);
        const invalid = updates.eventos.filter((e: string) => !validEvents.includes(e));
        if (invalid.length > 0) {
          return json({ error: `Eventos inválidos: ${invalid.join(", ")}` }, 400, req);
        }
      }

      updates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("webhook_subscriptions")
        .update(updates)
        .eq("id", id)
        .select("id, empresa_id, url, eventos, ativo")
        .single();

      if (error) return json({ error: error.message }, 500, req);
      if (!data) return json({ error: "Inscrição não encontrada" }, 404, req);

      return json({ subscription: data, message: "Inscrição atualizada com sucesso" }, 200, req);
    }

    // ── DELETE /excluir?id=xxx ─────────────────────────────
    if (req.method === "DELETE" && path === "/excluir") {
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "Parâmetro 'id' é obrigatório" }, 400, req);

      const { error } = await supabase
        .from("webhook_subscriptions")
        .delete()
        .eq("id", id);

      if (error) return json({ error: error.message }, 500, req);
      return json({ message: "Inscrição excluída com sucesso" }, 200, req);
    }

    // ── POST /testar ───────────────────────────────────────
    if (req.method === "POST" && path === "/testar") {
      const body = await req.json();
      const { id } = body;
      if (!id) return json({ error: "Campo 'id' é obrigatório" }, 400, req);

      const { data: sub } = await supabase
        .from("webhook_subscriptions")
        .select("*")
        .eq("id", id)
        .single();

      if (!sub) return json({ error: "Inscrição não encontrada" }, 404, req);

      // Send test event
      const testPayload = JSON.stringify({
        evento: "test.ping",
        timestamp: new Date().toISOString(),
        message: "Evento de teste do BiMaster Webhook System",
      });

      const key = await crypto.subtle.importKey(
        "raw", new TextEncoder().encode(sub.secret),
        { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
      );
      const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(testPayload));
      const signature = "sha256=" + Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");

      try {
        const response = await fetch(sub.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Event": "test.ping",
            "X-Webhook-Signature": signature,
            "X-Webhook-Timestamp": Math.floor(Date.now() / 1000).toString(),
            ...(sub.headers_customizados || {}),
          },
          body: testPayload,
          signal: AbortSignal.timeout(10000),
        });

        const responseBody = await response.text();
        return json({
          success: response.ok,
          http_status: response.status,
          response_body: responseBody.substring(0, 1000),
        }, 200, req);
      } catch (err) {
        return json({
          success: false,
          error: err instanceof Error ? err.message : String(err),
        }, 200, req);
      }
    }

    return json({ error: "Rota não encontrada" }, 404, req);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Erro interno" }, 500, req);
  }
});
