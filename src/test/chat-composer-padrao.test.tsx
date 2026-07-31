/**
 * Garante a paridade de ações do composer entre os chats do sistema:
 * anexar, câmera, solicitar aprovação, chamar atenção e emojis.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatComposerActionsBar } from "@/components/chat/v2/ChatComposerActionsBar";

const noop = () => {};

if (!window.matchMedia) {
  // jsdom não implementa matchMedia; usado por hooks de responsividade
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

describe("ChatComposerActionsBar", () => {
  it("expõe as 5 ações padrão", () => {
    render(
      <ChatComposerActionsBar
        onAttachFile={noop}
        onCameraCapture={noop}
        onRequestApproval={noop}
        onUrgentAlert={noop}
        onEmojiPick={noop}
      />,
    );
    expect(screen.getByLabelText("Anexar arquivo")).toBeTruthy();
    expect(screen.getByLabelText("Solicitar aprovação")).toBeTruthy();
    expect(
      screen.getByLabelText("Chamar atenção (mensagem urgente)"),
    ).toBeTruthy();
    expect(screen.getByLabelText("Inserir emoji")).toBeTruthy();
  });

  it("permite ocultar anexar/câmera em escopos sem upload direto", () => {
    render(
      <ChatComposerActionsBar
        showAttach={false}
        showCamera={false}
        onAttachFile={noop}
        onCameraCapture={noop}
        onRequestApproval={noop}
        onUrgentAlert={noop}
        onEmojiPick={noop}
      />,
    );
    expect(screen.queryByLabelText("Anexar arquivo")).toBeNull();
    expect(screen.getByLabelText("Solicitar aprovação")).toBeTruthy();
    expect(
      screen.getByLabelText("Chamar atenção (mensagem urgente)"),
    ).toBeTruthy();
  });
});

describe("chats com a barra padrão", () => {
  it("os quatro chats de tarefa/processo importam o componente compartilhado", async () => {
    const fs = await import("node:fs");
    const arquivos = [
      "src/components/chat/v2/TarefaChatPanel.tsx",
      "src/components/projetos/tarefa-detalhe/TarefaChatPanel.tsx",
      "src/components/projetos/TarefaFocusMode.tsx",
      "src/components/processo/ProcessoChat.tsx",
    ];
    for (const f of arquivos) {
      const src = fs.readFileSync(f, "utf8");
      expect(src.includes("ChatComposerActionsBar")).toBe(true);
      expect(src.includes("useAbrirAcaoVinculada")).toBe(true);
    }
  });
});

// evita warning de mock não usado em ambientes sem canvas
vi.mock("@/components/chat/v2/CameraCaptureButton", async (orig) => orig());
