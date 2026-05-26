// supabase/functions/notion-oauth-callback/index.ts
// Receives the OAuth code from Notion, exchanges for a token, persists the connection.
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";

const NOTION_TOKEN_URL = "https://api.notion.com/v1/oauth/token";

function getRedirectUri(): string {
  return `${Deno.env.get("SUPABASE_URL")!}/functions/v1/notion-oauth-callback`;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getAppOrigin(): string {
  // Origem confiável do app — usada para postMessage. Configurável via secret.
  return Deno.env.get("APP_ORIGIN") ?? "https://bimaster.online";
}

function htmlResponse(title: string, body: string, status = 200): Response {
  const safeTitle = escapeHtml(title);
  const safeBody = escapeHtml(body);
  const safeOrigin = escapeHtml(getAppOrigin());
  const type = status === 200 ? "notion-oauth-success" : "notion-oauth-error";
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#f8fafc;
       display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:24px}
  .card{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:32px;max-width:420px;text-align:center}
  h1{margin:0 0 12px;font-size:18px}
  p{margin:0;color:#cbd5e1;font-size:14px;line-height:1.5}
</style></head>
<body><div class="card"><h1>${safeTitle}</h1><p>${safeBody}</p></div>
<script>setTimeout(function(){try{window.opener&&window.opener.postMessage({type:'${type}'}, '${safeOrigin}')}catch(e){}window.close()},800)</script>
</body></html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// Público (OAuth callback) mas envolto em secureHandler para aplicar
// WAF L7, IP blocklist e security headers via plataforma.
Deno.serve(secureHandler(
  { auth: "none", rateLimit: 30, rateLimitPrefix: "notion-oauth-callback" },
  async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    return htmlResponse("Conexão cancelada", `Notion retornou: ${errorParam}`, 400);
  }
  if (!code || !state) {
    return htmlResponse("Parâmetros inválidos", "code ou state ausentes.", 400);
  }

  const clientId = Deno.env.get("NOTION_OAUTH_CLIENT_ID");
  const clientSecret = Deno.env.get("NOTION_OAUTH_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    return htmlResponse("Configuração ausente", "OAuth do Notion não configurado.", 500);
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Validate state
  const { data: stateRow, error: stateErr } = await sb
    .from("notion_oauth_states")
    .select("user_id, expires_at")
    .eq("state", state)
    .single();

  if (stateErr || !stateRow) {
    return htmlResponse("State inválido", "Tente reconectar a partir do bimaster.", 400);
  }
  if (new Date(stateRow.expires_at).getTime() < Date.now()) {
    await sb.from("notion_oauth_states").delete().eq("state", state);
    return htmlResponse("Sessão expirada", "Refaça a conexão.", 400);
  }

  // Consume state
  await sb.from("notion_oauth_states").delete().eq("state", state);

  // Exchange code for token
  const basic = btoa(`${clientId}:${clientSecret}`);
  const tokenResp = await fetch(NOTION_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUri(),
    }),
  });

  if (!tokenResp.ok) {
    const txt = await tokenResp.text();
    console.error("[notion-oauth-callback] token exchange failed", tokenResp.status, txt);
    return htmlResponse(
      "Falha ao conectar Notion",
      `Notion devolveu ${tokenResp.status}. Tente novamente.`,
      502,
    );
  }

  const token = await tokenResp.json() as {
    access_token: string;
    workspace_id: string;
    workspace_name?: string;
    workspace_icon?: string;
    bot_id: string;
    owner?: { user?: { id?: string; name?: string } };
  };

  // Persist via SECURITY DEFINER RPC: encripta o token dentro do banco,
  // evitando armazenar `access_token` em texto puro.
  const { error: upsertErr } = await sb.rpc("upsert_notion_connection", {
    p_user_id: stateRow.user_id,
    p_workspace_id: token.workspace_id,
    p_workspace_name: token.workspace_name ?? null,
    p_workspace_icon: token.workspace_icon ?? null,
    p_bot_id: token.bot_id,
    p_access_token: token.access_token,
    p_notion_user_id: token.owner?.user?.id ?? null,
    p_notion_user_name: token.owner?.user?.name ?? null,
  });

  if (upsertErr) {
    console.error("[notion-oauth-callback] upsert failed", upsertErr);
    return htmlResponse(
      "Erro ao salvar conexão",
      "Não foi possível salvar a conexão. Tente novamente.",
      500,
    );
  }

  return htmlResponse(
    "Notion conectado",
    `Workspace ${token.workspace_name ?? ""} pronto para receber briefings.`,
  );
});
});
