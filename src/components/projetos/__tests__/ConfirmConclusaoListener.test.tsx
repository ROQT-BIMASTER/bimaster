import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  confirmConclusaoTarefa,
  confirmExclusaoTarefa,
} from "@/lib/projetos/confirmConclusao";
import { ConfirmConclusaoListener } from "@/components/projetos/ConfirmConclusaoListener";

describe("ConfirmConclusaoListener — confirmação de tarefas", () => {
  beforeEach(() => {
    render(<ConfirmConclusaoListener />);
  });

  afterEach(() => {
    cleanup();
  });

  it("exibe o diálogo ao concluir uma tarefa e resolve true ao confirmar", async () => {
    const promise = confirmConclusaoTarefa({ titulo: "Aprovar arte" });

    expect(
      await screen.findByText(/Concluir tarefa\?/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/"Aprovar arte"/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Sim, concluir/i }));

    await expect(promise).resolves.toBe(true);
  });

  it("exibe o diálogo ao excluir uma tarefa e resolve false ao cancelar", async () => {
    const promise = confirmExclusaoTarefa({ titulo: "Briefing antigo" });

    expect(await screen.findByText(/Excluir tarefa\?/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Cancelar/i }));

    await expect(promise).resolves.toBe(false);
  });

  it("usa o substantivo plural e quantidade em ações em lote", async () => {
    const promise = confirmConclusaoTarefa({ quantidade: 7 });

    expect(
      await screen.findByText(/Concluir tarefas\?/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/7 tarefas selecionadas/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Sim, concluir/i }));
    await expect(promise).resolves.toBe(true);
  });

  it("usa o termo 'subtarefa' quando isSubtarefa = true", async () => {
    const promise = confirmExclusaoTarefa({
      titulo: "Validar SKU",
      isSubtarefa: true,
    });

    expect(
      await screen.findByText(/Excluir subtarefa\?/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Sim, excluir/i }));
    await expect(promise).resolves.toBe(true);
  });

  it("resolve false quando o diálogo é fechado sem ação", async () => {
    const promise = confirmConclusaoTarefa({ titulo: "X" });
    expect(await screen.findByText(/Concluir tarefa\?/i)).toBeInTheDocument();

    // Simula fechamento via overlay/Escape — usa onOpenChange(false)
    fireEvent.keyDown(document.activeElement || document.body, {
      key: "Escape",
      code: "Escape",
    });

    await expect(promise).resolves.toBe(false);
  });
});

describe("auditoria de tarefa — não bloqueia em caso de falha", () => {
  it("captura exceção interna sem propagar para o caller", async () => {
    vi.resetModules();
    vi.doMock("@/integrations/supabase/client", () => ({
      supabase: {
        auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
        from: () => ({
          insert: async () => ({ error: new Error("boom") }),
        }),
      },
    }));
    const { registrarAuditoriaTarefa } = await import(
      "@/lib/projetos/auditoriaTarefa"
    );
    await expect(
      registrarAuditoriaTarefa({
        tarefaId: "t1",
        action: "concluida",
      }),
    ).resolves.toBeUndefined();
  });
});
