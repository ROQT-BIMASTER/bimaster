// insider-threat: KPIs e operações administrativas do programa anti-insider.
// Operações: metrics | jit_list | jit_decide | reviews_list | review_open | review_decide
//          | seed_honeytokens | exports_recent | honey_hits
import { secureHandler } from "../_shared/secure-handler.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

function svcClient(authHeader?: string) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    authHeader ? { global: { headers: { Authorization: authHeader } } } : undefined,
  );
}

// User-context client to enforce admin via has_role inside RPC (auth.uid()).
function userClient(authHeader: string) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
}

Deno.serve(secureHandler(
  async (req, ctx) => {
    const authHeader = req.headers.get("authorization") || "";
    const sb = userClient(authHeader);
    const url = new URL(req.url);
    const op = url.searchParams.get("op") || (req.method === "POST" ? (await req.clone().json().catch(() => ({}))).op : null);

    if (!op) return Response.json({ error: "missing_op" }, { status: 400 });

    if (op === "metrics") {
      const { data, error } = await sb.rpc("insider_threat_metrics");
      if (error) return Response.json({ error: error.message }, { status: 403 });
      return Response.json(data);
    }

    if (op === "jit_list") {
      // admin sees all, requester sees own (RLS already enforces)
      const status = url.searchParams.get("status") || "pending";
      const { data, error } = await sb
        .from("jit_access_requests")
        .select("*")
        .eq("status", status)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) return Response.json({ error: error.message }, { status: 400 });
      return Response.json({ items: data });
    }

    if (op === "jit_decide") {
      const body = await req.json();
      const { request_id, decision, reason } = body;
      const { data, error } = await sb.rpc("jit_approve", {
        _request_id: request_id, _decision: decision, _reason: reason ?? null,
      });
      if (error) return Response.json({ error: error.message }, { status: 400 });
      return Response.json(data);
    }

    if (op === "reviews_list") {
      const { data: cycles, error: e1 } = await sb
        .from("access_review_cycles")
        .select("*")
        .order("opened_at", { ascending: false })
        .limit(20);
      if (e1) return Response.json({ error: e1.message }, { status: 400 });
      const cycleId = url.searchParams.get("cycle_id") || cycles?.[0]?.id;
      let items: any[] = [];
      if (cycleId) {
        const { data } = await sb
          .from("access_review_items")
          .select("*")
          .eq("cycle_id", cycleId)
          .order("created_at", { ascending: false });
        items = data ?? [];
      }
      return Response.json({ cycles, items, current_cycle_id: cycleId });
    }

    if (op === "review_open") {
      const body = await req.json().catch(() => ({}));
      const label = body.label || `Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}`;
      const { data, error } = await sb.rpc("access_review_open", { _label: label });
      if (error) return Response.json({ error: error.message }, { status: 403 });
      return Response.json({ cycle_id: data });
    }

    if (op === "review_decide") {
      const { item_id, decision, notes } = await req.json();
      const { error } = await sb.rpc("access_review_decide", {
        _item_id: item_id, _decision: decision, _notes: notes ?? null,
      });
      if (error) return Response.json({ error: error.message }, { status: 400 });
      return Response.json({ ok: true });
    }

    if (op === "seed_honeytokens") {
      const { data, error } = await sb.rpc("honeytokens_seed");
      if (error) return Response.json({ error: error.message }, { status: 403 });
      return Response.json(data);
    }

    if (op === "exports_recent") {
      const { data, error } = await sb
        .from("export_receipts")
        .select("id, user_id, scope, row_count, file_format, is_massive, ip_address, created_at, receipt_token")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) return Response.json({ error: error.message }, { status: 400 });
      return Response.json({ items: data });
    }

    if (op === "honey_hits") {
      const { data, error } = await sb
        .from("honeytoken_hits")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) return Response.json({ error: error.message }, { status: 400 });
      return Response.json({ items: data });
    }

    return Response.json({ error: "unknown_op" }, { status: 400 });
  },
  {
    auth: "jwt",
    rateLimit: { requests: 60, windowSeconds: 60 },
  },
));
