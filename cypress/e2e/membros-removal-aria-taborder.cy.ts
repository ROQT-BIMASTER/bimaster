/**
 * E2E: valida semântica/ARIA e ordem do foco (tab order) no
 * ProjetoMembrosDialog após cada tentativa de remoção (falha) e no sucesso.
 *
 * Garantias:
 *  - role="dialog" + aria-modal="true" + aria-labelledby/describedby
 *    apontando para elementos existentes dentro do dialog.
 *  - aria-busy="true" enquanto "Removendo {nome}…", false após cada retorno.
 *  - O botão "Tentar novamente" recebe foco automaticamente após erro.
 *  - Tab order após cada tentativa segue exatamente a sequência esperada:
 *    [close-dialog, retry-remove-btn, cancel-remove-btn] (em falha) e
 *    [close-dialog, adicionar-membros-btn, ...member-remove-btn] (em sucesso).
 */

describe("ProjetoMembrosDialog — role do dialog e tab order", () => {
  const PROJETO_ID = Cypress.env("PROJETO_ID") || "test-projeto-id";
  const MEMBRO_NOME = "Maria Teste";
  const MEMBRO_ID = "membro-teste-1";
  const TOTAL_FALHAS = 2;
  const DIALOG = '[data-testid="projeto-membros-dialog"]';

  beforeEach(() => {
    let n = 0;
    cy.intercept("POST", "**/rest/v1/rpc/remover_membro_projeto*", (req) => {
      n += 1;
      req.on("response", (res) => res.setDelay(600));
      if (n <= TOTAL_FALHAS) {
        req.reply({
          statusCode: 500,
          body: { message: "Falha simulada", code: "PGRST500" },
        });
      } else {
        req.reply({ statusCode: 200, body: { ok: true } });
      }
    }).as("remover");

    cy.visit(`/projetos/${PROJETO_ID}`);
    cy.get('[data-testid="abrir-membros-dialog"]').click();
    cy.get(DIALOG).should("be.visible");
  });

  const assertSemanticaDialog = () => {
    cy.get(DIALOG)
      .should("have.attr", "role", "dialog")
      .and("have.attr", "aria-modal", "true")
      .then(($d) => {
        const labelledby = $d.attr("aria-labelledby");
        const describedby = $d.attr("aria-describedby");
        expect(labelledby, "aria-labelledby").to.be.a("string").and.not.empty;
        // Elementos referenciados precisam existir DENTRO do dialog
        expect($d.find(`#${CSS.escape(labelledby!)}`).length).to.eq(1);
        if (describedby) {
          describedby.split(/\s+/).forEach((id) => {
            expect($d.find(`#${CSS.escape(id)}`).length, `descr ${id}`).to.eq(
              1,
            );
          });
        }
      });
  };

  const assertTabOrder = (esperado: string[]) => {
    // Foca o primeiro elemento focável do dialog e percorre o ciclo.
    cy.get(DIALOG).find("[data-testid='close-dialog']").focus();
    const observados: string[] = [];
    cy.wrap(esperado).each((_, i) => {
      cy.focused().then(($el) => {
        observados.push($el.attr("data-testid") || "");
        if (i < esperado.length - 1) cy.focused().tab();
      });
    });
    cy.then(() => {
      expect(observados, "tab order").to.deep.eq(esperado);
    });
  };

  it("preserva role/ARIA e tab order após cada falha e no sucesso", () => {
    // Disparo inicial
    cy.get(
      `[data-testid="member-remove-btn"][data-member-id="${MEMBRO_ID}"]`,
    ).click();
    cy.get('[data-testid="confirmar-remocao-btn"]').click();

    for (let attempt = 1; attempt <= TOTAL_FALHAS; attempt += 1) {
      // Durante o loading: aria-busy=true, dialog ainda válido
      cy.get(DIALOG).should("have.attr", "aria-busy", "true");
      assertSemanticaDialog();

      cy.wait("@remover");

      // Após falha: aria-busy=false, foco vai para "Tentar novamente"
      cy.get(DIALOG).should("have.attr", "aria-busy", "false");
      assertSemanticaDialog();
      cy.focused().should("have.attr", "data-testid", "retry-remove-btn");

      // Tab order em estado de erro
      assertTabOrder([
        "close-dialog",
        "retry-remove-btn",
        "cancel-remove-btn",
      ]);

      if (attempt < TOTAL_FALHAS) {
        cy.get('[data-testid="retry-remove-btn"]').click();
      }
    }

    // Última tentativa: sucesso
    cy.get('[data-testid="retry-remove-btn"]').click();
    cy.get(DIALOG).should("have.attr", "aria-busy", "true");
    cy.wait("@remover");
    cy.get(DIALOG).should("have.attr", "aria-busy", "false");
    assertSemanticaDialog();

    // Erro removido; tab order volta ao layout normal do dialog
    cy.get('[data-testid="remove-error"]').should("not.exist");
    cy.get(DIALOG)
      .find("[data-testid='member-remove-btn']")
      .then(($btns) => {
        const ordem = [
          "close-dialog",
          "adicionar-membros-btn",
          ...$btns
            .toArray()
            .map((b) => b.getAttribute("data-testid") || "member-remove-btn"),
        ];
        assertTabOrder(ordem);
      });
  });
});
