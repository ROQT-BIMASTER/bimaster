/// <reference types="cypress" />

/**
 * E2E: com o painel da subtarefa aberto e rolado, redimensiona a
 * viewport (simulando rotação / resize de janela) e em seguida confirma
 * a conclusão. Valida que:
 *   1. o painel da subtarefa permanece no MESMO nó DOM antes e depois
 *      do resize + PATCH (sem unmount/remount disparado por reflow ou
 *      invalidação de cache);
 *   2. o painel pai segue montado e a rota permanece intacta;
 *   3. o estado visual reflete "Concluída" após o PATCH.
 *
 * Regressão coberta: combinação resize + invalidação de query que, em
 * versões anteriores, derrubava o Sheet aninhado quando o layout
 * recalculava em paralelo ao refetch.
 */

const PROJETO_ID = '85829768-7a07-4f44-a48b-f5288dc1a830';
const SCROLL_TARGET = 200;
const VIEWPORT_INICIAL: [number, number] = [1316, 1040];
const VIEWPORT_RESIZE: [number, number] = [1024, 768];

describe('Projeto - resize de viewport durante conclusão de subtarefa mantém painel montado', () => {
  beforeEach(() => {
    cy.viewport(...VIEWPORT_INICIAL);

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

  it('redimensiona a janela, confirma a subtarefa e mantém o mesmo nó DOM', () => {
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

    // Rola o painel para uma posição não-zero (quando há conteúdo rolável).
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

      if (scroller) {
        scroller.scrollTop = SCROLL_TARGET;
        scroller.dispatchEvent(new Event('scroll'));
      }
    });

    // Redimensiona a viewport ANTES de confirmar.
    cy.viewport(...VIEWPORT_RESIZE);
    cy.wait(150); // settle de reflow

    // Checkpoint pós-resize: mesmo nó DOM, painel ainda aberto.
    cy.get('@painelSub').should('be.visible');
    cy.get('@painelSubNode').then((node) => {
      cy.get('[role="dialog"]').last().then(($current) => {
        expect($current[0], 'painel da subtarefa remontou após resize').to.eq(node);
      });
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
    cy.wait(400);

    // Painel ainda visível e MESMO nó DOM após resize + PATCH.
    cy.get('@painelSub').should('be.visible');
    cy.get('@painelSubNode').then((node) => {
      cy.get('[role="dialog"]').last().then(($current) => {
        expect(
          $current[0],
          'painel da subtarefa remontou após resize + PATCH',
        ).to.eq(node);
      });
    });

    // Segundo resize (de volta) para garantir estabilidade sob reflow contínuo.
    cy.viewport(...VIEWPORT_INICIAL);
    cy.wait(150);

    cy.get('@painelSubNode').then((node) => {
      cy.get('[role="dialog"]').last().then(($current) => {
        expect(
          $current[0],
          'painel remontou após segundo resize pós-conclusão',
        ).to.eq(node);
      });
    });

    // Estado final.
    cy.get('@painelSub').contains(/Concluída/i).should('be.visible');
    cy.get('[role="alertdialog"]').should('not.exist');
    cy.get('[role="dialog"]').should('have.length.at.least', 2);
    cy.location('pathname').should('include', `/dashboard/projetos/${PROJETO_ID}`);
  });
});
