/// <reference types="cypress" />

/**
 * E2E focado: dentro da rota de um projeto (lista de tarefas), ao concluir
 * uma tarefa OU trocar seu status pelo painel de detalhes, o `Sheet`
 * (`[role="dialog"]`) deve:
 *   1. permanecer aberto (`open` controlado por `selectedTarefaId`);
 *   2. NÃO desmontar/remontar — a mesma referência DOM persiste antes e
 *      depois da mutação (proteção contra o flicker causado por
 *      refetch agressivo que fora corrigido com `refetchType: "none"`);
 *   3. refletir o novo status sem reload e sem reabrir o painel.
 *
 * Complementa `tarefa-detalhe-conclusao-mantem-painel.cy.ts` (que cobre o
 * fluxo a partir da Central de Trabalho) cobrindo o caminho via rota do
 * projeto, que usa `ProjetoListView` + `ProjetoTarefaDetalhe` diretamente.
 */

const PROJETO_ID = '85829768-7a07-4f44-a48b-f5288dc1a830';

describe('Projeto - painel de detalhes estável ao salvar status', () => {
  beforeEach(() => {
    // PATCH em projeto_tarefas com pequeno delay para validarmos o
    // indicador "Salvando…" e a permanência do painel.
    cy.intercept('PATCH', '**/rest/v1/projeto_tarefas*', (req) => {
      req.reply({
        delay: 400,
        statusCode: 200,
        body: [{
          ...(req.body || {}),
          id: req.url.match(/id=eq\.([0-9a-f-]+)/i)?.[1] ?? 'tarefa-stub',
          updated_at: new Date().toISOString(),
        }],
      });
    }).as('patchTarefa');

    cy.visit(`/dashboard/projetos/${PROJETO_ID}`);
  });

  it('conclui uma tarefa pelo painel e mantém o painel aberto, sem remount', () => {
    // Abre a primeira tarefa da lista do projeto.
    cy.get(
      '[data-testid="projeto-tarefa-row"], [role="row"], a[href*="/tarefas/"]',
      { timeout: 20_000 },
    )
      .first()
      .click({ force: true });

    cy.get('[role="dialog"]', { timeout: 10_000 })
      .should('be.visible')
      .as('painel');

    // Snapshot do nó DOM raiz do painel — usado para garantir ausência de
    // unmount/remount após a mutação.
    cy.get('@painel').then(($el) => {
      cy.wrap($el[0]).as('painelNode');
    });

    // Conclui a tarefa pelo botão dedicado quando disponível; cai no Select
    // de status caso o botão não esteja visível neste contexto.
    cy.get('@painel').then(($p) => {
      const $btn = $p.find('button:contains("Marcar como concluída"), button:contains("Marcar concluída")');
      if ($btn.length) {
        cy.wrap($btn.first()).click();
      } else {
        cy.wrap($p)
          .find('[data-testid="tarefa-status-select"], [role="combobox"]')
          .first()
          .click();
        cy.get('[role="listbox"]').contains(/Concluída/i).click();
      }
    });

    // O indicador de "Salvando…" deve aparecer e o painel permanecer aberto.
    cy.get('[data-testid="tarefa-saving-indicator"], [data-testid="focusmode-saving-indicator"]', {
      timeout: 3_000,
    }).should('be.visible');
    cy.get('@painel').should('be.visible');

    cy.wait('@patchTarefa');

    // Painel continua visível e é EXATAMENTE o mesmo nó DOM de antes
    // (nenhum unmount/remount durante a invalidação de cache).
    cy.get('@painel').should('be.visible');
    cy.get('@painelNode').then((node) => {
      cy.get('[role="dialog"]').then(($current) => {
        expect($current[0], 'painel não remontou após o PATCH').to.eq(node);
      });
    });

    // Indicador some e status passa a refletir "Concluída" sem reabrir.
    cy.get('[data-testid="tarefa-saving-indicator"], [data-testid="focusmode-saving-indicator"]')
      .should('not.exist');
    cy.get('@painel').contains(/Concluída/i).should('be.visible');

    // Rota não recarregou.
    cy.location('pathname').should('include', `/dashboard/projetos/${PROJETO_ID}`);
  });

  it('troca o status duas vezes consecutivas sem fechar o painel nem remontar', () => {
    cy.get(
      '[data-testid="projeto-tarefa-row"], [role="row"], a[href*="/tarefas/"]',
      { timeout: 20_000 },
    )
      .first()
      .click({ force: true });

    cy.get('[role="dialog"]', { timeout: 10_000 }).should('be.visible').as('painel');
    cy.get('@painel').then(($el) => cy.wrap($el[0]).as('painelNode'));

    const trocarStatus = (label: RegExp) => {
      cy.get('@painel')
        .find('[data-testid="tarefa-status-select"], [role="combobox"]')
        .first()
        .click();
      cy.get('[role="listbox"]').contains(label).click();
      cy.wait('@patchTarefa');
      cy.get('@painel').should('be.visible');
      cy.get('@painelNode').then((node) => {
        cy.get('[role="dialog"]').then(($current) => {
          expect($current[0], `painel não remontou ao trocar para ${label}`).to.eq(node);
        });
      });
    };

    trocarStatus(/Em andamento/i);
    trocarStatus(/Concluída/i);
  });
});
