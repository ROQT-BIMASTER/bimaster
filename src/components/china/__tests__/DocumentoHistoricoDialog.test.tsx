import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/utils/test-utils";
import { DocumentoHistoricoDialog } from "@/components/china/DocumentoHistoricoDialog";

// Hook mockado por teste
const mockHook = vi.fn();
vi.mock("@/hooks/useChinaDocumentoHistorico", () => ({
  useChinaDocumentoHistorico: (...args: any[]) => mockHook(...args),
}));

// Auditoria não deve quebrar o teste
vi.mock("@/lib/audit/logRlsAccess", () => ({
  logRlsAccess: vi.fn(),
}));

describe("DocumentoHistoricoDialog — mensagens amigáveis", () => {
  beforeEach(() => {
    mockHook.mockReset();
  });

  it("exibe AccessDeniedNotice quando o erro é RLS/42501", async () => {
    mockHook.mockReturnValue({
      data: [],
      isLoading: false,
      error: { code: "42501", message: "permission denied" },
    });

    renderWithProviders(
      <DocumentoHistoricoDialog
        open
        onOpenChange={() => {}}
        documentoId="doc-1"
        tipoDocumentoLabel="Ficha Técnica"
      />,
    );

    expect(await screen.findByText(/Sem permissão para ver o histórico/i)).toBeInTheDocument();
    const btn = screen.getByTestId("access-denied-request-btn");
    expect(btn).toBeInTheDocument();

    await userEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: /Solicitar acesso/i })).toBeInTheDocument();
    });
  });

  it("mostra empty state quando não há erro nem versões", async () => {
    mockHook.mockReturnValue({ data: [], isLoading: false, error: null });
    renderWithProviders(
      <DocumentoHistoricoDialog open onOpenChange={() => {}} documentoId="doc-2" />,
    );
    expect(await screen.findByText(/Sem versões anteriores ainda/i)).toBeInTheDocument();
  });

  it("mostra loader enquanto carrega", () => {
    mockHook.mockReturnValue({ data: [], isLoading: true, error: null });
    renderWithProviders(
      <DocumentoHistoricoDialog open onOpenChange={() => {}} documentoId="doc-3" />,
    );
    expect(screen.getByText(/Carregando histórico/i)).toBeInTheDocument();
  });
});
