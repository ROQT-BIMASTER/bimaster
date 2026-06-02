/**
 * E2E: após uma remoção bem-sucedida, o ProjetoMembrosDialog é desmontado
 * e NÃO pode deixar nenhum focus trap ativo. Tab/Shift+Tab precisam
 * percorrer livremente os elementos focáveis da página inteira, sem
 * ficarem presos em nós residuais do antigo modal.
 *
 * Estratégia:
 *  1. Mapeia todos os elementos focáveis da página ANTES de abrir o dialog
 *     (baseline). Cada um recebe um índice (ordem do DOM).
 *  2. Abre o dialog, dispara a remoção, espera o sucesso, fecha.
 *  3. Reconfere que nenhum nó com `data-testid` do antigo dialog persiste.
 *  4. Foca o primeiro focável da página e tabula N vezes. Confirma que:
 *     - o foco NUNCA recai sobre qualquer descendente de um possível
 *       `[data-radix-portal]`, `[role="dialog"]` ou
 *       `[data-testid="projeto-membros-dialog"]`;
 *     - foram visitados ao menos K elementos distintos espalhados pelo
 *       DOM da página (prova de varredura, não de ciclo curto);
 *     - Shift+Tab a partir do último visitado retorna a um focável anterior
 *       (movimento bidirecional livre).
 */

describe("ProjetoMembrosDialog — sem focus trap residual após sucesso", () => {
  const PROJETO_ID = Cypress.env("PROJETO_ID") || "test-projeto-id";
  const MEMBRO_ID = "membro-teste-1";
  const DIALOG = '[data-testid="projeto-membros-dialog"]';

  const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  beforeEach(() => {
    cy.intercept("POST", "**/rest/v1/rpc/remover_membro_projeto*", (req) => {
      req.on("response", (res) => res.setDelay(300));
      req.reply({ statusCode: 200, body: { ok: true } });
    }).as("remover");

    cy.visit(`/projetos/${PROJETO_ID}`);
  });

  it("Tab/Shift+Tab varrem a página inteira sem voltar ao antigo modal", () => {
    // Baseline de focáveis da página
    cy.document().then((doc) => {
      const focaveis = Array.from(
        doc.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null);
      expect(focaveis.length, "página tem elementos focáveis").to.be.greaterThan(
        3,
      );
      (doc as any).__baselineFocaveis = focaveis.length;
    });

    // Fluxo: abrir → remover → sucesso → fechar
    cy.get('[data-testid="abrir-membros-dialog"]').click();
    cy.get(DIALOG).should("be.visible");
    cy.get(
      `[data-testid="member-remove-btn"][data-member-id="${MEMBRO_ID}"]`,
    ).click();
    cy.get('[data-testid="confirmar-remocao-btn"]').click();
    cy.wait("@remover");
    cy.get(DIALOG).should("have.attr", "aria-busy", "false");
    cy.get("body").type("{esc}");
    cy.get(DIALOG).should("not.exist");

    // Sanidade: nenhum vestígio do dialog
    cy.get('[role="dialog"]').should("not.exist");
    cy.get("[data-radix-portal]").should("not.exist");
    cy.get('[data-testid="member-remove-btn"]').should("not.exist");
    cy.get('[data-testid="confirmar-remocao-btn"]').should("not.exist");

    // Foca o primeiro focável real da página
    cy.document().then((doc) => {
      const primeiro = doc.querySelector<HTMLElement>(FOCUSABLE);
      expect(primeiro, "primeiro focável existe").to.exist;
      primeiro!.focus();
      expect(doc.activeElement, "foco inicial aplicado").to.eq(primeiro);
    });

    // Tabula N vezes e coleta foco visitado
    const visitados = new Set<string>();
    const proibido = (el: Element | null) =>
      !!el?.closest(
        `${DIALOG}, [role="dialog"], [data-radix-portal], [data-radix-dialog-overlay]`,
      );

    const PASSOS = 30;
    for (let i = 0; i < PASSOS; i += 1) {
      cy.focused().tab();
      cy.focused().then(($el) => {
        const el = $el[0];
        expect(
          proibido(el),
          `Tab #${i + 1} caiu em nó residual do dialog`,
        ).to.eq(false);
        // Chave estável para o elemento
        const key =
          el.getAttribute("data-testid") ||
          el.id ||
          `${el.tagName}:${el.getAttribute("aria-label") || el.textContent?.trim().slice(0, 30) || ""}`;
        visitados.add(key);
      });
    }

    // Deve ter visitado uma variedade — não pode estar preso em loop curto
    cy.then(() => {
      expect(
        visitados.size,
        `Tab varre múltiplos focáveis (visitou ${visitados.size})`,
      ).to.be.greaterThan(5);
    });

    // Shift+Tab também é livre (anda para trás sem cair em dialog)
    for (let i = 0; i < 10; i += 1) {
      cy.focused().tab({ shift: true });
      cy.focused().then(($el) => {
        expect(
          proibido($el[0]),
          `Shift+Tab #${i + 1} caiu em nó residual do dialog`,
        ).to.eq(false);
      });
    }
  });
});
