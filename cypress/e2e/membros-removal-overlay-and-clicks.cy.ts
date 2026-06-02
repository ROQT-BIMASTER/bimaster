/**
 * E2E: após sucesso na remoção, confirma que:
 *  1. Nenhum overlay/portal Radix permanece montado no DOM.
 *  2. Cliques em elementos que ficavam ABAIXO do modal (página, header,
 *     sidebar, conteúdo) chegam normalmente ao alvo — ou seja, não existe
 *     overlay invisível interceptando pointer events.
 *
 * Para a parte 2, usamos `document.elementFromPoint()` em coordenadas
 * distintas e verificamos que o topo do hit-test NÃO é um overlay/portal
 * Radix. Em seguida, disparamos cliques reais nesses elementos e
 * confirmamos que o handler do alvo é executado (reabrindo o dialog,
 * focando o botão, ou registrando o click via spy).
 */

describe("ProjetoMembrosDialog — sem overlay residual e cliques operacionais após sucesso", () => {
  const PROJETO_ID = Cypress.env("PROJETO_ID") || "test-projeto-id";
  const MEMBRO_ID = "membro-teste-1";
  const DIALOG = '[data-testid="projeto-membros-dialog"]';

  beforeEach(() => {
    cy.intercept("POST", "**/rest/v1/rpc/remover_membro_projeto*", (req) => {
      req.on("response", (res) => res.setDelay(400));
      req.reply({ statusCode: 200, body: { ok: true } });
    }).as("remover");

    cy.visit(`/projetos/${PROJETO_ID}`);
    cy.get('[data-testid="abrir-membros-dialog"]').click();
    cy.get(DIALOG).should("be.visible");
  });

  it("remove overlay/portal e libera cliques em elementos da página", () => {
    // Snapshot do gatilho ANTES do dialog fechar — guarda bbox para hit-test
    cy.get('[data-testid="abrir-membros-dialog"]').then(($btn) => {
      const r = $btn[0].getBoundingClientRect();
      cy.wrap({ x: r.left + r.width / 2, y: r.top + r.height / 2 }).as(
        "trigger",
      );
    });

    // Executa remoção bem-sucedida
    cy.get(
      `[data-testid="member-remove-btn"][data-member-id="${MEMBRO_ID}"]`,
    ).click();
    cy.get('[data-testid="confirmar-remocao-btn"]').click();
    cy.wait("@remover");

    // Dialog desmonta
    cy.get(DIALOG, { timeout: 5000 }).should("not.exist");

    // (1) Inexistência de overlay/portal
    cy.get('[role="dialog"]').should("not.exist");
    cy.get("[data-radix-portal]").should("not.exist");
    cy.get("[data-radix-dialog-overlay]").should("not.exist");
    cy.get('[data-state="open"][role="dialog"]').should("not.exist");
    // Sanidade: nenhum nó com data-radix-* + estado open
    cy.document().then((doc) => {
      const abertos = doc.querySelectorAll(
        '[data-radix-portal] [data-state="open"]',
      );
      expect(abertos.length, "portais Radix abertos residuais").to.eq(0);
    });

    // (2) Hit-test em coordenadas variadas — topo não pode ser overlay Radix
    const pontos: Array<[number, number, string]> = [
      [50, 50, "topo-esq"],
      [400, 80, "topo-meio"],
      [600, 300, "centro"],
      [200, 500, "inferior-esq"],
    ];
    cy.document().then((doc) => {
      pontos.forEach(([x, y, rotulo]) => {
        const el = doc.elementFromPoint(x, y);
        if (!el) return;
        const culpado = el.closest(
          "[data-radix-portal],[data-radix-dialog-overlay],[role='dialog']",
        );
        expect(
          culpado,
          `hit-test ${rotulo} (${x},${y}) não deve cair em overlay residual`,
        ).to.eq(null);
      });
    });

    // (3) Clique real em um elemento que estava ABAIXO do modal: o
    //     próprio gatilho "Abrir Membros". Se houvesse overlay residual,
    //     o click não chegaria e o dialog não reabriria.
    cy.get("@trigger").then((p: any) => {
      cy.document().then((doc) => {
        const alvo = doc.elementFromPoint(p.x, p.y);
        expect(alvo, "elementFromPoint do gatilho").to.exist;
        // Topo da pilha precisa ser o próprio gatilho (ou descendente dele),
        // nunca um overlay.
        const gatilho = doc.querySelector('[data-testid="abrir-membros-dialog"]');
        expect(
          gatilho && (alvo === gatilho || gatilho.contains(alvo!)),
          "topo do hit-test deve ser o gatilho — não um overlay",
        ).to.eq(true);
      });
    });

    // Click real reabre o dialog: prova funcional de que pointer events
    // chegam à camada da página.
    cy.get('[data-testid="abrir-membros-dialog"]').click();
    cy.get(DIALOG).should("be.visible");

    // E também elementos fora do gatilho (ex.: link da sidebar/header) são
    // hit-testáveis sem overlay no topo.
    cy.document().then((doc) => {
      const focaveis = Array.from(
        doc.querySelectorAll<HTMLElement>(
          'a, button, [role="button"], [tabindex="0"]',
        ),
      )
        .filter((el) => el.offsetParent !== null) // visível
        .slice(0, 5);
      focaveis.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        const top = doc.elementFromPoint(
          r.left + r.width / 2,
          r.top + r.height / 2,
        );
        const overlay = top?.closest(
          "[data-radix-portal],[data-radix-dialog-overlay]",
        );
        expect(
          overlay,
          `elemento focável "${el.getAttribute("data-testid") || el.tagName}" sob overlay`,
        ).to.eq(null);
      });
    });
  });
});
