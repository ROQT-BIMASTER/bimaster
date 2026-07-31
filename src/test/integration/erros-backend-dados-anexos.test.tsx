/**
 * Testes: mensagens de erro corretas quando o backend falha ao buscar
 * dados e anexos.
 *
 * Cobre:
 *  1) Helper padronizado `mensagemErroDados` / `toastErroDados`.
 *  2) Toast do download de anexos em lote quando o backend falha.
 *  3) Mensagem inline do visualizador quando a assinatura do arquivo falha.
 *  4) Propagação do erro do backend em `useTarefasAnexos` (query em estado de erro).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const toastMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

import {
  mensagemErroDados,
  tituloErroDados,
  toastErroDados,
  FALHA_GENERICA_DADOS,
} from "@/lib/errors/dadosFeedback";

beforeEach(() => {
  toastMock.error.mockClear();
  toastMock.success.mockClear();
});

describe("mensagemErroDados", () => {
  it("traduz falta de permissão (42501 / RLS) citando o recurso", () => {
    expect(mensagemErroDados({ code: "42501", message: "permission denied" }, "anexos")).toBe(
      "Você não tem permissão para acessar os anexos.",
    );
    expect(
      mensagemErroDados({ message: "new row violates row-level security policy" }, "tarefas"),
    ).toBe("Você não tem permissão para acessar as tarefas.");
  });

  it("traduz limite de requisições", () => {
    expect(mensagemErroDados({ code: "PGRST301" }, "dados")).toBe(
      "Limite de requisições excedido. Aguarde alguns instantes e tente novamente.",
    );
  });

  it("traduz sessão expirada", () => {
    expect(mensagemErroDados({ message: "JWT expired" }, "anexos")).toBe(
      "Sua sessão expirou. Entre novamente para continuar.",
    );
  });

  it("traduz falha de rede e timeout", () => {
    expect(mensagemErroDados(new TypeError("Failed to fetch"), "tarefas")).toBe(
      "Falha de conexão com o servidor. Verifique sua internet e tente novamente.",
    );
    expect(mensagemErroDados(new Error("request timeout"), "anexos")).toBe(
      "Falha de conexão com o servidor. Verifique sua internet e tente novamente.",
    );
  });

  it("traduz arquivo inexistente no storage", () => {
    expect(mensagemErroDados({ message: "Object not found" }, "pre-visualizacao")).toBe(
      "Não encontramos a pré-visualização no servidor. O item pode ter sido removido.",
    );
  });

  it("nunca devolve string vazia", () => {
    expect(mensagemErroDados(null, "dados")).toBe(FALHA_GENERICA_DADOS);
    expect(mensagemErroDados({ message: "   " }, "dados")).toBe(FALHA_GENERICA_DADOS);
    expect(mensagemErroDados(undefined, "anexos")).toBe(FALHA_GENERICA_DADOS);
  });

  it("mantém a mensagem original quando já é legível", () => {
    expect(mensagemErroDados(new Error("Pacote excede 20 MB"), "download")).toBe(
      "Pacote excede 20 MB",
    );
  });

  it("gera títulos por recurso, sem pontuação final", () => {
    expect(tituloErroDados("anexos")).toBe("Não foi possível carregar os anexos");
    expect(tituloErroDados("tarefas")).toBe("Não foi possível carregar as tarefas");
    expect(tituloErroDados("download")).toBe("Não foi possível carregar o pacote de download");
    expect(tituloErroDados()).toBe("Não foi possível carregar os dados");
    expect(tituloErroDados("anexos").endsWith(".")).toBe(false);
  });

  it("toastErroDados usa toast.error com título + descrição", () => {
    toastErroDados({ code: "42501", message: "permission denied" }, "anexos");
    expect(toastMock.error).toHaveBeenCalledWith("Não foi possível carregar os anexos", {
      description: "Você não tem permissão para acessar os anexos.",
    });
  });
});

describe("useTarefasAnexos — erro do backend é propagado", () => {
  it("expõe isError com a mensagem do backend (sem dados parciais)", async () => {
    vi.resetModules();
    const erro = { code: "42501", message: "permission denied for table projeto_tarefa_anexos" };
    vi.doMock("@/integrations/supabase/client", () => ({
      supabase: {
        from: () => ({
          select: () => ({ in: async () => ({ data: null, error: erro }) }),
        }),
        channel: () => {
          const ch: any = { on: () => ch, subscribe: () => ch };
          return ch;
        },
        removeChannel: () => {},
      },
    }));

    const { useTarefasAnexos } = await import("@/hooks/useTarefasAnexos");
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useTarefasAnexos("proj-1", ["t1"]), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
    expect(mensagemErroDados(result.current.error, "anexos")).toBe(
      "Você não tem permissão para acessar os anexos.",
    );
    vi.doUnmock("@/integrations/supabase/client");
  });
});

describe("ArquivoPreviewDialog — falha ao assinar o arquivo", () => {
  it("mostra mensagem clara quando a pré-visualização não pode ser carregada", async () => {
    vi.resetModules();
    vi.doMock("@/hooks/useSignedThumbUrl", () => ({
      useSignedThumbUrl: () => ({ data: null, isLoading: false, isError: true }),
    }));
    vi.doMock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));

    const { ArquivoPreviewDialog } = await import("@/components/projetos/ArquivoPreviewDialog");

    render(
      React.createElement(ArquivoPreviewDialog, {
        open: true,
        onOpenChange: vi.fn(),
        projetoId: "proj-1",
        arquivo: {
          nome: "foto.png",
          tipo: "image/png",
          storage_path: "uid/foto.png",
          tarefa_id: "t1",
        },
      }),
    );

    expect(
      await screen.findByText("Não foi possível carregar a pré-visualização."),
    ).toBeInTheDocument();
    vi.doUnmock("@/hooks/useSignedThumbUrl");
    vi.doUnmock("react-router-dom");
  });
});

describe("Download de anexos em lote — falha do backend", () => {
  it("emite toast padronizado com título e causa", async () => {
    toastErroDados({ message: "Failed to fetch" }, "download");
    expect(toastMock.error).toHaveBeenCalledWith("Não foi possível carregar o pacote de download", {
      description: "Falha de conexão com o servidor. Verifique sua internet e tente novamente.",
    });
  });

  it("o componente de download usa o helper padronizado (sem erro técnico cru)", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile(
      "src/components/projetos/DownloadAnexosLoteDialog.tsx",
      "utf-8",
    );
    expect(src).toContain("toastErroDados(e, \"download\")");
    expect(src).not.toContain("e instanceof Error ? e.message");
  });
});
