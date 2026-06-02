/// <reference types="cypress" />

/**
 * E2E: além do checkpoint de identidade do nó DOM, marca o elemento
 * raiz do painel da subtarefa com atributos sentinela antes do PATCH
 * (`data-mount-id`, `data-react-key-snapshot`, `data-instance-uid`)
 * e valida que TODOS persistem após o PATCH.
 *
 * Lógica: se o componente desmontasse e remontasse (mesmo que o React
 * reusasse o mesmo nó DOM por coincidência), os atributos sentinela
 * — escritos via JS no DOM real, fora do controle do React — seriam
 * perdidos no reconciler ou no novo mount. A presença E o valor exato
 * dos três atributos provam que não houve remount.
 *
 * Também captura `data-state`/`id`/`aria-labelledby` do Radix Dialog
 * (chaves estáveis que mudariam em remount) e compara antes/depois.
 */

const PROJETO_ID = '85829768-7a07-4f44-a48b-f5288dc1a830';

type Snapshot = {
  mountId: string;
  reactKey: string;
  instanceUid: string;
  radixId: string | null;
  ariaLabelledBy: string | null;
  dataState: string | null;
};

const tirarSnapshot = (el: HTMLElement): Snapshot => ({
  mountId: el.getAttribute('data-mount-id') ?? '',
  reactKey: el.getAttribute('data-react-key-snapshot') ?? '',
  instanceUid: el.getAttribute('data-instance-uid') ?? '',
  radixId: el.getAttribute('id'),
  ariaLabelledBy: el.getAttribute('aria-labelledby'),
  dataState: el.getAttribute('data-state'),
});

describe('Projeto - conclusão de subtarefa não remonta (validação por chaves + nó DOM)', () => {
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

  it('preserva nó DOM, atributos sentinela e chaves estáveis do Radix Dialog', () => {
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

    // Marca o nó com sentinelas e captura snapshot ANTES.
    cy.get('@painelSub').then(($el) => {
      const el = $el[0] as HTMLElement;
      const uid = `uid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      el.setAttribute('data-mount-id', 'mount-pre-patch');
      el.setAttribute('data-react-key-snapshot', 'snapshot-pre-patch');
      el.setAttribute('data-instance-uid', uid);

      cy.wrap(el).as('painelSubNode');
      cy.wrap(tirarSnapshot(el)).as('snapshotAntes');
    });

    // Dispara AlertDialog + confirma.
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

    // 1) Checkpoint clássico: mesmo nó DOM.
    cy.get('@painelSub').should('be.visible');
    cy.get('@painelSubNode').then((node) => {
      cy.get('[role="dialog"]').last().then(($current) => {
        expect($current[0], 'painel remontou (identidade do nó)').to.eq(node);
      });
    });

    // 2) Sentinelas escritos no DOM real preservados (prova de no-remount
    //    mesmo se React reusasse o mesmo nó por acaso).
    cy.get('[role="dialog"]')
      .last()
      .then(($current) => {
        const el = $current[0] as HTMLElement;
        const depois = tirarSnapshot(el);

        cy.get('@snapshotAntes').then((antesRaw) => {
          const antes = antesRaw as unknown as Snapshot;

          expect(depois.mountId, 'data-mount-id perdido (remount)').to.eq(antes.mountId);
          expect(depois.reactKey, 'data-react-key-snapshot perdido').to.eq(antes.reactKey);
          expect(depois.instanceUid, 'data-instance-uid perdido').to.eq(antes.instanceUid);

          // Chaves estáveis do Radix: id e aria-labelledby NÃO devem mudar.
          expect(depois.radixId, 'id do Radix Dialog mudou').to.eq(antes.radixId);
          expect(depois.ariaLabelledBy, 'aria-labelledby do Radix Dialog mudou').to.eq(
            antes.ariaLabelledBy,
          );
          expect(depois.dataState, 'data-state do Radix Dialog mudou').to.eq(antes.dataState);
        });
      });

    cy.get('@painelSub').contains(/Concluída/i).should('be.visible');
    cy.get('[role="alertdialog"]').should('not.exist');
    cy.get('[role="dialog"]').should('have.length.at.least', 2);
  });
});
