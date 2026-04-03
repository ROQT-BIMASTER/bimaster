import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Validates an API key against the erp_api_keys table.
 * Returns empresa_id if valid, null if not found/invalid.
 * Increments request_count on valid use.
 */
export async function validateErpApiKey(apiKey: string): Promise<string | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Hash the key
  const keyData = new TextEncoder().encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", keyData);
  const keyHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

  const { data } = await supabase.rpc("validate_erp_api_key", { p_key_hash: keyHash });

  if (data && data.length > 0 && data[0].valid) {
    return data[0].empresa_id;
  }

  return null;
}
