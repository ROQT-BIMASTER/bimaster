/**
 * E2E: durante qualquer tentativa de remoção em estado de loading
 * (spinner "Removendo {nome}…"), Escape e clique fora NUNCA podem fechar
 * o ProjetoMembrosDialog — mesmo em sequência de múltiplos spinners
 * consecutivos provocados por erros sucessivos.
 *
 * Estratégia:
 *  - Intercepta a RPC com atraso configurável e força N falhas em sequência.
 *  - Em cada spinner: martela Escape e cliques fora (overlay + cantos da
 *    viewport) repetidas vezes e confirma que o dialog continua visível e
 *    `aria-busy="true"`.
 *  - Repete por TOTAL_FALHAS tentativas + 1 spinner final que termina em
 *    sucesso (este também é testado durante o loading).
 *  - Só após o sucesso o Escape é aceito (sanidade do destravamento).
 */

describe("ProjetoMembrosDialog — Escape/clique fora nunca fecham em spinners consecutivos", () => {
  const PROJETO_ID = Cypress.env("PROJETO_ID") || "test-projeto-id";
  const MEMBRO_NOME = "Maria Teste";
  const MEMBRO_ID = "membro-teste-1";
  const TOTAL_FALHAS = 4;
  const DELAY_MS = 1500;
  const DIALOG = '[data-testid="projeto-membros-dialog"]';

  beforeEach(() => {
    let n = 0;
    cy.intercept("POST", "**/rest/v1/rpc/remover_membro_projeto*", (req) => {
      n += 1;
      req.on("response", (res) => res.setDelay(DELAY_MS));
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

  const martelarFechamentoSemSucesso = (rotulo: string) => {
    // Pré-condições: spinner ativo
    cy.get(DIALOG)
      .should("be.visible")
      .and("have.attr", "aria-busy", "true");
    cy.get('[data-testid="membros-live-region"]').should(
      "contain.text",
      `Removendo ${MEMBRO_NOME}`,
    );

    // 5x Escape em pontos distintos
    for (let i = 0; i < 5; i += 1) {
      cy.get("body").type("{esc}");
      cy.focused().then(($f) => {
        if ($f.length) cy.wrap($f).type("{esc}", { force: true });
      });
      cy.get(DIALOG, { log: false })
        .should("be.visible")
        .and("have.attr", "aria-busy", "true");
    }

    // 5x clique fora em coordenadas diferentes (cantos + overlay Radix)
    const pontos: Array<[number, number]> = [
      [2, 2],
      [10, 10],
      [400, 5],
      [5, 400],
      [800, 600],
    ];
    pontos.forEach(([x, y]) => {
      cy.get("body").click(x, y, { force: true });
      cy.get(DIALOG, { log: false })
        .should("be.visible")
        .and("have.attr", "aria-busy", "true");
    });

    // Overlay Radix (se presente) — pointerdown/click direto não fecha
    cy.get("body").then(($b) => {
      const overlay = $b.find("[data-radix-dialog-overlay]");
      if (overlay.length) {
        cy.wrap(overlay).click({ force: true, multiple: true });
        cy.get(DIALOG)
          .should("be.visible")
          .and("have.attr", "aria-busy", "true");
      }
    });

    cy.log(`spinner #${rotulo} sobreviveu a Escape/clique fora`);
  };

  it("bloqueia Escape e clique fora em N spinners de erro + spinner de sucesso", () => {
    // Dispara remoção
    cy.get(
      `[data-testid="member-remove-btn"][data-member-id="${MEMBRO_ID}"]`,
    ).click();
    cy.get('[data-testid="confirmar-remocao-btn"]').click();

    for (let attempt = 1; attempt <= TOTAL_FALHAS; attempt += 1) {
      martelarFechamentoSemSucesso(`${attempt}/erro`);
      cy.wait("@remover");
      // Após erro: dialog continua, mostra "Tentar novamente" e dispara
      // o próximo spinner.
      cy.get(DIALOG).should("be.visible");
      cy.get('[data-testid="remove-error"]').should("be.visible");
      cy.get('[data-testid="retry-remove-btn"]').click();
    }

    // Spinner final (sucesso): mesmo nele, durante o loading, Escape e
    // clique fora ainda não podem fechar.
    martelarFechamentoSemSucesso("final/sucesso");
    cy.wait("@remover");

    // Sanidade: após o sucesso o destravamento volta — Escape fecha.
    cy.get(DIALOG)
      .should("be.visible")
      .and("have.attr", "aria-busy", "false");
    cy.get('[data-testid="remove-error"]').should("not.exist");
    cy.get("body").type("{esc}");
    cy.get(DIALOG).should("not.exist");
  });
});
