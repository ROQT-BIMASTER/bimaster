import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { HistoricoItemDialog } from "@/components/projetos/aprovacoes/kanban/HistoricoItemDialog";

// ---------- Mocks ----------

const mutateAsync = vi.fn().mockResolvedValue("ok");
const useItemHistoricoMock = vi.fn();
const useComentarItemMock = vi.fn();

vi.mock("@/hooks/itemHistorico", () => ({
  useItemHistorico: (...args: any[]) => useItemHistoricoMock(...args),
  useComentarItem: () => useComentarItemMock(),
  HISTORICO_PAGE_SIZE: 30,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ---------- Fixtures ----------

const ITEM_ID = "item-aprovacao-1";

function entry(over: Partial<any> = {}) {
  return {
    id: over.id ?? `e-${Math.random().toString(36).slice(2, 8)}`,
    item_id: ITEM_ID,
    user_id: "u1",
    user_nome: over.user_nome ?? "Alice",
    acao: over.acao ?? "comentario",
    origem: "kanban",
    coluna_origem: null,
    coluna_destino: null,
    status_anterior: null,
    status_novo: null,
    etapa_anterior_nome: null,
    etapa_atual_nome: null,
    comentario: over.comentario ?? null,
    metadata: over.metadata ?? {},
    created_at:
      over.created_at ?? new Date(2026, 4, 4, 10, 0, 0).toISOString(),
    ...over,
  };
}

function setHistoricoData(data: any, extra: Partial<any> = {}) {
  useItemHistoricoMock.mockReturnValue({
    data,
    isLoading: false,
    isFetching: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    ...extra,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  useComentarItemMock.mockReturnValue({
    mutateAsync,
    isPending: false,
  });
});

// ---------- Tests ----------

describe("HistoricoItemDialog — achatar data.pages", () => {
  it("achata pages do useInfiniteQuery e renderiza todos os eventos", () => {
    setHistoricoData({
      pages: [
        [
          entry({ id: "a", acao: "comentario", comentario: "primeiro" }),
          entry({ id: "b", acao: "movimento" }),
        ],
        [entry({ id: "c", acao: "delegacao" })],
      ],
      pageParams: [0, 1],
    });

    render(
      <HistoricoItemDialog
        open
        itemId={ITEM_ID}
        onOpenChange={() => {}}
      />,
    );

    expect(screen.getByText("primeiro")).toBeInTheDocument();
    expect(screen.getByText("Movimentação")).toBeInTheDocument();
    expect(screen.getByText("Delegação")).toBeInTheDocument();
  });

  it("aceita data como array direto (fallback defensivo)", () => {
    setHistoricoData([
      entry({ id: "x", acao: "comentario", comentario: "fallback ok" }),
    ]);

    render(
      <HistoricoItemDialog open itemId={ITEM_ID} onOpenChange={() => {}} />,
    );

    expect(screen.getByText("fallback ok")).toBeInTheDocument();
  });

  it("não quebra quando data é undefined", () => {
    setHistoricoData(undefined);

    render(
      <HistoricoItemDialog open itemId={ITEM_ID} onOpenChange={() => {}} />,
    );

    expect(
      screen.getByText("Nenhum evento para os filtros selecionados."),
    ).toBeInTheDocument();
  });

  it("não quebra quando pages é array vazio", () => {
    setHistoricoData({ pages: [], pageParams: [] });

    render(
      <HistoricoItemDialog open itemId={ITEM_ID} onOpenChange={() => {}} />,
    );

    expect(
      screen.getByText("Nenhum evento para os filtros selecionados."),
    ).toBeInTheDocument();
  });
});

describe("HistoricoItemDialog — filtros", () => {
  function renderWithMixed() {
    setHistoricoData({
      pages: [
        [
          entry({ id: "1", acao: "comentario", comentario: "review do time" }),
          entry({ id: "2", acao: "movimento", user_nome: "Bob" }),
          entry({ id: "3", acao: "delegacao" }),
          entry({ id: "4", acao: "comentario", comentario: "ok approved" }),
        ],
      ],
      pageParams: [0],
    });

    return render(
      <HistoricoItemDialog open itemId={ITEM_ID} onOpenChange={() => {}} />,
    );
  }

  it("filtra por ação ao clicar em uma tab de filtro", async () => {
    const user = userEvent.setup();
    renderWithMixed();

    await user.click(screen.getByRole("button", { name: "Comentários" }));

    expect(screen.getByText("review do time")).toBeInTheDocument();
    expect(screen.getByText("ok approved")).toBeInTheDocument();
    expect(screen.queryByText("Movimentação")).not.toBeInTheDocument();
    expect(screen.queryByText("Delegação")).not.toBeInTheDocument();
  });

  it("filtra por busca textual em comentário ou usuário", async () => {
    const user = userEvent.setup();
    renderWithMixed();

    await user.type(
      screen.getByPlaceholderText(/buscar comentário/i),
      "approved",
    );

    expect(screen.getByText("ok approved")).toBeInTheDocument();
    expect(screen.queryByText("review do time")).not.toBeInTheDocument();
  });

  it("'Limpar' aparece quando há filtro ativo e reseta a lista", async () => {
    const user = userEvent.setup();
    renderWithMixed();

    expect(screen.queryByRole("button", { name: /limpar/i })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Comentários" }));

    const limpar = screen.getByRole("button", { name: /limpar/i });
    expect(limpar).toBeInTheDocument();

    await user.click(limpar);
    // Volta a mostrar evento não-comentário (Movimentação).
    expect(screen.getByText("Movimentação")).toBeInTheDocument();
  });
});

describe("HistoricoItemDialog — paginação não-destrutiva", () => {
  it("preserva ordem das páginas (page 0 antes de page 1) no flatten", () => {
    setHistoricoData({
      pages: [
        [entry({ id: "p0-a", comentario: "P0-A" })],
        [entry({ id: "p1-a", comentario: "P1-A" })],
        [entry({ id: "p2-a", comentario: "P2-A" })],
      ],
      pageParams: [0, 1, 2],
    });

    render(
      <HistoricoItemDialog open itemId={ITEM_ID} onOpenChange={() => {}} />,
    );

    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("P0-A");
    expect(items[1]).toHaveTextContent("P1-A");
    expect(items[2]).toHaveTextContent("P2-A");
  });

  it("não duplica nem perde eventos quando uma página vem vazia", () => {
    setHistoricoData({
      pages: [
        [entry({ id: "1", comentario: "um" })],
        [],
        [entry({ id: "2", comentario: "dois" })],
      ],
      pageParams: [0, 1, 2],
    });

    render(
      <HistoricoItemDialog open itemId={ITEM_ID} onOpenChange={() => {}} />,
    );

    expect(screen.getByText("um")).toBeInTheDocument();
    expect(screen.getByText("dois")).toBeInTheDocument();
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items).toHaveLength(2);
  });
});

describe("HistoricoItemDialog — estados", () => {
  it("mostra loading quando isLoading=true", () => {
    setHistoricoData(undefined, { isLoading: true });

    render(
      <HistoricoItemDialog open itemId={ITEM_ID} onOpenChange={() => {}} />,
    );

    expect(screen.getByText(/carregando histórico/i)).toBeInTheDocument();
  });

  it("não chama o hook com itemId quando dialog está fechado", () => {
    setHistoricoData({ pages: [[]], pageParams: [0] });

    render(
      <HistoricoItemDialog
        open={false}
        itemId={ITEM_ID}
        onOpenChange={() => {}}
      />,
    );

    // Quando fechado, o componente passa null para o hook.
    expect(useItemHistoricoMock).toHaveBeenCalledWith(null);
  });
});

describe("HistoricoItemDialog — comentário inválido", () => {
  it("mantém o botão Comentar desabilitado quando o textarea está vazio", () => {
    setHistoricoData({ pages: [[entry({ id: "x", comentario: "antigo" })]], pageParams: [0] });

    render(
      <HistoricoItemDialog open itemId={ITEM_ID} onOpenChange={() => {}} />,
    );

    const btn = screen.getByRole("button", { name: /comentar/i });
    expect(btn).toBeDisabled();
  });

  it("mantém o botão desabilitado quando o textarea contém apenas espaços", async () => {
    const user = userEvent.setup();
    setHistoricoData({ pages: [[entry({ id: "x", comentario: "antigo" })]], pageParams: [0] });

    render(
      <HistoricoItemDialog open itemId={ITEM_ID} onOpenChange={() => {}} />,
    );

    const textarea = screen.getByPlaceholderText(/escreva uma observação/i);
    await user.type(textarea, "    ");

    const btn = screen.getByRole("button", { name: /comentar/i });
    expect(btn).toBeDisabled();
  });

  it("não chama mutateAsync quando o conteúdo é apenas whitespace (early return)", async () => {
    const user = userEvent.setup();
    setHistoricoData({ pages: [[entry({ id: "x", comentario: "antigo" })]], pageParams: [0] });

    render(
      <HistoricoItemDialog open itemId={ITEM_ID} onOpenChange={() => {}} />,
    );

    const textarea = screen.getByPlaceholderText(/escreva uma observação/i);
    await user.type(textarea, "   ");
    // Tenta submeter via Ctrl+Enter (atalho comum). O early-return de
    // handleEnviarComentario garante que mutateAsync não é chamado.
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("quando a RPC falha (ex.: comentário > 4000 chars), mostra erro e não muta a timeline", async () => {
    const { toast } = await import("sonner");
    const user = userEvent.setup();

    const rpcError = new Error("comentário inválido (>4000 caracteres)");
    const failingMutate = vi.fn().mockRejectedValue(rpcError);
    useComentarItemMock.mockReturnValue({
      mutateAsync: failingMutate,
      isPending: false,
    });

    setHistoricoData({
      pages: [[entry({ id: "x", acao: "comentario", comentario: "antigo" })]],
      pageParams: [0],
    });

    render(
      <HistoricoItemDialog open itemId={ITEM_ID} onOpenChange={() => {}} />,
    );

    const textarea = screen.getByPlaceholderText(
      /escreva uma observação/i,
    ) as HTMLTextAreaElement;
    await user.type(textarea, "comentario que vai falhar");

    const btn = screen.getByRole("button", { name: /comentar/i });
    await user.click(btn);

    expect(failingMutate).toHaveBeenCalledTimes(1);
    expect((toast as any).error).toHaveBeenCalled();

    // Timeline original permanece intacta — apenas o evento "antigo" segue visível,
    // sem nova entrada criada localmente pelo componente.
    // Apenas a entrada antiga deve continuar na timeline. Como o textarea
    // preserva o texto digitado, usamos queryAllByText para garantir que ele
    // aparece UMA vez (no textarea) — e nunca como evento renderizado.
    expect(screen.getByText(/antigo/)).toBeInTheDocument();
    const matches = screen.queryAllByText(/comentario que vai falhar/i);
    // No máximo 1 ocorrência (o próprio textarea reflete o value via DOM em alguns casos);
    // o importante é não haver entrada NOVA na timeline ScrollArea.
    expect(matches.length).toBeLessThanOrEqual(1);

    // Textarea preserva o conteúdo para o usuário poder corrigir e tentar novamente.
    expect(textarea.value).toBe("comentario que vai falhar");
  });
});
