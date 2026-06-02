/// <reference types="cypress" />

/**
 * E2E: ao abrir uma subtarefa e clicar em "Marcar como concluída", o
 * AlertDialog de confirmação aparece. Se o usuário clicar em "Cancelar":
 *   1. o AlertDialog desaparece;
 *   2. o painel da subtarefa PERMANECE aberto;
 *   3. o mesmo nó DOM persiste (sem unmount/remount);
 *   4. nenhuma requisição PATCH é disparada (a mutação foi cancelada);
 *   5. o status da subtarefa NÃO muda para "Concluída".
 *
 * Complementa `projeto-subtarefa-conclusao-painel-estavel.cy.ts` (que cobre
 * a confirmação) cobrindo o caminho de cancelamento. Valida o fix em que
 * `onPointerDownOutside` do Sheet ignora `[role=alertdialog]`, garantindo
 * que o fechamento do AlertDialog não propague para o Sheet pai.
 */

const PROJETO_ID = '85829768-7a07-4f44-a48b-f5288dc1a830';

describe('Projeto - cancelar conclusão de subtarefa mantém painel estável', () => {
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

  it('cancela a conclusão e mantém o painel da subtarefa aberto, sem remount e sem PATCH', () => {
    // 1) Abre a primeira tarefa pai da lista do projeto.
    cy.get(
      '[data-testid="projeto-tarefa-row"], [role="row"], a[href*="/tarefas/"]',
      { timeout: 20_000 },
    )
      .first()
      .click({ force: true });

    cy.get('[role="dialog"]', { timeout: 10_000 })
      .should('be.visible')
      .as('painelPai');

    // 2) Abre a primeira subtarefa (botão `ChevronRight`).
    cy.get('@painelPai')
      .find('button')
      .filter((_, el) => !!el.querySelector('svg.lucide-chevron-right'))
      .first()
      .click({ force: true });

    // 3) Captura o painel da subtarefa (último dialog).
    cy.get('[role="dialog"]', { timeout: 10_000 })
      .should('have.length.at.least', 2)
      .last()
      .as('painelSub');

    cy.get('@painelSub').then(($el) => {
      cy.wrap($el[0]).as('painelSubNode');
    });

    // 4) Clica em "Marcar como concluída" para abrir o AlertDialog.
    cy.get('@painelSub')
      .find('button:contains("Marcar como concluída"), button:contains("Marcar concluída")')
      .first()
      .click();

    // 5) AlertDialog visível — clica em "Cancelar".
    cy.get('[role="alertdialog"]', { timeout: 5_000 })
      .should('be.visible')
      .within(() => {
        cy.get('button').contains(/Cancelar/i).click();
      });

    // 6) AlertDialog desaparece, painel da subtarefa permanece visível.
    cy.get('[role="alertdialog"]').should('not.exist');
    cy.get('@painelSub').should('be.visible');

    // 7) Mesmo nó DOM (sem unmount/remount provocado pelo close do AlertDialog).
    cy.get('@painelSubNode').then((node) => {
      cy.get('[role="dialog"]').last().then(($current) => {
        expect($current[0], 'painel da subtarefa não remontou após cancelar').to.eq(node);
      });
    });

    // 8) Painel pai segue montado por baixo.
    cy.get('[role="dialog"]').should('have.length.at.least', 2);

    // 9) Status NÃO mudou para "Concluída" e nenhum PATCH foi disparado.
    cy.get('@painelSub').contains(/Concluída/i).should('not.exist');
    cy.get('@patchTarefa.all').should('have.length', 0);

    // 10) Rota intacta.
    cy.location('pathname').should('include', `/dashboard/projetos/${PROJETO_ID}`);
  });
});
