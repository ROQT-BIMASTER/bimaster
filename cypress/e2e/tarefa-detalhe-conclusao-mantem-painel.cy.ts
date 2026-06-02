/// <reference types="cypress" />

/**
 * E2E: ao concluir uma tarefa (e ao criar uma subtarefa) dentro do painel
 * de detalhes (`ProjetoTarefaDetalhe`), o painel deve permanecer aberto,
 * o indicador "Salvando…" deve aparecer durante a persistência e o status
 * + a subtarefa devem ficar visíveis sem precisar recarregar a página
 * nem reabrir o painel.
 *
 * Cobre os requisitos:
 *  - tratamento de erro mantendo o painel aberto com opção "Tentar novamente"
 *  - sincronização automática de cache sem unmount/remount do painel
 *  - estado de loading/feedback durante a persistência
 *  - validação E2E de conclusão de tarefa sem recarregar a tela
 */

describe('Tarefa - concluir sem fechar o painel de detalhes', () => {
  beforeEach(() => {
    // Backend simulado: PATCH em projeto_tarefas (conclusão / status) com
    // pequeno delay para conseguirmos validar o indicador "Salvando…".
    cy.intercept('PATCH', '**/rest/v1/projeto_tarefas*', {
      delay: 400,
      statusCode: 200,
      body: [{ id: 'tarefa-stub', status: 'concluida', data_conclusao: new Date().toISOString() }],
    }).as('patchTarefa');

    // POST de criação de subtarefa.
    cy.intercept('POST', '**/rest/v1/projeto_tarefas*', {
      delay: 400,
      statusCode: 201,
      body: [{
        id: 'subtarefa-stub',
        titulo: 'Subtarefa E2E sem fechar painel',
        status: 'pendente',
        parent_tarefa_id: 'tarefa-stub',
        secao_id: 'secao-stub',
      }],
    }).as('postSubtarefa');

    cy.visit('/central-de-trabalho');
  });

  it('marca conclusão, mostra "Salvando…" e o painel continua aberto com status atualizado', () => {
    // Abre a primeira tarefa disponível na Central de Trabalho.
    cy.get('[data-testid="minha-tarefa-row"], [role="row"]', { timeout: 15_000 })
      .first()
      .click();

    cy.get('[role="dialog"]', { timeout: 10_000 }).should('be.visible').as('painel');

    // Snapshot do elemento raiz do painel para garantir que não há
    // unmount/remount (mesma referência permanece ao longo da operação).
    cy.get('@painel').then(($el) => {
      cy.wrap($el[0]).as('painelNode');
    });

    // Clica em "Marcar como concluída".
    cy.get('@painel')
      .contains('button', /Marcar como concluída|Marcar concluída/i)
      .click();

    // Indicador de Salvando aparece e o painel não fecha.
    cy.get('[data-testid="tarefa-saving-indicator"], [data-testid="focusmode-saving-indicator"]')
      .should('be.visible');
    cy.get('@painel').should('be.visible');

    cy.wait('@patchTarefa');

    // Painel permanece aberto, mesma instância DOM (sem remount).
    cy.get('@painel').should('be.visible');
    cy.get('@painelNode').then((node) => {
      cy.get('[role="dialog"]').then(($current) => {
        expect($current[0]).to.eq(node);
      });
    });

    // Indicador desaparece e o status "Concluída" passa a aparecer.
    cy.get('[data-testid="tarefa-saving-indicator"], [data-testid="focusmode-saving-indicator"]')
      .should('not.exist');
    cy.get('@painel').contains(/Concluída/i).should('be.visible');

    // Cria uma subtarefa pelo painel sem recarregar.
    cy.get('@painel').then(($p) => {
      const $input = $p.find('input[placeholder*="subtarefa" i], input[placeholder*="Adicionar"]').first();
      if ($input.length) {
        cy.wrap($input)
          .type('Subtarefa E2E sem fechar painel{enter}', { delay: 10 });
        cy.wait('@postSubtarefa');
        cy.get('@painel').should('be.visible');
        cy.get('@painel').contains('Subtarefa E2E sem fechar painel').should('be.visible');
      }
    });

    // URL não foi recarregada (mesma rota).
    cy.location('pathname').should('include', '/central-de-trabalho');
  });

  it('em caso de erro ao concluir, o painel permanece aberto e exibe ação "Tentar novamente"', () => {
    cy.intercept('PATCH', '**/rest/v1/projeto_tarefas*', {
      statusCode: 500,
      body: { message: 'Falha simulada' },
    }).as('patchFail');

    cy.get('[data-testid="minha-tarefa-row"], [role="row"]', { timeout: 15_000 })
      .first()
      .click();
    cy.get('[role="dialog"]', { timeout: 10_000 }).should('be.visible').as('painel');

    cy.get('@painel')
      .contains('button', /Marcar como concluída|Marcar concluída/i)
      .click();

    cy.wait('@patchFail');

    // Painel continua aberto após o erro.
    cy.get('@painel').should('be.visible');

    // Toast de erro com botão "Tentar novamente".
    cy.contains(/Tentar novamente/i, { timeout: 5_000 }).should('be.visible');
  });
});
