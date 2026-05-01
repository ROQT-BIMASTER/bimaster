// dependency-scan — Registra findings de dependências (executado via cron ou manual)
// Em produção, recebe payload com resultados do `npm audit --json` rodado fora da edge.
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(secureHandler({
  auth: "jwt",
  rateLimit: 10,
  rateLimitPrefix: "dependency-scan",
}, async (req, ctx) => {
  const cors = getCorsHeaders(req);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: isAdmin } = await sb.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Admin only" }), {
      status: 403, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({}));
  const audit = body.audit ?? {};
  const scanId = crypto.randomUUID();
  const findings: any[] = [];

  // npm audit format: vulnerabilities { name: { severity, via, fixAvailable, ... } }
  const vulns = audit.vulnerabilities ?? {};
  for (const [name, v] of Object.entries(vulns)) {
    const vuln = v as any;
    const cves = (Array.isArray(vuln.via) ? vuln.via : []).filter((x: any) => typeof x === "object").map((x: any) => x.url ?? x.source).filter(Boolean);
    findings.push({
      scan_id: scanId,
      package_name: name,
      installed_version: vuln.range ?? null,
      vulnerable_versions: vuln.range ?? null,
      severity: ["info","low","moderate","high","critical"].includes(vuln.severity) ? vuln.severity : "moderate",
      cve_ids: cves,
      advisory_url: cves[0] ?? null,
      recommendation: vuln.fixAvailable ? `Upgrade para ${typeof vuln.fixAvailable === "object" ? vuln.fixAvailable.version : "última versão"}` : "Sem fix disponível",
    });
  }

  if (findings.length > 0) {
    await sb.from("dependency_findings").insert(findings);
  }

  return new Response(JSON.stringify({
    scan_id: scanId,
    total: findings.length,
    by_severity: findings.reduce((acc, f) => { acc[f.severity] = (acc[f.severity] ?? 0) + 1; return acc; }, {} as Record<string, number>),
  }), { headers: { ...cors, "Content-Type": "application/json" } });
}));
