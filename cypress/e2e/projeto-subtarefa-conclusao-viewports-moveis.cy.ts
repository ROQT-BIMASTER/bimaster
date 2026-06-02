/// <reference types="cypress" />

/**
 * E2E: com o painel da subtarefa aberto e rolado, alterna a viewport
 * para tamanhos móveis (iPhone SE 375×667 e iPhone XR 414×896),
 * confirma a conclusão e valida que o painel da subtarefa permanece
 * exatamente no MESMO nó DOM (sem unmount/remount disparado pelo
 * reflow móvel + invalidação de cache do PATCH).
 *
 * Diagnóstico: em qualquer falha de identidade do nó DOM, captura
 * screenshot rotulado + log estruturado com viewport, scrollTop atual,
 * scrollTop esperado e contagem de [role="dialog"] no DOM. Isso é
 * essencial em viewports móveis, onde reflow tardio é comum.
 */

const PROJETO_ID = '85829768-7a07-4f44-a48b-f5288dc1a830';
const SCROLL_TARGET = 150;

const MOBILE_VIEWPORTS = [
  { label: 'iPhone SE (375×667)', width: 375, height: 667 },
  { label: 'iPhone XR (414×896)', width: 414, height: 896 },
] as const;

const interceptPatch = () => {
  cy.intercept('PATCH', '**/rest/v1/projeto_tarefas*', (req) => {
    req.reply({
      delay: 450,
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
};

const abrirSubtarefa = () => {
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
};

const acharScroller = () => {
  return cy.get('@painelSub').then(($p) => {
    const root = $p[0];
    const candidates = [root, ...Array.from(root.querySelectorAll('*'))];
    return candidates.find((el) => {
      const cs = getComputedStyle(el as Element);
      const oy = cs.overflowY;
      return (
        (oy === 'auto' || oy === 'scroll') &&
        (el as HTMLElement).scrollHeight > (el as HTMLElement).clientHeight + 20
      );
    }) as HTMLElement | undefined;
  });
};

const rolarPainel = (target: number) => {
  acharScroller().then((scroller) => {
    if (scroller) {
      scroller.scrollTop = target;
      scroller.dispatchEvent(new Event('scroll'));
    }
  });
};

/**
 * Faz a asserção de identidade do nó DOM e, em caso de falha,
 * coleta diagnóstico (viewport, scrollTop, dialog count) +
 * screenshot rotulado antes de propagar o erro.
 */
const assertMesmoNoComDiagnostico = (
  label: string,
  ctx: { viewport: string; expectedScroll: number | null },
) => {
  cy.get('@painelSub').should('be.visible');

  cy.get('@painelSubNode').then((node) => {
    cy.get('[role="dialog"]').last().then(($current) => {
      const igual = $current[0] === (node as unknown as HTMLElement);
      if (!igual) {
        acharScroller().then((scroller) => {
          cy.document().then((doc) => {
            const diag = {
              checkpoint: label,
              viewport: ctx.viewport,
              expectedScroll: ctx.expectedScroll,
              actualScroll: scroller?.scrollTop ?? null,
              dialogCount: doc.querySelectorAll('[role="dialog"]').length,
              alertdialogCount: doc.querySelectorAll('[role="alertdialog"]').length,
              currentTag: $current[0]?.tagName,
              expectedTag: (node as unknown as HTMLElement)?.tagName,
            };
            // eslint-disable-next-line no-console
            console.error('[REMOUNT][painelSub]', JSON.stringify(diag, null, 2));
            Cypress.log({
              name: 'remount-diag',
              message: `${label} (${ctx.viewport})`,
              consoleProps: () => diag,
            });
          });
        });
        cy.screenshot(
          `remount-FAIL-${label}-${ctx.viewport}`.replace(/[^a-z0-9-]+/gi, '_'),
          { capture: 'viewport' },
        );
      }
      expect(
        $current[0],
        `painel da subtarefa remontou [${label}] em ${ctx.viewport}`,
      ).to.eq(node);
    });
  });
};

describe('Projeto - conclusão de subtarefa em viewports móveis mantém o painel montado', () => {
  MOBILE_VIEWPORTS.forEach(({ label, width, height }) => {
    describe(label, () => {
      beforeEach(() => {
        cy.viewport(width, height);
        interceptPatch();
        cy.visit(`/dashboard/projetos/${PROJETO_ID}`);
      });

      it('conclui sem remount do painel da subtarefa', () => {
        abrirSubtarefa();
        rolarPainel(SCROLL_TARGET);

        assertMesmoNoComDiagnostico('pos-scroll', {
          viewport: label,
          expectedScroll: SCROLL_TARGET,
        });

        cy.get('@painelSub')
          .find('button:contains("Marcar como concluída"), button:contains("Marcar concluída")')
          .first()
          .click({ force: true });

        cy.get('[role="alertdialog"]', { timeout: 5_000 })
          .should('be.visible')
          .within(() => {
            cy.get('button')
              .filter(':contains("Concluir"), :contains("Confirmar"), :contains("Sim")')
              .first()
              .click();
          });

        cy.wait('@patchTarefa');
        cy.wait(400);

        assertMesmoNoComDiagnostico('pos-patch', {
          viewport: label,
          expectedScroll: SCROLL_TARGET,
        });

        cy.get('@painelSub').contains(/Concluída/i).should('be.visible');
        cy.get('[role="alertdialog"]').should('not.exist');
        cy.get('[role="dialog"]').should('have.length.at.least', 2);
        cy.location('pathname').should('include', `/dashboard/projetos/${PROJETO_ID}`);
      });
    });
  });
});
