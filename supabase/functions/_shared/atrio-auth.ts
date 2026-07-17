// Helper compartilhado: gerenciamento de token Bearer para API Atrio (OAuth2 client credentials)
// Usado por: erp-export-payment (AP lançamento/baixa) e erp-sync-engine (AR sync)
//
// Token válido por 3600s (1h). Renovamos a cada 55 min (margem de segurança confirmada com Daniel).
// Cache persistido em atrio_empresa_config para evitar request duplo entre edge functions concorrentes.

import { createClient } from "npm:@supabase/supabase-js@2";

const BASE_URL = "https://integra.alltomatize.com.br";
const RENEW_BEFORE_MS = 5 * 60 * 1000; // renovar se expirar em menos de 5 minutos

export interface AtrioTokenResult {
  token: string;
  baseUrl: string;
}

export async function getAtrioToken(
  supabaseServiceClient: ReturnType<typeof createClient>,
  empresaId: number
): Promise<AtrioTokenResult> {
  // 1. Tentar token cacheado
  const { data: cached } = await supabaseServiceClient
    .from("atrio_empresa_config")
    .select("access_token, token_expires_at")
    .eq("empresa_id", empresaId)
    .single();

  if (cached?.access_token && cached.access_token !== "") {
    const expiresAt = new Date(cached.token_expires_at).getTime();
    const now = Date.now();
    if (expiresAt - now > RENEW_BEFORE_MS) {
      return { token: cached.access_token, baseUrl: BASE_URL };
    }
  }

  // 2. Renovar token via API Atrio
  const clientId = Deno.env.get("ATRIO_CLIENT_ID");
  const clientSecret = Deno.env.get("ATRIO_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error(
      "ATRIO_CLIENT_ID ou ATRIO_CLIENT_SECRET não configurados em Supabase Edge Functions Secrets. " +
      "Configure em: Supabase → Settings → Edge Functions → Secrets."
    );
  }

  const res = await fetch(`${BASE_URL}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Falha ao obter token Atrio: HTTP ${res.status} — ${body}`);
  }

  const json = await res.json();
  const accessToken: string = json.accessToken;
  if (!accessToken) {
    throw new Error("Resposta do Atrio não contém 'accessToken'. Verifique a spec da API.");
  }

  // expiresIn = 3600s; renovamos com 55 min de antecedência (3300s)
  const expiresAt = new Date(Date.now() + 55 * 60 * 1000).toISOString();

  await supabaseServiceClient
    .from("atrio_empresa_config")
    .upsert(
      { empresa_id: empresaId, access_token: accessToken, token_expires_at: expiresAt, updated_at: new Date().toISOString() },
      { onConflict: "empresa_id" }
    );

  return { token: accessToken, baseUrl: BASE_URL };
}

export function atrioHeaders(token: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  };
}
