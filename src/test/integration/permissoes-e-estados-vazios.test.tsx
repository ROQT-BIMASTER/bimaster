/**
 * Cobertura de cenários negativos: usuário sem permissão e estados vazios.
 *
 * Valida:
 *  1. Guards de tela e módulo bloqueiam (AccessDenied), emitem toast de erro e
 *     registram a tentativa via log_access_denied — sem vazar o conteúdo protegido.
 *  2. Liberação por permissão explícita e por allowRoles.
 *  3. Estados vazios/sem registro: resumo de ações sem histórico, card sem anexos,
 *     selo "Aguardando documentos" e lista de anexos vazia.
 *  4. Mensagens de erro quando o backend falha ao abrir aprovação / chamar atenção.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const rpcMock = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();

let permState = { loading: false, permissionsReady: true, role: "usuario" as string | null };
let sessionState: unknown = { user: { id: "user-1" } };
let telasPermitidas = new Set<string>();
let modulosPermitidos = new Set<string>();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ session: sessionState, user: { id: "user-1" } }),
}));

vi.mock("@/contexts/PermissionsContext", () => ({
  usePermissions: () => permState,
}));

vi.mock("@/contexts/ImpersonationContext", () => ({
  useImpersonation: () => ({
    isImpersonating: false,
    stopImpersonation: vi.fn(),
    hasScreenPermission: (code: string) => telasPermitidas.has(code),
    hasModulePermission: (code: string) => modulosPermitidos.has(code),
  }),
}));

const historicoState: { data: unknown[]; isLoading: boolean } = { data: [], isLoading: false };
vi.mock("@/hooks/chat/useTarefaAcoesHistorico", () => ({
  useTarefaAcoesHistorico: () => historicoState,
}));

import { ScreenProtectedRoute } from "@/components/auth/ScreenProtectedRoute";
import { ModuleProtectedRoute } from "@/components/auth/ModuleProtectedRoute";
import { TarefaAcoesHistoricoResumo } from "@/components/projetos/tarefa-detalhe/TarefaAcoesHistoricoResumo";
import { TarefaAnexosBadge } from "@/components/projetos/TarefaAnexosBadge";
import { useAbrirAcaoVinculada } from "@/hooks/chat/useAbrirAcaoVinculada";

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const CONTEUDO = "Conteúdo protegido da tela";

function renderRota(node: React.ReactNode) {
  return render(<MemoryRouter initialEntries={["/dashboard/protegida"]}>{node}</MemoryRouter>);
}

beforeEach(() => {
  rpcMock.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
  rpcMock.mockResolvedValue({ data: null, error: null });
  permState = { loading: false, permissionsReady: true, role: "usuario" };
  sessionState = { user: { id: "user-1" } };
  telasPermitidas = new Set();
  modulosPermitidos = new Set();
  historicoState.data = [];
  historicoState.isLoading = false;
});

describe("usuário sem permissão — bloqueio de tela", () => {
  it("exibe Acesso Restrito e não renderiza o conteúdo protegido", async () => {
    renderRota(
      <ScreenProtectedRoute screenCode="financeiro_dre">
        <div>{CONTEUDO}</div>
      </ScreenProtectedRoute>,
    );

    expect(await screen.findByText("Acesso Restrito")).toBeTruthy();
    expect(
      screen.getByText("Você não tem permissão para acessar esta tela."),
    ).toBeTruthy();
    expect(screen.queryByText(CONTEUDO)).toBeNull();
  });

  it("emite toast de acesso negado e registra a tentativa", async () => {
    renderRota(
      <ScreenProtectedRoute screenCode="financeiro_dre">
        <div>{CONTEUDO}</div>
      </ScreenProtectedRoute>,
    );

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Acesso negado",
        expect.objectContaining({
          description: "Você não tem permissão para acessar esta tela.",
        }),
      ),
    );
    await waitFor(() => {
      const log = rpcMock.mock.calls.find((c) => c[0] === "log_access_denied");
      expect(log).toBeTruthy();
      expect(log![1]).toMatchObject({
        _screen_code: "financeiro_dre",
        _route: "/dashboard/protegida",
      });
    });
  });

  it("libera quando a tela está entre as permissões do usuário", () => {
    telasPermitidas = new Set(["financeiro_dre"]);
    renderRota(
      <ScreenProtectedRoute screenCode="financeiro_dre">
        <div>{CONTEUDO}</div>
      </ScreenProtectedRoute>,
    );

    expect(screen.getByText(CONTEUDO)).toBeTruthy();
    expect(screen.queryByText("Acesso Restrito")).toBeNull();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("libera por allowRoles mesmo sem permissão explícita", () => {
    permState = { loading: false, permissionsReady: true, role: "adm" };
    renderRota(
      <ScreenProtectedRoute screenCode="financeiro_dre" allowRoles={["adm"]}>
        <div>{CONTEUDO}</div>
      </ScreenProtectedRoute>,
    );

    expect(screen.getByText(CONTEUDO)).toBeTruthy();
  });

  it("não vaza o conteúdo enquanto as permissões carregam", () => {
    permState = { loading: true, permissionsReady: false, role: null };
    renderRota(
      <ScreenProtectedRoute screenCode="financeiro_dre">
        <div>{CONTEUDO}</div>
      </ScreenProtectedRoute>,
    );

    expect(screen.queryByText(CONTEUDO)).toBeNull();
    expect(screen.queryByText("Acesso Restrito")).toBeNull();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe("usuário sem permissão — bloqueio de módulo", () => {
  it("exibe mensagem específica de módulo e registra a tentativa", async () => {
    renderRota(
      <ModuleProtectedRoute moduleCode="compras">
        <div>{CONTEUDO}</div>
      </ModuleProtectedRoute>,
    );

    expect(await screen.findByText("Acesso Restrito")).toBeTruthy();
    expect(
      screen.getByText("Você não tem permissão para acessar este módulo."),
    ).toBeTruthy();
    expect(screen.queryByText(CONTEUDO)).toBeNull();
    await waitFor(() => {
      const log = rpcMock.mock.calls.find((c) => c[0] === "log_access_denied");
      expect(log![1]).toMatchObject({ _screen_code: "module:compras" });
    });
  });

  it("libera o módulo permitido", () => {
    modulosPermitidos = new Set(["compras"]);
    renderRota(
      <ModuleProtectedRoute moduleCode="compras">
        <div>{CONTEUDO}</div>
      </ModuleProtectedRoute>,
    );
    expect(screen.getByText(CONTEUDO)).toBeTruthy();
  });
});

describe("estados vazios / sem registro", () => {
  it("resumo de ações não é exibido quando não há histórico", () => {
    const { container } = render(<TarefaAcoesHistoricoResumo tarefaId="t-1" />);
    expect(container.textContent).toBe("");
  });

  it("resumo de ações não é exibido sem tarefa selecionada", () => {
    historicoState.data = [
      {
        id: "a1",
        tipo: "aprovacao",
        titulo: "Aprovar NF",
        detalhe: null,
        status: "pendente",
        created_at: new Date().toISOString(),
        usuario_id: "u1",
        usuario_nome: "Ana",
        usuario_avatar: null,
      },
    ];
    const { container } = render(<TarefaAcoesHistoricoResumo tarefaId={null} />);
    expect(container.textContent).toBe("");
  });

  it("resumo mostra contagens quando existe histórico", () => {
    historicoState.data = [
      {
        id: "a1",
        tipo: "aprovacao",
        titulo: "Aprovar NF",
        detalhe: null,
        status: "pendente",
        created_at: new Date().toISOString(),
        usuario_id: "u1",
        usuario_nome: "Ana",
        usuario_avatar: null,
      },
    ];
    render(<TarefaAcoesHistoricoResumo tarefaId="t-1" />);
    expect(screen.getByText("Aprovações e chamadas de atenção")).toBeTruthy();
    expect(screen.getByText("1 aprov.")).toBeTruthy();
    expect(screen.getByText("0 atenção")).toBeTruthy();
  });

  it("card sem anexos e sem expectativa de documentos não renderiza indicador", () => {
    const { container } = render(<TarefaAnexosBadge resumo={undefined} />);
    expect(container.textContent).toBe("");
  });

  it("card de checklist sem arquivo exibe 'Aguardando documentos'", () => {
    render(
      <TarefaAnexosBadge
        resumo={{ tarefa_id: "t-1", total: 0, arquivos: [] } as never}
        esperaDocumentos
      />,
    );
    expect(screen.getByText("Aguardando documentos")).toBeTruthy();
  });

  it("resumo com total zero é tratado como vazio mesmo com objeto presente", () => {
    const { container } = render(
      <TarefaAnexosBadge resumo={{ tarefa_id: "t-1", total: 0, arquivos: [] } as never} />,
    );
    expect(container.textContent).toBe("");
  });
});

describe("mensagens de erro nas ações vinculadas", () => {
  function Harness() {
    const { abrirAprovacao, abrirUrgente } = useAbrirAcaoVinculada();
    return (
      <div>
        <button
          onClick={() =>
            abrirAprovacao({ tipo: "tarefa", refId: "t-1", titulo: "Tarefa" })
          }
        >
          aprovar
        </button>
        <button
          onClick={() => abrirUrgente({ tipo: "tarefa", refId: "t-1", titulo: "Tarefa" })}
        >
          urgente
        </button>
      </div>
    );
  }

  it("informa o usuário quando o backend nega a criação da conversa", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "permission denied for table conversas" },
    });
    render(<Harness />);
    screen.getByText("aprovar").click();

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        expect.stringContaining("Não foi possível abrir a aprovação"),
      ),
    );
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("informa o usuário quando a chamada de atenção falha", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "sem permissão" } });
    render(<Harness />);
    screen.getByText("urgente").click();

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0][0]).toContain("sem permissão");
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
