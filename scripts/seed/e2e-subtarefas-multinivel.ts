/**
 * Seed/reset determinístico para os E2E de Subtarefas multi-nível.
 *
 * Garante, de forma idempotente, o ambiente esperado pelos specs
 * `e2e/projetos/subtarefas-multinivel*.spec.ts`:
 *
 *  1. Resolve user_ids de E2E_TEST_EMAIL (owner) e E2E_OUTSIDER_EMAIL.
 *  2. Garante role 'user' para ambos (sem mexer em admin).
 *  3. Garante que os projetos fixos do seed (E2E_PROJETO_ID e
 *     E2E_OUTRO_PROJETO_ID) existem e pertencem ao owner.
 *  4. Garante seção fixa (E2E_SECAO_ID) no PROJETO_ID.
 *  5. Garante tarefa fixa (E2E_OUTRO_PROJETO_TAREFA) no OUTRO projeto.
 *  6. Garante ownership/membresía: owner é membro de AMBOS os projetos;
 *     OUTSIDER é REMOVIDO explicitamente dos dois (essencial para o
 *     teste de RLS — se ficar como membro, a suíte de hardening falha).
 *  7. Reset: apaga tarefas com título prefixado "[e2e]" nos dois projetos
 *     (limpa lixo de runs anteriores sem tocar em dados reais).
 *
 * Não cria usuários — eles já devem existir no Auth (gerenciados manualmente
 * fora do CI). Falha cedo com mensagem clara se algo estiver faltando.
 *
 * Requer:
 *  - SUPABASE_URL                 (== VITE_SUPABASE_URL)
 *  - SUPABASE_SERVICE_ROLE_KEY
 *  - E2E_TEST_EMAIL
 *  - E2E_OUTSIDER_EMAIL
 *  - E2E_PROJETO_ID               UUID do projeto principal
 *  - E2E_SECAO_ID                 UUID da seção dentro do projeto principal
 *  - E2E_OUTRO_PROJETO_ID         UUID do segundo projeto (cross-project test)
 *  - E2E_OUTRO_PROJETO_TAREFA     UUID da tarefa no segundo projeto
 *
 * Uso local:
 *   bun run scripts/seed/e2e-subtarefas-multinivel.ts
 *
 * No CI: rodado como step antes do Playwright
 * (ver .github/workflows/e2e-subtarefas-multinivel.yml).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  return v;
}

async function getUserIdByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<string> {
  let page = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find(
      (u) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
    );
    if (found) return found.id;
    if (data.users.length < 200) {
      throw new Error(`Usuário não encontrado no Auth: ${email}`);
    }
    page += 1;
  }
}

async function ensureRoleUser(admin: SupabaseClient, userId: string) {
  await admin.from("user_roles").upsert(
    { user_id: userId, role: "user" },
    { onConflict: "user_id,role", ignoreDuplicates: true },
  );
}

async function ensureProjeto(
  admin: SupabaseClient,
  id: string,
  ownerId: string,
  nome: string,
) {
  const { error } = await admin.from("projetos").upsert(
    { id, nome, criador_id: ownerId },
    { onConflict: "id" },
  );
  if (error) {
    console.warn(`[seed-subtarefas] upsert projeto ${id} falhou: ${error.message}`);
  }
}

async function ensureSecao(
  admin: SupabaseClient,
  id: string,
  projetoId: string,
) {
  const { error } = await admin.from("projeto_secoes").upsert(
    { id, projeto_id: projetoId, titulo: "[e2e] Seção fixa" },
    { onConflict: "id" },
  );
  if (error) {
    console.warn(`[seed-subtarefas] upsert seção ${id} falhou: ${error.message}`);
  }
}

async function ensureTarefa(
  admin: SupabaseClient,
  id: string,
  projetoId: string,
) {
  const { error } = await admin.from("projeto_tarefas").upsert(
    { id, projeto_id: projetoId, titulo: "[e2e] Tarefa fixa (outro projeto)" },
    { onConflict: "id" },
  );
  if (error) {
    console.warn(`[seed-subtarefas] upsert tarefa ${id} falhou: ${error.message}`);
  }
}

async function ensureMembro(
  admin: SupabaseClient,
  projetoId: string,
  userId: string,
) {
  const { error } = await admin.from("projeto_membros").upsert(
    { projeto_id: projetoId, usuario_id: userId, papel: "owner" },
    { onConflict: "projeto_id,usuario_id", ignoreDuplicates: true },
  );
  if (error) console.warn(`[seed-subtarefas] membro ${userId}@${projetoId}: ${error.message}`);
}

async function removeMembro(
  admin: SupabaseClient,
  projetoId: string,
  userId: string,
) {
  const { error } = await admin
    .from("projeto_membros")
    .delete()
    .eq("projeto_id", projetoId)
    .eq("usuario_id", userId);
  if (error) {
    console.warn(`[seed-subtarefas] remover membro ${userId}@${projetoId}: ${error.message}`);
  }
}

async function limparTarefasE2E(admin: SupabaseClient, projetoIds: string[]) {
  const { error, count } = await admin
    .from("projeto_tarefas")
    .delete({ count: "exact" })
    .in("projeto_id", projetoIds)
    .like("titulo", "[e2e]%");
  if (error) {
    console.warn(`[seed-subtarefas] limpeza de tarefas [e2e]%: ${error.message}`);
  } else {
    console.log(`[seed-subtarefas] Tarefas [e2e]% removidas: ${count ?? 0}`);
  }
}

async function main() {
  const url = requireEnv("SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const ownerEmail = requireEnv("E2E_TEST_EMAIL");
  const outsiderEmail = requireEnv("E2E_OUTSIDER_EMAIL");
  const projetoId = requireEnv("E2E_PROJETO_ID");
  const secaoId = requireEnv("E2E_SECAO_ID");
  const outroProjetoId = requireEnv("E2E_OUTRO_PROJETO_ID");
  const outraTarefaId = requireEnv("E2E_OUTRO_PROJETO_TAREFA");

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const ownerId = await getUserIdByEmail(admin, ownerEmail);
  const outsiderId = await getUserIdByEmail(admin, outsiderEmail);
  console.log(`[seed-subtarefas] owner    = ${ownerEmail} → ${ownerId}`);
  console.log(`[seed-subtarefas] outsider = ${outsiderEmail} → ${outsiderId}`);

  await ensureRoleUser(admin, ownerId);
  await ensureRoleUser(admin, outsiderId);

  // Projetos e seção fixos.
  await ensureProjeto(admin, projetoId, ownerId, "[e2e] Projeto principal");
  await ensureProjeto(admin, outroProjetoId, ownerId, "[e2e] Projeto secundário");
  await ensureSecao(admin, secaoId, projetoId);
  await ensureTarefa(admin, outraTarefaId, outroProjetoId);

  // Ownership / membresía.
  await ensureMembro(admin, projetoId, ownerId);
  await ensureMembro(admin, outroProjetoId, ownerId);
  // Outsider NÃO pode ser membro de nenhum dos dois (essencial para RLS test).
  await removeMembro(admin, projetoId, outsiderId);
  await removeMembro(admin, outroProjetoId, outsiderId);

  // Reset de tarefas geradas em runs anteriores.
  await limparTarefasE2E(admin, [projetoId, outroProjetoId]);

  console.log("[seed-subtarefas] OK — ambiente determinístico pronto.");
}

main().catch((err) => {
  console.error("[seed-subtarefas] Falha:", err);
  process.exit(1);
});
