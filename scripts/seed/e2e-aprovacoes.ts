/**
 * Seed/reset determinístico para os testes E2E de Aprovações.
 *
 * O que faz, em ordem:
 *  1. Resolve o user_id do E2E_TEST_EMAIL.
 *  2. Garante que ele tenha role 'user' (não toca em admin).
 *  3. Resolve o user_id do E2E_SUPERVISOR_EMAIL (opcional) e seta supervisor_id.
 *  4. Re-aponta os fixtures fixos (projeto/pipeline/lote/item/eventos) para esse usuário,
 *     de modo que ele veja os cards via RLS e o created_by bata com auth.uid() nas mutations.
 *  5. Apaga comentários gerados em runs anteriores (eventos com comentário começando
 *     com "Teste e2e CI") para tornar a timeline determinística.
 *
 * Requer:
 *  - SUPABASE_URL          (== VITE_SUPABASE_URL)
 *  - SUPABASE_SERVICE_ROLE_KEY
 *  - E2E_TEST_EMAIL
 *  - E2E_SUPERVISOR_EMAIL  (opcional)
 *
 * Uso local:
 *   bun run scripts/seed/e2e-aprovacoes.ts
 *
 * No CI: rodado como step antes do Playwright (ver .github/workflows/e2e-aprovacoes.yml).
 */
import { createClient } from "@supabase/supabase-js";

const FIXTURES = {
  projetoId: "00000000-e2e0-0000-0000-000000000001",
  configId: "00000000-e2e0-0000-0000-000000000002",
  etapaId: "00000000-e2e0-0000-0000-000000000003",
  instanciaId: "00000000-e2e0-0000-0000-000000000004",
  itemId: "00000000-e2e0-0000-0000-000000000005",
  evt1Id: "00000000-e2e0-0000-0000-000000000006",
  evt2Id: "00000000-e2e0-0000-0000-000000000007",
} as const;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  return v;
}

async function getUserIdByEmail(
  admin: ReturnType<typeof createClient>,
  email: string,
): Promise<string> {
  // listUsers pagina; para o seed, percorrer até achar.
  let page = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const found = data.users.find(
      (u) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
    );
    if (found) return found.id;
    if (data.users.length < 200) {
      throw new Error(`Usuário não encontrado: ${email}`);
    }
    page += 1;
  }
}

async function main() {
  const url = requireEnv("SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const testEmail = requireEnv("E2E_TEST_EMAIL");
  const supervisorEmail = process.env.E2E_SUPERVISOR_EMAIL ?? null;

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const userId = await getUserIdByEmail(admin, testEmail);
  console.log(`[seed-e2e] Usuário de teste: ${testEmail} → ${userId}`);

  // 2. Garante role básica (não cria admin).
  await admin.from("user_roles").upsert(
    { user_id: userId, role: "user" },
    { onConflict: "user_id,role", ignoreDuplicates: true },
  );

  // 3. Supervisor opcional.
  if (supervisorEmail) {
    const supId = await getUserIdByEmail(admin, supervisorEmail);
    console.log(`[seed-e2e] Supervisor: ${supervisorEmail} → ${supId}`);
    const { error: supErr } = await admin
      .from("profiles")
      .update({ supervisor_id: supId })
      .eq("id", userId);
    if (supErr) console.warn(`[seed-e2e] supervisor_id não setado: ${supErr.message}`);
  }

  // 4. Re-aponta ownership dos fixtures.
  const updates: Array<readonly [string, Record<string, unknown>, Record<string, unknown>]> = [
    ["projetos", { id: FIXTURES.projetoId }, { criador_id: userId }],
    ["fluxo_aprovacao_config", { id: FIXTURES.configId }, { created_by: userId }],
    [
      "fluxo_aprovacao_instancias",
      { id: FIXTURES.instanciaId },
      { created_by: userId },
    ],
    [
      "aprovacao_documento_itens",
      { id: FIXTURES.itemId },
      { created_by: userId, responsavel_atual_id: userId },
    ],
    [
      "fluxo_aprovacao_etapa_eventos",
      { id: FIXTURES.evt1Id },
      { responsavel_id: userId, decidido_por: userId },
    ],
    [
      "fluxo_aprovacao_etapa_eventos",
      { id: FIXTURES.evt2Id },
      { responsavel_id: userId },
    ],
  ];

  for (const [table, match, patch] of updates) {
    const { error } = await admin.from(table).update(patch).match(match);
    if (error) {
      console.warn(
        `[seed-e2e] update ${table} ${JSON.stringify(match)} falhou: ${error.message}`,
      );
    }
  }

  // Garante membresía no projeto fixo (se a tabela existir).
  const { error: memErr } = await admin
    .from("projeto_membros")
    .upsert(
      { projeto_id: FIXTURES.projetoId, usuario_id: userId, papel: "owner" },
      { onConflict: "projeto_id,usuario_id", ignoreDuplicates: true },
    );
  if (memErr) {
    console.warn(`[seed-e2e] projeto_membros: ${memErr.message}`);
  }

  // 5. Limpa comentários de runs anteriores na instância fixa.
  const { error: delErr, count } = await admin
    .from("fluxo_aprovacao_etapa_eventos")
    .delete({ count: "exact" })
    .eq("instancia_id", FIXTURES.instanciaId)
    .like("comentario", "Teste e2e CI%");
  if (delErr) {
    console.warn(`[seed-e2e] limpeza de comentários falhou: ${delErr.message}`);
  } else {
    console.log(`[seed-e2e] Comentários de runs anteriores removidos: ${count ?? 0}`);
  }

  console.log("[seed-e2e] OK — ambiente determinístico pronto.");
}

main().catch((err) => {
  console.error("[seed-e2e] Falha:", err);
  process.exit(1);
});
