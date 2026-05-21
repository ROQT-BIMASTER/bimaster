// supabase/functions/notion-oauth-callback/index.ts
// Receives the OAuth code from Notion, exchanges for a token, persists the connection.
import { createClient } from "npm:@supabase/supabase-js@2";

const NOTION_TOKEN_URL = "https://api.notion.com/v1/oauth/token";

function getRedirectUri(): string {
  return `${Deno.env.get("SUPABASE_URL")!}/functions/v1/notion-oauth-callback`;
}

function htmlResponse(title: string, body: string, status = 200): Response {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#f8fafc;
       display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:24px}
  .card{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:32px;max-width:420px;text-align:center}
  h1{margin:0 0 12px;font-size:18px}
  p{margin:0;color:#cbd5e1;font-size:14px;line-height:1.5}
</style></head>
<body><div class="card"><h1>${title}</h1><p>${body}</p></div>
<script>setTimeout(()=>{try{window.opener&&window.opener.postMessage({type:'notion-oauth-${
    status === 200 ? "success" : "error"
  }'},'*')}catch(e){}window.close()},800)</script>
</body></html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

Deno.serve(async (req) => {
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

  const { error: upsertErr } = await sb
    .from("notion_connections")
    .upsert(
      {
        user_id: stateRow.user_id,
        workspace_id: token.workspace_id,
        workspace_name: token.workspace_name ?? null,
        workspace_icon: token.workspace_icon ?? null,
        bot_id: token.bot_id,
        access_token: token.access_token,
        notion_user_id: token.owner?.user?.id ?? null,
        notion_user_name: token.owner?.user?.name ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,workspace_id" },
    );

  if (upsertErr) {
    console.error("[notion-oauth-callback] upsert failed", upsertErr);
    return htmlResponse("Erro ao salvar conexão", upsertErr.message, 500);
  }

  return htmlResponse(
    "Notion conectado",
    `Workspace ${token.workspace_name ?? ""} pronto para receber briefings.`,
  );
});
