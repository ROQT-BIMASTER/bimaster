/**
 * Regressão estática — Linha do Tempo (Fábrica China).
 *
 * Garante que a query de `china_produto_documentos` consumida pelo hook
 * `useDocsResumo` em `UnifiedSubmissionTimeline.tsx` NUNCA volte a referenciar
 * a coluna `updated_at` (que não existe na tabela). Esse era o bug que zerava
 * os contadores da timeline: o PostgREST devolvia 400, `rows` virava `[]` e o
 * resumo mostrava `0 aprovados / N pendentes` mesmo com documentos aprovados.
 *
 * Também valida que a ordenação usa `created_at` (única coluna temporal real
 * da tabela) e que o tipo `DocRow` interno reflete isso.
 *
 * Implementado como teste de TEXTO porque `useDocsResumo` é interno ao módulo
 * (não exportado). Esse formato é suficiente para travar a regressão e roda em
 * <50ms, sem precisar de mock de Supabase.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const FILE = resolve(
  __dirname,
  "..",
  "UnifiedSubmissionTimeline.tsx",
);
const SRC = readFileSync(FILE, "utf8");

// Bloco da query `china_produto_documentos` (~12 linhas). Capturamos do
// `.from("china_produto_documentos")` até a próxima chamada `.order(...)`,
// que fecha o builder dessa tabela.
const docsQueryMatch = SRC.match(
  /\.from\(\s*["']china_produto_documentos["']\s*\)[\s\S]*?\.order\([^)]*\)/,
);

describe("UnifiedSubmissionTimeline — query china_produto_documentos", () => {
  it("o bloco da query é localizável no arquivo", () => {
    expect(docsQueryMatch, "query .from('china_produto_documentos')...order() não encontrada").toBeTruthy();
  });

  it("NÃO seleciona a coluna inexistente `updated_at`", () => {
    const block = docsQueryMatch![0];
    expect(block).not.toMatch(/updated_at/);
  });

  it("ordena por `created_at` desc (única coluna temporal real)", () => {
    const block = docsQueryMatch![0];
    expect(block).toMatch(/\.order\(\s*["']created_at["']\s*,\s*\{\s*ascending:\s*false\s*\}\s*\)/);
  });

  it("o `select` lista `created_at` explicitamente", () => {
    const block = docsQueryMatch![0];
    const selectMatch = block.match(/\.select\(\s*["']([^"']+)["']\s*\)/);
    expect(selectMatch, ".select(...) não encontrado no bloco da query").toBeTruthy();
    const cols = selectMatch![1].split(",").map((c) => c.trim());
    expect(cols).toContain("created_at");
    expect(cols).not.toContain("updated_at");
  });
});

describe("UnifiedSubmissionTimeline — tipo DocRow", () => {
  // Extrai apenas o corpo da interface DocRow (entre `interface DocRow {` e `}`).
  const docRowMatch = SRC.match(/interface DocRow \{([\s\S]*?)\}/);

  it("interface DocRow é localizável", () => {
    expect(docRowMatch).toBeTruthy();
  });

  it("DocRow declara `created_at` e NÃO declara `updated_at`", () => {
    const body = docRowMatch![1];
    expect(body).toMatch(/created_at\s*:/);
    expect(body).not.toMatch(/updated_at\s*:/);
  });
});

describe("UnifiedSubmissionTimeline — fallback `ultimoEm`", () => {
  it("`ultimoEm` é derivado de `created_at` (nunca de `updated_at`)", () => {
    // Casa: `ultimoEm: rows[0]?.created_at ?? null,`
    expect(SRC).toMatch(/ultimoEm:\s*rows\[0\]\?\.created_at\s*\?\?\s*null/);
    // Garantia negativa: nenhum acesso `rows[0]?.updated_at` deve sobreviver.
    expect(SRC).not.toMatch(/rows\[0\]\?\.updated_at/);
  });
});
