/**
 * Testes: trilha de auditoria de tentativas negadas e ações bloqueadas.
 *
 * Cobre:
 *  1) `ScreenProtectedRoute` — registra a tentativa negada via RPC
 *     `log_access_denied` (tela, rota completa, user agent), avisa o usuário
 *     e evita duplicidade de registro na mesma rota.
 *  2) Acesso permitido — nenhum registro de negativa é gravado.
 *  3) Ações bloqueadas de chat — gravadas em `chat_acoes_auditoria` na fase
 *     "falhou", com a causa normalizada e sem quebrar o fluxo do usuário.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

const toastMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
const rpcMock = vi.hoisted(() => vi.fn());
const authMock = vi.hoisted(() => ({ session: { user: { id: "u1" } } as any }));
const permsMock = vi.hoisted(() => ({ loading: false, permissionsReady: true, role: "vendedor" }));
const impersonationMock = vi.hoisted(() => ({ hasScreenPermission: vi.fn(() => false) }));
const locationMock = vi.hoisted(() => ({ value: { pathname: "/dashboard/financeiro", search: "?tab=dre" } }));

vi.mock("sonner", () => ({ toast: toastMock }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: rpcMock } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => authMock }));
vi.mock("@/contexts/PermissionsContext", () => ({ usePermissions: () => permsMock }));
vi.mock("@/contexts/ImpersonationContext", () => ({ useImpersonation: () => impersonationMock }));
vi.mock("react-router-dom", () => ({
  useLocation: () => locationMock.value,
  useNavigate: () => vi.fn(),
}));

import { ScreenProtectedRoute } from "@/components/auth/ScreenProtectedRoute";
import { registrarAcaoChat } from "@/lib/chat/acoesAuditoria";

const okRpc = () => Promise.resolve({ data: "audit-1", error: null });

beforeEach(() => {
  toastMock.error.mockClear();
  toastMock.success.mockClear();
  rpcMock.mockReset();
  rpcMock.mockImplementation(okRpc);
  impersonationMock.hasScreenPermission.mockReset();
  impersonationMock.hasScreenPermission.mockReturnValue(false);
  permsMock.loading = false;
  permsMock.permissionsReady = true;
  permsMock.role = "vendedor";
  authMock.session = { user: { id: "u1" } } as any;
  locationMock.value = { pathname: "/dashboard/financeiro", search: "?tab=dre" };
});

function renderGuard(props: Partial<React.ComponentProps<typeof ScreenProtectedRoute>> = {}) {
  return render(
    React.createElement(
      ScreenProtectedRoute,
      { screenCode: "financeiro_dre", ...props } as any,
      React.createElement("div", null, "conteúdo protegido"),
    ),
  );
}

describe("Auditoria de tentativas negadas (ScreenProtectedRoute)", () => {
  it("registra a tentativa negada com tela, rota completa e user agent", async () => {
    renderGuard();

    await waitFor(() => expect(rpcMock).toHaveBeenCalled());
    const [fn, args] = rpcMock.mock.calls[0];
    expect(fn).toBe("log_access_denied");
    expect(args._screen_code).toBe("financeiro_dre");
    expect(args._route).toBe("/dashboard/financeiro?tab=dre");
    expect(typeof args._user_agent === "string" || args._user_agent === null).toBe(true);
  });

  it("avisa o usuário e bloqueia o conteúdo", async () => {
    renderGuard();

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("Acesso negado", {
        description: "Você não tem permissão para acessar esta tela.",
      }),
    );
    expect(screen.queryByText("conteúdo protegido")).not.toBeInTheDocument();
  });

  it("não duplica o registro em re-renderizações da mesma rota", async () => {
    const { rerender } = renderGuard();
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(1));

    rerender(
      React.createElement(
        ScreenProtectedRoute,
        { screenCode: "financeiro_dre" } as any,
        React.createElement("div", null, "conteúdo protegido"),
      ),
    );

    await new Promise((r) => setTimeout(r, 20));
    expect(rpcMock).toHaveBeenCalledTimes(1);
  });

  it("não registra quando o usuário tem permissão à tela", async () => {
    impersonationMock.hasScreenPermission.mockReturnValue(true);
    renderGuard();

    expect(await screen.findByText("conteúdo protegido")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 20));
    expect(rpcMock).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("não registra quando a role está explicitamente liberada", async () => {
    permsMock.role = "admin";
    renderGuard({ allowRoles: ["admin"] } as any);

    expect(await screen.findByText("conteúdo protegido")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 20));
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("não registra antes das permissões carregarem (evita falso negativo)", async () => {
    permsMock.permissionsReady = false;
    permsMock.loading = true;
    renderGuard();

    await new Promise((r) => setTimeout(r, 20));
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("não registra usuário sem sessão (fica a cargo do ProtectedRoute)", async () => {
    authMock.session = null;
    renderGuard();

    expect(await screen.findByText("conteúdo protegido")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 20));
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("falha do registro não derruba a tela (apenas log interno)", async () => {
    rpcMock.mockImplementation(() =>
      Promise.resolve({ data: null, error: { message: "permission denied" } }),
    );
    renderGuard();

    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/não tem permissão/i)).toBeInTheDocument();
  });
});

describe("Auditoria de ações bloqueadas (chat_acoes_auditoria)", () => {
  it("grava a fase 'falhou' com a causa do bloqueio", async () => {
    await registrarAcaoChat({
      acao: "aprovacao",
      fase: "falhou",
      entidadeTipo: "tarefa",
      entidadeId: "t1",
      erro: new Error("Você não tem permissão para aprovar este documento"),
    });

    expect(rpcMock).toHaveBeenCalledTimes(1);
    const [fn, args] = rpcMock.mock.calls[0];
    expect(fn).toBe("rpc_registrar_acao_chat_auditoria");
    expect(args.p_fase).toBe("falhou");
    expect(args.p_acao).toBe("aprovacao");
    expect(args.p_entidade_tipo).toBe("tarefa");
    expect(args.p_entidade_id).toBe("t1");
    expect(args.p_erro).toBe("Você não tem permissão para aprovar este documento");
  });

  it("normaliza erro em texto e aceita erro ausente", async () => {
    await registrarAcaoChat({
      acao: "urgente",
      fase: "falhou",
      entidadeTipo: "processo",
      erro: "step-up obrigatório",
    });
    expect(rpcMock.mock.calls[0][1].p_erro).toBe("step-up obrigatório");

    rpcMock.mockClear();
    await registrarAcaoChat({ acao: "urgente", fase: "iniciada", entidadeTipo: "conversa" });
    expect(rpcMock.mock.calls[0][1].p_erro).toBeNull();
    expect(rpcMock.mock.calls[0][1].p_entidade_id).toBeNull();
  });

  it("nunca lança quando o backend recusa o registro de auditoria", async () => {
    rpcMock.mockImplementation(() =>
      Promise.resolve({ data: null, error: { message: "row-level security" } }),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      registrarAcaoChat({ acao: "aprovacao", fase: "falhou", entidadeTipo: "tarefa", entidadeId: "t1" }),
    ).resolves.toBeNull();

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
