/// <reference types="cypress" />

/**
 * E2E: cenário de corrida — usuário clica em "Concluir" no AlertDialog
 * e, em paralelo (mesmo tick), clica em "Cancelar" e também fora do
 * dialog. Independentemente de qual handler vence (Radix processa o
 * primeiro pointerdown e fecha o overlay), o painel da subtarefa
 * (Sheet aninhado) DEVE permanecer aberto e não remontar.
 *
 * Cobre regressões em que cliques concorrentes durante o fechamento do
 * AlertDialog propagavam para o Sheet pai via `onPointerDownOutside`.
 */

const PROJETO_ID = '85829768-7a07-4f44-a48b-f5288dc1a830';

describe('Projeto - cliques concorrentes Concluir+Cancelar não fecham painel da subtarefa', () => {
  beforeEach(() => {
    cy.intercept('PATCH', '**/rest/v1/projeto_tarefas*', (req) => {
      req.reply({
        delay: 400,
        statusCode: 200,
        body: [{
          ...(req.body || {}),
          id: req.url.match(/id=eq\.([0-9a-f-]+)/i)?.[1] ?? 'subtarefa-stub',
          updated_at: new Date().toISOString(),
        }],
      });
    }).as('patchTarefa');

    cy.visit(`/dashboard/projetos/${PROJETO_ID}`);
  });

  it('dispara clicks simultâneos em Concluir, Cancelar e overlay; painel da subtarefa segue aberto e mesmo nó DOM', () => {
    // Abre tarefa pai e subtarefa.
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

    // Abre o AlertDialog.
    cy.get('@painelSub')
      .find('button:contains("Marcar como concluída"), button:contains("Marcar concluída")')
      .first()
      .click();

    cy.get('[role="alertdialog"]', { timeout: 5_000 }).should('be.visible');

    // Dispara, no mesmo tick síncrono, pointerdown+click em três alvos:
    // botão "Concluir/Confirmar", botão "Cancelar" e overlay (fora).
    cy.document().then((doc) => {
      const alert = doc.querySelector('[role="alertdialog"]') as HTMLElement;
      const buttons = Array.from(alert.querySelectorAll('button')) as HTMLButtonElement[];
      const confirmar = buttons.find((b) =>
        /Concluir|Confirmar|Sim/i.test(b.textContent || ''),
      );
      const cancelar = buttons.find((b) => /Cancelar/i.test(b.textContent || ''));

      // overlay = sibling `fixed inset-0` mais próximo no portal.
      const overlays = doc.querySelectorAll(
        'div[data-state="open"].fixed.inset-0, [data-radix-portal] div.fixed.inset-0',
      );
      const overlay = overlays[overlays.length - 1] as HTMLElement | undefined;

      expect(confirmar, 'botão Concluir/Confirmar').to.exist;
      expect(cancelar, 'botão Cancelar').to.exist;

      const fire = (el: HTMLElement) => {
        const rect = el.getBoundingClientRect();
        const opts = {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
          button: 0,
        };
        el.dispatchEvent(new PointerEvent('pointerdown', { ...opts, pointerType: 'mouse' } as PointerEventInit));
        el.dispatchEvent(new MouseEvent('mousedown', opts));
        el.dispatchEvent(new PointerEvent('pointerup', { ...opts, pointerType: 'mouse' } as PointerEventInit));
        el.dispatchEvent(new MouseEvent('mouseup', opts));
        el.dispatchEvent(new MouseEvent('click', opts));
      };

      // Mesmo tick: três disparos consecutivos.
      fire(confirmar!);
      fire(cancelar!);
      if (overlay) fire(overlay);
    });

    // AlertDialog precisa ter sumido (qualquer um dos handlers fecha).
    cy.get('[role="alertdialog"]', { timeout: 5_000 }).should('not.exist');

    // Painel da subtarefa segue visível e é o MESMO nó DOM.
    cy.get('@painelSub').should('be.visible');
    cy.get('@painelSubNode').then((node) => {
      cy.get('[role="dialog"]').last().then(($current) => {
        expect(
          $current[0],
          'painel da subtarefa não fechou nem remontou após cliques concorrentes',
        ).to.eq(node);
      });
    });

    // Painel pai permanece montado.
    cy.get('[role="dialog"]').should('have.length.at.least', 2);

    // Rota intacta.
    cy.location('pathname').should('include', `/dashboard/projetos/${PROJETO_ID}`);
  });
});
