import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useSearchParams } from "react-router-dom";
import { useCallback } from "react";

/**
 * Regressoes cobertas:
 * 1. Card do Kanban abre a tarefa com UM clique (nao dois).
 * 2. O botao X fecha o drawer imediatamente (sem F5), limpando o parametro ?tarefa.
 * 3. Abrir outra tarefa com o drawer aberto troca o conteudo sem exigir fechar antes.
 */

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("Kanban: abertura de tarefa com clique unico", () => {
  const src = read("src/components/projetos/ProjetoKanbanView.tsx");

  it("usa onClick (nao onDoubleClick) no card para selecionar a tarefa", () => {
    expect(src).toContain("onClick={(event) => {");
    expect(src).toContain("onSelect();");
    expect(src).not.toContain("onDoubleClick");
  });

  it("expoe o card como botao acessivel com teclado", () => {
    expect(src).toContain('role="button"');
    expect(src).toContain("aria-label={`Abrir tarefa ${tarefa.titulo}`}");
    expect(src).toContain("onKeyDown");
  });

  it("ignora cliques em controles internos do card", () => {
    expect(src).toContain('closest("button, a, input, textarea, select, [role=menuitem]")');
  });
});

describe("ProjetoDetalhe: contrato de abrir/fechar o drawer", () => {
  const src = read("src/pages/ProjetoDetalhe.tsx");

  it("controla o drawer pelo parametro ?tarefa da URL", () => {
    expect(src).toContain('const selectedTarefaId = searchParams.get("tarefa")');
    expect(src).toContain("open={!!selectedTarefaId}");
  });

  it("fecha limpando o parametro antes de qualquer refetch", () => {
    const close = src.slice(src.indexOf("const handleDetailClose"));
    const body = close.slice(0, close.indexOf("}, ["));
    expect(body).toContain("if (open) return;");
    expect(body).toContain("setSelectedTarefaId(null);");
    // o invalidate acontece depois, fora do caminho critico de fechamento
    expect(body.indexOf("setSelectedTarefaId(null)")).toBeLessThan(body.indexOf("invalidateQueries"));
    expect(body).toContain("setTimeout");
  });

  it("permite abrir outra tarefa (subtarefa) sem fechar o drawer", () => {
    expect(src).toContain("onOpenSubtarefa={setSelectedTarefaId}");
  });
});

describe("ProjetoTarefaDetalhe: botao X", () => {
  const src = read("src/components/projetos/ProjetoTarefaDetalhe.tsx");

  it("dispara onOpenChange(false) diretamente no clique do X", () => {
    expect(src).toContain("onClick={() => onOpenChange(false)}");
  });
});

/** Harness que replica o contrato de estado do drawer (URL -> open). */
function DrawerHarness({ onClose }: { onClose: () => void }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tarefaId = searchParams.get("tarefa");

  const select = useCallback((id: string | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) next.set("tarefa", id);
      else next.delete("tarefa");
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const handleOpenChange = (open: boolean) => {
    if (open) return;
    select(null);
    onClose();
  };

  return (
    <div>
      <button type="button" aria-label="Abrir tarefa A" onClick={() => select("a")}>Card A</button>
      <button type="button" aria-label="Abrir tarefa B" onClick={() => select("b")}>Card B</button>
      {tarefaId && (
        <div role="dialog" aria-label="Detalhe da tarefa">
          <span>Tarefa {tarefaId.toUpperCase()}</span>
          <button type="button" aria-label="Fechar" onClick={() => handleOpenChange(false)}>X</button>
        </div>
      )}
    </div>
  );
}

describe("Comportamento do drawer (abrir/fechar/trocar)", () => {
  it("abre com um unico clique, fecha no X e troca de tarefa sem recarregar", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <MemoryRouter initialEntries={["/dashboard/projetos/1"]}>
        <DrawerHarness onClose={onClose} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Abrir tarefa A"));
    expect(await screen.findByText("Tarefa A")).toBeInTheDocument();

    // troca direta para outra tarefa com o drawer aberto
    await user.click(screen.getByLabelText("Abrir tarefa B"));
    expect(await screen.findByText("Tarefa B")).toBeInTheDocument();
    expect(screen.queryByText("Tarefa A")).not.toBeInTheDocument();

    // fechar pelo X remove o drawer imediatamente
    await user.click(screen.getByLabelText("Fechar"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
