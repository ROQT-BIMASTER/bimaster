/// <reference types="cypress" />

/**
 * E2E: ao concluir uma subtarefa com o painel rolado para baixo,
 * validar que:
 *   1. o painel da subtarefa NÃO remonta (mesmo nó DOM antes/depois);
 *   2. a posição de scroll é preservada (sem salto para o topo) — o
 *      `scrollTop` do container interno do Sheet deve permanecer
 *      próximo do valor capturado pré-mutação (tolerância pequena
 *      para reflow);
 *   3. estado visual reflete "Concluída" e painel pai segue montado.
 *
 * Regressões cobertas: invalidação de cache disparando re-render
 * que resetava `scrollTop`, e unmount do Sheet aninhado durante o
 * refetch.
 */

const PROJETO_ID = '85829768-7a07-4f44-a48b-f5288dc1a830';
const SCROLL_TARGET = 250;
const SCROLL_TOLERANCE = 24;

describe('Projeto - conclusão de subtarefa preserva scroll e não remonta painel', () => {
  beforeEach(() => {
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

  it('conclui com painel rolado: sem salto de scroll e sem remount', () => {
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

    // Localiza o container rolável dentro do painel (primeiro descendente
    // com overflow-y auto/scroll). Cai no próprio dialog se nenhum for
    // encontrado — o Sheet do Radix costuma ter `overflow-y-auto` no root.
    cy.get('@painelSub').then(($p) => {
      const root = $p[0];
      const candidates = [root, ...Array.from(root.querySelectorAll('*'))];
      const scroller = candidates.find((el) => {
        const cs = getComputedStyle(el as Element);
        const oy = cs.overflowY;
        return (oy === 'auto' || oy === 'scroll') && (el as HTMLElement).scrollHeight > (el as HTMLElement).clientHeight + 20;
      }) as HTMLElement | undefined;

      expect(scroller, 'container rolável dentro do painel da subtarefa').to.exist;
      cy.wrap(scroller).as('scroller');
    });

    // Rola para uma posição não-zero e captura o valor.
    cy.get('@scroller').then(($s) => {
      ($s[0] as HTMLElement).scrollTop = SCROLL_TARGET;
      $s[0].dispatchEvent(new Event('scroll'));
    });

    cy.get('@scroller').should(($s) => {
      expect(($s[0] as HTMLElement).scrollTop).to.be.greaterThan(SCROLL_TARGET - SCROLL_TOLERANCE);
    });

    cy.get('@scroller').then(($s) => {
      cy.wrap(($s[0] as HTMLElement).scrollTop).as('scrollAntes');
    });

    // Dispara o AlertDialog e confirma.
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

    // Settle para capturar qualquer reflow tardio de invalidação.
    cy.wait(400);

    // 1) Painel ainda visível e MESMO nó DOM.
    cy.get('@painelSub').should('be.visible');
    cy.get('@painelSubNode').then((node) => {
      cy.get('[role="dialog"]').last().then(($current) => {
        expect($current[0], 'painel da subtarefa remontou após PATCH').to.eq(node);
      });
    });

    // 2) Scroll preservado (sem salto para o topo).
    cy.get('@scrollAntes').then((antes) => {
      cy.get('@scroller').then(($s) => {
        const depois = ($s[0] as HTMLElement).scrollTop;
        expect(
          Math.abs(depois - (antes as unknown as number)),
          `scrollTop saltou de ${antes} para ${depois}`,
        ).to.be.lessThan(SCROLL_TOLERANCE);
      });
    });

    // 3) Estado visual + painel pai intactos.
    cy.get('@painelSub').contains(/Concluída/i).should('be.visible');
    cy.get('[role="alertdialog"]').should('not.exist');
    cy.get('[role="dialog"]').should('have.length.at.least', 2);
    cy.location('pathname').should('include', `/dashboard/projetos/${PROJETO_ID}`);
  });
});
