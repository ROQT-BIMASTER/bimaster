/// <reference types="cypress" />

/**
 * E2E: ao abrir uma subtarefa e clicar em "Marcar como concluída", o
 * AlertDialog de confirmação aparece. Ao clicar FORA do AlertDialog
 * (no overlay) — que normalmente o fecha — o painel da subtarefa
 * (Sheet aninhado) DEVE permanecer aberto e não remontar.
 *
 * Valida especificamente o fix em `ProjetoTarefaDetalhe.tsx` onde o
 * `onPointerDownOutside` do Sheet ignora alvos com `[role=alertdialog]`
 * (e seu overlay), garantindo que o close do AlertDialog não propague
 * como pointer-down-outside para o Sheet pai.
 *
 * Complementa:
 *   - projeto-subtarefa-conclusao-painel-estavel.cy.ts (confirmar)
 *   - projeto-subtarefa-cancelar-conclusao-painel-estavel.cy.ts (cancelar)
 */

const PROJETO_ID = '85829768-7a07-4f44-a48b-f5288dc1a830';

describe('Projeto - clique fora do AlertDialog não fecha painel de subtarefa', () => {
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

  it('clicar fora do AlertDialog fecha apenas o AlertDialog; o painel da subtarefa permanece aberto e sem remount', () => {
    // 1) Abre a primeira tarefa pai.
    cy.get(
      '[data-testid="projeto-tarefa-row"], [role="row"], a[href*="/tarefas/"]',
      { timeout: 20_000 },
    )
      .first()
      .click({ force: true });

    cy.get('[role="dialog"]', { timeout: 10_000 })
      .should('be.visible')
      .as('painelPai');

    // 2) Abre a primeira subtarefa (botão ChevronRight).
    cy.get('@painelPai')
      .find('button')
      .filter((_, el) => !!el.querySelector('svg.lucide-chevron-right'))
      .first()
      .click({ force: true });

    // 3) Captura o painel da subtarefa (último dialog) e seu nó DOM.
    cy.get('[role="dialog"]', { timeout: 10_000 })
      .should('have.length.at.least', 2)
      .last()
      .as('painelSub');

    cy.get('@painelSub').then(($el) => {
      cy.wrap($el[0]).as('painelSubNode');
    });

    // 4) Dispara o AlertDialog clicando em "Marcar como concluída".
    cy.get('@painelSub')
      .find('button:contains("Marcar como concluída"), button:contains("Marcar concluída")')
      .first()
      .click();

    cy.get('[role="alertdialog"]', { timeout: 5_000 }).should('be.visible');

    // 5) Clica FORA do AlertDialog (no overlay do Radix). O overlay
    //    cobre toda a viewport e fica logo antes do `[role=alertdialog]`
    //    no mesmo Portal. Disparamos pointerdown + mousedown + click
    //    para simular o gesto real do usuário, no canto superior
    //    esquerdo (longe de qualquer botão).
    cy.document().then((doc) => {
      // O overlay do AlertDialog Radix é o sibling anterior do content
      // no mesmo Portal. Buscamos pelo seletor de data-state.
      const overlays = doc.querySelectorAll(
        '[data-radix-portal] [data-state="open"][class*="fixed"][class*="inset-0"], ' +
        'div[data-state="open"].fixed.inset-0',
      );
      const overlay = overlays[overlays.length - 1] as HTMLElement | undefined;
      expect(overlay, 'overlay do AlertDialog encontrado').to.exist;

      const rect = overlay!.getBoundingClientRect();
      const x = rect.left + 5;
      const y = rect.top + 5;
      const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 };

      overlay!.dispatchEvent(new PointerEvent('pointerdown', { ...opts, pointerType: 'mouse' } as PointerEventInit));
      overlay!.dispatchEvent(new MouseEvent('mousedown', opts));
      overlay!.dispatchEvent(new PointerEvent('pointerup', { ...opts, pointerType: 'mouse' } as PointerEventInit));
      overlay!.dispatchEvent(new MouseEvent('mouseup', opts));
      overlay!.dispatchEvent(new MouseEvent('click', opts));
    });

    // 6) AlertDialog desaparece.
    cy.get('[role="alertdialog"]').should('not.exist');

    // 7) Painel da subtarefa permanece visível e é o MESMO nó DOM.
    cy.get('@painelSub').should('be.visible');
    cy.get('@painelSubNode').then((node) => {
      cy.get('[role="dialog"]').last().then(($current) => {
        expect(
          $current[0],
          'painel da subtarefa não fechou nem remontou após clique fora do AlertDialog',
        ).to.eq(node);
      });
    });

    // 8) Painel pai continua montado por baixo.
    cy.get('[role="dialog"]').should('have.length.at.least', 2);

    // 9) Nenhum PATCH disparado (mutação não foi confirmada).
    cy.get('@patchTarefa.all').should('have.length', 0);

    // 10) Status NÃO mudou para Concluída.
    cy.get('@painelSub').contains(/Concluída/i).should('not.exist');

    // 11) Rota intacta.
    cy.location('pathname').should('include', `/dashboard/projetos/${PROJETO_ID}`);
  });
});
