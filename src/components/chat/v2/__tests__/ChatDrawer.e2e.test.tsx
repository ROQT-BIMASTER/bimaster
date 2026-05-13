import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useNavigate } from "react-router-dom";
import { ChatDrawerProvider, useChatDrawer } from "@/components/chat/v2/ChatDrawer";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1" } }),
}));
vi.mock("@/hooks/chat/useConversas", () => ({
  useChatUnreadTotal: () => 0,
}));

const handles: { abrir?: () => void; navigate?: (to: string) => void } = {};

function Probe() {
  const { abrir } = useChatDrawer();
  const navigate = useNavigate();
  handles.abrir = abrir;
  handles.navigate = navigate;
  return null;
}

function PageA() {
  return <h1>pagina-a</h1>;
}
function PageB() {
  return <h1>pagina-b</h1>;
}

function setup() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <ChatDrawerProvider>
        <Routes>
          <Route path="/dashboard" element={<><Probe /><PageA /></>} />
          <Route path="/dashboard/projetos" element={<><Probe /><PageB /></>} />
        </Routes>
      </ChatDrawerProvider>
    </MemoryRouter>,
  );
}

describe("ChatDrawer e2e: navegar + abrir não causa tela em branco", () => {
  it("navega entre rotas com ChatDrawerProvider montado fora de Router (regressão)", async () => {
    // Mock que não quebra: garante que navegação funciona
    vi.doMock("@/components/chat/v2/ChatLayout", () => ({ ChatLayout: () => null }));
    setup();
    expect(screen.getByText("pagina-a")).toBeInTheDocument();
    await act(async () => {
      handles.navigate!("/dashboard/projetos");
    });
    expect(await screen.findByText("pagina-b")).toBeInTheDocument();
  });

  it("exibe fallback com botão de recarregar quando o ChatLayout falha", async () => {
    vi.resetModules();
    vi.doMock("@/components/chat/v2/ChatLayout", () => ({
      ChatLayout: () => {
        throw new Error("falha simulada no ChatLayout");
      },
    }));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Precisa re-importar para pegar o mock atualizado
    const { ChatDrawerProvider: Provider, useChatDrawer: useDrawer } = await import(
      "@/components/chat/v2/ChatDrawer"
    );

    function LocalProbe() {
      const { abrir } = useDrawer();
      handles.abrir = abrir;
      return null;
    }

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Provider>
          <LocalProbe />
          <PageA />
        </Provider>
      </MemoryRouter>,
    );

    await act(async () => {
      handles.abrir!();
    });

    const fallback = await screen.findByTestId("chat-error-fallback");
    expect(fallback).toBeInTheDocument();
    expect(screen.getByText("Recarregar página")).toBeInTheDocument();
    expect(screen.getByText("Tentar novamente")).toBeInTheDocument();
    // Página por trás do drawer continua presente — sem tela em branco
    expect(screen.getByText("pagina-a")).toBeInTheDocument();

    errSpy.mockRestore();
  });
});
