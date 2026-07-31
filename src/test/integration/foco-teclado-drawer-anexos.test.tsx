/**
 * Navegação por teclado e ciclo de foco:
 *  - Visualizador de anexos (`ArquivoPreviewDialog`) — componente REAL.
 *  - Drawer de tarefas (`ProjetoTarefaDetalhe`) — harness com o mesmo
 *    `SheetContent` real e os mesmos handlers de foco/Esc, mais asserções
 *    de contrato sobre o código-fonte para evitar que o comportamento
 *    testado se descole da implementação.
 *
 * Invariantes cobertos:
 *  1. Ao abrir, o foco entra no painel (nunca fica no fundo da página).
 *  2. Tab/Shift+Tab circulam apenas dentro do painel (focus trap).
 *  3. Esc fecha; dentro de um campo em edição, o 1º Esc só faz blur.
 *  4. Ao fechar, o foco volta para o elemento que abriu.
 *  5. Todo controle alcançável por teclado tem nome acessível.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

const secureDownloadMock = vi.fn();
vi.mock("@/lib/utils/secure-download", () => ({
  secureDownload: (...args: unknown[]) => secureDownloadMock(...args),
}));
vi.mock("@/hooks/useSignedThumbUrl", () => ({
  useSignedThumbUrl: () => ({ data: "blob:preview", isLoading: false }),
}));

import { ArquivoPreviewDialog } from "@/components/projetos/ArquivoPreviewDialog";

const ARQUIVO = {
  nome: "amostra-frontal.png",
  tipo: "image/png",
  storage_path: "uid/amostra-frontal.png",
  tarefa_id: "tarefa-1",
  tarefa_titulo: "Aprovar arte",
};

/** Lista de elementos focáveis dentro de um container. */
function focaveis(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.hasAttribute("hidden") && el.getAttribute("aria-hidden") !== "true");
}

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
});

// ---------------------------------------------------------------- Visualizador

describe("Visualizador de anexos — teclado e foco", () => {
  function PreviewHarness() {
    const [open, setOpen] = useState(false);
    return (
      <MemoryRouter>
        <button type="button" onClick={() => setOpen(true)}>
          Abrir anexo
        </button>
        <ArquivoPreviewDialog
          open={open}
          onOpenChange={setOpen}
          arquivo={ARQUIVO}
          projetoId="proj-1"
        />
      </MemoryRouter>
    );
  }

  it("abre pelo teclado e move o foco para dentro do diálogo", async () => {
    const user = userEvent.setup();
    render(<PreviewHarness />);

    await user.tab();
    expect(screen.getByRole("button", { name: "Abrir anexo" })).toHaveFocus();
    await user.keyboard("{Enter}");

    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  });

  it("mantém o foco preso no diálogo ao percorrer com Tab (ciclo fechado)", async () => {
    const user = userEvent.setup();
    render(<PreviewHarness />);
    await user.click(screen.getByRole("button", { name: "Abrir anexo" }));
    const dialog = await screen.findByRole("dialog");

    const alvos = focaveis(dialog);
    expect(alvos.length).toBeGreaterThan(1);

    // Uma volta completa + 1: o foco nunca escapa para o gatilho de fundo.
    for (let i = 0; i < alvos.length + 2; i++) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }

    // Shift+Tab também permanece dentro.
    for (let i = 0; i < 3; i++) {
      await user.tab({ shift: true });
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it("todo controle focável do diálogo tem nome acessível", async () => {
    const user = userEvent.setup();
    render(<PreviewHarness />);
    await user.click(screen.getByRole("button", { name: "Abrir anexo" }));
    const dialog = await screen.findByRole("dialog");

    for (const el of focaveis(dialog)) {
      const nome =
        el.getAttribute("aria-label")?.trim() ||
        el.textContent?.trim() ||
        el.getAttribute("title")?.trim() ||
        "";
      expect(nome, `elemento sem nome acessível: ${el.outerHTML.slice(0, 120)}`).not.toBe("");
    }
  });

  it("aciona ações por teclado (Enter em Baixar dispara download seguro)", async () => {
    const user = userEvent.setup();
    render(<PreviewHarness />);
    await user.click(screen.getByRole("button", { name: "Abrir anexo" }));
    await screen.findByRole("dialog");

    const baixar = screen.getByRole("button", { name: /Baixar/i });
    baixar.focus();
    await user.keyboard("{Enter}");

    expect(secureDownloadMock).toHaveBeenCalledWith(
      ARQUIVO.storage_path,
      ARQUIVO.nome,
      "projeto-anexos",
    );
  });

  it("Esc fecha o visualizador e devolve o foco ao gatilho", async () => {
    const user = userEvent.setup();
    render(<PreviewHarness />);
    const gatilho = screen.getByRole("button", { name: "Abrir anexo" });
    await user.click(gatilho);
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(gatilho).toHaveFocus());
  });
});

// ---------------------------------------------------------------- Drawer

describe("Drawer de tarefas — teclado e foco", () => {
  /** Reproduz os handlers reais de `ProjetoTarefaDetalhe` (validados abaixo por contrato). */
  function DrawerHarness() {
    const [open, setOpen] = useState(false);
    const openerRef = useRef<HTMLElement | null>(null);

    return (
      <div>
        <button
          type="button"
          data-tarefa-card-id="t-1"
          onClick={(e) => {
            openerRef.current = e.currentTarget;
            setOpen(true);
          }}
        >
          Abrir tarefa A
        </button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="right"
            hideClose
            data-testid="projeto-tarefa-detalhe-drawer"
            onEscapeKeyDown={(e) => {
              const active = document.activeElement as HTMLElement | null;
              const editing = active?.closest("input, textarea, [contenteditable=true]");
              if (editing) {
                e.preventDefault();
                (editing as HTMLElement).blur();
              }
            }}
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              (e.currentTarget as HTMLElement | null)?.focus({ preventScroll: true });
            }}
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              const opener = openerRef.current;
              if (opener && document.body.contains(opener)) {
                opener.focus({ preventScroll: true });
                return;
              }
              document
                .querySelector<HTMLElement>('[data-tarefa-card-id="t-1"]')
                ?.focus({ preventScroll: true });
            }}
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Detalhe da tarefa</SheetTitle>
              <SheetDescription>Detalhes da tarefa selecionada</SheetDescription>
            </SheetHeader>
            <input aria-label="Título da tarefa" defaultValue="Aprovar arte" />
            <button type="button" aria-label="Fechar" onClick={() => setOpen(false)}>
              X
            </button>
            <button type="button">Salvar</button>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  it("ao abrir, o foco vai para o painel e não para o primeiro botão de ação", async () => {
    const user = userEvent.setup();
    render(<DrawerHarness />);
    await user.click(screen.getByRole("button", { name: "Abrir tarefa A" }));

    const drawer = await screen.findByTestId("projeto-tarefa-detalhe-drawer");
    await waitFor(() => expect(document.activeElement).toBe(drawer));
  });

  it("Tab e Shift+Tab circulam apenas dentro do drawer", async () => {
    const user = userEvent.setup();
    render(<DrawerHarness />);
    await user.click(screen.getByRole("button", { name: "Abrir tarefa A" }));
    const drawer = await screen.findByTestId("projeto-tarefa-detalhe-drawer");

    for (let i = 0; i < 5; i++) {
      await user.tab();
      expect(drawer.contains(document.activeElement)).toBe(true);
    }
    for (let i = 0; i < 3; i++) {
      await user.tab({ shift: true });
      expect(drawer.contains(document.activeElement)).toBe(true);
    }
  });

  it("primeiro Esc em campo de edição apenas faz blur; segundo Esc fecha", async () => {
    const user = userEvent.setup();
    render(<DrawerHarness />);
    await user.click(screen.getByRole("button", { name: "Abrir tarefa A" }));
    const drawer = await screen.findByTestId("projeto-tarefa-detalhe-drawer");

    const input = screen.getByLabelText("Título da tarefa");
    input.focus();
    expect(input).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(input).not.toHaveFocus();
    expect(drawer).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByTestId("projeto-tarefa-detalhe-drawer")).not.toBeInTheDocument(),
    );
  });

  it("ao fechar no X, o foco volta para o card que abriu a tarefa", async () => {
    const user = userEvent.setup();
    render(<DrawerHarness />);
    const card = screen.getByRole("button", { name: "Abrir tarefa A" });
    await user.click(card);
    await screen.findByTestId("projeto-tarefa-detalhe-drawer");

    await user.click(screen.getByRole("button", { name: "Fechar" }));

    await waitFor(() =>
      expect(screen.queryByTestId("projeto-tarefa-detalhe-drawer")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(card).toHaveFocus());
  });
});

// ------------------------------------------------- Contrato com a implementação

describe("Contrato: o drawer real usa os mesmos handlers de foco", () => {
  const src = readFileSync(
    resolve(process.cwd(), "src/components/projetos/ProjetoTarefaDetalhe.tsx"),
    "utf8",
  );

  it("mantém onOpenAutoFocus focando o próprio painel", () => {
    expect(src).toContain("onOpenAutoFocus");
    expect(src).toContain("content?.focus({ preventScroll: true })");
  });

  it("mantém onCloseAutoFocus restaurando o foco no opener/card", () => {
    expect(src).toContain("onCloseAutoFocus");
    expect(src).toContain("openerElementRef.current");
    expect(src).toContain("data-tarefa-card-id=");
  });

  it("mantém o duplo-Esc (blur do campo em edição antes de fechar)", () => {
    expect(src).toContain("onEscapeKeyDown");
    expect(src).toContain('input, textarea, [contenteditable=true]');
  });
});
