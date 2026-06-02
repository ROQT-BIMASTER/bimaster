/// <reference types="cypress" />

/**
 * E2E: percorre múltiplos valores de scroll (50, 150, 250px) ao concluir
 * uma subtarefa e valida, para cada posição, que:
 *   1. o painel da subtarefa NÃO remonta (mesmo nó DOM antes/depois do PATCH);
 *   2. a posição de scroll é preservada dentro da tolerância;
 *   3. o painel pai segue montado e a rota permanece intacta.
 *
 * Cada iteração reabre o fluxo do zero (parent → sub → AlertDialog → confirma)
 * para isolar regressões dependentes da posição de scroll inicial.
 */

const PROJETO_ID = '85829768-7a07-4f44-a48b-f5288dc1a830';
const SCROLL_TOLERANCE = 24;
const SCROLL_TARGETS = [50, 150, 250] as const;

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

const localizarScroller = () => {
  cy.get('@painelSub').then(($p) => {
    const root = $p[0];
    const candidates = [root, ...Array.from(root.querySelectorAll('*'))];
    const scroller = candidates.find((el) => {
      const cs = getComputedStyle(el as Element);
      const oy = cs.overflowY;
      return (
        (oy === 'auto' || oy === 'scroll') &&
        (el as HTMLElement).scrollHeight > (el as HTMLElement).clientHeight + 20
      );
    }) as HTMLElement | undefined;

    expect(scroller, 'container rolável dentro do painel da subtarefa').to.exist;
    cy.wrap(scroller).as('scroller');
  });
};

describe('Projeto - conclusão de subtarefa preserva scroll em múltiplas posições', () => {
  SCROLL_TARGETS.forEach((target) => {
    describe(`com scroll inicial ${target}px`, () => {
      beforeEach(() => {
        interceptPatch();
        cy.visit(`/dashboard/projetos/${PROJETO_ID}`);
      });

      it(`conclui sem salto de scroll nem remount (scrollTop ≈ ${target}px)`, () => {
        abrirSubtarefa();
        localizarScroller();

        cy.get('@scroller').then(($s) => {
          ($s[0] as HTMLElement).scrollTop = target;
          $s[0].dispatchEvent(new Event('scroll'));
        });

        cy.get('@scroller').should(($s) => {
          expect(($s[0] as HTMLElement).scrollTop).to.be.greaterThan(
            target - SCROLL_TOLERANCE,
          );
        });

        cy.get('@scroller').then(($s) => {
          cy.wrap(($s[0] as HTMLElement).scrollTop).as('scrollAntes');
        });

        cy.get('@painelSub')
          .find('button:contains("Marcar como concluída"), button:contains("Marcar concluída")')
          .first()
          .click();

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

        // 1) Mesmo nó DOM (sem remount).
        cy.get('@painelSub').should('be.visible');
        cy.get('@painelSubNode').then((node) => {
          cy.get('[role="dialog"]').last().then(($current) => {
            expect(
              $current[0],
              `painel da subtarefa remontou após PATCH (scroll inicial ${target}px)`,
            ).to.eq(node);
          });
        });

        // 2) Scroll preservado.
        cy.get('@scrollAntes').then((antes) => {
          cy.get('@scroller').then(($s) => {
            const depois = ($s[0] as HTMLElement).scrollTop;
            expect(
              Math.abs(depois - (antes as unknown as number)),
              `scrollTop saltou de ${antes} para ${depois} (alvo ${target}px)`,
            ).to.be.lessThan(SCROLL_TOLERANCE);
          });
        });

        // 3) Painel pai intacto + rota preservada.
        cy.get('@painelSub').contains(/Concluída/i).should('be.visible');
        cy.get('[role="alertdialog"]').should('not.exist');
        cy.get('[role="dialog"]').should('have.length.at.least', 2);
        cy.location('pathname').should('include', `/dashboard/projetos/${PROJETO_ID}`);
      });
    });
  });
});
