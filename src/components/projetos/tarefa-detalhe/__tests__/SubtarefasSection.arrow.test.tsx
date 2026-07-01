import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SubtarefasSection } from "../SubtarefasSection";
import {
  __resetSubtarefaArrowTelemetry,
  getSubtarefaArrowEvents,
} from "@/lib/telemetry/subtarefaArrowTelemetry";

/**
 * Garante paridade v1/v2:
 * - A seta de abrir subtarefa está SEMPRE no DOM (sem `opacity-0` dependente de hover).
 * - Possui `aria-label` acessível e é focalizável via teclado.
 * - Ao clicar, dispara `onOpenSubtarefa(id)` e registra telemetria.
 */

vi.mock("@/hooks/useProjetoIA", () => ({
  useProjetoIA: () => ({ loading: false, generateChecklist: vi.fn() }),
}));
vi.mock("@/hooks/useProjetoMembros", () => ({
  useProjetoMembros: () => ({ membros: [], isLoading: false }),
}));
vi.mock("../SubtarefaResponsavelPicker", () => ({
  SubtarefaResponsavelPicker: () => null,
}));
vi.mock("../SubtarefaSeguidoresPicker", () => ({
  SubtarefaSeguidoresPicker: () => null,
}));

const baseTarefa: any = {
  id: "t1",
  titulo: "Tarefa",
  status: "pendente",
  prioridade: "media",
  secao_id: "s1",
  subtarefas: [
    {
      id: "st-1",
      titulo: "Subtarefa Um",
      status: "pendente",
      prioridade: "media",
      estagio: null,
      secao_id: "s1",
      data_prazo: null,
      responsavel_id: null,
      colaboradores: [],
      subtarefas: [],
    },
  ],
};

describe("SubtarefasSection — seta de abrir subtarefa", () => {
  beforeEach(() => {
    __resetSubtarefaArrowTelemetry();
  });

  it("renderiza a seta sempre visível (sem opacity-0) com aria-label descritivo", () => {
    render(
      <SubtarefasSection
        tarefa={baseTarefa}
        projetoId="p1"
        onUpdate={vi.fn()}
        onToggle={vi.fn()}
        onOpenSubtarefa={vi.fn()}
      />,
    );
    const btn = screen.getByTestId("subtarefa-open-arrow");
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute("aria-label", "Abrir subtarefa: Subtarefa Um");
    expect(btn.className).not.toMatch(/opacity-0/);
    expect(btn.className).toMatch(/focus-visible:ring/);
  });

  it("dispara onOpenSubtarefa com o id e registra telemetria de click", () => {
    const onOpen = vi.fn();
    render(
      <SubtarefasSection
        tarefa={baseTarefa}
        projetoId="p1"
        onUpdate={vi.fn()}
        onToggle={vi.fn()}
        onOpenSubtarefa={onOpen}
      />,
    );
    fireEvent.click(screen.getByTestId("subtarefa-open-arrow"));
    expect(onOpen).toHaveBeenCalledWith("st-1");
    const events = getSubtarefaArrowEvents();
    expect(events.some((e) => e.type === "click" && e.subtarefaId === "st-1")).toBe(true);
  });

  it("pode receber foco via teclado (paridade v1/v2, acessibilidade)", () => {
    render(
      <SubtarefasSection
        tarefa={baseTarefa}
        projetoId="p1"
        onUpdate={vi.fn()}
        onToggle={vi.fn()}
        onOpenSubtarefa={vi.fn()}
      />,
    );
    const btn = screen.getByTestId("subtarefa-open-arrow");
    btn.focus();
    expect(document.activeElement).toBe(btn);
  });
});
