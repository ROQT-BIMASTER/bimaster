import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const last5min = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    const last1h = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const results: string[] = [];

    // === RULE 1: Brute Force (5+ failed logins from same IP in 5min) ===
    const { data: failedByIp } = await supabase
      .from("access_audit_log")
      .select("ip_address")
      .eq("action", "login_failed")
      .gte("created_at", last5min);

    if (failedByIp && failedByIp.length > 0) {
      const ipCounts: Record<string, number> = {};
      for (const row of failedByIp) {
        const ip = String(row.ip_address || "unknown");
        ipCounts[ip] = (ipCounts[ip] || 0) + 1;
      }

      for (const [ip, count] of Object.entries(ipCounts)) {
        if (count >= 5 && ip !== "unknown") {
          // Check if incident already exists for this IP in last hour
          const { data: existing } = await supabase
            .from("security_incidents")
            .select("id")
            .eq("incident_type", "brute_force")
            .eq("source_ip", ip)
            .gte("created_at", last1h)
            .limit(1);

          if (!existing || existing.length === 0) {
            const { data: incident } = await supabase
              .from("security_incidents")
              .insert({
                incident_type: "brute_force",
                severity: count >= 20 ? "critical" : "high",
                title: `Brute force detectado: ${count} tentativas de ${ip}`,
                description: `${count} tentativas de login falhadas do IP ${ip} nos últimos 5 minutos`,
                source_ip: ip,
                risk_score: Math.min(count * 10, 100),
                auto_action_taken: "blocked_ip",
              })
              .select("id")
              .single();

            if (incident) {
              // Auto-block IP for 1 hour
              await supabase.from("security_ip_blocklist").insert({
                ip_address: ip,
                reason: `Brute force: ${count} failed logins in 5min`,
                blocked_by: "auto",
                incident_id: incident.id,
                expires_at: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
              });
              results.push(`Blocked IP ${ip} (${count} failed logins)`);
            }
          }
        }
      }
    }

    // === RULE 2: Suspicious IP (same IP in 3+ different accounts in 1h) ===
    const { data: ipUsers } = await supabase
      .from("access_audit_log")
      .select("ip_address, user_id")
      .gte("created_at", last1h)
      .not("user_id", "is", null);

    if (ipUsers && ipUsers.length > 0) {
      const ipToUsers: Record<string, Set<string>> = {};
      for (const row of ipUsers) {
        const ip = String(row.ip_address || "unknown");
        if (ip === "unknown") continue;
        if (!ipToUsers[ip]) ipToUsers[ip] = new Set();
        ipToUsers[ip].add(row.user_id!);
      }

      for (const [ip, users] of Object.entries(ipToUsers)) {
        if (users.size >= 3) {
          const { data: existing } = await supabase
            .from("security_incidents")
            .select("id")
            .eq("incident_type", "suspicious_ip")
            .eq("source_ip", ip)
            .gte("created_at", last1h)
            .limit(1);

          if (!existing || existing.length === 0) {
            await supabase.from("security_incidents").insert({
              incident_type: "suspicious_ip",
              severity: "high",
              title: `IP suspeito: ${ip} em ${users.size} contas`,
              description: `O IP ${ip} foi usado por ${users.size} usuários diferentes na última hora`,
              source_ip: ip,
              risk_score: Math.min(users.size * 20, 100),
              related_events: JSON.stringify([...users]),
              auto_action_taken: "none",
            });
            results.push(`Suspicious IP ${ip} (${users.size} users)`);
          }
        }
      }
    }

    // === RULE 3: Mass Export (10+ exports from same user in 1h) ===
    const { data: exports } = await supabase
      .from("audit_logs")
      .select("user_id")
      .in("action", ["export", "export_pdf", "export_excel", "export_csv"])
      .gte("created_at", last1h);

    if (exports && exports.length > 0) {
      const userExports: Record<string, number> = {};
      for (const row of exports) {
        if (!row.user_id) continue;
        userExports[row.user_id] = (userExports[row.user_id] || 0) + 1;
      }

      for (const [userId, count] of Object.entries(userExports)) {
        if (count >= 10) {
          const { data: existing } = await supabase
            .from("security_incidents")
            .select("id")
            .eq("incident_type", "mass_export")
            .eq("user_id", userId)
            .gte("created_at", last1h)
            .limit(1);

          if (!existing || existing.length === 0) {
            await supabase.from("security_incidents").insert({
              incident_type: "mass_export",
              severity: "medium",
              title: `Exportação em massa: ${count} exports`,
              description: `Usuário realizou ${count} exportações na última hora`,
              user_id: userId,
              risk_score: Math.min(count * 5, 100),
              auto_action_taken: "none",
            });
            results.push(`Mass export alert: user ${userId} (${count} exports)`);
          }
        }
      }
    }

    // === RISK SCORE CALCULATION ===
    // Get all users with activity in the last hour
    const { data: activeUsers } = await supabase
      .from("access_audit_log")
      .select("user_id")
      .gte("created_at", last1h)
      .not("user_id", "is", null);

    if (activeUsers) {
      const uniqueUsers = [...new Set(activeUsers.map((r) => r.user_id!))];

      for (const userId of uniqueUsers.slice(0, 50)) {
        // Limit to 50 users per run
        const factors: Record<string, number> = {};
        let score = 0;

        // Failed logins (weight 3)
        const { count: failCount } = await supabase
          .from("access_audit_log")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("action", "login_failed")
          .gte("created_at", last1h);
        const failedWeight = Math.min((failCount ?? 0) * 3, 30);
        factors.failed_logins = failCount ?? 0;
        score += failedWeight;

        // Incidents (weight 5)
        const { count: incidentCount } = await supabase
          .from("security_incidents")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("created_at", new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString());
        const incidentWeight = Math.min((incidentCount ?? 0) * 5, 50);
        factors.recent_incidents = incidentCount ?? 0;
        score += incidentWeight;

        // Multiple IPs (weight 2)
        const { data: userIps } = await supabase
          .from("access_audit_log")
          .select("ip_address")
          .eq("user_id", userId)
          .gte("created_at", last1h);
        const uniqueIps = new Set(userIps?.map((r) => String(r.ip_address)) || []);
        if (uniqueIps.size > 3) {
          const ipWeight = Math.min((uniqueIps.size - 3) * 2, 20);
          factors.multiple_ips = uniqueIps.size;
          score += ipWeight;
        }

        score = Math.min(score, 100);
        const riskLevel = score >= 75 ? "critical" : score >= 50 ? "high" : score >= 25 ? "medium" : "low";

        await supabase.from("security_user_risk_score").upsert(
          {
            user_id: userId,
            score,
            risk_level: riskLevel,
            factors,
            last_calculated_at: now.toISOString(),
          },
          { onConflict: "user_id" }
        );
      }
      results.push(`Risk scores updated for ${Math.min(uniqueUsers.length, 50)} users`);
    }

    // === CLEANUP: Expire old IP blocks ===
    await supabase
      .from("security_ip_blocklist")
      .update({ is_active: false })
      .lt("expires_at", now.toISOString())
      .eq("is_active", true);

    return new Response(
      JSON.stringify({ success: true, actions: results, timestamp: now.toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Correlation engine error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
