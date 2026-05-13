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
// ChatLayout simulado: lança erro para validar o fallback dentro do drawer.
vi.mock("@/components/chat/v2/ChatLayout", () => ({
  ChatLayout: () => {
    throw new Error("falha simulada no ChatLayout");
  },
}));

function Opener() {
  const { abrir } = useChatDrawer();
  const navigate = useNavigate();
  return (
    <div>
      <button onClick={() => abrir()}>abrir-chat</button>
      <button onClick={() => navigate("/dashboard/projetos")}>navegar</button>
    </div>
  );
}

function PageA() {
  return <h1>pagina-a</h1>;
}
function PageB() {
  return <h1>pagina-b</h1>;
}

describe("ChatDrawer e2e: abrir + navegar não causa tela em branco", () => {
  it("mantém a aplicação renderizada e exibe fallback com botão de recarregar", async () => {
    // silencia logs de erro do React boundary durante o teste
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <ChatDrawerProvider>
          <Routes>
            <Route path="/dashboard" element={<><Opener /><PageA /></>} />
            <Route path="/dashboard/projetos" element={<><Opener /><PageB /></>} />
          </Routes>
        </ChatDrawerProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText("pagina-a")).toBeInTheDocument();

    // Abre o drawer → ChatLayout lança → fallback aparece
    await act(async () => {
      screen.getByText("abrir-chat").click();
    });

    expect(await screen.findByTestId("chat-error-fallback")).toBeInTheDocument();
    expect(screen.getByText("Recarregar página")).toBeInTheDocument();

    // Navega para outra rota — app continua renderizando, sem tela em branco
    await act(async () => {
      screen.getByText("navegar").click();
    });

    expect(await screen.findByText("pagina-b")).toBeInTheDocument();

    errSpy.mockRestore();
  });
});
