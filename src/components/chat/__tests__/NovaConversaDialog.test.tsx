import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { NovaConversaDialog } from "@/components/chat/NovaConversaDialog";
import { supabase } from "@/integrations/supabase/client";

const toastMock = vi.fn();

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

function mockProfilesQuery() {
  const users = [
    { id: "user-2", nome: "Milene Harumi", email: "mharumi@rubyrose.com.br", avatar_url: null },
    { id: "user-3", nome: "Milena Lacerda", email: "milena.lacerda@rubyrose.com.br", avatar_url: null },
  ];

  const query: any = {
    select: vi.fn(() => query),
    neq: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn().mockResolvedValue({ data: users, error: null }),
  };

  return query;
}

describe("NovaConversaDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (supabase.auth as any).getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    (supabase as any).rpc = vi.fn().mockResolvedValue({ data: "conversa-1", error: null });
    (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockProfilesQuery());
  });

  it("cria conversa privada via ação segura do backend e não insere direto em tabelas do chat", async () => {
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

    expect(supabase.from).toHaveBeenCalledWith("profiles");
    expect(supabase.from).not.toHaveBeenCalledWith("conversas");
    expect(supabase.from).not.toHaveBeenCalledWith("conversas_participantes");
  });
});