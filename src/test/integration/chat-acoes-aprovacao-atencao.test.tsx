/**
 * E2E de comportamento das ações "Enviar para aprovação" e "Chamar atenção"
 * na barra padrão do composer, garantindo paridade entre os contextos:
 *  - Hub de chat (conversa de projeto)
 *  - Painel lateral da tarefa
 *  - Modo Foco da tarefa
 *  - Chat de processo
 *
 * Valida: RPC de vínculo chamada com os parâmetros corretos, navegação para o
 * chat com ?abrir=aprovacao|urgente e ausência de divergência entre contextos.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import fs from "node:fs";

const rpcMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { ChatComposerActionsBar } from "@/components/chat/v2/ChatComposerActionsBar";
import {
  useAbrirAcaoVinculada,
  type VinculoTipo,
} from "@/hooks/chat/useAbrirAcaoVinculada";

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

const originalLocation = window.location;
const assign = vi.fn();
Object.defineProperty(window, "location", {
  configurable: true,
  writable: true,
  value: { ...originalLocation, assign },
});
afterAll(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: originalLocation,
  });
});

function Harness({
  tipo,
  refId,
  titulo,
}: {
  tipo: VinculoTipo;
  refId: string;
  titulo: string;
}) {
  const { abrirAprovacao, abrirUrgente } = useAbrirAcaoVinculada();
  return (
    <ChatComposerActionsBar
      onAttachFile={() => {}}
      onCameraCapture={() => {}}
      onEmojiPick={() => {}}
      onRequestApproval={() => abrirAprovacao({ tipo, refId, titulo })}
      onUrgentAlert={() => abrirUrgente({ tipo, refId, titulo })}
    />
  );
}

const CONTEXTOS: Array<{
  nome: string;
  tipo: VinculoTipo;
  refId: string;
  titulo: string;
}> = [
  {
    nome: "Hub de chat (projeto)",
    tipo: "projeto",
    refId: "11111111-1111-1111-1111-111111111111",
    titulo: "Projeto Alfa",
  },
  {
    nome: "Painel lateral da tarefa",
    tipo: "tarefa",
    refId: "22222222-2222-2222-2222-222222222222",
    titulo: "Tarefa Beta",
  },
  {
    nome: "Modo Foco da tarefa",
    tipo: "tarefa",
    refId: "33333333-3333-3333-3333-333333333333",
    titulo: "Tarefa Gama",
  },
  {
    nome: "Chat de processo",
    tipo: "processo",
    refId: "44444444-4444-4444-4444-444444444444",
    titulo: "Processo Delta",
  },
];

describe("ações de aprovação e chamar atenção — paridade entre contextos", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    assign.mockReset();
    rpcMock.mockResolvedValue({ data: "conv-abc", error: null });
  });

  for (const ctx of CONTEXTOS) {
    it(`${ctx.nome}: envia para aprovação abrindo o chat vinculado`, async () => {
      const user = userEvent.setup();
      render(<Harness {...ctx} />);
      await user.click(screen.getByLabelText("Solicitar aprovação"));

      await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(1));
      expect(rpcMock).toHaveBeenCalledWith(
        "rpc_get_or_create_conversa_vinculada",
        { p_tipo: ctx.tipo, p_ref_id: ctx.refId, p_titulo: ctx.titulo },
      );
      await waitFor(() =>
        expect(assign).toHaveBeenCalledWith(
          "/dashboard/chat?conversaId=conv-abc&abrir=aprovacao",
        ),
      );
    });

    it(`${ctx.nome}: chama atenção abrindo o chat vinculado`, async () => {
      const user = userEvent.setup();
      render(<Harness {...ctx} />);
      await user.click(
        screen.getByLabelText("Chamar atenção (mensagem urgente)"),
      );

      await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(1));
      expect(rpcMock).toHaveBeenCalledWith(
        "rpc_get_or_create_conversa_vinculada",
        { p_tipo: ctx.tipo, p_ref_id: ctx.refId, p_titulo: ctx.titulo },
      );
      await waitFor(() =>
        expect(assign).toHaveBeenCalledWith(
          "/dashboard/chat?conversaId=conv-abc&abrir=urgente",
        ),
      );
    });
  }

  it("não navega quando a RPC falha", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "denied" } });
    const user = userEvent.setup();
    render(<Harness {...CONTEXTOS[1]} />);
    await user.click(screen.getByLabelText("Solicitar aprovação"));
    await waitFor(() => expect(rpcMock).toHaveBeenCalled());
    expect(assign).not.toHaveBeenCalled();
  });
});

describe("wiring real dos contextos", () => {
  const casos: Array<[string, string]> = [
    ["src/components/chat/v2/TarefaChatPanel.tsx", "tarefa"],
    ["src/components/projetos/tarefa-detalhe/TarefaChatPanel.tsx", "tarefa"],
    ["src/components/projetos/TarefaFocusMode.tsx", "tarefa"],
    ["src/components/processo/ProcessoChat.tsx", "processo"],
  ];

  for (const [arquivo, tipo] of casos) {
    it(`${arquivo} usa as duas ações com tipo "${tipo}"`, () => {
      const src = fs.readFileSync(arquivo, "utf8");
      expect(src).toContain("abrirAprovacao");
      expect(src).toContain("abrirUrgente");
      expect(src).toContain(`tipo: "${tipo}"`);
      expect(src).toContain("onRequestApproval");
      expect(src).toContain("onUrgentAlert");
    });
  }
});
