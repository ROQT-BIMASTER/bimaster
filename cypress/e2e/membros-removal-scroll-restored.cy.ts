/// <reference types="cypress" />

/**
 * E2E: após sucesso na remoção de membro, o scroll da página deve voltar
 * ao estado normal — sem overflow:hidden, sem scroll-lock — e a página
 * deve poder ser rolada novamente verticalmente.
 */

describe('Membros - scroll volta ao normal após sucesso', () => {
  beforeEach(() => {
    cy.intercept('POST', '**/rest/v1/rpc/remover_membro_projeto*', {
      delay: 250,
      statusCode: 200,
      body: { success: true },
    }).as('removerMembro');

    cy.visit('/projetos');
    cy.get('[data-testid="projeto-card"], a[href*="/projetos/"]').first().click();
  });

  it('libera overflow/scroll-lock e permite rolar a página novamente', () => {
    // baseline: snapshot do estado de scroll antes de abrir o modal
    cy.document().then((doc) => {
      const body = doc.body;
      const html = doc.documentElement;
      cy.wrap({
        bodyOverflow: getComputedStyle(body).overflow,
        htmlOverflow: getComputedStyle(html).overflow,
        bodyPointer: getComputedStyle(body).pointerEvents,
      }).as('baselineScroll');
    });

    // abre dialog
    cy.get('[data-testid="abrir-membros-dialog"], button:contains("Membros")')
      .first()
      .click();
    cy.get('[data-testid="projeto-membros-dialog"]').should('be.visible');

    // confirma que o lock está ativo enquanto o modal está aberto (sanity)
    cy.document().then((doc) => {
      const locked =
        doc.body.hasAttribute('data-scroll-locked') ||
        getComputedStyle(doc.body).overflow === 'hidden' ||
        doc.documentElement.hasAttribute('data-scroll-locked');
      expect(locked, 'durante o modal aberto algum lock deve estar presente').to.be
        .true;
    });

    // executa remoção
    cy.get('[data-testid="membro-item"]').first().within(() => {
      cy.get('[data-testid="remover-membro"], button:contains("Remover")').click();
    });
    cy.get('[data-testid="confirmar-remocao"], button:contains("Confirmar")').click();

    cy.wait('@removerMembro');

    // dialog desaparece
    cy.get('[data-testid="projeto-membros-dialog"]').should('not.exist');
    cy.get('[role="dialog"]').should('not.exist');
    cy.get('[data-radix-portal]').should('not.exist');
    cy.get('[data-radix-dialog-overlay]').should('not.exist');

    // estado de scroll deve ter sido restaurado
    cy.document().then((doc) => {
      const body = doc.body;
      const html = doc.documentElement;

      expect(body.hasAttribute('data-scroll-locked'), 'body sem data-scroll-locked')
        .to.be.false;
      expect(html.hasAttribute('data-scroll-locked'), 'html sem data-scroll-locked')
        .to.be.false;
      expect(body.hasAttribute('aria-hidden'), 'body sem aria-hidden').to.be.false;
      expect(body.hasAttribute('inert'), 'body sem inert').to.be.false;

      const bodyStyles = getComputedStyle(body);
      const htmlStyles = getComputedStyle(html);

      expect(bodyStyles.overflow, 'body.overflow não pode ser hidden').to.not.equal(
        'hidden',
      );
      expect(htmlStyles.overflow, 'html.overflow não pode ser hidden').to.not.equal(
        'hidden',
      );
      expect(bodyStyles.pointerEvents, 'body.pointer-events deve estar livre').to.not
        .equal('none');

      // inline styles do Radix Scroll Lock também devem ter sumido
      expect(body.style.overflow, 'inline body.style.overflow vazio').to.not.equal(
        'hidden',
      );
      expect(body.style.paddingRight, 'inline body.style.paddingRight vazio').to.not
        .match(/\d+px/);
    });

    // baseline restaurado
    cy.get<{ bodyOverflow: string; htmlOverflow: string; bodyPointer: string }>(
      '@baselineScroll',
    ).then((baseline) => {
      cy.document().then((doc) => {
        expect(getComputedStyle(doc.body).overflow).to.equal(baseline.bodyOverflow);
        expect(getComputedStyle(doc.documentElement).overflow).to.equal(
          baseline.htmlOverflow,
        );
        expect(getComputedStyle(doc.body).pointerEvents).to.equal(
          baseline.bodyPointer,
        );
      });
    });

    // a página deve ser rolável novamente
    cy.window().then((win) => {
      const initialY = win.scrollY;
      win.scrollTo({ top: initialY + 400, behavior: 'instant' as ScrollBehavior });
      cy.wrap(null).should(() => {
        expect(win.scrollY, 'scroll para baixo deve funcionar').to.be.greaterThan(
          initialY,
        );
      });

      win.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      cy.wrap(null).should(() => {
        expect(win.scrollY, 'scroll de volta ao topo deve funcionar').to.equal(0);
      });
    });

    // scroll por gesto/teclado também deve funcionar
    cy.get('body').trigger('keydown', { key: 'End' });
    cy.window().its('scrollY').should('be.greaterThan', 0);
  });
});
