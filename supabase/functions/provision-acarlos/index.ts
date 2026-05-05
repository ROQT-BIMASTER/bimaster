// One-shot provisioning function. Idempotent. Delete after use.
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (_req) => {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const EMAIL = "a.carlos@rubyrosemaquiagem.com.br";
  const NOME = "Antônio Carlos";
  const PASSWORD = "RubyRose@2026!";
  const NATHALIA_ID = "f8b9a84e-67d2-449a-bc5a-3d15a9dfd379";
  const DEPARTAMENTO_ID = "8cce900f-2455-4ed3-9b3a-54a993de037f";

  const log: any = { steps: [] };

  // 1. Create or fetch auth user
  let userId: string | null = null;
  const createRes = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}`, "apikey": key },
    body: JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { nome: NOME, tipo_usuario: "gerente" },
    }),
  });
  const createBody = await createRes.json();
  if (createRes.ok) {
    userId = createBody.id;
    log.steps.push({ create_user: "ok", id: userId });
  } else {
    log.steps.push({ create_user: "exists_or_failed", body: createBody });
    // lookup
    const lookup = await fetch(`${url}/auth/v1/admin/users?filter=email.eq.${EMAIL}`, {
      headers: { "Authorization": `Bearer ${key}`, "apikey": key },
    });
    const lookupBody = await lookup.json();
    userId = lookupBody?.users?.[0]?.id ?? null;
    log.steps.push({ lookup: userId });
  }
  if (!userId) return new Response(JSON.stringify({ error: "no_user", log }), { status: 500 });

  // 2. Profile upsert
  const { error: pErr } = await admin
    .from("profiles")
    .update({ nome: NOME, departamento_id: DEPARTAMENTO_ID, aprovado: true, status: "ativo" })
    .eq("id", userId);
  log.steps.push({ profile: pErr ? pErr.message : "ok" });

  // 3. Role
  const { error: rErr } = await admin
    .from("user_roles")
    .upsert({ user_id: userId, role: "gerente" }, { onConflict: "user_id,role" });
  log.steps.push({ role: rErr ? rErr.message : "ok" });

  // 4. Replicate projeto_membros from Nathalia
  const { data: nathaliaLinks, error: nErr } = await admin
    .from("projeto_membros")
    .select("projeto_id, papel")
    .eq("user_id", NATHALIA_ID);
  if (nErr) {
    log.steps.push({ nathalia_links: nErr.message });
  } else {
    const rows = (nathaliaLinks ?? []).map((l: any) => ({
      user_id: userId,
      projeto_id: l.projeto_id,
      papel: l.papel,
    }));
    const { error: insErr, count } = await admin
      .from("projeto_membros")
      .upsert(rows, { onConflict: "projeto_id,user_id", count: "exact" });
    log.steps.push({ projeto_membros: insErr ? insErr.message : "ok", total: rows.length, count });
  }

  return new Response(JSON.stringify({ ok: true, user_id: userId, email: EMAIL, log }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
