/// <reference types="cypress" />

/**
 * E2E: 3 ciclos completos de abrir modal → remover membro com sucesso →
 * fechar. A cada ciclo nenhum overlay/portal residual pode persistir e
 * os cliques na página devem continuar funcionando normalmente.
 */

const PORTAL_SELECTORS = [
  '[data-testid="projeto-membros-dialog"]',
  '[role="dialog"]',
  '[data-radix-portal]',
  '[data-radix-dialog-overlay]',
  '[data-state="open"][role="dialog"]',
];

function assertSemResiduos(ctx: string) {
  PORTAL_SELECTORS.forEach((sel) => {
    cy.get('body').then(($b) => {
      expect(
        $b.find(sel).length,
        `${ctx}: nenhum ${sel} residual deve existir`,
      ).to.equal(0);
    });
  });

  cy.document().then((doc) => {
    expect(
      doc.body.hasAttribute('data-scroll-locked'),
      `${ctx}: body sem data-scroll-locked`,
    ).to.be.false;
    expect(
      doc.body.hasAttribute('aria-hidden'),
      `${ctx}: body sem aria-hidden`,
    ).to.be.false;
    expect(
      doc.body.hasAttribute('inert'),
      `${ctx}: body sem inert`,
    ).to.be.false;
    expect(
      getComputedStyle(doc.body).pointerEvents,
      `${ctx}: body com pointer-events livre`,
    ).to.not.equal('none');
  });
}

function executarRemocao(ciclo: number) {
  cy.get('[data-testid="abrir-membros-dialog"], button:contains("Membros")')
    .first()
    .click();

  cy.get('[data-testid="projeto-membros-dialog"]', { timeout: 5000 }).should(
    'be.visible',
  );

  cy.get('[data-testid="membro-item"]').first().within(() => {
    cy.get('[data-testid="remover-membro"], button:contains("Remover")').click();
  });
  cy.get('[data-testid="confirmar-remocao"], button:contains("Confirmar")').click();

  cy.wait(`@removerMembro${ciclo}`);

  cy.get('[data-testid="projeto-membros-dialog"]').should('not.exist');
}

describe('Membros - 3 ciclos sem overlay residual', () => {
  beforeEach(() => {
    // intercepta uma vez por ciclo para conseguir aguardar individualmente
    [1, 2, 3].forEach((n) => {
      cy.intercept('POST', '**/rest/v1/rpc/remover_membro_projeto*', {
        delay: 200,
        statusCode: 200,
        body: { success: true },
      }).as(`removerMembro${n}`);
    });

    cy.visit('/projetos');
    cy.get('[data-testid="projeto-card"], a[href*="/projetos/"]').first().click();
  });

  it('3 ciclos: remove com sucesso e clique fora continua funcional', () => {
    assertSemResiduos('estado inicial');

    for (let ciclo = 1; ciclo <= 3; ciclo++) {
      executarRemocao(ciclo);

      // após o fechamento — nenhum resíduo
      assertSemResiduos(`ciclo ${ciclo} pós-sucesso`);

      // clique em elemento da página deve funcionar (não bloqueado por overlay)
      cy.get('body').then(($body) => {
        const alvo = $body
          .find('button:visible, a:visible, [role="button"]:visible')
          .filter((_, el) => {
            const el2 = el as HTMLElement;
            // ignora elementos que abrem novamente o membros dialog para não poluir
            const txt = el2.textContent?.toLowerCase() ?? '';
            return !txt.includes('membros') && !txt.includes('remover');
          })
          .first();

        expect(alvo.length, `ciclo ${ciclo}: deve haver alvo clicável`).to.equal(1);

        // garante que o elemento recebe o clique (nada captura por cima)
        cy.wrap(alvo).click({ force: false });
      });

      // após o clique, ainda sem resíduos
      assertSemResiduos(`ciclo ${ciclo} pós-clique`);
    }
  });
});
