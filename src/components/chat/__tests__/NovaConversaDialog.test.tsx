import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { NovaConversaDialog } from "@/components/chat/NovaConversaDialog";
import { supabase } from "@/integrations/supabase/client";

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(toastMock, { success: toastMock, error: toastMock }),
}));

class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

globalThis.ResizeObserver = ResizeObserverMock as any;

const directoryUsers = [
  { id: "user-1", nome: "Eu Mesmo", avatar_url: null },
  { id: "user-2", nome: "Milene Harumi", avatar_url: null },
  { id: "user-3", nome: "Milena Lacerda", avatar_url: null },
];

describe("NovaConversaDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (supabase.auth as any).getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    // Diretório vem direto do rpc("get_chat_directory") — resolve sem encadeamento.
    (supabase as any).rpc = vi.fn().mockImplementation((name: string) => {
      if (name === "get_chat_directory") {
        return Promise.resolve({ data: directoryUsers, error: null });
      }
      if (name === "rpc_chat_criar_conversa_privada") {
        return Promise.resolve({ data: "conversa-1", error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
  });

  it("cria conversa privada via ação segura do backend e lê o diretório via get_chat_directory", async () => {
    const onSuccess = vi.fn();
    const user = userEvent.setup();

    render(<NovaConversaDialog open onOpenChange={vi.fn()} onSuccess={onSuccess} />);

    await user.type(screen.getByPlaceholderText("Buscar por nome, e-mail ou @menção..."), "@mile");
    await user.click(await screen.findByText("Milene Harumi"));
    await user.click(screen.getByRole("button", { name: "Criar Conversa" }));

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith("rpc_chat_criar_conversa_privada", {
        p_outro_user_id: "user-2",
      });
      expect(onSuccess).toHaveBeenCalledWith("conversa-1");
    });

    // Diretório de usuários vem da função SECURITY DEFINER (RLS-safe).
    expect(supabase.rpc).toHaveBeenCalledWith("get_chat_directory");

    // Não acessa diretamente tabelas do chat nem a antiga view chat_directory.
    expect(supabase.from).not.toHaveBeenCalledWith("chat_directory");
    expect(supabase.from).not.toHaveBeenCalledWith("conversas");
    expect(supabase.from).not.toHaveBeenCalledWith("conversas_participantes");

    // O usuário atual (user-1) é filtrado em JS — não deve aparecer na lista.
    expect(screen.queryByText("Eu Mesmo")).not.toBeInTheDocument();
  });
});
