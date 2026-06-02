/**
 * E2E: garante que durante "Removendo {nome}…" — mesmo após múltiplas
 * tentativas consecutivas com falha — Tab/Shift+Tab nunca escapam do modal
 * e Escape/clique fora continuam bloqueados, destravando somente após
 * o retorno de sucesso.
 */

describe("ProjetoMembrosDialog — focus trap e bloqueio multi-tentativa", () => {
  const PROJETO_ID = Cypress.env("PROJETO_ID") || "test-projeto-id";
  const MEMBRO_NOME = "Maria Teste";
  const MEMBRO_ID = "membro-teste-1";
  const TOTAL_FALHAS = 3;

  beforeEach(() => {
    let tentativa = 0;
    cy.intercept("POST", "**/rest/v1/rpc/remover_membro_projeto*", (req) => {
      tentativa += 1;
      if (tentativa <= TOTAL_FALHAS) {
        req.on("response", (res) => res.setDelay(1200));
        req.reply({
          statusCode: 500,
          body: {
            message: "Falha simulada",
            code: "PGRST500",
            hint: "Tente novamente em instantes",
          },
        });
      } else {
        req.on("response", (res) => res.setDelay(1200));
        req.reply({ statusCode: 200, body: { ok: true } });
      }
    }).as("remover");

    cy.visit(`/projetos/${PROJETO_ID}`);
    cy.get('[data-testid="abrir-membros-dialog"]').click();
    cy.get('[data-testid="projeto-membros-dialog"]').should("be.visible");
  });

  const dispararRemocao = () => {
    cy.get(
      `[data-testid="member-remove-btn"][data-member-id="${MEMBRO_ID}"]`,
    ).click();
    cy.get('[data-testid="confirmar-remocao-btn"]').click();
  };

  const assertModalTravadaDuranteLoading = () => {
    // aria-live anunciando loading
    cy.get('[data-testid="membros-live-region"]').should(
      "contain.text",
      `Removendo ${MEMBRO_NOME}`,
    );

    const dialog = '[data-testid="projeto-membros-dialog"]';

    // Escape NÃO fecha
    cy.get("body").type("{esc}");
    cy.get(dialog).should("be.visible");

    // Clique fora (overlay) NÃO fecha
    cy.get("body").click(5, 5, { force: true });
    cy.get(dialog).should("be.visible");

    // Focus trap: Tab repetido permanece dentro do dialog
    for (let i = 0; i < 12; i += 1) {
      cy.focused().tab();
      cy.focused().then(($el) => {
        expect($el.closest(dialog).length, `Tab #${i} dentro do dialog`).to.eq(
          1,
        );
      });
    }
    // Shift+Tab repetido também permanece dentro
    for (let i = 0; i < 12; i += 1) {
      cy.focused().tab({ shift: true });
      cy.focused().then(($el) => {
        expect(
          $el.closest(dialog).length,
          `Shift+Tab #${i} dentro do dialog`,
        ).to.eq(1);
      });
    }
  };

  it("mantém focus trap e bloqueia Esc/clique fora em todas as tentativas até sucesso", () => {
    const assertAlvoPreservado = (tentativa: number) => {
      // O cabeçalho/aria-live do dialog continua referenciando exatamente o
      // mesmo membro selecionado originalmente — nunca troca entre retries.
      cy.get('[data-testid="remove-target-name"]')
        .should("have.attr", "data-member-id", MEMBRO_ID)
        .and("contain.text", MEMBRO_NOME);
      cy.get('[data-testid="membros-live-region"]').should(
        "contain.text",
        `Removendo ${MEMBRO_NOME}`,
      );
      // E o payload enviado ao backend sempre carrega o mesmo membro_id.
      cy.get("@remover.all").then((calls: any) => {
        expect(calls).to.have.length(tentativa);
        calls.forEach((call: any, idx: number) => {
          expect(
            call.request.body?.p_membro_id ?? call.request.body?.membro_id,
            `tentativa ${idx + 1} -> membro_id correto`,
          ).to.eq(MEMBRO_ID);
        });
      });
    };

    for (let attempt = 1; attempt <= TOTAL_FALHAS; attempt += 1) {
      if (attempt === 1) {
        dispararRemocao();
      } else {
        cy.get('[data-testid="retry-remove-btn"]').click();
      }

      assertModalTravadaDuranteLoading();

      cy.wait("@remover");
      assertAlvoPreservado(attempt);
      cy.get('[data-testid="remove-error"]').should("be.visible");
      cy.get('[data-testid="projeto-membros-dialog"]').should("be.visible");
    }

    // Última tentativa: sucesso
    cy.get('[data-testid="retry-remove-btn"]').click();
    assertModalTravadaDuranteLoading();
    cy.wait("@remover");
    assertAlvoPreservado(TOTAL_FALHAS + 1);

    // Após sucesso o estado destrava: erro some e membro removido
    cy.get('[data-testid="remove-error"]').should("not.exist");
    cy.get(
      `[data-testid="member-remove-btn"][data-member-id="${MEMBRO_ID}"]`,
    ).should("not.exist");

    // Agora Escape volta a funcionar
    cy.get("body").type("{esc}");
    cy.get('[data-testid="projeto-membros-dialog"]').should("not.exist");
  });
});

