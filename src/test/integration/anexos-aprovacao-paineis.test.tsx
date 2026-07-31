/**
 * Cobertura de anexar/enviar documentos para aprovação.
 *
 * Garante que:
 *  1. A barra padrão do composer entrega EXATAMENTE o arquivo selecionado
 *     (nome, tipo, tamanho) e limpa o input para permitir reenvio do mesmo arquivo.
 *  2. O NovaAprovacaoDialog exibe os arquivos escolhidos, respeita o limite de
 *     20MB, bloqueia envio sem documento e envia cada arquivo correto ao
 *     storage + RPC de anexo, na ordem.
 *  3. Os três painéis de chat da tarefa (painel lateral, chat v2 e Modo Foco)
 *     montam a barra de ações e encaminham o arquivo escolhido para o envio.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import fs from "node:fs";

const rpcMock = vi.fn();
const uploadMock = vi.fn();
const criarAprovacaoMock = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();

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
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/hooks/chat/useChatAprovacao", () => ({
  useCriarAprovacao: () => ({
    mutateAsync: (...a: unknown[]) => criarAprovacaoMock(...a),
    isPending: false,
  }),
}));

vi.mock("@/components/chat/v2/aprovacaoDocs", () => ({
  uploadAprovacaoDoc: (...a: unknown[]) => uploadMock(...a),
}));

import { ChatComposerActionsBar } from "@/components/chat/v2/ChatComposerActionsBar";
import { NovaAprovacaoDialog } from "@/components/chat/v2/NovaAprovacaoDialog";

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

function makeFile(name: string, type = "application/pdf", size = 1024) {
  const file = new File(["x".repeat(Math.min(size, 4096))], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function getFileInput(container: HTMLElement) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  expect(input).toBeTruthy();
  return input;
}

beforeEach(() => {
  rpcMock.mockReset();
  uploadMock.mockReset();
  criarAprovacaoMock.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
  rpcMock.mockResolvedValue({ data: null, error: null });
  criarAprovacaoMock.mockResolvedValue("aprov-1");
  uploadMock.mockImplementation(async (_c: string, _a: string, uid: string, f: File) => ({
    storage_path: `${uid}/${f.name}`,
    mime_type: f.type,
    size_bytes: f.size,
    hash: `hash-${f.name}`,
  }));
});

describe("composer — arquivo anexado é exatamente o selecionado", () => {
  it("encaminha o arquivo escolhido com nome, tipo e tamanho corretos", async () => {
    const onAttachFile = vi.fn();
    const { container } = render(
      <ChatComposerActionsBar
        onAttachFile={onAttachFile}
        onCameraCapture={() => {}}
        onEmojiPick={() => {}}
        onRequestApproval={() => {}}
        onUrgentAlert={() => {}}
      />,
    );

    const file = makeFile("contrato-fornecedor.pdf", "application/pdf", 2048);
    await userEvent.upload(getFileInput(container), file);

    expect(onAttachFile).toHaveBeenCalledTimes(1);
    const list = onAttachFile.mock.calls[0][0] as FileList;
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("contrato-fornecedor.pdf");
    expect(list[0].type).toBe("application/pdf");
    expect(list[0].size).toBe(2048);
  });

  it("preserva a ordem quando múltiplos arquivos são selecionados", async () => {
    const onAttachFile = vi.fn();
    const { container } = render(
      <ChatComposerActionsBar
        onAttachFile={onAttachFile}
        onCameraCapture={() => {}}
        onEmojiPick={() => {}}
        onRequestApproval={() => {}}
        onUrgentAlert={() => {}}
      />,
    );

    await userEvent.upload(getFileInput(container), [
      makeFile("a.pdf"),
      makeFile("b.png", "image/png"),
    ]);

    const list = onAttachFile.mock.calls[0][0] as FileList;
    expect(Array.from(list).map((f) => f.name)).toEqual(["a.pdf", "b.png"]);
  });

  it("limpa o input após o envio para permitir reanexar o mesmo arquivo", async () => {
    const onAttachFile = vi.fn();
    const { container } = render(
      <ChatComposerActionsBar
        onAttachFile={onAttachFile}
        onCameraCapture={() => {}}
        onEmojiPick={() => {}}
        onRequestApproval={() => {}}
        onUrgentAlert={() => {}}
      />,
    );

    const input = getFileInput(container);
    const file = makeFile("mesmo.pdf");
    await userEvent.upload(input, file);
    expect(input.value).toBe("");
    await userEvent.upload(input, file);
    expect(onAttachFile).toHaveBeenCalledTimes(2);
  });
});

describe("NovaAprovacaoDialog — documentos corretos são exibidos e enviados", () => {
  const renderDialog = () =>
    render(<NovaAprovacaoDialog open onOpenChange={() => {}} conversaId="conv-1" />);

  it("exibe os arquivos anexados na lista do dialog", async () => {
    const { baseElement } = renderDialog();
    await userEvent.upload(getFileInput(baseElement as HTMLElement), [
      makeFile("laudo.pdf"),
      makeFile("foto.png", "image/png"),
    ]);

    expect(await screen.findByText("laudo.pdf")).toBeTruthy();
    expect(screen.getByText("foto.png")).toBeTruthy();
  });

  it("permite remover um anexo antes do envio", async () => {
    const { baseElement } = renderDialog();
    await userEvent.upload(getFileInput(baseElement as HTMLElement), [
      makeFile("laudo.pdf"),
      makeFile("foto.png", "image/png"),
    ]);
    await userEvent.click(await screen.findByLabelText("Remover laudo.pdf"));

    await waitFor(() => expect(screen.queryByText("laudo.pdf")).toBeNull());
    expect(screen.getByText("foto.png")).toBeTruthy();
  });

  it("rejeita arquivo acima de 20MB e não o inclui na lista", async () => {
    const { baseElement } = renderDialog();
    const input = getFileInput(baseElement as HTMLElement);
    const grande = makeFile("gigante.pdf", "application/pdf", 21 * 1024 * 1024);
    Object.defineProperty(input, "files", {
      configurable: true,
      value: Object.assign([grande], { item: (i: number) => [grande][i], length: 1 }),
    });
    fireEvent.change(input);

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(screen.queryByText("gigante.pdf")).toBeNull();
  });

  it("bloqueia o envio quando não há documento anexado", async () => {
    renderDialog();
    await userEvent.type(screen.getByPlaceholderText(/Aprovar pagamento/i), "Aprovar NF");
    const submit = screen.getByRole("button", { name: /Solicitar aprovação/i });
    expect(submit).toBeDisabled();
    await userEvent.click(submit);
    expect(criarAprovacaoMock).not.toHaveBeenCalled();
  });

  it("envia exatamente os arquivos anexados, na ordem, com metadados corretos", async () => {
    const { baseElement } = renderDialog();
    await userEvent.type(screen.getByPlaceholderText(/Aprovar pagamento/i), "Aprovar NF 123");
    await userEvent.upload(getFileInput(baseElement as HTMLElement), [
      makeFile("nf-123.pdf", "application/pdf", 3000),
      makeFile("comprovante.png", "image/png", 500),
    ]);
    await userEvent.click(screen.getByRole("button", { name: /Solicitar aprovação/i }));

    await waitFor(() => expect(uploadMock).toHaveBeenCalledTimes(2));

    expect(criarAprovacaoMock).toHaveBeenCalledWith(
      expect.objectContaining({ conversaId: "conv-1", titulo: "Aprovar NF 123" }),
    );
    expect(uploadMock.mock.calls.map((c) => (c[3] as File).name)).toEqual([
      "nf-123.pdf",
      "comprovante.png",
    ]);
    uploadMock.mock.calls.forEach((c) => {
      expect(c[0]).toBe("conv-1");
      expect(c[1]).toBe("aprov-1");
      expect(c[2]).toBe("user-1");
    });

    const anexos = rpcMock.mock.calls.filter(
      (c) => c[0] === "rpc_chat_aprovacao_anexar_documento",
    );
    expect(anexos).toHaveLength(2);
    expect(anexos[0][1]).toMatchObject({
      p_aprovacao_id: "aprov-1",
      p_titulo: "nf-123.pdf",
      p_storage_path: "user-1/nf-123.pdf",
      p_mime_type: "application/pdf",
      p_size_bytes: 3000,
    });
    expect(anexos[1][1]).toMatchObject({
      p_titulo: "comprovante.png",
      p_mime_type: "image/png",
      p_size_bytes: 500,
    });
  });
});

describe("paridade dos três painéis da tarefa", () => {
  const PAINEIS: Array<{ nome: string; arquivo: string; handler: RegExp }> = [
    {
      nome: "Painel lateral da tarefa",
      arquivo: "src/components/projetos/tarefa-detalhe/TarefaChatPanel.tsx",
      handler: /onAttachFile=\{\(files\)\s*=>\s*enviarArquivo\(files\[0\]\)\}/,
    },
    {
      nome: "Chat v2 da tarefa",
      arquivo: "src/components/chat/v2/TarefaChatPanel.tsx",
      handler: /onAttachFile=\{\(files\)\s*=>\s*enviarArquivo\(files\[0\]\)\}/,
    },
    {
      nome: "Modo Foco",
      arquivo: "src/components/projetos/TarefaFocusMode.tsx",
      handler: /onAttachFile=\{\(files\)\s*=>\s*enviarArquivoChat\(files\[0\]\)\}/,
    },
  ];

  it.each(PAINEIS)("$nome monta a barra de ações padrão", ({ arquivo }) => {
    const src = fs.readFileSync(arquivo, "utf8");
    expect(src).toContain("ChatComposerActionsBar");
    expect(src).not.toMatch(/showAttach=\{false\}/);
  });

  it.each(PAINEIS)("$nome encaminha o arquivo selecionado", ({ arquivo, handler }) => {
    const src = fs.readFileSync(arquivo, "utf8");
    expect(src).toMatch(handler);
    expect(src).toMatch(/onCameraCapture=\{\(f\)\s*=>\s*enviarArquivo(Chat)?\(f\)\}/);
  });

  it.each(PAINEIS)("$nome expõe a ação de solicitar aprovação da tarefa", ({ arquivo }) => {
    const src = fs.readFileSync(arquivo, "utf8");
    expect(src).toContain("abrirAprovacao");
    expect(src).toMatch(/tipo:\s*"tarefa"/);
  });
});
