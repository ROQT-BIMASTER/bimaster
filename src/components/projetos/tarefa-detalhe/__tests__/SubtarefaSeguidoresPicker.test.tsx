import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SubtarefaSeguidoresPicker } from "../SubtarefaSeguidoresPicker";

/**
 * Testes de consistência da pilha de seguidores em subtarefas para
 * diferentes perfis de acesso (dono, membro, convidado). Foco: garantir
 * que iniciais/avatares e o fallback "Membro" sempre apareçam mesmo quando
 * `avatar_url` chega nulo, quebrado ou `nome` está ausente.
 */

// Mocks dos hooks de dados: isolamos o componente da rede/Supabase e
// exercitamos apenas a lógica de normalização + render.
vi.mock("@/hooks/useProjetoMembros", () => ({
  useProjetoMembros: () => ({
    membros: [
      { id: "m1", user_id: "u-dono", profile: { nome: "Ana Dona", avatar_url: null } },
      { id: "m2", user_id: "u-membro", profile: { nome: "Bruno Membro", avatar_url: null } },
      { id: "m3", user_id: "u-convidado", profile: { nome: "Carla Convidada", avatar_url: null } },
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

// Evita chamadas a supabase.storage nos testes.
vi.mock("@/lib/utils/avatarUrl", () => ({
  resolveAvatarUrl: async (u: string) => u,
}));

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("SubtarefaSeguidoresPicker – perfis diferentes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("perfil dono: renderiza pilha com nome e cai em iniciais quando sem avatar", () => {
    renderWithClient(
      <SubtarefaSeguidoresPicker
        subtarefaId="s1"
        projetoId="p1"
        colaboradores={[{ user_id: "u-dono", nome: "Ana Dona", avatar_url: null }]}
      />,
    );
    // Iniciais AD (primeira + última) do fallback do SmartAvatar
    expect(screen.getByText("AD")).toBeInTheDocument();
    expect(screen.getAllByTitle(/Ana Dona/).length).toBeGreaterThan(0);
  });

  it("perfil membro: normaliza `nome` ausente para 'Membro' e ignora avatar_url inválido", () => {
    renderWithClient(
      <SubtarefaSeguidoresPicker
        subtarefaId="s2"
        projetoId="p1"
        colaboradores={[
          // nome vazio + avatar_url string inválida
          { user_id: "u-membro", nome: "", avatar_url: "undefined" as unknown as string },
        ]}
      />,
    );
    // Fallback "Membro" -> iniciais "ME"
    expect(screen.getByText("ME")).toBeInTheDocument();
    // Não deve haver <img> renderizada pois url é inválida
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("perfil convidado: múltiplos seguidores com dados parciais mostram todos os fallbacks + contador", () => {
    renderWithClient(
      <SubtarefaSeguidoresPicker
        subtarefaId="s3"
        projetoId="p1"
        colaboradores={[
          { user_id: "u1", nome: "Ana Dona", avatar_url: null },
          { user_id: "u2", nome: "Bruno Membro", avatar_url: null },
          { user_id: "u3", nome: "Carla Convidada", avatar_url: null },
          { user_id: "u4", nome: "", avatar_url: null }, // 4º força "+1"
        ]}
      />,
    );
    expect(screen.getByText("AD")).toBeInTheDocument();
    expect(screen.getByText("BM")).toBeInTheDocument();
    expect(screen.getByText("CC")).toBeInTheDocument();
    expect(screen.getByText("+1")).toBeInTheDocument();
  });

  it("lista vazia: renderiza botão '+ Equipe' quando não há seguidores e nada está resolvendo", () => {
    renderWithClient(
      <SubtarefaSeguidoresPicker
        subtarefaId="s4"
        projetoId="p1"
        colaboradores={[]}
      />,
    );
    expect(screen.getByText("Equipe")).toBeInTheDocument();
  });

  it("estado resolvendo: renderiza skeletons e não mostra iniciais nem botão Equipe", () => {
    renderWithClient(
      <SubtarefaSeguidoresPicker
        subtarefaId="s5"
        projetoId="p1"
        colaboradores={[]}
        isResolving
      />,
    );
    expect(screen.queryByText("Equipe")).toBeNull();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("filtra colaboradores com user_id inválido para não quebrar a pilha", () => {
    renderWithClient(
      <SubtarefaSeguidoresPicker
        subtarefaId="s6"
        projetoId="p1"
        colaboradores={[
          { user_id: "", nome: "Ghost", avatar_url: null } as any,
          { user_id: "u-ok", nome: "Ok User", avatar_url: null },
        ]}
      />,
    );
    expect(screen.getByText("OU")).toBeInTheDocument();
    expect(screen.queryByText("GH")).toBeNull();
  });
});
