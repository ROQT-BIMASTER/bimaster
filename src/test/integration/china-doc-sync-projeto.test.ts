/**
 * Regressão — sincronização de documentos da submissão China com o projeto.
 *
 * Garantias verificadas em nível de contrato (sem rede):
 *  - existe hook dedicado que chama a RPC de sincronização;
 *  - o hook invalida as queries de vínculos/tarefas após sincronizar;
 *  - a ação está exposta no painel de Vincular China e no cabeçalho do projeto.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("China — sincronização de documentos com o projeto", () => {
  const hook = read("src/hooks/useSincronizarDocsProjeto.ts");
  const painel = read("src/components/china/VincularChinaSidePanel.tsx");
  const header = read("src/components/projetos/ProjetoHeader.tsx");

  it("usa a RPC unificada de sincronização", () => {
    expect(hook).toContain('"rpc_china_sincronizar_documentos_projeto"');
    expect(hook).toContain("p_submissao_id");
  });

  it("invalida as queries de vínculos e tarefas após sincronizar", () => {
    expect(hook).toContain('queryKey: ["china-doc-vinculos"]');
    expect(hook).toContain('queryKey: ["china-docs-da-tarefa"]');
    expect(hook).toContain('queryKey: ["projeto-tarefas"]');
  });

  it("expõe a ação no painel de Vincular China", () => {
    expect(painel).toContain("useSincronizarDocsProjeto");
    expect(painel).toContain("sincronizarDocs.mutate(submissao.id)");
  });

  it("expõe a ação no cabeçalho do projeto-espelho", () => {
    expect(header).toContain("useSincronizarDocsProjeto");
    expect(header).toContain("sincronizarDocs.mutate(submissaoId)");
  });
});
