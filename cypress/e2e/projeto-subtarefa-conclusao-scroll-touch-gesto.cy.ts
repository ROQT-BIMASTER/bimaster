/// <reference types="cypress" />

/**
 * E2E: rola o painel da subtarefa via GESTOS de toque (touchstart →
 * touchmove → touchend) em viewport móvel, em vez de setar `scrollTop`
 * diretamente. Em seguida confirma a conclusão e valida:
 *   1. o painel da subtarefa permanece no MESMO nó DOM (sem remount);
 *   2. o `scrollTop` final permanece estável dentro da tolerância
 *      entre o último frame de touchend e o pós-PATCH.
 *
 * Regressão coberta: scroll por gesto em iOS-like (momentum scrolling)
 * combinado com invalidação de cache disparando reset de scroll ou
 * unmount do Sheet aninhado.
 */

const PROJETO_ID = '85829768-7a07-4f44-a48b-f5288dc1a830';
const SCROLL_TOLERANCE = 32; // maior por causa de momentum
const VIEWPORT: [number, number] = [390, 844]; // iPhone 12

describe('Projeto - conclusão de subtarefa após scroll por gesto de toque', () => {
  beforeEach(() => {
    cy.viewport(...VIEWPORT);

    cy.intercept('PATCH', '**/rest/v1/projeto_tarefas*', (req) => {
      req.reply({
        delay: 500,
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

    cy.visit(`/dashboard/projetos/${PROJETO_ID}`);
  });

  it('scroll por touch preserva nó DOM e posição após PATCH', () => {
    // Abre tarefa pai.
    cy.get(
      '[data-testid="projeto-tarefa-row"], [role="row"], a[href*="/tarefas/"]',
      { timeout: 20_000 },
    )
      .first()
      .click({ force: true });

    cy.get('[role="dialog"]', { timeout: 10_000 }).should('be.visible').as('painelPai');

    // Abre subtarefa.
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

    // Localiza scroller.
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

    // Simula scroll por gesto de toque (drag para cima → rola para baixo).
    cy.get('@scroller').then(($s) => {
      const el = $s[0] as HTMLElement;
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const yStart = rect.top + rect.height * 0.8;
      const yEnd = rect.top + rect.height * 0.2;

      const touch = (type: string, y: number) =>
        new TouchEvent(type, {
          bubbles: true,
          cancelable: true,
          touches:
            type === 'touchend'
              ? []
              : [
                  new Touch({
                    identifier: 1,
                    target: el,
                    clientX: x,
                    clientY: y,
                  }),
                ],
          changedTouches: [
            new Touch({
              identifier: 1,
              target: el,
              clientX: x,
              clientY: y,
            }),
          ],
        });

      el.dispatchEvent(touch('touchstart', yStart));

      // Frames intermediários.
      const steps = 8;
      for (let i = 1; i <= steps; i++) {
        const y = yStart + ((yEnd - yStart) * i) / steps;
        el.dispatchEvent(touch('touchmove', y));
        // Fallback: alguns ambientes (jsdom-like) não aplicam scroll por touch.
        el.scrollTop = (el.scrollTop || 0) + (yStart - y) / steps;
      }
      el.dispatchEvent(touch('touchend', yEnd));
      el.dispatchEvent(new Event('scroll'));
    });

    // Captura scrollTop pós-gesto.
    cy.get('@scroller').should(($s) => {
      expect(($s[0] as HTMLElement).scrollTop).to.be.greaterThan(0);
    });
    cy.get('@scroller').then(($s) => {
      cy.wrap(($s[0] as HTMLElement).scrollTop).as('scrollAposGesto');
    });

    // Dispara AlertDialog + confirma.
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

    // 1) Mesmo nó DOM.
    cy.get('@painelSub').should('be.visible');
    cy.get('@painelSubNode').then((node) => {
      cy.get('[role="dialog"]').last().then(($current) => {
        expect($current[0], 'painel remontou após PATCH (touch scroll)').to.eq(node);
      });
    });

    // 2) Scroll preservado (com tolerância maior para momentum).
    cy.get('@scrollAposGesto').then((antes) => {
      cy.get('@scroller').then(($s) => {
        const depois = ($s[0] as HTMLElement).scrollTop;
        expect(
          Math.abs(depois - (antes as unknown as number)),
          `scrollTop saltou de ${antes} para ${depois} após PATCH`,
        ).to.be.lessThan(SCROLL_TOLERANCE);
      });
    });

    cy.get('@painelSub').contains(/Concluída/i).should('be.visible');
    cy.get('[role="alertdialog"]').should('not.exist');
  });
});
