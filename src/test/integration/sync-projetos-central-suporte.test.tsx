/**
 * Integração ponta a ponta — Sincronização Projetos / Kanban / Central de
 * Trabalho / Central de Suporte.
 *
 * Cobre os 4 contratos definidos no PR de correção:
 *
 *  1. `useMinhasTarefas` propaga os campos `ticket_*` retornados pela RPC
 *     `get_minhas_tarefas_central` e assina realtime em `suporte_tickets`
 *     (mesmo mecanismo do Kanban).
 *  2. `SuporteTicketDrawer` invoca a RPC `add_conversa_participante_if_missing`
 *     quando abre com um ticket que tem `conversa_id` — evita "Conversa não
 *     encontrada" para observadores autorizados (dono, solicitante, fila).
 *  3. `ChatThread` usa `useConversaInfo` como fallback: quando o usuário
 *     ainda não é participante da conversa mas existe informação da conversa,
 *     renderiza normalmente em vez de bloquear com "Conversa não encontrada".
 *  4. Só devolve "Conversa não encontrada" quando conv **e** info estão
 *     ausentes (contrato original preservado).
 *
 * Tudo é mockado: nenhuma chamada real ao backend.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import React from "react";

// ---------------------------------------------------------------------------
// Mocks globais
// ---------------------------------------------------------------------------

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// Estado compartilhado do mock do supabase.
const rpc = vi.fn();
const channelOn = vi.fn();
const channelSubscribe = vi.fn();
const removeChannel = vi.fn().mockResolvedValue(undefined);

const channelApi: any = {
  on: (...args: any[]) => {
    channelOn(...args);
    return channelApi;
  },
  subscribe: (cb?: any) => {
    channelSubscribe(cb);
    return channelApi;
  },
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: any[]) => rpc(...args),
    channel: vi.fn(() => channelApi),
    removeChannel: (...args: any[]) => removeChannel(...args),
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-obs-1", email: "obs@x.com" } }),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/realtime/channelName", () => ({
  uniqueChannelName: (base: string) => `${base}::test`,
}));

// ---------------------------------------------------------------------------
// Wrapper
// ---------------------------------------------------------------------------

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
  return { qc, Wrapper };
}

beforeEach(() => {
  rpc.mockReset();
  channelOn.mockClear();
  channelSubscribe.mockClear();
  removeChannel.mockClear();
  // Defaults seguros para hooks de chat (ver mocks abaixo).
  mockConversas.mockReturnValue({ data: [], isLoading: false });
  mockConversaInfo.mockReturnValue({ data: null });
  // jsdom não implementa scrollIntoView, usado pelo ChatThread.
  if (!(Element.prototype as any).scrollIntoView) {
    (Element.prototype as any).scrollIntoView = vi.fn();
  }
});

// Estado partilhado dos hooks de chat — declarado no topo (hoisted) para ficar
// disponível dentro do `beforeEach` e nos `vi.mock` mais abaixo.
const mockConversas = vi.fn();
const mockConversaInfo = vi.fn();

// ===========================================================================
// 1. useMinhasTarefas — RPC + realtime em suporte_tickets
// ===========================================================================

describe("Sync #1 — Central de Trabalho expõe estado do ticket (Kanban)", () => {
  it("propaga ticket_* do payload da RPC get_minhas_tarefas_central", async () => {
    rpc.mockResolvedValueOnce({
      data: [
        {
          id: "tar-1",
          titulo: "Tarefa espelho",
          descricao: null,
          status: "em_andamento",
          prioridade: "alta",
          data_inicio_planejada: null,
          data_prazo: null,
          data_conclusao: null,
          projeto_id: "proj-1",
          projeto_nome: "Suporte",
          projeto_cor: "#000",
          estagio: "em_atendimento",
          criador_id: "user-obs-1",
          visibilidade: "publica",
          secao_id: null,
          secao_nome: null,
          ordem: 0,
          parent_tarefa_id: null,
          responsavel_id: "user-obs-1",
          responsavel_nome: "Observador",
          responsavel_avatar_url: null,
          codigo: "T-1",
          produto_id: null,
          created_at: "2026-07-16T10:00:00Z",
          updated_at: "2026-07-16T10:00:00Z",
          papel: "responsavel",
          ticket_id: "tic-1",
          ticket_protocolo: "RR-20260714-8C2707",
          ticket_status: "em_atendimento",
          ticket_sla_status: "em_risco",
          ticket_prazo_resolucao_em: "2026-07-17T18:00:00Z",
          ticket_fila_id: "fila-1",
          ticket_fila_nome: "Financeiro",
          ticket_ultima_interacao_em: "2026-07-16T11:00:00Z",
          ticket_prioridade: "alta",
          ticket_conversa_id: "conv-1",
        },
      ],
      error: null,
    });

    const { useMinhasTarefas } = await import("@/hooks/useMinhasTarefas");
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useMinhasTarefas(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(rpc).toHaveBeenCalledWith("get_minhas_tarefas_central", {
      p_limite_concluidas: 50,
      p_incluir_criador: true,
    });
    const row = result.current.data![0];
    expect(row.ticket_id).toBe("tic-1");
    expect(row.ticket_protocolo).toBe("RR-20260714-8C2707");
    expect(row.ticket_status).toBe("em_atendimento");
    expect(row.ticket_sla_status).toBe("em_risco");
    expect(row.ticket_fila_nome).toBe("Financeiro");
    expect(row.ticket_conversa_id).toBe("conv-1");
  });

  it("assina realtime em suporte_tickets (mesma fonte que o Kanban)", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    const { useMinhasTarefas } = await import("@/hooks/useMinhasTarefas");
    const { Wrapper } = makeWrapper();
    renderHook(() => useMinhasTarefas(), { wrapper: Wrapper });

    await waitFor(() => expect(channelSubscribe).toHaveBeenCalled());

    const subscribedTables = channelOn.mock.calls
      .map((c) => c[1]?.table)
      .filter(Boolean);
    expect(subscribedTables).toContain("projeto_tarefas");
    expect(subscribedTables).toContain("projeto_tarefa_responsaveis");
    expect(subscribedTables).toContain("suporte_tickets");
  });
});

// ===========================================================================
// 2. SuporteTicketDrawer — garante participante da conversa
// ===========================================================================

// Mocks estruturais do drawer (dependências não relacionadas ao contrato testado).
vi.mock("@/hooks/suporte/useSuporteAcoes", () => ({
  useSuporteAcoes: () => ({
    assumir: { mutate: vi.fn(), isPending: false },
    mudarStatus: { mutate: vi.fn(), isPending: false },
  }),
}));
// ChatThread NÃO é mockado: os testes #3/#4 exercitam o próprio componente
// (as dependências internas do chat estão mockadas mais abaixo).
vi.mock("@/components/suporte/CsatPrompt", () => ({ CsatPrompt: () => null }));
vi.mock("@/components/suporte/TicketEtapaBadge", () => ({
  TicketEtapaBadge: () => null,
}));
vi.mock("@/components/suporte/TransferirChamadoDialog", () => ({
  TransferirChamadoDialog: () => null,
}));
vi.mock("@/components/suporte/EscalonarChamadoDialog", () => ({
  EscalonarChamadoDialog: () => null,
}));
vi.mock("@/components/suporte/SuporteSlaCountdown", () => ({
  SuporteSlaCountdown: () => null,
}));
vi.mock("@/components/suporte/pareceres/PareceresTab", () => ({
  PareceresTab: () => null,
}));

describe("Sync #2 — SuporteTicketDrawer garante participação do observador", () => {
  it("chama add_conversa_participante_if_missing ao abrir ticket com conversa_id", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const { SuporteTicketDrawer } = await import(
      "@/components/suporte/SuporteTicketDrawer"
    );
    const { Wrapper } = makeWrapper();

    const ticket: any = {
      id: "tic-1",
      conversa_id: "conv-abc",
      protocolo: "RR-20260714-8C2707",
      titulo: "Divergência",
      status: "em_atendimento",
      prioridade: "alta",
      owner_id: "u2",
      requester_id: "u2",
      assignee_id: "user-obs-1",
      fila_id: "fila-1",
    };

    render(
      React.createElement(SuporteTicketDrawer, { ticket, onClose: () => {} }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(rpc).toHaveBeenCalledWith(
        "add_conversa_participante_if_missing",
        { _conversa_id: "conv-abc" },
      );
    });
  });
});

// ===========================================================================
// 3 & 4. ChatThread — fallback via useConversaInfo
// ===========================================================================

vi.mock("@/hooks/chat/useConversas", () => ({
  useConversas: () => mockConversas(),
}));
vi.mock("@/hooks/chat/useMensagens", () => ({
  useMensagens: () => ({
    mensagens: [],
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
  }),
  useConversaInfo: () => mockConversaInfo(),
}));
vi.mock("@/hooks/chat/useChatPresence", () => ({
  useChatRoomPresence: () => ({ digitandoUserIds: [], enviarDigitando: vi.fn() }),
  useGlobalPresence: () => ({ online: new Set<string>() }),
}));
vi.mock("@/hooks/chat/useChatActions", () => ({
  useChatActions: () => ({
    marcarLido: { mutate: vi.fn() },
    setParticipanteFlag: { mutate: vi.fn() },
  }),
}));
vi.mock("@/hooks/chat/usePresenceStatus", () => ({
  usePresenceStatusMap: () => ({ data: new Map() }),
  PRESENCE_STATUS_INFO: {},
}));
vi.mock("@/components/chat/v2/MessageInput", () => ({ MessageInput: () => null }));
vi.mock("@/components/chat/v2/MessageBubble", () => ({ MessageBubble: () => null }));
vi.mock("@/components/chat/v2/MyProtocolsBar", () => ({ MyProtocolsBar: () => null }));

describe("Sync #3 — ChatThread fallback via useConversaInfo", () => {
  it("renderiza chat via useConversaInfo quando o usuário não é participante ainda", async () => {
    mockConversas.mockReturnValue({ data: [], isLoading: false });
    mockConversaInfo.mockReturnValue({
      data: {
        conversa: {
          id: "conv-abc",
          nome: "Ticket RR-20260714-8C2707",
          tipo: "grupo",
          avatar_url: null,
        },
        participantes: [{ id: "u1" }, { id: "u2" }],
      },
    });

    const { ChatThread } = await import("@/components/chat/v2/ChatThread");
    const { Wrapper } = makeWrapper();

    render(
      React.createElement(ChatThread, {
        conversaId: "conv-abc",
        onShowInfo: () => {},
      }),
      { wrapper: Wrapper },
    );

    expect(screen.queryByText("Conversa não encontrada")).not.toBeInTheDocument();
    expect(screen.getByText(/RR-20260714-8C2707/)).toBeInTheDocument();
  });

  it("mantém 'Conversa não encontrada' quando não há conv nem info", async () => {
    mockConversas.mockReturnValue({ data: [], isLoading: false });
    mockConversaInfo.mockReturnValue({ data: null });

    const { ChatThread } = await import("@/components/chat/v2/ChatThread");
    const { Wrapper } = makeWrapper();

    render(
      React.createElement(ChatThread, {
        conversaId: "conv-inexistente",
        onShowInfo: () => {},
      }),
      { wrapper: Wrapper },
    );

    expect(screen.getByText("Conversa não encontrada")).toBeInTheDocument();
  });
});
