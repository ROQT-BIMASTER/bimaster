import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const MENCAO_TYPES = ["task_mention", "chat_mention", "process_mention"];
const CONTEXT_LABEL: Record<string, string> = {
  task_mention: "Tarefa",
  chat_mention: "Chat do projeto",
  process_mention: "Processo",
};

function timeAgoPtBr(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.round(h / 24);
  return `há ${d}d`;
}

interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string | null;
  message: string | null;
  action_url: string | null;
  read: boolean;
  created_at: string;
}

const SECRET_HEADER = "x-cron-secret";

Deno.serve(secureHandler(
  { auth: "none", rateLimit: 5, rateLimitPrefix: "mencoes-digest" },
  async (req, _ctx) => {
    const cors = getCorsHeaders(req);

    // Proteção: apenas o cron (com secret) ou service-role pode disparar
    const cronSecret = Deno.env.get("MENCOES_DIGEST_CRON_SECRET");
    const provided = req.headers.get(SECRET_HEADER);
    const auth = req.headers.get("authorization") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const isService = serviceKey && auth === `Bearer ${serviceKey}`;
    if (!isService && (!cronSecret || provided !== cronSecret)) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Janela: últimas 24h
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: notifs, error } = await admin
      .from("notifications")
      .select("id,user_id,type,title,message,action_url,read,created_at")
      .in("type", MENCAO_TYPES)
      .eq("read", false)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Agrupa por user_id
    const byUser = new Map<string, NotificationRow[]>();
    for (const n of (notifs || []) as NotificationRow[]) {
      const arr = byUser.get(n.user_id) || [];
      arr.push(n);
      byUser.set(n.user_id, arr);
    }

    if (byUser.size === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Carrega perfis (email + nome) dos destinatários
    const userIds = Array.from(byUser.keys());
    const { data: profiles } = await admin
      .from("profiles")
      .select("id,email,nome")
      .in("id", userIds);

    const profileById = new Map<string, { email: string | null; nome: string | null }>();
    for (const p of (profiles || []) as Array<{ id: string; email: string | null; nome: string | null }>) {
      profileById.set(p.id, { email: p.email, nome: p.nome });
    }

    const today = new Date().toISOString().slice(0, 10);
    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const [userId, items] of byUser.entries()) {
      const profile = profileById.get(userId);
      if (!profile?.email) { skipped++; continue; }

      const ordered = items.slice(0, 20).map((n) => ({
        title: n.title || "Você foi mencionado",
        message: (n.message || "").substring(0, 200),
        url: n.action_url || "",
        context: CONTEXT_LABEL[n.type] || "Menção",
        ago: timeAgoPtBr(n.created_at),
      }));

      const idempotencyKey = `mencoes-digest-${userId}-${today}`;

      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            templateName: "mencoes-digest-diario",
            recipientEmail: profile.email,
            idempotencyKey,
            templateData: {
              recipientName: profile.nome?.split(" ")[0] || undefined,
              total: items.length,
              centralUrl: "https://bimaster.online/dashboard/projetos/central?tab=inbox&subtab=mencoes",
              itens: ordered,
            },
          }),
        });
        if (!resp.ok) {
          const txt = await resp.text();
          errors.push(`${userId}: ${resp.status} ${txt.substring(0, 120)}`);
        } else {
          await resp.text();
          sent++;
        }
      } catch (e) {
        errors.push(`${userId}: ${(e as Error).message}`);
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, skipped, total_users: byUser.size, errors }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  },
));
