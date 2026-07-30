/**
 * Regressão — indicadores de documentos no quadro (Kanban) e reorganização.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("Kanban — indicadores de documentos das tarefas", () => {
  const hook = read("src/hooks/useTarefasAnexos.ts");
  const badge = read("src/components/projetos/TarefaAnexosBadge.tsx");
  const kanban = read("src/components/projetos/ProjetoKanbanView.tsx");
  const reparo = read("src/hooks/useRepararDocsProjeto.ts");

  it("agrega anexos da tarefa e documentos China sem duplicar", () => {
    expect(hook).toContain('from("projeto_tarefa_anexos")');
    expect(hook).toContain('china_documento_tarefa_vinculos');
    expect(hook).toContain("china_documento_id");
  });

  it("mantém os contadores sincronizados em tempo real", () => {
    expect(hook).toContain("postgres_changes");
    expect(hook).toContain('queryKey: ["tarefas-anexos-resumo"]');
  });

  it("exibe contador, miniaturas e o estado de espera de documentos", () => {
    expect(badge).toContain("Aguardando documentos");
    expect(badge).toContain("Paperclip");
    expect(badge).toContain("getSignedUrl");
  });

  it("liga o indicador aos cards do quadro", () => {
    expect(kanban).toContain("useTarefasAnexos");
    expect(kanban).toContain("anexosResumo={anexosMap?.[tarefa.id]}");
    expect(kanban).toContain('tipo_tarefa === "china_checklist_item"');
  });

  it("expõe a reorganização de documentos via RPC dedicada", () => {
    expect(reparo).toContain('"rpc_china_reparar_documentos_projeto"');
    expect(read("src/components/china/VincularChinaSidePanel.tsx")).toContain("repararDocs.mutate(submissao.id)");
    expect(read("src/components/projetos/ProjetoHeader.tsx")).toContain("repararDocs.mutate(submissaoId)");
  });
});
