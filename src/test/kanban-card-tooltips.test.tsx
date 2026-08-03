import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SLACountdownPill } from "@/components/projetos/SLACountdownPill";
import { SlaStatusBadge } from "@/components/projetos/SlaStatusBadge";

function renderComProvider(ui: React.ReactElement) {
  return render(<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>);
}

const amanha = new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString();

describe("Tooltips dos badges do card do Quadro", () => {
  it("mostra limite e origem no hover do selo de prazo", async () => {
    const user = userEvent.setup();
    renderComProvider(
      <SLACountdownPill deadline={amanha} sourceLabel="Prazo do processo operacional" />,
    );

    await user.hover(screen.getByText(/^\d+d/));

    await waitFor(() => {
      expect(screen.getAllByText(/Limite:/).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("Prazo do processo operacional").length).toBeGreaterThan(0);
  });

  it("renderiza o balão fora do card (portal) para não ser recortado", async () => {
    const user = userEvent.setup();
    const { container } = renderComProvider(
      <div style={{ overflow: "hidden" }} data-testid="card">
        <SLACountdownPill deadline={amanha} />
      </div>,
    );

    await user.hover(screen.getByText(/^\d+d/));

    await waitFor(() => {
      expect(screen.getAllByText(/Limite:/).length).toBeGreaterThan(0);
    });
    const card = container.querySelector('[data-testid="card"]')!;
    expect(card.textContent).not.toMatch(/Limite:/);
  });

  it("não abre o tooltip enquanto o card está sendo arrastado", async () => {
    const user = userEvent.setup();
    renderComProvider(<SLACountdownPill deadline={amanha} disableTooltip />);

    await user.hover(screen.getByText(/^\d+d/));

    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText(/Limite:/)).toBeNull();
  });

  it("abre o tooltip do selo de SLA por foco de teclado", async () => {
    const user = userEvent.setup();
    renderComProvider(<SlaStatusBadge status="violado" contexto="Aprovação" />);

    await user.tab();

    await waitFor(() => {
      expect(screen.getAllByText(/Atividade: Aprovação/).length).toBeGreaterThan(0);
    });
  });
});
