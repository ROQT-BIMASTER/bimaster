import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SmartAvatar } from "../SmartAvatar";

vi.mock("@/lib/utils/avatarUrl", () => ({
  resolveAvatarUrl: async (u: string) => u,
}));

// Radix Avatar usa `new Image()` interno para decidir se renderiza <img>.
// Em jsdom o load nunca completa, então o <img> real nunca aparece. Aqui
// substituímos o wrapper por primitivos DOM diretos para conseguir
// testar o fluxo de erro (`onError`) do SmartAvatar de forma determinística.
vi.mock("@/components/ui/avatar", () => {
  const React = require("react");
  const Avatar = ({ children, ...props }: any) =>
    React.createElement("span", props, children);
  const AvatarImage = ({ onError, ...props }: any) =>
    React.createElement("img", { ...props, onError });
  const AvatarFallback = ({ children, ...props }: any) =>
    React.createElement("span", props, children);
  return { Avatar, AvatarImage, AvatarFallback };
});

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

describe("SmartAvatar – tooltip 'Nome (identifier) — foto indisponível' quando imagem falha", () => {
  const nome = "Ana Dona";
  const src = "https://example.com/avatar.png";

  const identifiers: Array<{ label: string; value: string; expectedSuffix: string }> = [
    { label: "email", value: "ana@x.com", expectedSuffix: "(ana@x.com)" },
    {
      label: "email longo",
      value: "ana.paula.dona@sub.dominio.empresa.com.br",
      expectedSuffix: "(ana.paula.dona@sub.dominio.empresa.com.br)",
    },
    { label: "uuid", value: "8f14e45f-ceea-467a-a01e-1d0f9c8b9f6a", expectedSuffix: "(8f14e45f-ceea-467a-a01e-1d0f9c8b9f6a)" },
    { label: "cargo humano", value: "Head de Produto", expectedSuffix: "(Head de Produto)" },
    { label: "handle com @", value: "@ana.dona", expectedSuffix: "(@ana.dona)" },
    { label: "numérico", value: "12345", expectedSuffix: "(12345)" },
    { label: "com acentos", value: "gestão-sênior", expectedSuffix: "(gestão-sênior)" },
    { label: "CJK", value: "产品负责人", expectedSuffix: "(产品负责人)" },
    { label: "com parênteses internos", value: "PM (interino)", expectedSuffix: "(PM (interino))" },
    { label: "com espaços nas bordas", value: "  ana@x.com  ", expectedSuffix: "(ana@x.com)" },
  ];

  for (const { label, value, expectedSuffix } of identifiers) {
    it(`identifier=${label}: após onError, tooltip vira '${nome} ${expectedSuffix} — foto indisponível'`, () => {
      const { container } = render(
        <SmartAvatar src={src} nome={nome} identifier={value} />,
      );
      const root = container.querySelector("[title]") as HTMLElement;
      // Antes do erro, tooltip é limpo.
      expect(root.getAttribute("title")).toBe(`${nome} ${expectedSuffix}`);
      expect(root.getAttribute("aria-label")).toBe(`${nome} ${expectedSuffix}`);

      const img = container.querySelector("img") as HTMLImageElement;
      expect(img).not.toBeNull();
      fireEvent.error(img);

      const rootAfter = container.querySelector("[title]") as HTMLElement;
      const expected = `${nome} ${expectedSuffix} — foto indisponível`;
      expect(rootAfter.getAttribute("title")).toBe(expected);
      expect(rootAfter.getAttribute("aria-label")).toBe(expected);
      // Fallback textual passa a estar visível e compartilha o mesmo aria-label.
      const fallback = screen.getByText("AD");
      expect(fallback.getAttribute("aria-label")).toBe(expected);
      // <img> some após o erro (showImage=false).
      expect(container.querySelector("img")).toBeNull();
    });
  }

  it("sem identifier: após onError, tooltip vira 'Nome — foto indisponível'", () => {
    const { container } = render(<SmartAvatar src={src} nome={nome} />);
    const img = container.querySelector("img") as HTMLImageElement;
    fireEvent.error(img);
    const root = container.querySelector("[title]") as HTMLElement;
    expect(root.getAttribute("title")).toBe(`${nome} — foto indisponível`);
    expect(root.getAttribute("aria-label")).toBe(`${nome} — foto indisponível`);
  });

  it("identifier vazio/whitespace: ignora identifier no tooltip mesmo após erro", () => {
    const { container } = render(
      <SmartAvatar src={src} nome={nome} identifier="   " />,
    );
    const img = container.querySelector("img") as HTMLImageElement;
    fireEvent.error(img);
    const root = container.querySelector("[title]") as HTMLElement;
    expect(root.getAttribute("title")).toBe(`${nome} — foto indisponível`);
    expect(root.getAttribute("aria-label")).toBe(`${nome} — foto indisponível`);
  });

  it("nome vazio + identifier: usa fallback 'Membro (id) — foto indisponível'", () => {
    const { container } = render(
      <SmartAvatar src={src} nome={null} identifier="user-42" />,
    );
    const img = container.querySelector("img") as HTMLImageElement;
    fireEvent.error(img);
    const root = container.querySelector("[title]") as HTMLElement;
    expect(root.getAttribute("title")).toBe("Membro (user-42) — foto indisponível");
    expect(root.getAttribute("aria-label")).toBe("Membro (user-42) — foto indisponível");
  });

  it("title custom NÃO ganha sufixo '— foto indisponível' após erro (mantém intenção do caller)", () => {
    const { container } = render(
      <SmartAvatar src={src} nome={nome} identifier="ana@x.com" title="Perfil oficial" />,
    );
    const img = container.querySelector("img") as HTMLImageElement;
    fireEvent.error(img);
    const root = container.querySelector("[title]") as HTMLElement;
    expect(root.getAttribute("title")).toBe("Perfil oficial");
    expect(root.getAttribute("aria-label")).toBe("Perfil oficial");
  });
});

/**
 * Matriz de consistência a11y: garante que os três vetores expostos ao
 * usuário/AT — `title` (tooltip), `aria-label` (screen readers no root e
 * no fallback) e `alt` (imagem) — carreguem exatamente o mesmo texto
 * resolvido em cada cenário. Isso evita divergência silenciosa entre o
 * que o usuário vidente vê no hover e o que o SR anuncia.
 */
describe("SmartAvatar – consistência a11y (title === aria-label === alt)", () => {
  const cases: Array<{
    label: string;
    props: { src?: string | null; nome?: string | null; identifier?: string | null; fallbackNome?: string };
    expected: string;
  }> = [
    {
      label: "nome + identifier + src válido",
      props: { src: "https://x/y.png", nome: "Ana Dona", identifier: "ana@x.com" },
      expected: "Ana Dona (ana@x.com)",
    },
    {
      label: "nome sem identifier",
      props: { src: "https://x/y.png", nome: "Beto" },
      expected: "Beto",
    },
    {
      label: "nome vazio + identifier: usa fallback padrão",
      props: { src: "https://x/y.png", nome: "", identifier: "u-1" },
      expected: "Membro (u-1)",
    },
    {
      label: "nome null + identifier + fallbackNome custom",
      props: { src: "https://x/y.png", nome: null, identifier: "u-2", fallbackNome: "Convidado" },
      expected: "Convidado (u-2)",
    },
    {
      label: "identifier com espaços: trim",
      props: { src: "https://x/y.png", nome: "Carla", identifier: "  c@x  " },
      expected: "Carla (c@x)",
    },
    {
      label: 'identifier "null" string: ignorado (não renderiza parênteses)',
      // Nota: SmartAvatar hoje só filtra "null"/"undefined" em src; para identifier
      // preservamos o valor literal quando o caller mandar. Esse teste documenta
      // o comportamento atual e trava regressão silenciosa.
      props: { src: "https://x/y.png", nome: "Dani", identifier: "null" },
      expected: "Dani (null)",
    },
  ];

  it.each(cases)("$label: title, aria-label e alt batem", ({ props, expected }) => {
    const { container } = render(<SmartAvatar {...props} />);
    const root = container.querySelector("[title]") as HTMLElement;
    expect(root.getAttribute("title")).toBe(expected);
    expect(root.getAttribute("aria-label")).toBe(expected);
    const img = container.querySelector("img") as HTMLImageElement | null;
    if (img) expect(img.getAttribute("alt")).toBe(expected);
    // O AvatarFallback (span com as iniciais) também precisa expor aria-label
    // consistente para leitores de tela quando a imagem não carrega.
    const fallback = Array.from(container.querySelectorAll("[aria-label]")).find(
      (el) => el !== root,
    ) as HTMLElement | undefined;
    expect(fallback?.getAttribute("aria-label")).toBe(expected);
  });

  it("após onError, title/aria-label/alt ganham sufixo simultaneamente", () => {
    const { container } = render(
      <SmartAvatar src="https://x/y.png" nome="Ana" identifier="ana@x.com" />,
    );
    const img = container.querySelector("img") as HTMLImageElement;
    fireEvent.error(img);
    const expected = "Ana (ana@x.com) — foto indisponível";
    const root = container.querySelector("[title]") as HTMLElement;
    expect(root.getAttribute("title")).toBe(expected);
    expect(root.getAttribute("aria-label")).toBe(expected);
    // Após erro o SmartAvatar deixa de renderizar <img>; o fallback assume
    // o aria-label completo (com o sufixo) para o SR.
    expect(container.querySelector("img")).toBeNull();
    const fallback = Array.from(container.querySelectorAll("[aria-label]")).find(
      (el) => el !== root,
    ) as HTMLElement;
    expect(fallback.getAttribute("aria-label")).toBe(expected);
  });

  it("sem src válido: não renderiza <img>, mas aria-label do fallback bate com o title do root", () => {
    const { container } = render(
      <SmartAvatar src={null} nome="Ana" identifier="ana@x.com" />,
    );
    const root = container.querySelector("[title]") as HTMLElement;
    const expected = "Ana (ana@x.com)";
    expect(root.getAttribute("title")).toBe(expected);
    expect(root.getAttribute("aria-label")).toBe(expected);
    expect(container.querySelector("img")).toBeNull();
    const fallback = Array.from(container.querySelectorAll("[aria-label]")).find(
      (el) => el !== root,
    ) as HTMLElement;
    expect(fallback.getAttribute("aria-label")).toBe(expected);
  });
});

/**
 * Regras de precedência do `fallbackNome`: quando o `nome` real está
 * ausente/inutilizável ou é o placeholder genérico "Membro" hidratado
 * por RPC/RLS incompleto, o `fallbackNome` custom passado pelo caller
 * é autoritativo — inclusive no tooltip, aria-label e alt.
 */
describe("SmartAvatar – precedência do fallbackNome sobre nome vazio/placeholder", () => {
  const getRoot = (c: HTMLElement) => c.querySelector("[title]") as HTMLElement;

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["string vazia", ""],
    ["apenas espaços", "   "],
    ["apenas tabs/quebras", "\t\n\r  "],
    ['string literal "null"', "null"],
    ['string literal "undefined"', "undefined"],
  ])("nome=%s + fallbackNome custom: tooltip usa o fallback", (_label, nome) => {
    const { container } = render(
      <SmartAvatar src={null} nome={nome as any} identifier="u-1" fallbackNome="Convidado" />,
    );
    const root = getRoot(container);
    expect(root.getAttribute("title")).toBe("Convidado (u-1)");
    expect(root.getAttribute("aria-label")).toBe("Convidado (u-1)");
  });

  it('nome="Membro" (placeholder genérico) + fallbackNome custom: prefere o fallback', () => {
    const { container } = render(
      <SmartAvatar src={null} nome="Membro" identifier="u-2" fallbackNome="Aprovador" />,
    );
    const root = getRoot(container);
    expect(root.getAttribute("title")).toBe("Aprovador (u-2)");
    expect(root.getAttribute("aria-label")).toBe("Aprovador (u-2)");
    expect(screen.getByText("AP")).toBeInTheDocument();
  });

  it('nome="  membro  " (case + whitespace) ainda é tratado como placeholder', () => {
    const { container } = render(
      <SmartAvatar src={null} nome="  membro  " fallbackNome="Aprovador" />,
    );
    expect(getRoot(container).getAttribute("title")).toBe("Aprovador");
  });

  it('nome="Membro" + fallbackNome padrão ("Membro"): mantém "Membro"', () => {
    const { container } = render(<SmartAvatar src={null} nome="Membro" />);
    expect(getRoot(container).getAttribute("title")).toBe("Membro");
  });

  it("nome real específico NÃO é sobrescrito pelo fallback", () => {
    const { container } = render(
      <SmartAvatar src={null} nome="Ana Dona" fallbackNome="Convidado" />,
    );
    expect(getRoot(container).getAttribute("title")).toBe("Ana Dona");
  });

  it("após onError com nome vazio + fallback custom: sufixo aplica-se ao fallback", () => {
    const { container } = render(
      <SmartAvatar src="https://x/y.png" nome="" identifier="u-3" fallbackNome="Aprovador" />,
    );
    const img = container.querySelector("img") as HTMLImageElement;
    fireEvent.error(img);
    expect(getRoot(container).getAttribute("title")).toBe(
      "Aprovador (u-3) — foto indisponível",
    );
  });

  it("<img alt> também usa o fallback quando nome é whitespace", () => {
    const { container } = render(
      <SmartAvatar src="https://x/y.png" nome="   " fallbackNome="Convidado" />,
    );
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.getAttribute("alt")).toBe("Convidado");
  });
});

/**
 * Regressão automática: título, aria-label (root e fallback), alt do <img>
 * e o texto visual do fallback (iniciais) devem sempre derivar da MESMA
 * string resolvida, para qualquer combinação de dados de entrada. Se um
 * dia alguém alterar `resolveDisplayNome` ou `buildTitle` sem propagar
 * para todos os vetores acessíveis, este bloco quebra imediatamente.
 */
describe("SmartAvatar – regressão: title/aria-label/alt/iniciais coerentes", () => {
  type Cenario = {
    label: string;
    props: React.ComponentProps<typeof SmartAvatar>;
    /** Nome que deve aparecer resolvido em todos os vetores. */
    displayNome: string;
    /** Trecho extra esperado no title/aria-label (ex.: identifier). */
    tooltipExtra?: string;
  };

  function computeInitialsRef(nome: string): string {
    const parts = nome.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  const cenarios: Cenario[] = [
    {
      label: "nome válido + identifier",
      props: { nome: "Ana Dona", identifier: "ana@x.com" },
      displayNome: "Ana Dona",
      tooltipExtra: "(ana@x.com)",
    },
    { label: "nome válido sem identifier", props: { nome: "Bruno Silva" }, displayNome: "Bruno Silva" },
    { label: "nome nulo → fallback default", props: { nome: null }, displayNome: "Membro" },
    { label: "nome undefined → fallback default", props: { nome: undefined }, displayNome: "Membro" },
    { label: "nome whitespace → fallback custom", props: { nome: "   ", fallbackNome: "Convidado" }, displayNome: "Convidado" },
    { label: 'nome literal "null" → fallback custom', props: { nome: "null", fallbackNome: "Anônimo" }, displayNome: "Anônimo" },
    { label: 'nome literal "undefined" → fallback default', props: { nome: "undefined" }, displayNome: "Membro" },
    {
      label: 'placeholder "Membro" com fallback custom vence',
      props: { nome: "Membro", fallbackNome: "Fornecedor" },
      displayNome: "Fornecedor",
    },
    {
      label: "identifier com espaços é trimado no tooltip",
      props: { nome: "Carla Nunes", identifier: "  carla@x  " },
      displayNome: "Carla Nunes",
      tooltipExtra: "(carla@x)",
    },
    {
      label: "identifier vazio não aparece",
      props: { nome: "Diego Rocha", identifier: "   " },
      displayNome: "Diego Rocha",
    },
    { label: "nome CJK", props: { nome: "李 明" }, displayNome: "李 明" },
    { label: "nome único longo", props: { nome: "Maximiliano" }, displayNome: "Maximiliano" },
  ];

  it.each(cenarios)(
    "sem imagem: $label — title=aria-label(root)=aria-label(fallback), iniciais do displayNome",
    ({ props, displayNome, tooltipExtra }) => {
      const expected = tooltipExtra ? `${displayNome} ${tooltipExtra}` : displayNome;
      const { container } = render(<SmartAvatar {...props} />);
      const root = container.querySelector("span[title]") as HTMLElement;
      const spans = container.querySelectorAll("span[aria-label]");
      expect(root.getAttribute("title")).toBe(expected);
      spans.forEach((s) => expect(s.getAttribute("aria-label")).toBe(expected));
      // Sem src → nenhum <img>, o fallback renderiza as iniciais.
      expect(container.querySelector("img")).toBeNull();
      expect(container.textContent).toContain(computeInitialsRef(displayNome));
    },
  );

  it.each(cenarios)(
    "com imagem OK: $label — title/aria-label/alt idênticos, iniciais latentes coerentes",
    ({ props, displayNome, tooltipExtra }) => {
      const expected = tooltipExtra ? `${displayNome} ${tooltipExtra}` : displayNome;
      const { container } = render(<SmartAvatar {...props} src="https://x/ok.png" />);
      const root = container.querySelector("span[title]") as HTMLElement;
      const img = container.querySelector("img") as HTMLImageElement;
      const fallback = container.querySelectorAll("span[aria-label]");
      expect(root.getAttribute("title")).toBe(expected);
      expect(img.getAttribute("alt")).toBe(expected);
      fallback.forEach((s) => expect(s.getAttribute("aria-label")).toBe(expected));
      // Iniciais permanecem coerentes com o displayNome mesmo enquanto a imagem carrega.
      expect(fallback[fallback.length - 1].textContent).toBe(
        computeInitialsRef(displayNome),
      );
    },
  );

  it.each(cenarios)(
    "após onError: $label — sufixo '— foto indisponível' propaga p/ title, aria-labels e alt some",
    ({ props, displayNome, tooltipExtra }) => {
      const base = tooltipExtra ? `${displayNome} ${tooltipExtra}` : displayNome;
      const expected = `${base} — foto indisponível`;
      const { container } = render(<SmartAvatar {...props} src="https://x/broken.png" />);
      const img = container.querySelector("img") as HTMLImageElement;
      fireEvent.error(img);
      const root = container.querySelector("span[title]") as HTMLElement;
      const spans = container.querySelectorAll("span[aria-label]");
      expect(root.getAttribute("title")).toBe(expected);
      spans.forEach((s) => expect(s.getAttribute("aria-label")).toBe(expected));
      // <img> deve ser desmontado após o erro; iniciais ficam visíveis.
      expect(container.querySelector("img")).toBeNull();
      expect(container.textContent).toContain(computeInitialsRef(displayNome));
    },
  );
});
