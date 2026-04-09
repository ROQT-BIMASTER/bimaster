import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SubnetStats {
  prefix: string;
  uniqueIps: Set<string>;
  totalFailed: number;
  totalRequests: number;
  endpoints: Set<string>;
  keys: Set<string>;
  userAgents: Set<string>;
  ips: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin");

    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch logs from last 2 hours
    const since2h = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: logs } = await supabase
      .from("api_security_log")
      .select("*")
      .gte("created_at", since2h)
      .order("created_at", { ascending: false })
      .limit(500);

    const { data: recentIncidents } = await supabase
      .from("security_incidents")
      .select("*")
      .gte("created_at", since2h)
      .limit(50);

    const logCount = logs?.length || 0;
    const incidentCount = recentIncidents?.length || 0;

    // Build per-IP summary
    const ipSummary: Record<string, { total: number; failed: number; endpoints: Set<string>; keys: Set<string>; userAgents: Set<string> }> = {};
    const endpointSummary: Record<string, { total: number; failed: number }> = {};

    // Build per-subnet summary
    const subnetMap = new Map<string, SubnetStats>();

    (logs || []).forEach((l: any) => {
      const ip = String(l.ip_address || "unknown");
      if (!ipSummary[ip]) ipSummary[ip] = { total: 0, failed: 0, endpoints: new Set(), keys: new Set(), userAgents: new Set() };
      ipSummary[ip].total++;
      if (!l.success) ipSummary[ip].failed++;
      ipSummary[ip].endpoints.add(l.endpoint);
      if (l.key_preview) ipSummary[ip].keys.add(l.key_preview);
      if (l.user_agent) ipSummary[ip].userAgents.add(l.user_agent);

      if (!endpointSummary[l.endpoint]) endpointSummary[l.endpoint] = { total: 0, failed: 0 };
      endpointSummary[l.endpoint].total++;
      if (!l.success) endpointSummary[l.endpoint].failed++;

      // Subnet aggregation (/16)
      const parts = ip.split(".");
      if (parts.length === 4) {
        const prefix = `${parts[0]}.${parts[1]}`;
        if (!subnetMap.has(prefix)) {
          subnetMap.set(prefix, {
            prefix,
            uniqueIps: new Set(),
            totalFailed: 0,
            totalRequests: 0,
            endpoints: new Set(),
            keys: new Set(),
            userAgents: new Set(),
            ips: [],
          });
        }
        const subnet = subnetMap.get(prefix)!;
        if (!subnet.uniqueIps.has(ip)) {
          subnet.uniqueIps.add(ip);
          subnet.ips.push(ip);
        }
        subnet.totalRequests++;
        if (!l.success) subnet.totalFailed++;
        subnet.endpoints.add(l.endpoint);
        if (l.key_preview) subnet.keys.add(l.key_preview);
        if (l.user_agent) subnet.userAgents.add(l.user_agent);
      }
    });

    // Serialize IP data
    const ipData = Object.entries(ipSummary).map(([ip, s]) => ({
      ip,
      total: s.total,
      failed: s.failed,
      unique_endpoints: s.endpoints.size,
      unique_keys: s.keys.size,
      unique_user_agents: s.userAgents.size,
      endpoints: Array.from(s.endpoints).slice(0, 10),
    }));

    const endpointData = Object.entries(endpointSummary).map(([ep, s]) => ({
      endpoint: ep,
      total: s.total,
      failed: s.failed,
      error_rate: s.total > 0 ? (s.failed / s.total * 100).toFixed(1) + "%" : "0%",
    }));

    // Serialize subnet data — flag suspicious subnets (5+ unique IPs with failures)
    const subnetData = Array.from(subnetMap.values())
      .filter(s => s.uniqueIps.size >= 3)
      .map(s => ({
        prefix: s.prefix + ".x.x",
        unique_ips: s.uniqueIps.size,
        total_failed: s.totalFailed,
        total_requests: s.totalRequests,
        unique_endpoints: s.endpoints.size,
        failure_rate: s.totalRequests > 0 ? (s.totalFailed / s.totalRequests * 100).toFixed(1) + "%" : "0%",
        ips: s.ips.slice(0, 20),
        is_suspicious: s.uniqueIps.size >= 5 && s.totalFailed >= 10,
      }))
      .sort((a, b) => b.total_failed - a.total_failed)
      .slice(0, 10);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é o Sentinel, um agente de segurança especializado em análise de logs de API.

Sua missão é analisar dados de tráfego e detectar anomalias de segurança.

Tipos de anomalia que você deve detectar:
1. ENDPOINT_SCANNING: Muitas tentativas 401/403 em endpoints diferentes do mesmo IP
2. CREDENTIAL_STUFFING: Mesmo IP tentando múltiplos tokens diferentes
3. API_ABUSE: Volume anormalmente alto de um token válido (possível exfiltração)
4. DATA_EXFILTRATION: Muitos GETs em endpoints de dados em curto período
5. EVASION: Múltiplos IPs com mesmo User-Agent (possível botnet)
6. BRUTE_FORCE: Mais de 50 falhas de auth de um mesmo IP
7. DISTRIBUTED_SCANNING: Múltiplos IPs do mesmo subnet (/16) realizando falhas coordenadas em vários endpoints. Indicativo de ataque distribuído por botnet ou infraestrutura cloud. Critério: 5+ IPs únicos do mesmo subnet com falhas simultâneas.

Para cada anomalia, forneça:
- type: tipo da anomalia
- severity: low/medium/high/critical
- ip: IP envolvido (se aplicável, para DISTRIBUTED_SCANNING use o prefixo como "18.231.x.x")
- endpoint: endpoint mais afetado (se aplicável)
- description: descrição clara em português
- confidence: 0.0 a 1.0
- subnet_ips: lista de IPs do subnet (apenas para DISTRIBUTED_SCANNING)

Para cada defesa recomendada:
- action: block_ip, block_subnet, disable_token, ou alert_only
- target: IP, prefixo de subnet, ou token a bloquear
- reason: justificativa
- subnet_ips: lista de IPs a bloquear (apenas para block_subnet)

Para block_ip: recomende com confidence >= 0.8.
Para block_subnet: recomende com confidence >= 0.7 (a correlação de subnet já é evidência forte).
Se não houver anomalias, retorne listas vazias e risk_assessment positivo.`;

    const userPrompt = `Analise os dados de tráfego das últimas 2 horas:

RESUMO POR IP (${ipData.length} IPs únicos):
${JSON.stringify(ipData.sort((a, b) => b.failed - a.failed).slice(0, 20), null, 2)}

RESUMO POR ENDPOINT (${endpointData.length} endpoints):
${JSON.stringify(endpointData.sort((a, b) => b.failed - a.failed).slice(0, 15), null, 2)}

RESUMO POR SUBNET /16 (${subnetData.length} subnets com 3+ IPs):
${JSON.stringify(subnetData, null, 2)}

SUBNETS SUSPEITOS (5+ IPs com falhas): ${subnetData.filter(s => s.is_suspicious).map(s => `${s.prefix} (${s.unique_ips} IPs, ${s.total_failed} falhas)`).join(", ") || "nenhum"}

INCIDENTES RECENTES: ${incidentCount}
TOTAL DE LOGS: ${logCount}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_security_analysis",
              description: "Report the security analysis results",
              parameters: {
                type: "object",
                properties: {
                  anomalies: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string" },
                        severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
                        ip: { type: "string" },
                        endpoint: { type: "string" },
                        description: { type: "string" },
                        confidence: { type: "number" },
                        subnet_ips: { type: "array", items: { type: "string" } },
                      },
                      required: ["type", "severity", "description", "confidence"],
                    },
                  },
                  defenses: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        action: { type: "string", enum: ["block_ip", "block_subnet", "disable_token", "alert_only"] },
                        target: { type: "string" },
                        reason: { type: "string" },
                        subnet_ips: { type: "array", items: { type: "string" } },
                      },
                      required: ["action", "target", "reason"],
                    },
                  },
                  risk_assessment: { type: "string" },
                },
                required: ["anomalies", "defenses", "risk_assessment"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_security_analysis" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "AI returned no structured response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const analysis = JSON.parse(toolCall.function.arguments);

    // Execute defenses for high-confidence threats
    const executedDefenses = [];
    for (const defense of analysis.defenses || []) {
      if (defense.action === "block_ip") {
        const matchingAnomaly = (analysis.anomalies || []).find(
          (a: any) => a.ip === defense.target && a.confidence >= 0.8
        );
        if (matchingAnomaly) {
          // Insert incident FIRST (no FK dependency)
          const { data: incidentData, error: incidentErr } = await supabase.from("security_incidents").insert({
            incident_type: matchingAnomaly.type,
            severity: matchingAnomaly.severity,
            status: "auto_mitigated",
            source_ip: defense.target,
            auto_action_taken: `IP bloqueado (${matchingAnomaly.severity === "critical" ? "hard" : "soft"}) por 24h`,
            title: `Sentinel: ${matchingAnomaly.type}`,
            description: matchingAnomaly.description,
            confidence_score: matchingAnomaly.confidence,
            detection_method: "ai_sentinel",
          }).select("id").single();

          if (incidentErr) {
            console.error("[Sentinel] Failed to insert incident for block_ip:", incidentErr);
          }

          const { error: blockErr } = await supabase.from("security_ip_blocklist").upsert(
            {
              ip_address: defense.target,
              reason: `AI Sentinel: ${defense.reason}`,
              blocked_by: "ai_sentinel",
              block_level: matchingAnomaly.severity === "critical" ? "hard" : "soft",
              is_active: true,
              expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            },
            { onConflict: "ip_address" }
          );

          if (blockErr) {
            console.error("[Sentinel] Failed to upsert blocklist for IP:", defense.target, blockErr);
          }

          executedDefenses.push({ ...defense, executed: !blockErr && !incidentErr });
        } else {
          executedDefenses.push({ ...defense, executed: false, reason_skipped: "confidence < 0.8" });
        }
      } else if (defense.action === "block_subnet") {
        // Distributed attack — block all IPs from the subnet
        const matchingAnomaly = (analysis.anomalies || []).find(
          (a: any) => a.type === "DISTRIBUTED_SCANNING" && a.confidence >= 0.7
        );

        // Gather IPs to block: from defense.subnet_ips or from the matching anomaly
        const ipsToBlock: string[] = defense.subnet_ips || matchingAnomaly?.subnet_ips || [];
        
        // Also look up IPs from our subnetMap
        const prefix = defense.target.replace(/\.x\.x$/, "");
        const subnetEntry = subnetMap.get(prefix);
        if (subnetEntry) {
          for (const ip of subnetEntry.ips) {
            if (!ipsToBlock.includes(ip)) ipsToBlock.push(ip);
          }
        }

        if (matchingAnomaly && ipsToBlock.length > 0) {
          // Insert incident FIRST
          // Use first real IP for inet-typed source_ip column; store subnet label in description
          const representativeIp = ipsToBlock[0] || "0.0.0.0";
          const { data: incidentData, error: incidentErr } = await supabase.from("security_incidents").insert({
            incident_type: "DISTRIBUTED_SCANNING",
            severity: matchingAnomaly.severity || "high",
            status: "auto_mitigated",
            source_ip: representativeIp,
            auto_action_taken: `Subnet ${defense.target}: ${ipsToBlock.length} IPs em soft block por 24h`,
            title: `Sentinel: Ataque Distribuído - ${defense.target}`,
            description: `${matchingAnomaly.description || ''} [Subnet prefix: ${defense.target}]`,
            confidence_score: matchingAnomaly.confidence,
            detection_method: "ai_sentinel",
          }).select("id").single();

          if (incidentErr) {
            console.error("[Sentinel] Failed to insert incident for block_subnet:", incidentErr);
          }

          let blockedCount = 0;
          let blockErrors = 0;
          for (const ip of ipsToBlock) {
            const { error: blockErr } = await supabase.from("security_ip_blocklist").upsert(
              {
                ip_address: ip,
                reason: `AI Sentinel Subnet Block [${defense.target}]: ${defense.reason}`,
                blocked_by: "ai_sentinel",
                block_level: "soft",
                is_active: true,
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              },
              { onConflict: "ip_address" }
            );
            if (blockErr) {
              blockErrors++;
              console.error(`[Sentinel] Failed to block IP ${ip}:`, blockErr);
            } else {
              blockedCount++;
            }
          }

          console.log(`[Sentinel] Subnet ${defense.target}: ${blockedCount} blocked, ${blockErrors} errors`);
          executedDefenses.push({ ...defense, executed: blockedCount > 0, ips_blocked: blockedCount, errors: blockErrors });
        } else {
          executedDefenses.push({ ...defense, executed: false, ips_blocked: 0, reason_skipped: matchingAnomaly ? "no IPs" : "confidence < 0.7" });
        }
      } else {
        executedDefenses.push({ ...defense, executed: false });
      }
    }

    const result = {
      anomalies: analysis.anomalies || [],
      defenses: executedDefenses,
      risk_assessment: analysis.risk_assessment || "Análise concluída.",
      logs_analyzed: logCount,
      incidents_found: incidentCount,
      analysis_timestamp: new Date().toISOString(),
      subnet_analysis: subnetData,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Sentinel error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
