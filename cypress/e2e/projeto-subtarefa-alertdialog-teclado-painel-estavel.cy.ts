/// <reference types="cypress" />

/**
 * E2E: ao abrir o AlertDialog de conclusão da subtarefa, testar atalhos de
 * teclado:
 *   - Enter: confirma (dispara PATCH) e o painel da subtarefa permanece
 *     aberto e não remonta;
 *   - Escape: cancela (nenhum PATCH) e o painel da subtarefa permanece
 *     aberto e não remonta.
 *
 * Valida que o close do AlertDialog via teclado não propaga como
 * pointer-down-outside para o Sheet aninhado (`onPointerDownOutside`
 * ignora `[role=alertdialog]`).
 */

const PROJETO_ID = '85829768-7a07-4f44-a48b-f5288dc1a830';

function abrirSubtarefa() {
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

  cy.get('[role="alertdialog"]', { timeout: 5_000 }).should('be.visible');
}

function assertPainelMesmoNo(msg: string) {
  cy.get('@painelSub').should('be.visible');
  cy.get('@painelSubNode').then((node) => {
    cy.get('[role="dialog"]').last().then(($current) => {
      expect($current[0], msg).to.eq(node);
    });
  });
}

describe('Projeto - Enter/Escape no AlertDialog mantêm painel da subtarefa estável', () => {
  beforeEach(() => {
    cy.intercept('PATCH', '**/rest/v1/projeto_tarefas*', (req) => {
      req.reply({
        delay: 400,
        statusCode: 200,
        body: [{
          ...(req.body || {}),
          id: req.url.match(/id=eq\.([0-9a-f-]+)/i)?.[1] ?? 'subtarefa-stub',
          updated_at: new Date().toISOString(),
        }],
      });
    }).as('patchTarefa');

    cy.visit(`/dashboard/projetos/${PROJETO_ID}`);
  });

  it('Enter confirma e mantém o painel da subtarefa aberto, sem remount', () => {
    abrirSubtarefa();

    // Foco está no botão de ação por padrão no Radix AlertDialog.
    cy.get('[role="alertdialog"]').focused().type('{enter}');

    cy.wait('@patchTarefa');
    cy.get('[role="alertdialog"]').should('not.exist');
    assertPainelMesmoNo('painel não remontou após Enter');
    cy.get('[role="dialog"]').should('have.length.at.least', 2);
  });

  it('Escape cancela sem PATCH e mantém o painel da subtarefa aberto, sem remount', () => {
    abrirSubtarefa();

    cy.get('body').type('{esc}');

    cy.get('[role="alertdialog"]').should('not.exist');
    assertPainelMesmoNo('painel não remontou após Escape');
    cy.get('@patchTarefa.all').should('have.length', 0);
    cy.get('@painelSub').contains(/Concluída/i).should('not.exist');
    cy.get('[role="dialog"]').should('have.length.at.least', 2);
  });
});
