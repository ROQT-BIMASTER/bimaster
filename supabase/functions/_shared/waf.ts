// _shared/waf.ts — Web Application Firewall L7 middleware (v2: geo/ASN + bot signals + shadow mode)
import { createClient } from "npm:@supabase/supabase-js@2";

export interface WafResult {
  allowed: boolean;
  reason?: string;
  category?: string;
  /** Quando true, a infração foi detectada mas NÃO bloqueada (modo shadow). */
  shadowed?: boolean;
}

// ===== Runtime config cache =====
type WafMode = "shadow" | "enforce" | "off";
let _modeCache: { value: WafMode; expires: number } | null = null;

async function getWafMode(): Promise<WafMode> {
  const now = Date.now();
  if (_modeCache && _modeCache.expires > now) return _modeCache.value;
  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data } = await sb.from("waf_runtime_config").select("mode").eq("id", 1).maybeSingle();
    const v = (data?.mode as WafMode) || "shadow";
    _modeCache = { value: v, expires: now + 30_000 };
    return v;
  } catch {
    return "shadow";
  }
}

// ===== Geo / ASN policy =====
type GeoDecision = { decision: "allow" | "block" | "neutral"; country?: string };

function getCountry(req: Request): string | null {
  return (
    req.headers.get("cf-ipcountry") ||
    req.headers.get("x-vercel-ip-country") ||
    req.headers.get("x-country") ||
    null
  );
}

let _geoCache: { allow: Set<string>; block: Set<string>; expires: number } | null = null;

async function evaluateGeo(req: Request): Promise<GeoDecision> {
  const country = getCountry(req);
  if (!country) return { decision: "neutral" };
  const now = Date.now();
  if (!_geoCache || _geoCache.expires <= now) {
    try {
      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data } = await sb.from("waf_geo_policy").select("country_code, action");
      const allow = new Set<string>();
      const block = new Set<string>();
      for (const row of (data ?? []) as Array<{ country_code: string; action: string }>) {
        if (row.action === "allow") allow.add(row.country_code.toUpperCase());
        if (row.action === "block") block.add(row.country_code.toUpperCase());
      }
      _geoCache = { allow, block, expires: now + 60_000 };
    } catch {
      _geoCache = { allow: new Set(), block: new Set(), expires: now + 60_000 };
    }
  }
  const cc = country.toUpperCase();
  if (_geoCache.block.has(cc)) return { decision: "block", country: cc };
  if (_geoCache.allow.size > 0 && _geoCache.allow.has(cc)) return { decision: "allow", country: cc };
  return { decision: "neutral", country: cc };
}

// ===== Bot signals (heurístico) =====
function botSignalsScore(req: Request): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const ua = req.headers.get("user-agent") || "";
  if (!ua) { score += 30; reasons.push("missing_ua"); }
  if (ua.length < 20) { score += 15; reasons.push("short_ua"); }
  if (!req.headers.get("accept-language")) { score += 10; reasons.push("missing_accept_language"); }
  if (!req.headers.get("accept")) { score += 10; reasons.push("missing_accept"); }
  if (/headlesschrome|phantomjs|puppeteer|playwright/i.test(ua)) {
    score += 50; reasons.push("headless_ua");
  }
  return { score, reasons };
}

// SQL Injection patterns
const SQL_INJECTION_PATTERNS = [
  /(\bunion\b\s+\bselect\b)/i,
  /(\bor\b\s+1\s*=\s*1)/i,
  /(\band\b\s+1\s*=\s*1)/i,
  /(\bdrop\b\s+\btable\b)/i,
  /(\bdelete\b\s+\bfrom\b)/i,
  /(\binsert\b\s+\binto\b)/i,
  /(\bexec\b\s*\()/i,
  /(\bexecute\b\s*\()/i,
  /(;\s*\bdrop\b)/i,
  /(;\s*\bdelete\b)/i,
  /(;\s*\bupdate\b\s+\bset\b)/i,
  /(\bsleep\s*\(\s*\d+\s*\))/i,
  /(\bbenchmark\s*\()/i,
  /(\bwaitfor\b\s+\bdelay\b)/i,
  /(--\s*$)/m,
  /(\/\*[\s\S]*?\*\/)/,
  /(\bchar\s*\(\s*\d+\s*\))/i,
  /(\bconvert\s*\()/i,
  /(\bhaving\b\s+1\s*=\s*1)/i,
  /(\border\b\s+\bby\b\s+\d+)/i,
];

// XSS patterns
const XSS_PATTERNS = [
  /<script[\s>]/i,
  /javascript\s*:/i,
  /on(error|load|click|mouseover|focus|blur|submit|change|input)\s*=/i,
  /<iframe[\s>]/i,
  /<object[\s>]/i,
  /<embed[\s>]/i,
  /<svg[\s>].*?on\w+\s*=/i,
  /\beval\s*\(/i,
  /\bdocument\s*\.\s*(cookie|write|location)/i,
  /\bwindow\s*\.\s*location/i,
  /<img[^>]+onerror/i,
];

// Path traversal patterns
const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//,
  /\.\.%2[fF]/,
  /%2[eE]%2[eE]%2[fF]/,
  /%2[eE]\./,
  /\.%2[eE]/,
  /\/etc\/passwd/i,
  /\/proc\/self/i,
  /\bboot\.ini\b/i,
];

// Known malicious bot user-agents
const MALICIOUS_BOT_PATTERNS = [
  /sqlmap/i,
  /nikto/i,
  /nessus/i,
  /openvas/i,
  /dirbuster/i,
  /gobuster/i,
  /wfuzz/i,
  /hydra/i,
  /masscan/i,
  /zmap/i,
  /havij/i,
  /acunetix/i,
  /netsparker/i,
  /burpsuite/i,
];

const MAX_BODY_SIZE = 1_048_576; // 1MB

function detectSqlInjection(input: string): boolean {
  return SQL_INJECTION_PATTERNS.some((p) => p.test(input));
}

function detectXss(input: string): boolean {
  return XSS_PATTERNS.some((p) => p.test(input));
}

function detectPathTraversal(input: string): boolean {
  return PATH_TRAVERSAL_PATTERNS.some((p) => p.test(input));
}

function detectMaliciousBot(ua: string): boolean {
  return MALICIOUS_BOT_PATTERNS.some((p) => p.test(ua));
}

function inspectValue(value: string): WafResult | null {
  if (detectSqlInjection(value)) {
    return { allowed: false, reason: "SQL injection pattern detected", category: "sqli" };
  }
  if (detectXss(value)) {
    return { allowed: false, reason: "XSS pattern detected", category: "xss" };
  }
  if (detectPathTraversal(value)) {
    return { allowed: false, reason: "Path traversal detected", category: "path_traversal" };
  }
  return null;
}

function inspectObject(obj: unknown, depth = 0): WafResult | null {
  if (depth > 10) return null;
  if (typeof obj === "string") return inspectValue(obj);
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const r = inspectObject(item, depth + 1);
      if (r) return r;
    }
  } else if (obj && typeof obj === "object") {
    for (const [key, val] of Object.entries(obj)) {
      const kr = inspectValue(key);
      if (kr) return kr;
      const vr = inspectObject(val, depth + 1);
      if (vr) return vr;
    }
  }
  return null;
}

/**
 * WAF L7 check — call at the beginning of Edge Functions.
 * Inspects headers, URL, query params, and body for malicious patterns.
 */
export async function wafCheck(req: Request): Promise<WafResult> {
  const mode = await getWafMode();
  if (mode === "off") return { allowed: true };

  const ua = req.headers.get("user-agent") || "";

  // Helper que respeita o modo (shadow = log + allow)
  const decide = async (reason: string, category: string): Promise<WafResult> => {
    await logWafBlock(req, reason, category, mode);
    if (mode === "shadow") {
      return { allowed: true, reason, category, shadowed: true };
    }
    return { allowed: false, reason: "Request blocked by security policy", category };
  };

  // 1. Geo policy (allow-list / block-list)
  const geo = await evaluateGeo(req);
  if (geo.decision === "block") {
    return decide(`Geo blocked: ${geo.country}`, "geo_block");
  }

  // 2. Bot signals heurísticos (score >= 50 = bloqueio)
  const bot = botSignalsScore(req);
  if (bot.score >= 50) {
    return decide(`Bot signals: ${bot.reasons.join(",")}`, "bot_signals");
  }

  // 3. Bot detection (assinaturas conhecidas)
  if (detectMaliciousBot(ua)) {
    return decide("malicious_bot", "bot_detection");
  }

  // 4. URL e query string
  const url = new URL(req.url);
  const urlCheck = inspectValue(decodeURIComponent(url.pathname + url.search));
  if (urlCheck) {
    return decide(urlCheck.reason!, urlCheck.category!);
  }

  // 5. Body para POST/PUT/PATCH
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
    if (contentLength > MAX_BODY_SIZE) {
      return decide("Request body too large", "size_limit");
    }

    try {
      const cloned = req.clone();
      const text = await cloned.text();
      if (text.length > MAX_BODY_SIZE) {
        return decide("Request body too large", "size_limit");
      }

      try {
        const json = JSON.parse(text);
        const bodyCheck = inspectObject(json);
        if (bodyCheck) {
          return decide(bodyCheck.reason!, bodyCheck.category!);
        }
      } catch {
        const rawCheck = inspectValue(text);
        if (rawCheck) {
          return decide(rawCheck.reason!, rawCheck.category!);
        }
      }
    } catch {
      // Body já consumido — skip
    }
  }

  return { allowed: true };
}

async function logWafBlock(req: Request, reason: string, category: string): Promise<void> {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    await supabase.from("security_audit_log").insert({
      action: "waf_blocked",
      severity: "high",
      metadata: {
        ip,
        reason,
        category,
        method: req.method,
        path: new URL(req.url).pathname,
        user_agent: req.headers.get("user-agent") || "none",
      },
    }).then(() => {}, () => {});
  } catch {
    // Fire and forget
  }
}

/**
 * Helper to return a WAF block response with proper CORS headers.
 */
export function wafBlockResponse(result: WafResult, corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error: "Request blocked by security policy" }),
    {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
