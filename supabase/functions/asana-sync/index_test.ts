// Testes leves para garantir que o código de reconciliação de followers
// na edge `asana-sync` continua executando o upsert mesmo quando a tarefa
// não foi modificada (modified_at idêntico).
//
// Este teste valida a INVARIANTE: o loop de followers fica FORA do bloco
// `if (!unchanged) { ... }`. Se alguém regredir movendo o loop para dentro
// do bloco, o teste falha.
import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SOURCE = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

Deno.test("followers loop runs unconditionally (not gated by 'unchanged')", () => {
  // Encontra a posição do bloco condicional 'if (!unchanged)' que envolve só o update da tarefa
  const unchangedBlock = SOURCE.match(/if\s*\(\s*!unchanged\s*\)\s*{[\s\S]*?}\s*\n/);
  assert(unchangedBlock, "Bloco 'if (!unchanged)' não encontrado");

  const followersIdx = SOURCE.indexOf("projeto_tarefa_seguidores");
  assert(followersIdx > -1, "Referência a projeto_tarefa_seguidores não encontrada");

  const blockStart = unchangedBlock.index!;
  const blockEnd = blockStart + unchangedBlock[0].length;
  // O upsert de seguidores DEVE estar fora desse bloco
  assert(
    followersIdx < blockStart || followersIdx > blockEnd,
    "REGRESSÃO: upsert de projeto_tarefa_seguidores está dentro do bloco 'if (!unchanged)' — " +
    "isso impede a reconciliação de seguidores quando modified_at não muda no Asana.",
  );
});

Deno.test("collaborators upsert runs unconditionally", () => {
  const unchangedBlock = SOURCE.match(/if\s*\(\s*!unchanged\s*\)\s*{[\s\S]*?}\s*\n/)!;
  const colabIdx = SOURCE.indexOf("projeto_tarefa_colaboradores");
  assert(colabIdx > -1, "Referência a projeto_tarefa_colaboradores não encontrada");
  const blockStart = unchangedBlock.index!;
  const blockEnd = blockStart + unchangedBlock[0].length;
  assert(
    colabIdx < blockStart || colabIdx > blockEnd,
    "REGRESSÃO: upsert de colaboradores ficou gated por 'unchanged'",
  );
});

Deno.test("orphan GID mapping by email is present", () => {
  // Garante que ainda existe o passo que mapeia usuários Asana para profiles via email
  assert(
    /asanaUsers[\s\S]{0,200}email/.test(SOURCE),
    "Lógica de mapeamento de usuários Asana por email foi removida",
  );
});
