// _shared/waf.ts — Web Application Firewall L7 middleware
import { createClient } from "npm:@supabase/supabase-js@2";

export interface WafResult {
  allowed: boolean;
  reason?: string;
  category?: string;
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
  const ua = req.headers.get("user-agent") || "";

  // Bot detection
  if (detectMaliciousBot(ua)) {
    await logWafBlock(req, "malicious_bot", "bot_detection");
    return { allowed: false, reason: "Request blocked by security policy", category: "bot_detection" };
  }

  // Check URL and query string
  const url = new URL(req.url);
  const urlCheck = inspectValue(decodeURIComponent(url.pathname + url.search));
  if (urlCheck) {
    await logWafBlock(req, urlCheck.reason!, urlCheck.category!);
    return urlCheck;
  }

  // Check body for POST/PUT/PATCH
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
    if (contentLength > MAX_BODY_SIZE) {
      await logWafBlock(req, "Request body too large", "size_limit");
      return { allowed: false, reason: "Request body too large", category: "size_limit" };
    }

    try {
      const cloned = req.clone();
      const text = await cloned.text();
      if (text.length > MAX_BODY_SIZE) {
        await logWafBlock(req, "Request body too large", "size_limit");
        return { allowed: false, reason: "Request body too large", category: "size_limit" };
      }

      // Try to parse as JSON and inspect deeply
      try {
        const json = JSON.parse(text);
        const bodyCheck = inspectObject(json);
        if (bodyCheck) {
          await logWafBlock(req, bodyCheck.reason!, bodyCheck.category!);
          return bodyCheck;
        }
      } catch {
        // Not JSON — inspect raw text
        const rawCheck = inspectValue(text);
        if (rawCheck) {
          await logWafBlock(req, rawCheck.reason!, rawCheck.category!);
          return rawCheck;
        }
      }
    } catch {
      // Body already consumed or unreadable — skip
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
    }).catch(() => {});
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
