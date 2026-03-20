// _shared/auth.ts — Authentication helpers (SEG-1 + ADV-1)
import { createClient } from "npm:@supabase/supabase-js@2";
import { timingSafeEqual } from "./timing-safe.ts";

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
 * Uses timing-safe comparison (ADV-1) to prevent timing attacks.
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

  // Hash the provided key for comparison (ADV-1: timing-safe)
  const apiKeyHash = await hashApiKey(apiKey);

  // Fetch all active configs and compare timing-safely
  const { data: configs } = await supabase
    .from("erp_config")
    .select("id, empresa_id, api_key_hash, api_key, api_key_anterior, api_key_anterior_expira_em")
    .eq("ativo", true);

  if (!configs || configs.length === 0) {
    throw new AuthError("Chave API inválida ou inativa", 401);
  }

  for (const config of configs) {
    // Primary: compare hash (timing-safe)
    if (config.api_key_hash && timingSafeEqual(apiKeyHash, config.api_key_hash)) {
      return { empresaId: config.empresa_id, configId: config.id };
    }

    // Fallback: plaintext comparison during transition (timing-safe)
    if (config.api_key && timingSafeEqual(apiKey, config.api_key)) {
      return { empresaId: config.empresa_id, configId: config.id };
    }

    // Grace period for rotated keys (timing-safe)
    if (
      config.api_key_anterior &&
      config.api_key_anterior_expira_em &&
      new Date(config.api_key_anterior_expira_em) > new Date() &&
      timingSafeEqual(apiKey, config.api_key_anterior)
    ) {
      return { empresaId: config.empresa_id, configId: config.id };
    }
  }

  throw new AuthError("Chave API inválida ou inativa", 401);
}

/**
 * Validate HMAC-SHA256 signature from x-hub-signature-256 header.
 * Uses timing-safe comparison (ADV-1).
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

  // ADV-1: Timing-safe comparison
  if (!timingSafeEqual(signature, expected)) {
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
