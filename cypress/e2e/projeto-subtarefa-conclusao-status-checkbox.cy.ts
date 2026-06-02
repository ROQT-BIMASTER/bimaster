/// <reference types="cypress" />

/**
 * E2E: ao concluir uma subtarefa via confirmação no AlertDialog, validar
 * que o status visível e o checkbox refletem "Concluída" enquanto o
 * painel da subtarefa permanece aberto e sem unmount/remount.
 *
 * Foco: estado visual pós-mutação (badge "Concluída" + checkbox marcado),
 * complementando os testes de identidade DOM já existentes.
 */

const PROJETO_ID = '85829768-7a07-4f44-a48b-f5288dc1a830';

describe('Projeto - status/checkbox da subtarefa pós-conclusão com painel aberto', () => {
  beforeEach(() => {
    cy.intercept('PATCH', '**/rest/v1/projeto_tarefas*', (req) => {
      req.reply({
        delay: 400,
        statusCode: 200,
        body: [{
          ...(req.body || {}),
          id: req.url.match(/id=eq\.([0-9a-f-]+)/i)?.[1] ?? 'subtarefa-stub',
          status: 'concluida',
          concluida_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }],
      });
    }).as('patchTarefa');

    cy.visit(`/dashboard/projetos/${PROJETO_ID}`);
  });

  it('reflete status Concluída e checkbox marcado, com painel permanecendo aberto', () => {
    cy.get(
      '[data-testid="projeto-tarefa-row"], [role="row"], a[href*="/tarefas/"]',
      { timeout: 20_000 },
    )
      .first()
      .click({ force: true });

    cy.get('[role="dialog"]', { timeout: 10_000 }).should('be.visible').as('painelPai');

    cy.get('@painelPai')
      .find('button')
      .filter((_, el) => !!el.querySelector('svg.lucide-chevron-right'))
      .first()
      .click({ force: true });

    cy.get('[role="dialog"]', { timeout: 10_000 })
      .should('have.length.at.least', 2)
      .last()
      .as('painelSub');

    cy.get('@painelSub').then(($el) => cy.wrap($el[0]).as('painelSubNode'));

    cy.get('@painelSub')
      .find('button:contains("Marcar como concluída"), button:contains("Marcar concluída")')
      .first()
      .click();

    cy.get('[role="alertdialog"]', { timeout: 5_000 })
      .should('be.visible')
      .within(() => {
        cy.get('button')
          .filter(':contains("Concluir"), :contains("Confirmar"), :contains("Sim")')
          .first()
          .click();
      });

    cy.wait('@patchTarefa');

    // Painel segue visível e é o mesmo nó DOM.
    cy.get('@painelSub').should('be.visible');
    cy.get('@painelSubNode').then((node) => {
      cy.get('[role="dialog"]').last().then(($current) => {
        expect($current[0], 'painel da subtarefa não remontou').to.eq(node);
      });
    });

    // Status reflete "Concluída".
    cy.get('@painelSub').contains(/Concluída/i, { timeout: 5_000 }).should('be.visible');

    // Checkbox da subtarefa (Radix `[role="checkbox"]`) marcado, ou input nativo `:checked`.
    cy.get('@painelSub').then(($p) => {
      const $radix = $p.find('[role="checkbox"][data-state="checked"]');
      const $native = $p.find('input[type="checkbox"]:checked');
      expect(
        $radix.length + $native.length,
        'checkbox da subtarefa deve estar marcado',
      ).to.be.greaterThan(0);
    });

    // AlertDialog desapareceu, painel pai segue montado.
    cy.get('[role="alertdialog"]').should('not.exist');
    cy.get('[role="dialog"]').should('have.length.at.least', 2);
  });
});
