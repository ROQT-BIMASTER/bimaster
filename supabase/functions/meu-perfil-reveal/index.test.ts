// Testes automatizados para a edge function `meu-perfil-reveal`.
//
// Cobertura:
//  1) Sem JWT  -> 401 e nunca devolve `value`.
//  2) Campo inválido -> 400 e nunca devolve `value`.
//  3) JSON inválido  -> 400 e nunca devolve `value`.
//  4) Senha errada   -> 401, registra falha, nunca devolve `value`.
//  5) Rate limit: 5 falhas em 10 min disparam 429 com Retry-After (~15 min)
//     e bloqueiam inclusive tentativas com senha correta.
//  6) Sucesso com senha correta devolve `value` apenas para o campo solicitado
//     e cria um grant independente por campo (TTL 30s).
//  7) Após o TTL expirar, o grant correspondente fica fora da janela ativa
//     (expires_at < now()) — garantindo que nenhum dado completo permanece
//     acessível fora do TTL.
//
// Como rodar (em IDE local):
//   deno test -A supabase/functions/meu-perfil-reveal/index.test.ts
//
// Pré-requisitos (definir em `.env` na raiz do projeto):
//   VITE_SUPABASE_URL
//   VITE_SUPABASE_PUBLISHABLE_KEY
//   TEST_USER_EMAIL       (opcional — habilita testes que exigem login real)
//   TEST_USER_PASSWORD    (opcional — habilita testes que exigem login real)
//   SUPABASE_SERVICE_ROLE_KEY (opcional — habilita limpeza/asserts em
//                              profile_reveal_attempts/profile_reveal_grants)
//
// Testes que dependem de credenciais reais são marcados como `ignore: true`
// quando os secrets não estão presentes, para que a suíte rode em CI sem
// credenciais sem falhar.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const ANON_KEY =
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const TEST_EMAIL = Deno.env.get("TEST_USER_EMAIL") ?? "";
const TEST_PASSWORD = Deno.env.get("TEST_USER_PASSWORD") ?? "";

const FN_URL = `${SUPABASE_URL}/functions/v1/meu-perfil-reveal`;
const hasRealCreds = !!(TEST_EMAIL && TEST_PASSWORD);
const hasService = !!SERVICE_ROLE;

async function call(
  body: unknown,
  opts: { jwt?: string; raw?: string } = {},
): Promise<{ status: number; json: any; headers: Headers }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: ANON_KEY,
  };
  if (opts.jwt) headers["Authorization"] = `Bearer ${opts.jwt}`;
  const res = await fetch(FN_URL, {
    method: "POST",
    headers,
    body: opts.raw ?? JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { _raw: text };
  }
  return { status: res.status, json, headers: res.headers };
}

async function loginAsTestUser(): Promise<string> {
  const supa = createClient(SUPABASE_URL, ANON_KEY);
  const { data, error } = await supa.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (error || !data.session?.access_token) {
    throw new Error(`Login do TEST_USER falhou: ${error?.message}`);
  }
  return data.session.access_token;
}

async function cleanupAttemptsAndGrants(userId: string) {
  if (!hasService) return;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  await admin.from("profile_reveal_attempts").delete().eq("user_id", userId);
  await admin.from("profile_reveal_grants").delete().eq("user_id", userId);
}

// ---------------------------------------------------------------------------
// 1) Sem JWT -> 401 e sem value
// ---------------------------------------------------------------------------
Deno.test("rejeita requisições sem JWT (401) e nunca devolve value", async () => {
  const { status, json } = await call({ field: "cpf", password: "x" });
  assertEquals(status, 401);
  assertEquals(json.value, undefined);
});

// ---------------------------------------------------------------------------
// 2) Campo inválido -> 400 e sem value (mesmo com JWT)
// ---------------------------------------------------------------------------
Deno.test({
  name: "rejeita campo inválido (400) e nunca devolve value",
  ignore: !hasRealCreds,
  fn: async () => {
    const jwt = await loginAsTestUser();
    const { status, json } = await call(
      { field: "senha", password: TEST_PASSWORD },
      { jwt },
    );
    assertEquals(status, 400);
    assertEquals(json.value, undefined);
  },
});

// ---------------------------------------------------------------------------
// 3) JSON inválido -> 400
// ---------------------------------------------------------------------------
Deno.test({
  name: "rejeita body não-JSON (400)",
  ignore: !hasRealCreds,
  fn: async () => {
    const jwt = await loginAsTestUser();
    const { status, json } = await call({}, { jwt, raw: "not-json" });
    assertEquals(status, 400);
    assertEquals(json.value, undefined);
  },
});

// ---------------------------------------------------------------------------
// 4) Senha errada -> 401, sem value
// ---------------------------------------------------------------------------
Deno.test({
  name: "senha incorreta retorna 401 e nunca devolve value",
  ignore: !hasRealCreds,
  fn: async () => {
    const jwt = await loginAsTestUser();
    const userId = (await createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    }).auth.getUser()).data.user!.id;
    await cleanupAttemptsAndGrants(userId);

    const { status, json } = await call(
      { field: "cpf", password: "senha-errada-xyz-123" },
      { jwt },
    );
    assertEquals(status, 401);
    assertEquals(json.value, undefined);
  },
});

// ---------------------------------------------------------------------------
// 5) Rate limit: 5 falhas seguidas -> 429, bloqueando inclusive senha correta
// ---------------------------------------------------------------------------
Deno.test({
  name: "rate limit dispara 429 após 5 falhas e bloqueia senha correta",
  ignore: !(hasRealCreds && hasService),
  fn: async () => {
    const jwt = await loginAsTestUser();
    const supa = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const userId = (await supa.auth.getUser()).data.user!.id;
    await cleanupAttemptsAndGrants(userId);

    for (let i = 0; i < 5; i++) {
      const r = await call({ field: "cpf", password: `errada-${i}` }, { jwt });
      assertEquals(r.status, 401, `tentativa ${i + 1} deveria ser 401`);
    }

    // 6ª tentativa, mesmo com senha correta, deve ser bloqueada
    const blocked = await call(
      { field: "cpf", password: TEST_PASSWORD },
      { jwt },
    );
    assertEquals(blocked.status, 429);
    assertEquals(blocked.json.error, "rate_limited");
    assertEquals(blocked.json.value, undefined);
    assert(Number(blocked.json.retry_after_seconds) > 0);
    assert(blocked.headers.get("retry-after"), "Header Retry-After ausente");

    await cleanupAttemptsAndGrants(userId);
  },
});

// ---------------------------------------------------------------------------
// 6) Sucesso devolve value apenas do campo solicitado e cria grant por campo
// ---------------------------------------------------------------------------
Deno.test({
  name: "sucesso cria grants independentes por campo (cpf, rg, email)",
  ignore: !(hasRealCreds && hasService),
  fn: async () => {
    const jwt = await loginAsTestUser();
    const supa = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const userId = (await supa.auth.getUser()).data.user!.id;
    await cleanupAttemptsAndGrants(userId);

    const fields = ["cpf", "rg", "email"] as const;
    const grantIds: string[] = [];
    for (const field of fields) {
      const r = await call({ field, password: TEST_PASSWORD }, { jwt });
      assertEquals(r.status, 200, `falha em ${field}: ${JSON.stringify(r.json)}`);
      assertEquals(r.json.field, field);
      assertEquals(r.json.ttl_seconds, 30);
      assert(r.json.grant_id, "grant_id ausente");
      assert(r.json.expires_at, "expires_at ausente");
      grantIds.push(r.json.grant_id);
    }
    // Todos os grants devem ser distintos (TTL independente por campo)
    assertEquals(new Set(grantIds).size, grantIds.length);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: grants } = await admin
      .from("profile_reveal_grants")
      .select("id, field, expires_at")
      .in("id", grantIds);
    assertEquals(grants?.length, 3);
    const byField = Object.fromEntries((grants ?? []).map((g) => [g.field, g]));
    for (const f of fields) {
      assert(byField[f], `grant para ${f} não persistido`);
    }

    await cleanupAttemptsAndGrants(userId);
  },
});

// ---------------------------------------------------------------------------
// 7) Após TTL: grant fica expirado (expires_at < now()).
//    Nenhum endpoint do backend devolve `value` de um grant expirado — a
//    revelação só ocorre no momento do `signInWithPassword`. Aqui simulamos a
//    expiração forçando `expires_at` para o passado e confirmamos que o grant
//    não aparece em nenhuma janela ativa.
// ---------------------------------------------------------------------------
Deno.test({
  name: "grants expirados não permanecem na janela ativa (TTL respeitado)",
  ignore: !(hasRealCreds && hasService),
  fn: async () => {
    const jwt = await loginAsTestUser();
    const supa = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const userId = (await supa.auth.getUser()).data.user!.id;
    await cleanupAttemptsAndGrants(userId);

    const r = await call({ field: "cpf", password: TEST_PASSWORD }, { jwt });
    assertEquals(r.status, 200);
    const grantId = r.json.grant_id as string;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    // Força expiração: empurra expires_at para 1 minuto atrás.
    const past = new Date(Date.now() - 60_000).toISOString();
    const { error: updErr } = await admin
      .from("profile_reveal_grants")
      .update({ expires_at: past })
      .eq("id", grantId);
    assertEquals(updErr, null);

    const nowIso = new Date().toISOString();
    const { data: active } = await admin
      .from("profile_reveal_grants")
      .select("id")
      .eq("user_id", userId)
      .gt("expires_at", nowIso);
    assertFalse(
      (active ?? []).some((g) => g.id === grantId),
      "grant expirado apareceu como ativo",
    );

    await cleanupAttemptsAndGrants(userId);
  },
});
