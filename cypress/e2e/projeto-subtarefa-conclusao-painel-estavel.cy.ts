/// <reference types="cypress" />

/**
 * E2E focado em subtarefas: ao abrir uma subtarefa (segundo `Sheet` aninhado,
 * controlado por `selectedSubtarefaId` em `ProjetoTarefaDetalhe`) e concluí-la
 * pelo botão "Marcar como concluída" (com confirmação via AlertDialog), o
 * painel da subtarefa DEVE:
 *   1. permanecer aberto após a confirmação (o `AlertDialog` é ignorado pelo
 *      `onPointerDownOutside` do `Sheet` — fix recente);
 *   2. NÃO desmontar/remontar — a mesma referência DOM persiste, pois o
 *      mount é controlado por `selectedSubtarefaId` (não pelo objeto
 *      `selectedSubtarefa`, que pode ficar nulo durante refetch);
 *   3. refletir o novo status sem reload e sem reabrir o painel pai.
 *
 * Complementa `projeto-tarefa-conclusao-painel-estavel.cy.ts` (tarefa pai).
 */

const PROJETO_ID = '85829768-7a07-4f44-a48b-f5288dc1a830';

describe('Projeto - painel de subtarefa estável ao concluir', () => {
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

  it('conclui uma subtarefa pelo botão e mantém o painel aberto, sem remount', () => {
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

    // 2) Abre a primeira subtarefa (botão `ChevronRight` ao lado do título).
    //    Força hover para revelar o botão (opacity 0 → 100 no group-hover).
    cy.get('@painelPai')
      .find('button')
      .filter((_, el) => !!el.querySelector('svg.lucide-chevron-right'))
      .first()
      .click({ force: true });

    // 3) Agora devem existir DOIS dialogs abertos. O painel da subtarefa é o
    //    último a montar; capturamos-o e travamos a referência DOM.
    cy.get('[role="dialog"]', { timeout: 10_000 })
      .should('have.length.at.least', 2)
      .last()
      .as('painelSub');

    cy.get('@painelSub').then(($el) => {
      cy.wrap($el[0]).as('painelSubNode');
    });

    // 4) Clica no botão "Marcar como concluída" dentro do painel da subtarefa.
    cy.get('@painelSub')
      .find('button:contains("Marcar como concluída"), button:contains("Marcar concluída")')
      .first()
      .click();

    // 5) Confirma no AlertDialog (texto típico: "Concluir" / "Confirmar").
    cy.get('[role="alertdialog"]', { timeout: 5_000 })
      .should('be.visible')
      .within(() => {
        cy.get('button')
          .filter(':contains("Concluir"), :contains("Confirmar"), :contains("Sim")')
          .first()
          .click();
      });

    // 6) Painel da subtarefa permanece visível enquanto a mutação roda.
    cy.get('@painelSub').should('be.visible');

    cy.wait('@patchTarefa');

    // 7) Painel ainda visível E é EXATAMENTE o mesmo nó DOM de antes
    //    (nenhum unmount/remount após o PATCH + invalidação de cache).
    cy.get('@painelSub').should('be.visible');
    cy.get('@painelSubNode').then((node) => {
      cy.get('[role="dialog"]').last().then(($current) => {
        expect($current[0], 'painel da subtarefa não remontou após o PATCH').to.eq(node);
      });
    });

    // 8) AlertDialog desapareceu e status reflete "Concluída" sem reabrir.
    cy.get('[role="alertdialog"]').should('not.exist');
    cy.get('@painelSub').contains(/Concluída/i).should('be.visible');

    // 9) Painel pai segue montado por baixo (Sheet aninhado funcional).
    cy.get('[role="dialog"]').should('have.length.at.least', 2);

    // 10) Rota não recarregou.
    cy.location('pathname').should('include', `/dashboard/projetos/${PROJETO_ID}`);
  });
});
