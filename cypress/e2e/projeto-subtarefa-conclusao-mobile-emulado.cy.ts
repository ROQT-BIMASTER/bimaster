/// <reference types="cypress" />

/**
 * E2E: executa o fluxo de conclusão de subtarefa em modo de EMULAÇÃO
 * DE DISPOSITIVO MÓVEL (não apenas viewport fixo). Aplica:
 *   - viewport iPhone X (375×812);
 *   - `Cypress.config('userAgent', ...)` com UA do iOS Safari, injetado
 *     via `cy.intercept` (Cypress não tem device emulation nativo via
 *     CDP — replicamos os sinais práticos: UA, touch support, devicePixelRatio);
 *   - flag de touch no `window` (`ontouchstart`, `navigator.maxTouchPoints = 5`);
 *   - matchMedia stub para `(pointer: coarse)` e `(hover: none)`.
 *
 * Em seguida valida que o painel da subtarefa NÃO remonta após o PATCH
 * mesmo com os sinais de mobile ativos, garantindo consistência entre
 * "viewport fixo" e "device emulado".
 *
 * Cobre regressões em código que ramifica por:
 *   - `navigator.maxTouchPoints`
 *   - `matchMedia('(pointer: coarse)')`
 *   - UA sniffing (hooks de mobile-only re-render)
 */

const PROJETO_ID = '85829768-7a07-4f44-a48b-f5288dc1a830';
const IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const aplicarEmulacaoMobile = () => {
  cy.viewport(375, 812);

  // UA via header em todas as requisições (limite do Cypress sem CDP).
  cy.intercept('**/*', (req) => {
    req.headers['user-agent'] = IOS_UA;
  });

  // Patches no window antes de qualquer script da app rodar.
  cy.on('window:before:load', (win) => {
    Object.defineProperty(win.navigator, 'userAgent', { value: IOS_UA, configurable: true });
    Object.defineProperty(win.navigator, 'maxTouchPoints', { value: 5, configurable: true });
    Object.defineProperty(win.navigator, 'platform', { value: 'iPhone', configurable: true });
    Object.defineProperty(win, 'devicePixelRatio', { value: 3, configurable: true });
    (win as unknown as { ontouchstart: null }).ontouchstart = null;

    const originalMatchMedia = win.matchMedia.bind(win);
    win.matchMedia = (query: string) => {
      const coarse = /pointer:\s*coarse/i.test(query);
      const noHover = /hover:\s*none/i.test(query);
      const maxWidth = /max-width:\s*(\d+)px/i.exec(query);
      let matches = originalMatchMedia(query).matches;
      if (coarse || noHover) matches = true;
      if (maxWidth && Number(maxWidth[1]) >= 375) matches = true;
      return {
        matches,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      } as MediaQueryList;
    };
  });
};

describe('Projeto - conclusão de subtarefa sob emulação de dispositivo móvel', () => {
  beforeEach(() => {
    aplicarEmulacaoMobile();

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

    cy.visit(`/dashboard/projetos/${PROJETO_ID}`);
  });

  it('mantém painel montado após PATCH com sinais de mobile (UA + touch + matchMedia)', () => {
    // Sanity: emulação aplicada.
    cy.window().then((win) => {
      expect(win.navigator.userAgent, 'UA iOS').to.match(/iPhone/);
      expect(win.navigator.maxTouchPoints, 'maxTouchPoints > 0').to.be.greaterThan(0);
      expect(win.matchMedia('(pointer: coarse)').matches, 'pointer: coarse').to.eq(true);
    });

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

    cy.get('@painelSub').then(($el) => {
      const el = $el[0] as HTMLElement;
      el.setAttribute('data-mount-id', 'mobile-emu-pre-patch');
      cy.wrap(el).as('painelSubNode');
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

    // Mesmo nó DOM + sentinela preservado sob emulação mobile.
    cy.get('@painelSub').should('be.visible');
    cy.get('@painelSubNode').then((node) => {
      cy.get('[role="dialog"]').last().then(($current) => {
        expect($current[0], 'painel remontou sob emulação mobile').to.eq(node);
        expect(
          ($current[0] as HTMLElement).getAttribute('data-mount-id'),
          'sentinela perdida (remount em mobile emu)',
        ).to.eq('mobile-emu-pre-patch');
      });
    });

    cy.get('@painelSub').contains(/Concluída/i).should('be.visible');
    cy.get('[role="alertdialog"]').should('not.exist');
    cy.get('[role="dialog"]').should('have.length.at.least', 2);
  });
});
