import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReadStatusLegend } from "../ReadStatusLegend";

describe("ReadStatusLegend", () => {
  it("renderiza o gatilho com aria-label acessível", () => {
    render(<ReadStatusLegend />);
    // Aceita PT/EN/ZH dependendo do idioma resolvido pelo i18n.
    const trigger = screen.getByRole("button", {
      name: /leitura|read|阅读/i,
    });
    expect(trigger).toBeInTheDocument();
  });

  it("exibe o conteúdo da legenda ao focar o gatilho", () => {
    render(<ReadStatusLegend />);
    const trigger = screen.getByRole("button", {
      name: /leitura|read|阅读/i,
    });
    fireEvent.focus(trigger);
    const matches = screen.getAllByText(/Indicadores de leitura|Read indicators|阅读标记/i);
    expect(matches.length).toBeGreaterThan(0);
  });
});
