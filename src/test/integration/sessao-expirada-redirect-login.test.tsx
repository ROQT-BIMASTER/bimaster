/**
 * Testes: expiração de sessão e redirecionamento para login.
 *
 * Cobre:
 *  1) Sessão válida → conteúdo protegido renderiza.
 *  2) Sessão expirada (session vira null em runtime, ex.: refresh token inválido)
 *     → redireciona para /auth/login sem exigir F5.
 *  3) Sessão expirada durante o carregamento (safety timeout) → também redireciona.
 *  4) Sem permissão de tela + sessão expirada → o redirecionamento para login
 *     tem prioridade sobre a tela de "Acesso Restrito".
 *  5) Sem permissão de tela COM sessão válida → permanece em Acesso Restrito
 *     (não redireciona para login).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const authMock = vi.hoisted(() => ({
  session: { user: { id: "u1" } } as any,
  approved: true,
  isActive: true,
  loading: false,
}));
const permsMock = vi.hoisted(() => ({
  role: "vendedor" as string | null,
  loading: false,
  permissionsReady: true,
}));
const impersonationMock = vi.hoisted(() => ({ hasScreenPermission: vi.fn(() => false) }));
const rpcMock = vi.hoisted(() => vi.fn(() => Promise.resolve({ data: null, error: null })));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => authMock }));
vi.mock("@/contexts/PermissionsContext", () => ({ usePermissions: () => permsMock }));
vi.mock("@/contexts/ImpersonationContext", () => ({ useImpersonation: () => impersonationMock }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: rpcMock } }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ScreenProtectedRoute } from "@/components/auth/ScreenProtectedRoute";

function renderApp(ui: React.ReactNode, initial = "/dashboard/financeiro") {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/auth/login" element={<div>Tela de login</div>} />
        <Route path="/dashboard/financeiro" element={<>{ui}</>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  authMock.session = { user: { id: "u1" } };
  authMock.loading = false;
  authMock.approved = true;
  authMock.isActive = true;
  permsMock.role = "vendedor";
  permsMock.loading = false;
  permsMock.permissionsReady = true;
  impersonationMock.hasScreenPermission.mockReturnValue(true);
  rpcMock.mockClear();
});

describe("Expiração de sessão → redirecionamento para login", () => {
  it("renderiza o conteúdo quando a sessão é válida", () => {
    renderApp(
      <ProtectedRoute>
        <div>Conteúdo protegido</div>
      </ProtectedRoute>,
    );
    expect(screen.getByText("Conteúdo protegido")).toBeInTheDocument();
  });

  it("redireciona para /auth/login quando a sessão expira em runtime", async () => {
    const { rerender } = renderApp(
      <ProtectedRoute>
        <div>Conteúdo protegido</div>
      </ProtectedRoute>,
    );
    expect(screen.getByText("Conteúdo protegido")).toBeInTheDocument();

    // Simula expiração: refresh token inválido → session = null
    authMock.session = null;
    rerender(
      <MemoryRouter initialEntries={["/dashboard/financeiro"]}>
        <Routes>
          <Route path="/auth/login" element={<div>Tela de login</div>} />
          <Route
            path="/dashboard/financeiro"
            element={
              <ProtectedRoute>
                <div>Conteúdo protegido</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText("Tela de login")).toBeInTheDocument());
    expect(screen.queryByText("Conteúdo protegido")).not.toBeInTheDocument();
  });

  it("redireciona para login mesmo quando o safety timeout dispara sem sessão", async () => {
    vi.useFakeTimers();
    authMock.session = null;
    authMock.loading = true;
    renderApp(
      <ProtectedRoute>
        <div>Conteúdo protegido</div>
      </ProtectedRoute>,
    );
    await vi.advanceTimersByTimeAsync(6000);
    vi.useRealTimers();
    await waitFor(() => expect(screen.getByText("Tela de login")).toBeInTheDocument());
  });

  it("prioriza o login sobre 'Acesso Restrito' quando a sessão expirou e não há permissão", async () => {
    authMock.session = null;
    impersonationMock.hasScreenPermission.mockReturnValue(false);

    renderApp(
      <ProtectedRoute>
        <ScreenProtectedRoute screenCode="financeiro_dre">
          <div>Conteúdo protegido</div>
        </ScreenProtectedRoute>
      </ProtectedRoute>,
    );

    await waitFor(() => expect(screen.getByText("Tela de login")).toBeInTheDocument());
    expect(screen.queryByText(/não tem permissão/i)).not.toBeInTheDocument();
    // Sem sessão não faz sentido auditar tentativa negada
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("mantém 'Acesso Restrito' (sem redirecionar ao login) quando há sessão válida sem permissão", async () => {
    impersonationMock.hasScreenPermission.mockReturnValue(false);

    renderApp(
      <ProtectedRoute>
        <ScreenProtectedRoute screenCode="financeiro_dre">
          <div>Conteúdo protegido</div>
        </ScreenProtectedRoute>
      </ProtectedRoute>,
    );

    await waitFor(() =>
      expect(screen.getByText(/não tem permissão para acessar esta tela/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText("Tela de login")).not.toBeInTheDocument();
    expect(rpcMock).toHaveBeenCalledWith(
      "log_access_denied",
      expect.objectContaining({ _screen_code: "financeiro_dre" }),
    );
  });
});
