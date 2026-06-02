/// <reference types="cypress" />

/**
 * E2E: replica o fluxo de conclusão de subtarefa com scroll por touch
 * + validação de no-remount (nó DOM + sentinelas) sob EMULAÇÃO DE
 * DISPOSITIVO ANDROID (Pixel 7 e Galaxy S22), além das suites iOS já
 * existentes. Cobre regressões em ramos de UA/matchMedia/touch que
 * possam divergir entre iOS Safari e Android Chrome.
 *
 * Para cada device:
 *   1. Aplica viewport + UA Android + sinais de touch + matchMedia stub;
 *   2. Abre tarefa pai → abre subtarefa;
 *   3. Rola por gesto (touchstart → touchmove → touchend) no scroller;
 *   4. Marca sentinelas no nó raiz do painel da subtarefa;
 *   5. Confirma AlertDialog → aguarda PATCH;
 *   6. Valida: mesmo nó DOM, sentinelas preservadas, scrollTop estável,
 *      AlertDialog fechado e painel pai ainda montado.
 */

const PROJETO_ID = '85829768-7a07-4f44-a48b-f5288dc1a830';
const SCROLL_TOLERANCE = 32;

type AndroidDevice = {
  label: string;
  width: number;
  height: number;
  dpr: number;
  userAgent: string;
};

const ANDROID_DEVICES: AndroidDevice[] = [
  {
    label: 'Pixel 7 (Android 13, Chrome)',
    width: 412,
    height: 915,
    dpr: 2.625,
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  },
  {
    label: 'Galaxy S22 (Android 14, Chrome)',
    width: 360,
    height: 780,
    dpr: 3,
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; SM-S901B) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36',
  },
];

const aplicarEmulacaoAndroid = (device: AndroidDevice) => {
  cy.viewport(device.width, device.height);

  cy.intercept('**/*', (req) => {
    req.headers['user-agent'] = device.userAgent;
  });

  cy.on('window:before:load', (win) => {
    Object.defineProperty(win.navigator, 'userAgent', {
      value: device.userAgent,
      configurable: true,
    });
    Object.defineProperty(win.navigator, 'maxTouchPoints', { value: 5, configurable: true });
    Object.defineProperty(win.navigator, 'platform', { value: 'Linux armv8l', configurable: true });
    Object.defineProperty(win.navigator, 'vendor', { value: 'Google Inc.', configurable: true });
    Object.defineProperty(win, 'devicePixelRatio', { value: device.dpr, configurable: true });
    (win as unknown as { ontouchstart: null }).ontouchstart = null;

    const originalMatchMedia = win.matchMedia.bind(win);
    win.matchMedia = (query: string) => {
      const coarse = /pointer:\s*coarse/i.test(query);
      const noHover = /hover:\s*none/i.test(query);
      const maxWidth = /max-width:\s*(\d+)px/i.exec(query);
      let matches = originalMatchMedia(query).matches;
      if (coarse || noHover) matches = true;
      if (maxWidth && Number(maxWidth[1]) >= device.width) matches = true;
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

describe('Projeto - conclusão de subtarefa sob emulação Android (Pixel 7 / Galaxy S22)', () => {
  ANDROID_DEVICES.forEach((device) => {
    describe(device.label, () => {
      beforeEach(() => {
        aplicarEmulacaoAndroid(device);

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

      it('scroll por touch + PATCH preservam nó DOM, sentinelas e scrollTop', () => {
        cy.window().then((win) => {
          expect(win.navigator.userAgent, 'UA Android').to.match(/Android/);
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

        // Sentinelas no nó raiz do painel da subtarefa.
        cy.get('@painelSub').then(($el) => {
          const el = $el[0] as HTMLElement;
          const uid = `android-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
          el.setAttribute('data-mount-id', `android-pre-patch-${device.width}x${device.height}`);
          el.setAttribute('data-instance-uid', uid);
          cy.wrap(el).as('painelSubNode');
          cy.wrap(uid).as('uidEsperado');
        });

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

        // Scroll por gesto (drag para cima → rola para baixo).
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
                  : [new Touch({ identifier: 1, target: el, clientX: x, clientY: y })],
              changedTouches: [new Touch({ identifier: 1, target: el, clientX: x, clientY: y })],
            });

          el.dispatchEvent(touch('touchstart', yStart));
          const steps = 8;
          for (let i = 1; i <= steps; i++) {
            const y = yStart + ((yEnd - yStart) * i) / steps;
            el.dispatchEvent(touch('touchmove', y));
            el.scrollTop = (el.scrollTop || 0) + (yStart - y) / steps;
          }
          el.dispatchEvent(touch('touchend', yEnd));
          el.dispatchEvent(new Event('scroll'));
        });

        cy.get('@scroller').should(($s) => {
          expect(($s[0] as HTMLElement).scrollTop).to.be.greaterThan(0);
        });
        cy.get('@scroller').then(($s) => {
          cy.wrap(($s[0] as HTMLElement).scrollTop).as('scrollAposGesto');
        });

        // Confirma AlertDialog.
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
            expect(
              $current[0],
              `painel remontou em ${device.label}`,
            ).to.eq(node);
          });
        });

        // 2) Sentinelas preservadas.
        cy.get('@uidEsperado').then((uid) => {
          cy.get('[role="dialog"]').last().then(($current) => {
            const el = $current[0] as HTMLElement;
            expect(
              el.getAttribute('data-mount-id'),
              `data-mount-id perdido em ${device.label}`,
            ).to.eq(`android-pre-patch-${device.width}x${device.height}`);
            expect(
              el.getAttribute('data-instance-uid'),
              `data-instance-uid perdido em ${device.label}`,
            ).to.eq(uid as unknown as string);
          });
        });

        // 3) scrollTop estável.
        cy.get('@scrollAposGesto').then((antes) => {
          cy.get('@scroller').then(($s) => {
            const depois = ($s[0] as HTMLElement).scrollTop;
            expect(
              Math.abs(depois - (antes as unknown as number)),
              `scrollTop saltou em ${device.label} (${antes} → ${depois})`,
            ).to.be.lessThan(SCROLL_TOLERANCE);
          });
        });

        cy.get('@painelSub').contains(/Concluída/i).should('be.visible');
        cy.get('[role="alertdialog"]').should('not.exist');
        cy.get('[role="dialog"]').should('have.length.at.least', 2);
      });
    });
  });
});
