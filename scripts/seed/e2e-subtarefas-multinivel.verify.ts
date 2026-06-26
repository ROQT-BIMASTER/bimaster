/**
 * Verificação pós-seed para os E2E de Subtarefas multi-nível.
 *
 * Confirma que o seed deixou o backend em um estado consistente antes
 * de executar o Playwright. Falha cedo (exit 1) com mensagem clara se
 * algum invariante não bater — evitando que a suíte gaste minutos para
 * morrer com erro genérico de "tarefa não encontrada".
 *
 * Invariantes checados:
 *  1. Owner e outsider existem no Auth (resolvíveis por e-mail).
 *  2. Projeto principal (E2E_PROJETO_ID) existe e pertence ao owner.
 *  3. Projeto secundário (E2E_OUTRO_PROJETO_ID) existe e pertence ao owner.
 *  4. Seção fixa (E2E_SECAO_ID) existe e pertence ao projeto principal.
 *  5. Tarefa fixa (E2E_OUTRO_PROJETO_TAREFA) existe e pertence ao projeto
 *     secundário (necessária para o teste de "parent em outro projeto").
 *  6. Owner é membro de AMBOS os projetos.
 *  7. Outsider NÃO é membro de nenhum dos dois (essencial para RLS).
 *  8. Não há tarefas "[e2e]%" residuais nos projetos (seed limpou).
 *
 * Requer as mesmas envs do seed (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * E2E_*).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  return v;
}

const errors: string[] = [];
function check(cond: unknown, msg: string) {
  if (!cond) errors.push(msg);
}

async function findUserId(admin: SupabaseClient, email: string): Promise<string | null> {
  let page = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find(
      (u) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
    );
    if (found) return found.id;
    if (data.users.length < 200) return null;
    page += 1;
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

  const ownerId = await findUserId(admin, ownerEmail);
  const outsiderId = await findUserId(admin, outsiderEmail);
  check(!!ownerId, `Owner (${ownerEmail}) não encontrado no Auth.`);
  check(!!outsiderId, `Outsider (${outsiderEmail}) não encontrado no Auth.`);

  // Projetos.
  const { data: projs, error: pErr } = await admin
    .from("projetos")
    .select("id, criador_id")
    .in("id", [projetoId, outroProjetoId]);
  if (pErr) throw pErr;
  const pPrincipal = projs?.find((p: any) => p.id === projetoId);
  const pSecundario = projs?.find((p: any) => p.id === outroProjetoId);
  check(!!pPrincipal, `Projeto principal ${projetoId} ausente.`);
  check(!!pSecundario, `Projeto secundário ${outroProjetoId} ausente.`);
  if (pPrincipal && ownerId) {
    check(
      (pPrincipal as any).criador_id === ownerId,
      `Projeto principal não pertence ao owner (criador_id=${(pPrincipal as any).criador_id}).`,
    );
  }
  if (pSecundario && ownerId) {
    check(
      (pSecundario as any).criador_id === ownerId,
      `Projeto secundário não pertence ao owner (criador_id=${(pSecundario as any).criador_id}).`,
    );
  }

  // Seção.
  const { data: secao, error: sErr } = await admin
    .from("projeto_secoes")
    .select("id, projeto_id")
    .eq("id", secaoId)
    .maybeSingle();
  if (sErr) throw sErr;
  check(!!secao, `Seção ${secaoId} ausente.`);
  if (secao) {
    check(
      (secao as any).projeto_id === projetoId,
      `Seção ${secaoId} pertence a outro projeto (${(secao as any).projeto_id}).`,
    );
  }

  // Tarefa fixa do outro projeto.
  const { data: tarefa, error: tErr } = await admin
    .from("projeto_tarefas")
    .select("id, projeto_id")
    .eq("id", outraTarefaId)
    .maybeSingle();
  if (tErr) throw tErr;
  check(!!tarefa, `Tarefa fixa ${outraTarefaId} ausente.`);
  if (tarefa) {
    check(
      (tarefa as any).projeto_id === outroProjetoId,
      `Tarefa fixa ${outraTarefaId} pertence a outro projeto (${(tarefa as any).projeto_id}).`,
    );
  }

  // Membresía.
  if (ownerId) {
    const { data: membros, error: mErr } = await admin
      .from("projeto_membros")
      .select("projeto_id, usuario_id")
      .eq("usuario_id", ownerId)
      .in("projeto_id", [projetoId, outroProjetoId]);
    if (mErr) throw mErr;
    check(
      !!membros?.find((m: any) => m.projeto_id === projetoId),
      `Owner não é membro do projeto principal.`,
    );
    check(
      !!membros?.find((m: any) => m.projeto_id === outroProjetoId),
      `Owner não é membro do projeto secundário.`,
    );
  }
  if (outsiderId) {
    const { data: outMembros, error: oErr } = await admin
      .from("projeto_membros")
      .select("projeto_id")
      .eq("usuario_id", outsiderId)
      .in("projeto_id", [projetoId, outroProjetoId]);
    if (oErr) throw oErr;
    check(
      (outMembros?.length ?? 0) === 0,
      `Outsider permanece membro de ${outMembros?.length} projeto(s) — RLS test vai falhar.`,
    );
  }

  // Lixo de runs anteriores.
  const { count: residuais, error: rErr } = await admin
    .from("projeto_tarefas")
    .select("id", { count: "exact", head: true })
    .in("projeto_id", [projetoId, outroProjetoId])
    .like("titulo", "[e2e]%")
    .neq("id", outraTarefaId);
  if (rErr) throw rErr;
  check(
    (residuais ?? 0) === 0,
    `Existem ${residuais} tarefas [e2e]% residuais — seed não limpou.`,
  );

  if (errors.length > 0) {
    console.error("[verify-subtarefas] FALHA — invariantes quebrados:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log("[verify-subtarefas] OK — todos os invariantes do seed satisfeitos.");
}

main().catch((err) => {
  console.error("[verify-subtarefas] Erro inesperado:", err);
  process.exit(1);
});
