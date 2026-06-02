/// <reference types="cypress" />

/**
 * E2E (Cypress) — Regressão extendida da trava do AlertDialog em remoção.
 *
 * Cobre:
 *  1. N retries seguidos (≥ 3) com falha de rede: Esc, clique fora e
 *     Tab/Shift+Tab continuam bloqueados em TODAS as tentativas.
 *  2. Cada tentativa renderiza um bloco `remove-error` NOVO com `data-attempt`
 *     incrementado; o conteúdo da tentativa anterior é totalmente removido do
 *     DOM ao clicar em "Tentar novamente" (não há merge nem flash residual).
 *  3. Após sucesso na N-ésima tentativa, o foco volta para o item da lista
 *     no mesmo índice do membro removido (ou para "Adicionar Membros" se a
 *     lista ficou vazia).
 *
 * Vars: CYPRESS_TEST_EMAIL/PASSWORD, CYPRESS_PROJETO_ID.
 */
const PROJETO_ID = Cypress.env("PROJETO_ID") as string | undefined;
const FAIL_COUNT = 3;

describe("Membros do Projeto — regressão N retries + foco", () => {
  beforeEach(function () {
    if (!PROJETO_ID) this.skip();
    cy.login();
    cy.visit(`/dashboard/projetos/${PROJETO_ID}`);
    cy.contains("button", /membros|equipe/i).first().click();
    cy.findByRole("dialog", { name: /membros do projeto/i }).should("be.visible");
  });

  it("aguenta múltiplos retries e restaura o foco no sucesso final", () => {
    let calls = 0;
    cy.intercept({ method: "DELETE", url: /projeto_membros/i }, (req) => {
      calls++;
      if (calls <= FAIL_COUNT) {
        req.reply({
          statusCode: 500 + (calls % 4), // varia status para validar re-render
          body: {
            message: `Falha simulada #${calls}`,
            code: `ERR_${calls}`,
            hint: `Dica específica #${calls}`,
          },
        });
      } else {
        // Pequeno atraso para podermos exercitar trava durante a chamada final.
        req.on("response", (res) => res.setDelay(1500));
      }
    }).as("removeMembro");

    // Captura o índice do membro alvo antes de abrir o confirm.
    cy.get('[data-testid="membros-list"] [data-testid="member-remove-btn"]').then(($btns) => {
      const targetIdx = 0;
      const targetMemberId = $btns.eq(targetIdx).attr("data-member-id");
      cy.wrap(targetMemberId).as("targetId");
      cy.wrap($btns.length).as("initialCount");
    });

    cy.get('[data-testid="member-remove-btn"]').first().click();
    cy.findByRole("alertdialog").as("alert");

    // Loop de tentativas falhas.
    for (let attempt = 1; attempt <= FAIL_COUNT; attempt++) {
      const btnLabel = attempt === 1 ? /^remover$/i : /tentar novamente/i;
      cy.get("@alert").contains("button", btnLabel).click();

      // Durante a chamada: spinner + travas.
      cy.findByTestId("alert-removing-status").should("be.visible");
      cy.get("body").type("{esc}");
      cy.get("body").click(3, 3, { force: true });
      cy.get("@alert").should("be.visible");

      // Aguarda erro desta tentativa.
      cy.findByTestId("remove-error")
        .should("be.visible")
        .and("have.attr", "data-attempt", String(attempt))
        .within(() => {
          cy.contains(new RegExp(`Falha simulada #${attempt}`)).should("exist");
          cy.contains(new RegExp(`code: ERR_${attempt}`)).should("exist");
          cy.contains(new RegExp(`Dica específica #${attempt}`)).should("exist");
        });

      // Conteúdo da tentativa ANTERIOR não pode coexistir.
      if (attempt > 1) {
        cy.findByTestId("remove-error").within(() => {
          cy.contains(new RegExp(`Falha simulada #${attempt - 1}`)).should("not.exist");
          cy.contains(new RegExp(`code: ERR_${attempt - 1}`)).should("not.exist");
        });
      }

      // Travas pós-erro: Esc, clique fora, focus trap.
      cy.get("body").type("{esc}");
      cy.get("body").click(3, 3, { force: true });
      cy.get("@alert").should("be.visible");
      for (let i = 0; i < 10; i++) cy.focused().tab?.();
      cy.get("@alert").then(($el) => {
        expect($el[0].contains(document.activeElement)).to.eq(true);
      });
      for (let i = 0; i < 5; i++) cy.focused().tab?.({ shift: true });
      cy.get("@alert").then(($el) => {
        expect($el[0].contains(document.activeElement)).to.eq(true);
      });
    }

    // Última tentativa (sucesso). Antes de clicar, confirma que ainda há um
    // único bloco de erro renderizado (não acumulou).
    cy.findAllByTestId("remove-error").should("have.length", 1);
    cy.get("@alert").contains("button", /tentar novamente/i).click();

    // Durante o delay final, travas continuam.
    cy.findByTestId("alert-removing-status").should("be.visible");
    cy.get("body").type("{esc}");
    cy.get("body").click(3, 3, { force: true });
    cy.get("@alert").should("be.visible");

    cy.wait("@removeMembro");
    cy.get("@alert").should("not.exist");

    // Foco restaurado: o botão de remover no MESMO índice (ou o anterior se
    // a lista encurtou) deve estar focado; alternativamente, "Adicionar Membros".
    cy.document().then((doc) => {
      const active = doc.activeElement as HTMLElement | null;
      const expectedSelectors = [
        '[data-testid="member-remove-btn"]',
        '[data-testid="adicionar-membros-btn"]',
      ];
      const matches = !!active && expectedSelectors.some((s) => active.matches(s));
      expect(matches, `foco em ${active?.tagName}.${active?.className}`).to.eq(true);
    });

    // Sanidade: o membro alvo não está mais na lista.
    cy.get<string>("@targetId").then((id) => {
      cy.get(`[data-testid="member-remove-btn"][data-member-id="${id}"]`).should("not.exist");
    });
  });
});
