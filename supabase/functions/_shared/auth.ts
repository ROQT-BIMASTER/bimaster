// _shared/auth.ts — Authentication helpers (SEG-1)
import { createClient } from "npm:@supabase/supabase-js@2";

export interface AuthResult {
  userId: string;
  email?: string;
  empresaId?: string;
}

export interface ApiKeyResult {
  empresaId: string;
  configId: string;
}

/**
 * Validate JWT from Authorization: Bearer <token>.
 * Returns user info or throws.
 */
export async function validateJWT(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthError("Token de autorização ausente", 401);
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    throw new AuthError("Token inválido ou expirado", 401);
  }

  return {
    userId: data.user.id,
    email: data.user.email,
  };
}

/**
 * Validate x-api-key against erp_config (supports hash comparison).
 */
export async function validateApiKey(req: Request): Promise<ApiKeyResult> {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    throw new AuthError("x-api-key obrigatório", 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Try hash-based comparison first (SEG-2), fall back to plaintext during transition
  const apiKeyHash = await hashApiKey(apiKey);

  const { data: config } = await supabase
    .from("erp_config")
    .select("id, empresa_id")
    .eq("ativo", true)
    .or(
      `api_key_hash.eq.${apiKeyHash},api_key.eq.${apiKey},and(api_key_anterior.eq.${apiKey},api_key_anterior_expira_em.gt.${new Date().toISOString()})`
    )
    .maybeSingle();

  if (!config) {
    throw new AuthError("Chave API inválida ou inativa", 401);
  }

  return { empresaId: config.empresa_id, configId: config.id };
}

/**
 * Validate HMAC-SHA256 signature from x-hub-signature-256 header.
 */
export async function validateHmac(
  req: Request,
  body: string,
  secret: string
): Promise<void> {
  const signature = req.headers.get("x-hub-signature-256") || req.headers.get("x-signature");
  if (!signature) {
    throw new AuthError("Assinatura HMAC ausente", 401);
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const expected = "sha256=" + Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (signature !== expected) {
    throw new AuthError("Assinatura HMAC inválida", 401);
  }
}

/**
 * Hash an API key using SHA-256 (matching the DB trigger).
 */
async function hashApiKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Custom error with HTTP status.
 */
export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}
