/**
 * Integração — persistência dos filtros de status do módulo China.
 *
 * Garante que a seleção feita numa tela (Kanban) reaparece idêntica nas outras
 * (Caixa de Entrada / Checklist) ao navegar entre páginas, porque todas usam o
 * mesmo escopo (`CHINA_STATUS_FILTER_SCOPE`) e a mesma preferência por usuário
 * gravada no backend, com cache local para render imediato.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FlowBucket } from "@/lib/china/flowTones";

/* ── Backend fake: uma linha por (user_id, escopo) ───────────────────── */
const backend = new Map<string, string[]>();
let usuario: { id: string } | null = { id: "user-china-1" };
const upsertSpy = vi.fn();
const selectSpy = vi.fn();

vi.mock("@/integrations/supabase/client", () => {
  const chave = (uid: string, escopo: string) => `${uid}::${escopo}`;
  return {
    supabase: {
      auth: { getUser: async () => ({ data: { user: usuario } }) },
      from: (tabela: string) => {
        if (tabela !== "china_status_filter_prefs") throw new Error(`tabela inesperada: ${tabela}`);
        return {
          select: () => ({
            eq: (_c1: string, uid: string) => ({
              eq: (_c2: string, escopo: string) => ({
                maybeSingle: async () => {
                  selectSpy(uid, escopo);
                  const buckets = backend.get(chave(uid, escopo));
                  return { data: buckets ? { buckets } : null, error: null };
                },
              }),
            }),
          }),
          upsert: async (row: { user_id: string; escopo: string; buckets: string[] }) => {
            upsertSpy(row);
            backend.set(chave(row.user_id, row.escopo), row.buckets);
            return { error: null };
          },
        };
      },
    },
  };
});

// Importados depois do mock.
import {
  CHINA_STATUS_FILTER_SCOPE,
  ChinaStatusFilterChips,
  useChinaStatusFilter,
} from "@/components/china/ChinaStatusFilterChips";

const CACHE_KEY = `china-status-filter:${CHINA_STATUS_FILTER_SCOPE}`;

/** Simula uma tela do módulo: monta o hook + os chips. */
function TelaComFiltro({ nome }: { nome: string }) {
  const { selected, setSelected } = useChinaStatusFilter();
  return (
    <div data-testid={`tela-${nome}`}>
      <span data-testid={`sel-${nome}`}>{selected.join(",")}</span>
      <ChinaStatusFilterChips
        counts={{ em_analise: 4, aprovado: 3, rejeitado: 2 }}
        selected={selected}
        onChange={setSelected}
      />
    </div>
  );
}

beforeEach(() => {
  backend.clear();
  localStorage.clear();
  usuario = { id: "user-china-1" };
  upsertSpy.mockClear();
  selectSpy.mockClear();
});

describe("China — filtros de status persistidos por usuário entre telas", () => {
  it("seleção feita no Kanban reaparece na Caixa de Entrada e no Checklist", async () => {
    const user = userEvent.setup();

    // Página 1 — Kanban.
    const kanban = render(<TelaComFiltro nome="kanban" />);
    await waitFor(() => expect(selectSpy).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: /Em análise/ }));
    await waitFor(() =>
      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "user-china-1",
          escopo: CHINA_STATUS_FILTER_SCOPE,
          buckets: ["em_analise"],
        }),
      ),
    );
    kanban.unmount();

    // Página 2 — Caixa de Entrada (novo mount, como numa navegação).
    const inbox = render(<TelaComFiltro nome="inbox" />);
    await waitFor(() =>
      expect(screen.getByTestId("sel-inbox").textContent).toBe("em_analise"),
    );
    expect(screen.getByRole("button", { name: /Em análise/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    inbox.unmount();

    // Página 3 — Checklist: mesmo escopo, mesma visualização.
    render(<TelaComFiltro nome="checklist" />);
    await waitFor(() =>
      expect(screen.getByTestId("sel-checklist").textContent).toBe("em_analise"),
    );
  });

  it("cache local renderiza a seleção antes da resposta do backend", async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(["aprovado"]));
    backend.set(`user-china-1::${CHINA_STATUS_FILTER_SCOPE}`, ["aprovado"]);

    const { result } = renderHook(() => useChinaStatusFilter());
    // Estado inicial (síncrono) já vem do cache.
    expect(result.current.selected).toEqual(["aprovado"]);
    await waitFor(() => expect(selectSpy).toHaveBeenCalled());
    expect(result.current.selected).toEqual(["aprovado"]);
  });

  it("preferência do backend sobrescreve um cache local desatualizado", async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(["pendente"]));
    backend.set(`user-china-1::${CHINA_STATUS_FILTER_SCOPE}`, ["aprovado", "rejeitado"]);

    const { result } = renderHook(() => useChinaStatusFilter());
    await waitFor(() =>
      expect(result.current.selected).toEqual(["aprovado", "rejeitado"]),
    );
    // E o cache local é reconciliado com o backend.
    expect(JSON.parse(localStorage.getItem(CACHE_KEY)!)).toEqual(["aprovado", "rejeitado"]);
  });

  it("valores inválidos vindos do backend ou do cache são descartados", async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(["bucket_inexistente", "aprovado"]));
    backend.set(`user-china-1::${CHINA_STATUS_FILTER_SCOPE}`, [
      "aprovado",
      "coluna_removida",
      "em_analise",
    ]);

    const { result } = renderHook(() => useChinaStatusFilter());
    expect(result.current.selected).toEqual(["aprovado"]);
    await waitFor(() =>
      expect(result.current.selected).toEqual(["aprovado", "em_analise"]),
    );
  });

  it("limpar o filtro numa tela limpa em todas as outras", async () => {
    backend.set(`user-china-1::${CHINA_STATUS_FILTER_SCOPE}`, ["rejeitado"]);
    const user = userEvent.setup();

    const inbox = render(<TelaComFiltro nome="inbox" />);
    await waitFor(() => expect(screen.getByTestId("sel-inbox").textContent).toBe("rejeitado"));

    await user.click(screen.getByText(/Limpar/));
    await waitFor(() =>
      expect(backend.get(`user-china-1::${CHINA_STATUS_FILTER_SCOPE}`)).toEqual([]),
    );
    inbox.unmount();

    render(<TelaComFiltro nome="checklist" />);
    await waitFor(() => expect(selectSpy).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("sel-checklist").textContent).toBe("");
  });

  it("preferência é por usuário: outro usuário não herda o filtro", async () => {
    backend.set(`user-china-1::${CHINA_STATUS_FILTER_SCOPE}`, ["aprovado"]);
    const primeiro = renderHook(() => useChinaStatusFilter());
    await waitFor(() => expect(primeiro.result.current.selected).toEqual(["aprovado"]));
    primeiro.unmount();

    // Troca de sessão: cache local zerado como num novo login.
    usuario = { id: "user-china-2" };
    localStorage.clear();

    const segundo = renderHook(() => useChinaStatusFilter());
    await waitFor(() => expect(selectSpy).toHaveBeenCalledWith("user-china-2", CHINA_STATUS_FILTER_SCOPE));
    expect(segundo.result.current.selected).toEqual([]);
  });

  it("sem sessão o filtro funciona em memória/cache e não grava no backend", async () => {
    usuario = null;
    const { result } = renderHook(() => useChinaStatusFilter());

    await act(async () => {
      result.current.setSelected(["enviado"]);
    });

    expect(result.current.selected).toEqual(["enviado"]);
    expect(JSON.parse(localStorage.getItem(CACHE_KEY)!)).toEqual(["enviado"]);
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it("matches() aplica o mesmo critério de exibição em qualquer tela", async () => {
    backend.set(`user-china-1::${CHINA_STATUS_FILTER_SCOPE}`, ["aprovado", "em_analise"]);
    const { result } = renderHook(() => useChinaStatusFilter());
    await waitFor(() => expect(result.current.selected).toHaveLength(2));

    const buckets: FlowBucket[] = [
      "aprovado",
      "em_analise",
      "rejeitado",
      "enviado",
      "pendente",
      "nao_criado",
    ];
    expect(buckets.filter(result.current.matches)).toEqual(["aprovado", "em_analise"]);

    // Sem seleção, tudo passa (nenhum item some por engano).
    await act(async () => {
      result.current.setSelected([]);
    });
    expect(buckets.filter(result.current.matches)).toEqual(buckets);
  });
});
