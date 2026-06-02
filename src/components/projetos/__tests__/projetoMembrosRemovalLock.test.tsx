/**
 * Regressão — bloqueio de interações durante "Removendo {nome}…".
 *
 * Garante que enquanto a flag `removing` está ativa:
 * - Botões internos da modal ficam disabled (via <fieldset disabled>).
 * - Conteúdo fica `inert` (Tab/Shift+Tab não focam nada de dentro).
 * - O overlay mostra "Removendo {nome}…" com role="status" + aria-busy.
 * - Tecla Escape e clique-fora não fecham (handlers simulados via flags).
 * - Em caso de erro da mutation, a modal permanece "aberta" e mostra
 *   uma mensagem de erro acessível (role="alert").
 *
 * O teste reproduz o mesmo padrão estrutural usado em
 * `ProjetoMembrosDialog.tsx` sem precisar montar o Radix Dialog real
 * (que exige portais, focus-trap real, e mocks pesados de Supabase).
 */
import { describe, it, expect } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

type Target = { id: string; nome: string };

function Harness({
  mutate,
}: {
  mutate: (target: Target) => Promise<void>;
}) {
  const [removing, setRemoving] = useState<Target | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);

  const target: Target = { id: "u1", nome: "Maria" };

  return (
    <div
      data-testid="modal"
      // Replica os guards do Radix DialogContent
      onKeyDown={(e) => {
        if (e.key === "Escape" && removing) {
          e.preventDefault();
          (e as any)._blockedByLock = true;
        } else if (e.key === "Escape") {
          setClosed(true);
        }
      }}
      onClickCapture={(e) => {
        // Simula o "fechar por clique fora": só fecha se NÃO estiver removendo.
        if ((e.target as HTMLElement).dataset.outside === "true") {
          if (!removing) setClosed(true);
        }
      }}
    >
      {closed && <p data-testid="closed-marker">closed</p>}

      {removing && (
        <div
          data-testid="removing-overlay"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          Removendo <strong>{removing.nome}</strong>…
        </div>
      )}

      {error && !removing && (
        <div role="alert" data-testid="remove-error">
          {error}
        </div>
      )}

      <fieldset
        disabled={!!removing}
        data-testid="lock-fieldset"
        // @ts-expect-error inert é booleano nativo
        inert={removing ? "" : undefined}
      >
        <button
          data-testid="action-remover"
          onClick={async () => {
            setError(null);
            setRemoving(target);
            try {
              await mutate(target);
              setRemoving(null);
            } catch (err) {
              setRemoving(null);
              setError(err instanceof Error ? err.message : "erro");
            }
          }}
        >
          Remover
        </button>
        <button data-testid="some-other-button">Outro</button>
      </fieldset>

      <div data-outside="true" data-testid="outside-region">
        fora
      </div>
    </div>
  );
}

describe("Modal lock durante remoção de membro", () => {
  it("desabilita botões e ativa overlay enquanto a remoção está em andamento", async () => {
    let resolveMutation!: () => void;
    const mutate = () =>
      new Promise<void>((resolve) => {
        resolveMutation = resolve;
      });

    render(<Harness mutate={mutate} />);

    fireEvent.click(screen.getByTestId("action-remover"));

    // Overlay aparece com o nome do membro.
    const overlay = await screen.findByTestId("removing-overlay");
    expect(overlay).toHaveAttribute("aria-busy", "true");
    expect(overlay.textContent).toContain("Maria");

    // fieldset disabled + inert
    const fs = screen.getByTestId("lock-fieldset") as HTMLFieldSetElement;
    expect(fs.disabled).toBe(true);
    expect(fs.hasAttribute("inert")).toBe(true);

    // Botões internos ficam de fato desabilitados (herança do fieldset).
    expect((screen.getByTestId("action-remover") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("some-other-button") as HTMLButtonElement).disabled).toBe(true);

    // Esc não fecha.
    fireEvent.keyDown(screen.getByTestId("modal"), { key: "Escape" });
    expect(screen.queryByTestId("closed-marker")).toBeNull();

    // Clique-fora não fecha.
    fireEvent.click(screen.getByTestId("outside-region"));
    expect(screen.queryByTestId("closed-marker")).toBeNull();

    // Encerra a mutation com sucesso.
    resolveMutation();
    await waitFor(() => expect(screen.queryByTestId("removing-overlay")).toBeNull());

    // Após a remoção, controles voltam ao normal.
    expect((screen.getByTestId("action-remover") as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByTestId("closed-marker")).toBeNull();
    expect(screen.queryByTestId("remove-error")).toBeNull();
  });

  it("mantém a modal aberta e mostra mensagem de erro quando a mutation falha", async () => {
    const mutate = () => Promise.reject(new Error("Permissão negada pelo servidor."));

    render(<Harness mutate={mutate} />);

    fireEvent.click(screen.getByTestId("action-remover"));

    const errorBox = await screen.findByTestId("remove-error");
    expect(errorBox).toHaveAttribute("role", "alert");
    expect(errorBox.textContent).toContain("Permissão negada pelo servidor.");

    // Modal segue aberta.
    expect(screen.queryByTestId("closed-marker")).toBeNull();
    // Overlay sumiu (não está mais "removendo").
    expect(screen.queryByTestId("removing-overlay")).toBeNull();
    // Controles voltaram a ficar habilitados para nova tentativa.
    expect((screen.getByTestId("action-remover") as HTMLButtonElement).disabled).toBe(false);
  });

  it("permite Esc fechar a modal somente quando não há remoção em andamento", () => {
    render(<Harness mutate={() => Promise.resolve()} />);
    fireEvent.keyDown(screen.getByTestId("modal"), { key: "Escape" });
    expect(screen.getByTestId("closed-marker")).toBeInTheDocument();
  });
});
