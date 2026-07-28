/**
 * Regressão — modelo de checklist padrão do sistema (módulo China).
 *
 * Garantias verificadas em nível de contrato (sem rede):
 *  - o hook expõe `is_padrao` e ordena o padrão primeiro;
 *  - a mutation de definição usa a RPC `set_template_checklist_padrao`;
 *  - a UI do modo foco bloqueia exclusão do modelo padrão.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("China — modelo de checklist padrão do sistema", () => {
  const hook = read("src/hooks/useChinaDocChecklistTemplates.ts");
  const ui = read("src/components/china/ChinaChecklistFocusMode.tsx");

  it("expõe is_padrao no tipo do modelo", () => {
    expect(hook).toMatch(/is_padrao:\s*boolean/);
  });

  it("ordena o modelo padrão primeiro na listagem", () => {
    expect(hook).toContain('.order("is_padrao", { ascending: false })');
  });

  it("define o padrão via RPC controlada no backend", () => {
    expect(hook).toContain('rpc("set_template_checklist_padrao"');
    expect(hook).toMatch(/export function useSetTemplatePadrao/);
  });

  it("não permite excluir o modelo padrão pela interface", () => {
    expect(ui).toContain("disabled={tpl.is_padrao}");
    expect(ui).toContain("if (tpl.is_padrao) return;");
  });

  it("sinaliza o modelo padrão com badge dedicada", () => {
    expect(ui).toContain("Padrão do sistema");
  });
});
