/// <reference types="cypress" />

/**
 * E2E: após sucesso na remoção de membro, navegação com Tab e Shift+Tab
 * deve percorrer toda a página até o último elemento focável, sem nunca
 * cair em nenhum nó do antigo dialog (focus trap residual).
 */

const DIALOG_SELECTORS = [
  '[data-testid="projeto-membros-dialog"]',
  '[role="dialog"]',
  '[data-radix-portal]',
  '[data-radix-dialog-overlay]',
];

function dentroDoDialogAntigo(el: HTMLElement | null): boolean {
  if (!el) return false;
  return DIALOG_SELECTORS.some((sel) => !!el.closest(sel));
}

describe('Membros - Tab/Shift+Tab cobrem toda a página após sucesso', () => {
  beforeEach(() => {
    cy.intercept('POST', '**/rest/v1/rpc/remover_membro_projeto*', {
      delay: 200,
      statusCode: 200,
      body: { success: true },
    }).as('removerMembro');

    cy.visit('/projetos');
    cy.get('[data-testid="projeto-card"], a[href*="/projetos/"]').first().click();
  });

  it('Tab+Shift+Tab percorrem todos os focáveis sem reentrar no modal antigo', () => {
    // executa a remoção
    cy.get('[data-testid="abrir-membros-dialog"], button:contains("Membros")')
      .first()
      .click();
    cy.get('[data-testid="projeto-membros-dialog"]').should('be.visible');
    cy.get('[data-testid="membro-item"]').first().within(() => {
      cy.get('[data-testid="remover-membro"], button:contains("Remover")').click();
    });
    cy.get('[data-testid="confirmar-remocao"], button:contains("Confirmar")').click();
    cy.wait('@removerMembro');

    // dialog e portais devem ter sumido
    cy.get('[data-testid="projeto-membros-dialog"]').should('not.exist');
    cy.get('[role="dialog"]').should('not.exist');
    cy.get('[data-radix-portal]').should('not.exist');
    cy.get('[data-radix-dialog-overlay]').should('not.exist');

    // mapeia todos os elementos focáveis reais da página
    const FOCUSABLE = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    cy.document().then((doc) => {
      const focaveis = Array.from(doc.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => {
          if (dentroDoDialogAntigo(el)) return false;
          if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed')
            return false;
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        },
      );

      expect(focaveis.length, 'página deve ter múltiplos elementos focáveis').to.be
        .greaterThan(3);

      cy.wrap(focaveis.length).as('totalFocaveis');
      cy.wrap(focaveis[0]).as('primeiroFocavel');
      cy.wrap(focaveis[focaveis.length - 1]).as('ultimoFocavel');
    });

    // ====== FASE 1: Tab para frente até o último focável real ======
    cy.get<HTMLElement>('@primeiroFocavel').then(($el) => {
      cy.wrap($el).focus();
    });

    cy.get<number>('@totalFocaveis').then((total) => {
      // Cap defensivo: 3x o número de focáveis para tolerar wrap-around
      const maxIter = Math.max(total * 3, 50);
      const visitados = new Set<HTMLElement>();
      let chegouNoUltimo = false;

      cy.get<HTMLElement>('@ultimoFocavel').then(($ultimo) => {
        const ultimoEl = $ultimo as unknown as HTMLElement;

        const tabLoop = (i: number): Cypress.Chainable<void> => {
          if (i >= maxIter || chegouNoUltimo) return cy.wrap(undefined);
          return cy.focused().then(($focused) => {
            const el = $focused.get(0) as HTMLElement;
            expect(
              dentroDoDialogAntigo(el),
              `Tab iteração ${i}: foco entrou em nó do dialog antigo (${el.tagName})`,
            ).to.be.false;
            visitados.add(el);
            if (el === ultimoEl) chegouNoUltimo = true;
            return cy.focused().tab().then(() => tabLoop(i + 1));
          }) as unknown as Cypress.Chainable<void>;
        };

        tabLoop(0).then(() => {
          expect(
            chegouNoUltimo,
            'Tab para frente precisa alcançar o último elemento focável',
          ).to.be.true;
          expect(visitados.size, 'Tab deve visitar a maioria dos focáveis').to.be
            .greaterThan(Math.min(total - 1, 5));
        });
      });
    });

    // ====== FASE 2: Shift+Tab de volta ao primeiro ======
    cy.get<HTMLElement>('@ultimoFocavel').then(($el) => {
      cy.wrap($el).focus();
    });

    cy.get<number>('@totalFocaveis').then((total) => {
      const maxIter = Math.max(total * 3, 50);
      const visitados = new Set<HTMLElement>();
      let chegouNoPrimeiro = false;

      cy.get<HTMLElement>('@primeiroFocavel').then(($primeiro) => {
        const primeiroEl = $primeiro as unknown as HTMLElement;

        const shiftLoop = (i: number): Cypress.Chainable<void> => {
          if (i >= maxIter || chegouNoPrimeiro) return cy.wrap(undefined);
          return cy.focused().then(($focused) => {
            const el = $focused.get(0) as HTMLElement;
            expect(
              dentroDoDialogAntigo(el),
              `Shift+Tab iteração ${i}: foco entrou em nó do dialog antigo (${el.tagName})`,
            ).to.be.false;
            visitados.add(el);
            if (el === primeiroEl) chegouNoPrimeiro = true;
            return cy
              .focused()
              .tab({ shift: true })
              .then(() => shiftLoop(i + 1));
          }) as unknown as Cypress.Chainable<void>;
        };

        shiftLoop(0).then(() => {
          expect(
            chegouNoPrimeiro,
            'Shift+Tab precisa alcançar o primeiro elemento focável',
          ).to.be.true;
          expect(visitados.size, 'Shift+Tab deve visitar a maioria dos focáveis').to
            .be.greaterThan(Math.min(total - 1, 5));
        });
      });
    });
  });
});
