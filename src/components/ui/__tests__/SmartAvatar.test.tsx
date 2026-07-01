import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SmartAvatar } from "../SmartAvatar";

vi.mock("@/lib/utils/avatarUrl", () => ({
  resolveAvatarUrl: async (u: string) => u,
}));

/**
 * Garante que SmartAvatar sempre exibe iniciais (e o nome como title/alt)
 * quando `avatar_url` é nulo, indefinido ou uma string inválida — nunca
 * renderiza um <img> quebrado nesses casos.
 */
describe("SmartAvatar – fallback quando avatar_url é nulo/inválido", () => {
  const nome = "Ana Dona";

  it("src=null: renderiza iniciais e não renderiza <img>", () => {
    render(<SmartAvatar src={null} nome={nome} />);
    expect(screen.getByText("AD")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("src=undefined: renderiza iniciais", () => {
    render(<SmartAvatar src={undefined} nome={nome} />);
    expect(screen.getByText("AD")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it('src="" (string vazia): trata como inválido', () => {
    render(<SmartAvatar src="" nome={nome} />);
    expect(screen.getByText("AD")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it('src="null" (string literal): trata como inválido', () => {
    render(<SmartAvatar src="null" nome={nome} />);
    expect(screen.getByText("AD")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it('src="undefined" (string literal): trata como inválido', () => {
    render(<SmartAvatar src="undefined" nome={nome} />);
    expect(screen.getByText("AD")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("src apenas com espaços: trata como inválido", () => {
    render(<SmartAvatar src="   " nome={nome} />);
    expect(screen.getByText("AD")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("sem nome: usa fallback 'Membro' -> iniciais 'ME'", () => {
    render(<SmartAvatar src={null} nome={null} />);
    expect(screen.getByText("ME")).toBeInTheDocument();
  });

  it("nome com espaços em branco: cai no fallback 'Membro'", () => {
    render(<SmartAvatar src={null} nome="   " />);
    expect(screen.getByText("ME")).toBeInTheDocument();
  });

  it("fallbackNome customizado: usa esse valor quando nome é vazio", () => {
    render(<SmartAvatar src={null} nome={null} fallbackNome="Convidado" />);
    expect(screen.getByText("CO")).toBeInTheDocument();
    expect(screen.getByTitle("Convidado")).toBeInTheDocument();
  });

  it("nome único: usa primeiras 2 letras uppercase", () => {
    render(<SmartAvatar src={null} nome="carla" />);
    expect(screen.getByText("CA")).toBeInTheDocument();
  });

  it("nome com múltiplas palavras: primeira letra da primeira + última palavra", () => {
    render(<SmartAvatar src={null} nome="Bruno da Silva Membro" />);
    expect(screen.getByText("BM")).toBeInTheDocument();
  });

  it("propaga title com o nome mesmo sem foto", () => {
    render(<SmartAvatar src={null} nome={nome} />);
    // title fica em Avatar (span) e aria-label em fallback
    expect(screen.getAllByTitle(nome).length).toBeGreaterThan(0);
  });

  it("title customizado sobrepõe o nome e o identifier", () => {
    render(
      <SmartAvatar src={null} nome={nome} identifier="ana@x.com" title="Perfil de Ana" />,
    );
    expect(screen.getAllByTitle("Perfil de Ana").length).toBeGreaterThan(0);
  });

  it("identifier: monta tooltip 'Nome (identifier)' automaticamente", () => {
    render(<SmartAvatar src={null} nome={nome} identifier="ana@x.com" />);
    expect(screen.getAllByTitle("Ana Dona (ana@x.com)").length).toBeGreaterThan(0);
  });

  it("identifier em branco é ignorado no tooltip", () => {
    render(<SmartAvatar src={null} nome={nome} identifier="   " />);
    expect(screen.getAllByTitle("Ana Dona").length).toBeGreaterThan(0);
  });

  it("sem nome + identifier: tooltip usa fallback 'Membro (id)'", () => {
    render(<SmartAvatar src={null} nome={null} identifier="user-42" />);
    expect(screen.getAllByTitle("Membro (user-42)").length).toBeGreaterThan(0);
    expect(screen.getByText("ME")).toBeInTheDocument();
  });
});
