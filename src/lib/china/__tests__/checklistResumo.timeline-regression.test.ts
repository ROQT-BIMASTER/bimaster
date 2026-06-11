/**
 * Regressão Linha do Tempo × Caixa de Entrada — contadores não zerados.
 *
 * Cobre o bug específico do produto "Compact Powder código 1":
 *   - 1 documento ("Cores do Produto") aprovado na Caixa de Entrada.
 *   - Linha do Tempo mostrava `0 aprovados / 11 pendentes` porque o hook
 *     `useDocsResumo` consultava a coluna inexistente `updated_at` e o
 *     PostgREST devolvia 400 → `rows` virava `[]`.
 *
 * Aqui validamos o CONTRATO da função pura `summarizeChecklistResumo`, que é
 * a fonte de verdade dos contadores: dado um conjunto de `ChecklistDocRow`
 * SEM o campo `updated_at` (porque a tabela real não tem essa coluna), o
 * resumo continua produzindo `aprovados >= 1` e `pendentes === total - 1`.
 *
 * Se alguém voltar a depender de `updated_at` em `ChecklistDocRow` ou na
 * lógica de classificação, esse teste explode imediatamente.
 */
import { describe, it, expect } from "vitest";
import {
  summarizeChecklistResumo,
  type ChecklistDocRow,
} from "../checklistResumo";
import {
  computeExpectedChecklist,
  DEFAULT_EXPECTED_TOTAL,
} from "../mergeChecklist";

const expectedFull = computeExpectedChecklist([], [], []);

describe("contadores da timeline — sem updated_at (regressão Compact Powder)", () => {
  it("doc aprovado SEM updated_at conta como 1 aprovado e 1 enviado", () => {
    // Linha como ela vem da nova query: só `created_at`, sem `updated_at`.
    const rows: ChecklistDocRow[] = [
      { tipo_documento: "cores_produto", status: "aprovado", created_at: "2026-06-10T12:00:00Z" },
    ];
    const r = summarizeChecklistResumo(rows, expectedFull);
    expect(r.aprovados).toBe(1);
    expect(r.enviados).toBe(1);
    expect(r.pendentes).toBe(r.total - 1);
    // Invariante reforçada — nunca volta a aparecer "0 aprovados" quando há doc aprovado.
    expect(r.aprovados).toBeGreaterThan(0);
  });

  it("11 itens de checklist com 1 aprovado → 1 aprovado / 10 pendentes (cenário Compact Powder)", () => {
    const tipos = Array.from(expectedFull.tipos).slice(0, 11);
    const exp = {
      ...expectedFull,
      tipos: new Set(tipos),
      total: 11,
      tiposChinaEnvia: new Set(tipos),
      tiposBrasilEnvia: new Set<string>(),
    };
    const rows: ChecklistDocRow[] = [
      { tipo_documento: tipos[0], status: "aprovado", created_at: "2026-06-10T12:00:00Z" },
    ];
    const r = summarizeChecklistResumo(rows, exp);
    expect(r.total).toBe(11);
    expect(r.aprovados).toBe(1);
    expect(r.enviados).toBe(1);
    expect(r.pendentes).toBe(10);
  });

  it("rows vazias (query falhou) NÃO devem produzir resumo zerado silenciosamente: pendentes == total", () => {
    // Se a query retornar [] por erro de schema, o resumo agora deve indicar
    // total pendente — mas o total esperado continua ≥ 1, então pelo menos a
    // soma fecha. Esse teste documenta esse comportamento defensivo.
    const r = summarizeChecklistResumo([], expectedFull);
    expect(r.pendentes).toBe(r.total);
    expect(r.aprovados).toBe(0);
    expect(r.enviados).toBe(0);
    expect(r.total).toBe(DEFAULT_EXPECTED_TOTAL);
  });
});
