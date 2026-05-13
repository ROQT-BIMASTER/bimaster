import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { ChatDrawerProvider, useChatDrawer } from "@/components/chat/v2/ChatDrawer";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1" } }),
}));
vi.mock("@/hooks/chat/useConversas", () => ({
  useChatUnreadTotal: () => 0,
}));

afterEach(() => {
  cleanup();
  vi.resetModules();
});

const handles: { abrir?: () => void } = {};

function Probe() {
  const { abrir } = useChatDrawer();
  handles.abrir = abrir;
  return <div data-testid="app-shell">app-shell</div>;
}

describe("ChatDrawer e2e: fallback e resiliência a mudanças de rota", () => {
  it("exibe fallback com botão de recarregar e mantém o resto da app quando o ChatLayout falha", async () => {
    vi.doMock("@/components/chat/v2/ChatLayout", () => ({
      ChatLayout: () => {
        throw new Error("falha simulada no ChatLayout");
      },
    }));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { ChatDrawerProvider: Provider, useChatDrawer: useDrawer } = await import(
      "@/components/chat/v2/ChatDrawer"
    );

    function LocalProbe() {
      const { abrir } = useDrawer();
      handles.abrir = abrir;
      return <div data-testid="app-shell">app-shell</div>;
    }

    render(
      <Provider>
        <LocalProbe />
      </Provider>,
    );

    await act(async () => {
      handles.abrir!();
    });

    expect(await screen.findByTestId("chat-error-fallback")).toBeInTheDocument();
    expect(screen.getByText("Recarregar página")).toBeInTheDocument();
    expect(screen.getByText("Tentar novamente")).toBeInTheDocument();
    // App continua presente — sem tela em branco
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();

    errSpy.mockRestore();
  });

  it("não quebra ao simular navegação do browser (popstate) com o drawer montado", async () => {
    render(
      <ChatDrawerProvider>
        <Probe />
      </ChatDrawerProvider>,
    );

    expect(screen.getByTestId("app-shell")).toBeInTheDocument();

    // Simula navegações reais do browser
    await act(async () => {
      window.history.pushState({}, "", "/dashboard");
    });
    await act(async () => {
      window.history.pushState({}, "", "/dashboard/projetos");
    });
    await act(async () => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    // App ainda renderizada — sem tela em branco
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
  });
});
