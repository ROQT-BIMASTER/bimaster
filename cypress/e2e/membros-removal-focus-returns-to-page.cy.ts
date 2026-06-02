/// <reference types="cypress" />

/**
 * E2E: após sucesso na remoção de membro, o foco deve ir para um elemento
 * clicável real da página (fora do modal) e o Tab não pode reentrar em
 * nenhum nó do antigo dialog.
 */

const DIALOG_SELECTORS = [
  '[data-testid="projeto-membros-dialog"]',
  '[role="dialog"]',
  '[data-radix-portal]',
  '[data-radix-dialog-overlay]',
];

function isInsideOldDialog(el: HTMLElement | null): boolean {
  if (!el) return false;
  return DIALOG_SELECTORS.some((sel) => !!el.closest(sel));
}

describe('Membros - foco volta para a página após sucesso', () => {
  beforeEach(() => {
    cy.intercept('POST', '**/rest/v1/rpc/remover_membro_projeto*', {
      delay: 250,
      statusCode: 200,
      body: { success: true },
    }).as('removerMembro');

    cy.visit('/projetos');
    cy.get('[data-testid="projeto-card"], a[href*="/projetos/"]').first().click();
  });

  it('move o foco para um elemento clicável fora do modal e libera o Tab', () => {
    cy.get('[data-testid="abrir-membros-dialog"], button:contains("Membros")')
      .first()
      .click();

    cy.get('[data-testid="projeto-membros-dialog"]').should('be.visible');

    cy.get('[data-testid="membro-item"]').first().within(() => {
      cy.get('[data-testid="remover-membro"], button:contains("Remover")').click();
    });

    cy.get('[data-testid="confirmar-remocao"], button:contains("Confirmar")').click();

    cy.wait('@removerMembro');

    // dialog deve desaparecer
    cy.get('[data-testid="projeto-membros-dialog"]').should('not.exist');
    cy.get('[role="dialog"]').should('not.exist');
    cy.get('[data-radix-portal]').should('not.exist');
    cy.get('[data-radix-dialog-overlay]').should('not.exist');

    // foco deve ir para um elemento real da página, fora do antigo modal
    cy.focused().should(($el) => {
      const el = $el.get(0) as HTMLElement;
      expect(el, 'foco precisa existir após o sucesso').to.exist;
      expect(isInsideOldDialog(el), 'foco não pode estar dentro do dialog antigo').to
        .be.false;

      // precisa ser um elemento clicável/focável real da página
      const tag = el.tagName.toLowerCase();
      const tabbable =
        ['a', 'button', 'input', 'select', 'textarea'].includes(tag) ||
        el.hasAttribute('tabindex');
      expect(tabbable, `elemento focado precisa ser clicável (tag=${tag})`).to.be
        .true;

      // precisa estar conectado ao DOM e visível
      expect(el.isConnected, 'elemento focado precisa estar no DOM').to.be.true;
      const rect = el.getBoundingClientRect();
      expect(rect.width * rect.height, 'elemento focado precisa ter área visível').to
        .be.greaterThan(0);
    });

    // valida que o foco corresponde a um clique funcional real
    cy.focused().then(($el) => {
      cy.wrap($el).click({ force: false });
    });

    // Tab por 25 elementos: nenhum pode cair dentro do dialog antigo
    const visitados = new Set<HTMLElement>();
    for (let i = 0; i < 25; i++) {
      cy.focused().tab();
      cy.focused().then(($el) => {
        const el = $el.get(0) as HTMLElement;
        visitados.add(el);
        expect(
          isInsideOldDialog(el),
          `iteração ${i}: Tab caiu em elemento do dialog antigo (${el.tagName})`,
        ).to.be.false;
      });
    }

    // sanity: o Tab navegou por múltiplos elementos diferentes (sem loop curto)
    cy.then(() => {
      expect(visitados.size, 'Tab precisa percorrer vários elementos da página').to
        .be.greaterThan(5);
    });
  });
});
