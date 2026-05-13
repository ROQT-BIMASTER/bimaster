import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReadStatusLegend } from "../ReadStatusLegend";

describe("ReadStatusLegend", () => {
  it("renderiza o gatilho com aria-label acessível", () => {
    render(<ReadStatusLegend />);
    const trigger = screen.getByRole("button", {
      name: /significam os destaques de leitura/i,
    });
    expect(trigger).toBeInTheDocument();
  });

  it("exibe o conteúdo da legenda ao focar o gatilho", () => {
    render(<ReadStatusLegend />);
    const trigger = screen.getByRole("button", {
      name: /significam os destaques de leitura/i,
    });
    // Radix Tooltip abre no focus além do hover.
    fireEvent.focus(trigger);
    // O conteúdo do tooltip aparece em um portal.
    const matches = screen.getAllByText(/Indicadores de leitura/i);
    expect(matches.length).toBeGreaterThan(0);
  });
});
