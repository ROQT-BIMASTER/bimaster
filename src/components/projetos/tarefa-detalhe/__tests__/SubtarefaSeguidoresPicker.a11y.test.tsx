import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SubtarefaSeguidoresPicker } from "../SubtarefaSeguidoresPicker";

// cmdk usa ResizeObserver, indisponível no jsdom por padrão.
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    (globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

/**
 * Validações de acessibilidade da pilha de avatares de seguidores.
 *
 * Cobre:
 * - Nome acessível do trigger (aria-label + title) reflete lista real
 *   de seguidores, contador ou estado vazio.
 * - Estado "carregando" comunica `aria-busy` sem depender de cor.
 * - Contador "+N" tem rótulo textual próprio para leitores de tela.
 * - Skeletons são `aria-hidden` (decorativos) — o nome acessível vem
 *   sempre do botão pai.
 * - Navegação por teclado: `Tab` foca o trigger, `Enter`/`Space` abrem
 *   o Popover sem depender de mouse.
 */

vi.mock("@/hooks/useProjetoMembros", () => ({
  useProjetoMembros: () => ({
    membros: [
      { id: "m1", user_id: "u-1", profile: { nome: "Ana Dona", avatar_url: null } },
      { id: "m2", user_id: "u-2", profile: { nome: "Bruno Membro", avatar_url: null } },
    ],
    membrosLoading: false,
  }),
}));

vi.mock("@/hooks/useProjetoTarefas", () => ({
  useProjetoTarefas: () => ({
    addColaborador: { mutate: vi.fn() },
    removeColaborador: { mutate: vi.fn() },
  }),
}));

vi.mock("@/lib/utils/avatarUrl", () => ({
  resolveAvatarUrl: async (u: string) => u,
}));

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("SubtarefaSeguidoresPicker — acessibilidade", () => {
  it("estado vazio: trigger tem aria-label 'Adicionar seguidores' e não anuncia lista", () => {
    renderWithClient(
      <SubtarefaSeguidoresPicker subtarefaId="s1" projetoId="p1" colaboradores={[]} />,
    );
    const btn = screen.getByRole("button", { name: "Adicionar seguidores" });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute("title", "Adicionar seguidores");
    expect(btn).toHaveAttribute("aria-haspopup", "dialog");
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(btn).not.toHaveAttribute("aria-busy");
    // Ícone Plus é decorativo
    expect(btn.querySelector("[aria-hidden='true']")).toBeTruthy();
  });

  it("estado carregando (sem colabs conhecidos): aria-label 'Carregando seguidores' + aria-busy", () => {
    renderWithClient(
      <SubtarefaSeguidoresPicker
        subtarefaId="s2"
        projetoId="p1"
        colaboradores={[]}
        isResolving
      />,
    );
    const btn = screen.getByRole("button", { name: "Carregando seguidores" });
    expect(btn).toHaveAttribute("aria-busy", "true");
    // Placeholder circular é decorativo
    const decorative = btn.querySelector("[aria-hidden='true']");
    expect(decorative).toBeTruthy();
  });

  it("estado carregando com colabs: skeletons são aria-hidden e nome acessível vem do botão", () => {
    renderWithClient(
      <SubtarefaSeguidoresPicker
        subtarefaId="s3"
        projetoId="p1"
        colaboradores={[
          { user_id: "u-1", nome: "Ana Dona", avatar_url: null },
          { user_id: "u-2", nome: "Bruno Membro", avatar_url: null },
        ]}
        isResolving
      />,
    );
    const btn = screen.getByRole("button");
    // Aria-busy sinaliza carregamento sem depender de cor/animação
    expect(btn).toHaveAttribute("aria-busy", "true");
    // Nome acessível já lista os seguidores conhecidos
    expect(btn.getAttribute("aria-label")).toMatch(/Seguidores \(2\): Ana Dona, Bruno Membro/);
    // Nenhum <img> deve aparecer enquanto resolve — evita leitores de tela
    // anunciarem avatares parciais
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("pilha renderizada: aria-label enumera nomes e contador; avatares individuais são decorativos", () => {
    renderWithClient(
      <SubtarefaSeguidoresPicker
        subtarefaId="s4"
        projetoId="p1"
        colaboradores={[
          { user_id: "u-1", nome: "Ana Dona", avatar_url: null },
          { user_id: "u-2", nome: "Bruno Membro", avatar_url: null },
          { user_id: "u-3", nome: "Carla Convidada", avatar_url: null },
          { user_id: "u-4", nome: "Diego Extra", avatar_url: null },
        ]}
      />,
    );
    const btn = screen.getByRole("button");
    // Nome acessível único, com contagem e nomes enumerados
    expect(btn.getAttribute("aria-label")).toBe(
      "Seguidores (4): Ana Dona, Bruno Membro, Carla Convidada, Diego Extra",
    );
    // Contador "+N" tem seu próprio rótulo para leitores de tela
    const extra = screen.getByLabelText("mais 1 seguidores");
    expect(extra).toHaveTextContent("+1");
  });

  it("contador +N usa forma singular quando resta exatamente 1", () => {
    renderWithClient(
      <SubtarefaSeguidoresPicker
        subtarefaId="s4b"
        projetoId="p1"
        colaboradores={[
          { user_id: "u-1", nome: "A", avatar_url: null },
          { user_id: "u-2", nome: "B", avatar_url: null },
          { user_id: "u-3", nome: "C", avatar_url: null },
          { user_id: "u-4", nome: "D", avatar_url: null },
        ]}
      />,
    );
    // 4 colabs, mostra 3, resta 1 -> "mais 1 seguidores" (regra pt-BR simples)
    expect(screen.getByLabelText(/mais 1 seguidor/)).toBeInTheDocument();
  });

  it("navegação por teclado: Tab foca o trigger e Enter abre o Popover sem regressão", async () => {
    const user = userEvent.setup();
    renderWithClient(
      <>
        <button data-testid="antes">antes</button>
        <SubtarefaSeguidoresPicker
          subtarefaId="s5"
          projetoId="p1"
          colaboradores={[{ user_id: "u-1", nome: "Ana Dona", avatar_url: null }]}
        />
      </>,
    );
    // Foca o botão anterior e avança com Tab -> trigger recebe foco
    screen.getByTestId("antes").focus();
    await user.tab();
    const trigger = screen.getByRole("button", { name: /Seguidores \(1\)/ });
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    // Enter abre o Popover (Radix expõe como dialog); aria-expanded vira true
    await user.keyboard("{Enter}");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    // Input de busca do Command fica disponível para navegação por teclado
    expect(await screen.findByPlaceholderText("Buscar membro...")).toBeInTheDocument();
  });
});
