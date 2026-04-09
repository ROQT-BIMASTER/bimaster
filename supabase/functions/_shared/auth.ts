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

  // Fallback: check erp_api_keys table (Portal de Integração)
  const { validateErpApiKey } = await import("./erp-key-validator.ts");
  const erpEmpresa = await validateErpApiKey(apiKey);
  if (erpEmpresa) {
    return { empresaId: erpEmpresa, configId: "erp_api_keys" };
  }

  throw new AuthError("Chave API inválida ou inativa", 401);
}

/**
 * Validate x-api-key for ERP endpoints.
 * Returns empresaId (string) or throws AuthError.
 * Checks: erp_config → erp_api_keys (Portal) → legacy env keys.
 */
export async function validateErpAuth(
  req: Request,
  legacyEnvKeys?: string[]
): Promise<{ empresaId: string; source: string }> {
  const apiKey = req.headers.get("x-api-key");
  const url = new URL(req.url);
  const endpoint = url.pathname;
  const method = req.method;
  const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("cf-connecting-ip")
    || req.headers.get("x-real-ip")
    || "unknown";
  const userAgent = req.headers.get("user-agent") || undefined;

  if (!apiKey) {
    logApiAccess({
      endpoint, method, ipAddress, userAgent,
      apiKeyUsed: false, success: false,
      errorMessage: "Header x-api-key ausente",
    });
    throw new AuthError("Header x-api-key ausente", 401);
  }

  const keyPreview = getKeyPreview(apiKey);

  // 1. Check legacy env keys (N8N_API_KEY, EXPORT_API_KEY, etc.) with timing-safe
  if (legacyEnvKeys) {
    for (const envName of legacyEnvKeys) {
      const envValue = Deno.env.get(envName);
      if (envValue && timingSafeEqual(apiKey, envValue)) {
        logApiAccess({
          endpoint, method, ipAddress, userAgent,
          apiKeyUsed: true, success: true, keyPreview,
        });
        return { empresaId: "legacy", source: envName };
      }
    }
  }

  // 2. Check erp_config table
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: configRow } = await supabase
    .from("erp_config")
    .select("empresa_id")
    .eq("config_key", "api_key")
    .eq("config_value", apiKey)
    .maybeSingle();

  if (configRow?.empresa_id) {
    logApiAccess({
      endpoint, method, ipAddress, userAgent,
      apiKeyUsed: true, success: true, keyPreview,
    });
    return { empresaId: String(configRow.empresa_id), source: "erp_config" };
  }

  // 3. Check erp_api_keys table (Portal de Integração)
  const { validateErpApiKey } = await import("./erp-key-validator.ts");
  const empresa = await validateErpApiKey(apiKey);
  if (empresa) {
    logApiAccess({
      endpoint, method, ipAddress, userAgent,
      apiKeyUsed: true, success: true, keyPreview,
    });
    return { empresaId: empresa, source: "erp_api_keys" };
  }

  logApiAccess({
    endpoint, method, ipAddress, userAgent,
    apiKeyUsed: true, success: false, keyPreview,
    errorMessage: "Chave API inválida ou inativa",
  });
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
 * Log API access to api_security_log (fire-and-forget).
 */
export function logApiAccess(params: {
  endpoint: string;
  method: string;
  ipAddress?: string;
  userAgent?: string;
  apiKeyUsed: boolean;
  userId?: string;
  success: boolean;
  errorMessage?: string;
  keyPreview?: string;
  responseTimeMs?: number;
}): void {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    supabase.from("api_security_log").insert({
      endpoint: params.endpoint,
      method: params.method,
      ip_address: params.ipAddress || "unknown",
      user_agent: params.userAgent?.substring(0, 500) || null,
      api_key_used: params.apiKeyUsed,
      user_id: params.userId || null,
      success: params.success,
      error_message: params.errorMessage || null,
      key_preview: params.keyPreview || null,
      response_time_ms: params.responseTimeMs || null,
    }).then(() => {}).catch(() => {});
  } catch {
    // Fire-and-forget — never block the API response
  }
}

/**
 * Extract key preview (first 12 + last 4 chars) for audit trail.
 */
export function getKeyPreview(key: string): string {
  if (key.length <= 16) return key.substring(0, 4) + "****";
  return key.substring(0, 12) + "..." + key.substring(key.length - 4);
}

/**
 * Unified auth: tries JWT first, then API Key.
 * Use for portal APIs that support both auth methods.
 * Logs all access attempts (success + failure) to api_security_log.
 */
export async function validateAnyAuth(req: Request): Promise<{
  userId?: string;
  email?: string;
  empresaId?: string;
  source: "jwt" | "api_key";
}> {
  const authHeader = req.headers.get("Authorization");
  const apiKey = req.headers.get("x-api-key");
  const url = new URL(req.url);
  const endpoint = url.pathname;
  const method = req.method;
  const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("cf-connecting-ip")
    || req.headers.get("x-real-ip")
    || "unknown";
  const userAgent = req.headers.get("user-agent") || undefined;

  // Try JWT first if Authorization header exists
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const result = await validateJWT(req);
      logApiAccess({
        endpoint, method, ipAddress, userAgent,
        apiKeyUsed: false, userId: result.userId,
        success: true,
      });
      return { userId: result.userId, email: result.email, source: "jwt" };
    } catch {
      // Fall through to API key
    }
  }

  // Try API key
  if (apiKey) {
    try {
      const result = await validateApiKey(req);
      logApiAccess({
        endpoint, method, ipAddress, userAgent,
        apiKeyUsed: true, success: true,
        keyPreview: getKeyPreview(apiKey),
      });
      return { empresaId: result.empresaId, source: "api_key" };
    } catch {
      // Log failed attempt
      logApiAccess({
        endpoint, method, ipAddress, userAgent,
        apiKeyUsed: true, success: false,
        errorMessage: "Chave API inválida",
        keyPreview: getKeyPreview(apiKey),
      });
    }
  }

  // Log complete auth failure
  logApiAccess({
    endpoint, method, ipAddress, userAgent,
    apiKeyUsed: !!apiKey, success: false,
    errorMessage: "Nenhuma autenticação válida",
  });

  throw new AuthError("Autenticação necessária (Bearer token ou x-api-key)", 401);
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
