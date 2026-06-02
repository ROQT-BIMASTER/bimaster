/// <reference types="cypress" />

/**
 * E2E focado em estabilidade DOM pós-confirmação: clica em "Concluir"
 * no AlertDialog, aguarda o PATCH e a invalidação de cache, e valida
 * com múltiplos checkpoints que o painel da subtarefa permanece
 * EXATAMENTE no mesmo nó DOM (sem unmount/remount) em três momentos:
 *   1. logo após o clique em "Concluir" (mutação em voo);
 *   2. após o PATCH responder;
 *   3. após um pequeno settle (>refetch debounce) para detectar
 *      remounts tardios disparados por invalidações encadeadas.
 *
 * Complementa `projeto-subtarefa-conclusao-painel-estavel.cy.ts` com
 * janelas temporais maiores para capturar regressões sutis.
 */

const PROJETO_ID = '85829768-7a07-4f44-a48b-f5288dc1a830';

describe('Projeto - Confirmar no AlertDialog mantém painel da subtarefa montado em múltiplos checkpoints', () => {
  beforeEach(() => {
    cy.intercept('PATCH', '**/rest/v1/projeto_tarefas*', (req) => {
      req.reply({
        delay: 500,
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

  it('confirma conclusão e mantém o mesmo nó DOM antes, durante e após o PATCH', () => {
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

    // Confirma.
    cy.get('[role="alertdialog"]', { timeout: 5_000 })
      .should('be.visible')
      .within(() => {
        cy.get('button')
          .filter(':contains("Concluir"), :contains("Confirmar"), :contains("Sim")')
          .first()
          .click();
      });

    const assertMesmoNo = (label: string) => {
      cy.get('@painelSub').should('be.visible');
      cy.get('@painelSubNode').then((node) => {
        cy.get('[role="dialog"]').last().then(($current) => {
          expect($current[0], `painel da subtarefa não remontou [${label}]`).to.eq(node);
        });
      });
    };

    // Checkpoint 1: mutação em voo (AlertDialog fechado, PATCH ainda pendente).
    cy.get('[role="alertdialog"]').should('not.exist');
    assertMesmoNo('mutação em voo');

    // Checkpoint 2: imediatamente após o PATCH responder.
    cy.wait('@patchTarefa');
    assertMesmoNo('após PATCH');

    // Checkpoint 3: após settle (cobre invalidações tardias / refetch).
    cy.wait(1000);
    assertMesmoNo('após settle de 1s');

    // Estado visual final.
    cy.get('@painelSub').contains(/Concluída/i).should('be.visible');
    cy.get('[role="dialog"]').should('have.length.at.least', 2);
    cy.location('pathname').should('include', `/dashboard/projetos/${PROJETO_ID}`);
  });
});
