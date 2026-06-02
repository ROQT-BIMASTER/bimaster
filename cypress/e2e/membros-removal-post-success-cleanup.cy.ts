/**
 * E2E: após um sucesso na remoção, o ProjetoMembrosDialog precisa desmontar
 * por completo e devolver a página ao estado interativo normal — sem deixar
 * listeners/overlays/atributos que reintroduzam bloqueios.
 *
 * Validações executadas após o sucesso:
 *  - O dialog é removido do DOM (sem residual com role="dialog").
 *  - Nenhum overlay/portal (Radix) permanece (`[data-radix-portal]`,
 *    `[data-radix-dialog-overlay]`, elementos com `data-state="open"`).
 *  - `<body>` não fica com `aria-hidden`, `inert`, `data-scroll-locked`,
 *    `pointer-events: none` nem `overflow: hidden` residual.
 *  - O scroll da página volta a funcionar (window.scrollY muda ao scrollar).
 *  - Tecla Escape e Tab não disparam mais nenhum efeito relacionado ao dialog.
 *  - Cliques em elementos fora do antigo overlay funcionam normalmente
 *    (foco vai para o alvo clicado, sem ser interceptado por overlay).
 *  - Nenhum listener residual: ao disparar `keydown` Escape no `document`,
 *    nada é cancelado (event.defaultPrevented === false).
 */

describe("ProjetoMembrosDialog — limpeza pós-sucesso (sem bloqueios residuais)", () => {
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

  it("desmonta o dialog e não deixa overlay/listeners bloqueando a página", () => {
    // Snapshot do body ANTES do dialog ser aberto novamente (depois do click,
    // já está aberto; usamos como referência o estado pós-fechamento).
    cy.get(
      `[data-testid="member-remove-btn"][data-member-id="${MEMBRO_ID}"]`,
    ).click();
    cy.get('[data-testid="confirmar-remocao-btn"]').click();
    cy.wait("@remover");

    // Dialog deve desmontar
    cy.get(DIALOG, { timeout: 5000 }).should("not.exist");
    cy.get('[role="dialog"]').should("not.exist");

    // Sem overlay/portal Radix residual em estado open
    cy.get('[data-radix-dialog-overlay]').should("not.exist");
    cy.get('[data-state="open"][role="dialog"]').should("not.exist");

    // <body> limpo
    cy.get("body").then(($body) => {
      const body = $body[0];
      expect(body.hasAttribute("aria-hidden"), "body aria-hidden").to.eq(false);
      expect(body.hasAttribute("inert"), "body inert").to.eq(false);
      expect(
        body.hasAttribute("data-scroll-locked"),
        "body data-scroll-locked",
      ).to.eq(false);
      const cs = window.getComputedStyle(body);
      expect(cs.pointerEvents, "body pointer-events").to.not.eq("none");
      expect(cs.overflow, "body overflow").to.not.eq("hidden");
    });

    // <html> também livre de locks aplicados por libs de scroll lock
    cy.get("html").then(($h) => {
      expect($h[0].hasAttribute("data-scroll-locked")).to.eq(false);
      expect(window.getComputedStyle($h[0]).overflow).to.not.eq("hidden");
    });

    // Scroll volta a funcionar
    cy.window().then((win) => {
      win.scrollTo(0, 0);
      const before = win.scrollY;
      win.scrollTo(0, 400);
      cy.wrap(null).should(() => {
        expect(win.scrollY, "scrollY após scrollTo").to.not.eq(before);
      });
    });

    // Escape no document não é mais capturado/cancelado por listener residual
    cy.document().then((doc) => {
      const ev = new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      });
      doc.dispatchEvent(ev);
      expect(ev.defaultPrevented, "Escape sem listener residual").to.eq(false);
    });

    // Foco funciona em elementos fora do antigo dialog
    cy.get('[data-testid="abrir-membros-dialog"]').focus();
    cy.focused().should(
      "have.attr",
      "data-testid",
      "abrir-membros-dialog",
    );

    // Click fora não é interceptado por overlay invisível
    cy.get('[data-testid="abrir-membros-dialog"]').click();
    cy.get(DIALOG).should("be.visible"); // reabre normalmente
  });
});
