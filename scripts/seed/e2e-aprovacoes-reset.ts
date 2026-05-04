/**
 * Reset determinístico para os testes E2E de Aprovações.
 *
 * Diferente de `e2e-aprovacoes.ts` (seed), este script **apenas apaga** dados
 * conhecidos do seed E2E para deixar o banco limpo antes de cada execução
 * em CI. Não toca em nenhum dado fora dos UUIDs fixos / prefixos do E2E.
 *
 * O que apaga (escopo estritamente E2E):
 *   1. Eventos da timeline com `comentario` começando por "Teste e2e CI"
 *      na instância fixa do seed.
 *   2. Eventos extras da instância fixa que NÃO sejam os 2 eventos do seed
 *      (evt1Id / evt2Id) — limpa qualquer ruído deixado por runs anteriores.
 *
 * O que NÃO apaga:
 *   - Projeto, pipeline, etapa, lote e item fixos do seed (gerenciados pela
 *     migration `*_seed_e2e_aprovacoes.sql`, idempotente).
 *   - Qualquer dado fora dos UUIDs fixos.
 *   - `user_roles` ou `profiles` do usuário de teste.
 *
 * Após esse reset, rode `e2e-aprovacoes.ts` (seed) para re-aplicar ownership.
 *
 * Requer:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * Uso:
 *   bun run scripts/seed/e2e-aprovacoes-reset.ts
 */
import { createClient } from "@supabase/supabase-js";

const FIXTURES = {
  instanciaId: "00000000-e2e0-0000-0000-000000000004",
  itemId: "00000000-e2e0-0000-0000-000000000005",
  evt1Id: "00000000-e2e0-0000-0000-000000000006",
  evt2Id: "00000000-e2e0-0000-0000-000000000007",
} as const;

const COMMENT_PREFIX = "Teste e2e CI";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  return v;
}

async function main() {
  const url = requireEnv("SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("[reset-e2e] Iniciando reset (escopo: somente fixtures E2E)…");

  // 1. Apaga comentários gerados por runs anteriores (prefixo conhecido).
  const { error: delPrefixErr, count: prefixCount } = await admin
    .from("fluxo_aprovacao_etapa_eventos")
    .delete({ count: "exact" })
    .eq("instancia_id", FIXTURES.instanciaId)
    .like("comentario", `${COMMENT_PREFIX}%`);

  if (delPrefixErr) {
    console.error(
      `[reset-e2e] Falha ao apagar comentários "${COMMENT_PREFIX}%": ${delPrefixErr.message}`,
    );
    process.exit(1);
  }
  console.log(
    `[reset-e2e] Comentários "${COMMENT_PREFIX}%" removidos: ${prefixCount ?? 0}`,
  );

  // 2. Apaga eventos extras da instância fixa que não sejam os 2 eventos do seed.
  const { error: delExtraErr, count: extraCount } = await admin
    .from("fluxo_aprovacao_etapa_eventos")
    .delete({ count: "exact" })
    .eq("instancia_id", FIXTURES.instanciaId)
    .not("id", "in", `(${FIXTURES.evt1Id},${FIXTURES.evt2Id})`);

  if (delExtraErr) {
    console.warn(
      `[reset-e2e] Limpeza de eventos extras falhou (segue): ${delExtraErr.message}`,
    );
  } else {
    console.log(`[reset-e2e] Eventos extras removidos: ${extraCount ?? 0}`);
  }

  console.log("[reset-e2e] OK — banco limpo no escopo E2E.");
}

main().catch((err) => {
  console.error("[reset-e2e] Falha:", err);
  process.exit(1);
});
