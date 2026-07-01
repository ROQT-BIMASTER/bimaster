import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

describe("SmartAvatar – nomes longos, sobrenomes faltando e caracteres especiais", () => {
  it("nome muito longo (várias palavras): usa 1ª letra da 1ª e da última palavra", () => {
    const longo =
      "Maria Aparecida das Dores de Souza Guimarães Rodrigues Albuquerque";
    render(<SmartAvatar src={null} nome={longo} />);
    expect(screen.getByText("MA")).toBeInTheDocument();
    expect(screen.getAllByTitle(longo).length).toBeGreaterThan(0);
  });

  it("nome de uma única palavra extremamente longa: primeiras 2 letras uppercase", () => {
    render(<SmartAvatar src={null} nome="Anastasiavladimirovnapetrovna" />);
    expect(screen.getByText("AN")).toBeInTheDocument();
  });

  it("apenas primeiro nome (sem sobrenome): usa primeiras 2 letras uppercase", () => {
    render(<SmartAvatar src={null} nome="Léo" />);
    expect(screen.getByText("LÉ")).toBeInTheDocument();
  });

  it("nome com espaços múltiplos internos: normaliza e pega 1ª+última", () => {
    render(<SmartAvatar src={null} nome="  Ana    Beatriz    Costa  " />);
    expect(screen.getByText("AC")).toBeInTheDocument();
  });

  it("nome com acentos: preserva o caractere acentuado nas iniciais", () => {
    render(<SmartAvatar src={null} nome="Álvaro Óscar" />);
    expect(screen.getByText("ÁÓ")).toBeInTheDocument();
  });

  it("nome com cedilha e til: caracteres especiais aparecem em uppercase", () => {
    render(<SmartAvatar src={null} nome="Conceição Não" />);
    expect(screen.getByText("CN")).toBeInTheDocument();
  });

  it("nome com hífen composto: hífen faz parte da palavra", () => {
    render(<SmartAvatar src={null} nome="Ana-Maria Silva" />);
    expect(screen.getByText("AS")).toBeInTheDocument();
  });

  it("nome CJK sem espaço: primeiras 2 letras da palavra única", () => {
    render(<SmartAvatar src={null} nome="李雷韩梅梅" />);
    expect(screen.getByText("李雷")).toBeInTheDocument();
  });

  it("nome CJK com sobrenome separado por espaço: 1ª+última", () => {
    render(<SmartAvatar src={null} nome="李 雷" />);
    expect(screen.getByText("李雷")).toBeInTheDocument();
  });

  it("nome com emoji entre palavras: emoji conta como palavra do meio", () => {
    render(<SmartAvatar src={null} nome="Ana 🌟 Costa" />);
    expect(screen.getByText("AC")).toBeInTheDocument();
  });

  it("nome só com pontuação/símbolos: mantém os símbolos como iniciais", () => {
    render(<SmartAvatar src={null} nome="@# $%" />);
    expect(screen.getByText("@$")).toBeInTheDocument();
  });

  it("nome longo + identifier longo: tooltip concatena sem truncar", () => {
    const longo = "Maria Aparecida das Dores Rodrigues";
    const email = "maria.aparecida.das.dores.rodrigues@empresa.com.br";
    render(<SmartAvatar src={null} nome={longo} identifier={email} />);
    expect(
      screen.getAllByTitle(`${longo} (${email})`).length,
    ).toBeGreaterThan(0);
  });

  it("nome termina em espaço (sobrenome faltando): trata como palavra única", () => {
    render(<SmartAvatar src={null} nome="Ana " />);
    expect(screen.getByText("AN")).toBeInTheDocument();
  });

  it("nome com quebra de linha/tab: normaliza como whitespace", () => {
    render(<SmartAvatar src={null} nome={"Ana\n\tSilva"} />);
    expect(screen.getByText("AS")).toBeInTheDocument();
  });
});

describe("SmartAvatar – consistência de aria-label e title com avatar_url nulo", () => {
  const cases: Array<{ label: string; src: unknown }> = [
    { label: "null", src: null },
    { label: "undefined", src: undefined },
    { label: "string vazia", src: "" },
    { label: "string 'null'", src: "null" },
    { label: "string 'undefined'", src: "undefined" },
    { label: "apenas espaços", src: "   " },
  ];

  for (const { label, src } of cases) {
    it(`src=${label}: title e aria-label do Avatar batem com o nome`, () => {
      const { container } = render(
        <SmartAvatar src={src as string | null | undefined} nome="Ana Dona" />,
      );
      const root = container.querySelector("[title]") as HTMLElement | null;
      expect(root).not.toBeNull();
      expect(root!.getAttribute("title")).toBe("Ana Dona");
      expect(root!.getAttribute("aria-label")).toBe("Ana Dona");
      // Não deve haver "foto indisponível" — não houve erro de carregamento.
      expect(root!.getAttribute("title")).not.toMatch(/foto indispon/i);
    });

    it(`src=${label}: fallback textual expõe aria-label idêntico ao title`, () => {
      const { container } = render(
        <SmartAvatar src={src as string | null | undefined} nome="Ana Dona" />,
      );
      const root = container.querySelector("[title]") as HTMLElement;
      const fallback = screen.getByText("AD");
      expect(fallback.getAttribute("aria-label")).toBe(root.getAttribute("title"));
    });

    it(`src=${label} + identifier: tooltip e aria-label incluem identifier`, () => {
      const { container } = render(
        <SmartAvatar
          src={src as string | null | undefined}
          nome="Ana Dona"
          identifier="ana@x.com"
        />,
      );
      const root = container.querySelector("[title]") as HTMLElement;
      expect(root.getAttribute("title")).toBe("Ana Dona (ana@x.com)");
      expect(root.getAttribute("aria-label")).toBe("Ana Dona (ana@x.com)");
      const fallback = screen.getByText("AD");
      expect(fallback.getAttribute("aria-label")).toBe("Ana Dona (ana@x.com)");
    });

    it(`src=${label} + nome vazio: usa fallback 'Membro' em title e aria-label`, () => {
      const { container } = render(
        <SmartAvatar src={src as string | null | undefined} nome={null} />,
      );
      const root = container.querySelector("[title]") as HTMLElement;
      expect(root.getAttribute("title")).toBe("Membro");
      expect(root.getAttribute("aria-label")).toBe("Membro");
      const fallback = screen.getByText("ME");
      expect(fallback.getAttribute("aria-label")).toBe("Membro");
    });

    it(`src=${label}: title customizado sobrescreve nome e aria-label espelha`, () => {
      const { container } = render(
        <SmartAvatar
          src={src as string | null | undefined}
          nome="Ana Dona"
          identifier="ana@x.com"
          title="Perfil oficial"
        />,
      );
      const root = container.querySelector("[title]") as HTMLElement;
      expect(root.getAttribute("title")).toBe("Perfil oficial");
      expect(root.getAttribute("aria-label")).toBe("Perfil oficial");
      const fallback = screen.getByText("AD");
      expect(fallback.getAttribute("aria-label")).toBe("Perfil oficial");
    });

    it(`src=${label}: nunca acrescenta '— foto indisponível' quando não houve <img>`, () => {
      const { container } = render(
        <SmartAvatar src={src as string | null | undefined} nome="Ana Dona" />,
      );
      // Sem <img> renderizada, não há como disparar onError → título limpo.
      expect(container.querySelector("img")).toBeNull();
      const root = container.querySelector("[title]") as HTMLElement;
      expect(root.getAttribute("title")).not.toContain("foto indispon");
    });
  }

  it("re-render com src alternando entre null e undefined mantém aria-label estável", () => {
    const { container, rerender } = render(
      <SmartAvatar src={null} nome="Ana Dona" identifier="ana@x.com" />,
    );
    const first = (container.querySelector("[title]") as HTMLElement).getAttribute(
      "aria-label",
    );
    rerender(<SmartAvatar src={undefined} nome="Ana Dona" identifier="ana@x.com" />);
    const second = (container.querySelector("[title]") as HTMLElement).getAttribute(
      "aria-label",
    );
    rerender(<SmartAvatar src="null" nome="Ana Dona" identifier="ana@x.com" />);
    const third = (container.querySelector("[title]") as HTMLElement).getAttribute(
      "aria-label",
    );
    expect(first).toBe("Ana Dona (ana@x.com)");
    expect(first).toBe(second);
    expect(second).toBe(third);
  });
});
