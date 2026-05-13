import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { ChatDrawerProvider } from "@/components/chat/v2/ChatDrawer";

// Mocks: isolam o teste do Supabase / contextos pesados.
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null }),
}));
vi.mock("@/hooks/chat/useConversas", () => ({
  useChatUnreadTotal: () => 0,
}));
vi.mock("@/components/chat/v2/ChatLayout", () => ({
  ChatLayout: () => null,
}));

describe("ChatDrawerProvider regression", () => {
  it("renderiza sem <Router> sem lançar (não usa useLocation)", () => {
    expect(() =>
      render(
        <ChatDrawerProvider>
          <div>conteudo</div>
        </ChatDrawerProvider>,
      ),
    ).not.toThrow();
  });

  it("não importa useLocation de react-router-dom", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/components/chat/v2/ChatDrawer.tsx", "utf8");
    expect(src).not.toMatch(/useLocation/);
    expect(src).not.toMatch(/from\s+["']react-router-dom["']/);
  });
});
