import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/utils/test-utils";
import { LoteAprovacaoCard } from "@/components/projetos/aprovacoes/LoteAprovacaoCard";

const useLoteEventos = vi.fn();
const useLoteEtapas = vi.fn();
const useLoteDocumentos = vi.fn();

vi.mock("@/hooks/useLoteAprovacao", () => ({
  useLoteEventos: (...a: any[]) => useLoteEventos(...a),
  useLoteEtapas: (...a: any[]) => useLoteEtapas(...a),
  useLoteDocumentos: (...a: any[]) => useLoteDocumentos(...a),
  useAvancarEtapa: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/lib/audit/logRlsAccess", () => ({
  logRlsAccess: vi.fn(),
}));

const baseLote = {
  id: "lote-1",
  config_id: "cfg-1",
  tarefa_id: "t-1",
  secao_id: null,
  projeto_id: null,
  lote_nome: "Lote X",
  titulo: null,
  descricao: null,
  status: "em_andamento",
  etapa_atual_ordem: 1,
  rodada: 1,
  prazo_lote: null,
  politica_movimentacao: "continuar",
  created_at: new Date().toISOString(),
  created_by: null,
};

describe("LoteAprovacaoCard — friendly RLS errors", () => {
  beforeEach(() => {
    useLoteEtapas.mockReturnValue({ data: [] });
    useLoteDocumentos.mockReturnValue({ data: [] });
    useLoteEventos.mockReset();
  });

  it("mostra AccessDeniedNotice quando eventos retornam erro 42501", () => {
    useLoteEventos.mockReturnValue({
      data: [],
      error: { code: "42501", message: "row-level security" },
    });
    renderWithProviders(<LoteAprovacaoCard lote={baseLote as any} />);
    expect(screen.getByText(/Sem permissão para ver o histórico de aprovação/i)).toBeInTheDocument();
    expect(screen.getByTestId("access-denied-request-btn")).toBeInTheDocument();
  });

  it("não mostra AccessDeniedNotice quando erro não é de permissão", () => {
    useLoteEventos.mockReturnValue({
      data: [],
      error: { code: "23505", message: "duplicate key" },
    });
    renderWithProviders(<LoteAprovacaoCard lote={baseLote as any} />);
    expect(screen.queryByText(/Sem permissão para ver o histórico/i)).not.toBeInTheDocument();
  });

  it("renderiza normalmente sem erro nenhum", () => {
    useLoteEventos.mockReturnValue({ data: [], error: null });
    renderWithProviders(<LoteAprovacaoCard lote={baseLote as any} />);
    expect(screen.getByText("Lote X")).toBeInTheDocument();
    expect(screen.queryByText(/Sem permissão/i)).not.toBeInTheDocument();
  });
});
