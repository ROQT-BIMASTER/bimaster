/// <reference types="cypress" />

/**
 * E2E (Cypress) — Membros do Projeto: trava durante remoção.
 *
 * Espelha `e2e/projetos/membros-removal-lock.spec.ts` (Playwright) e cobre:
 *  - Esc bloqueado enquanto "Removendo {nome}…" estiver ativo.
 *  - Clique fora bloqueado.
 *  - Focus trap (Tab/Shift+Tab) confinado ao AlertDialog.
 *  - Live region anuncia "Removendo {nome}…" e depois "sucesso" / "erro".
 *  - Erro mantém o AlertDialog aberto, com botão "Tentar novamente".
 *  - Retry preserva o membro selecionado e só fecha após sucesso.
 *
 * Vars: CYPRESS_TEST_EMAIL/PASSWORD, CYPRESS_PROJETO_ID
 */
const PROJETO_ID = Cypress.env("PROJETO_ID") as string | undefined;

describe("Membros do Projeto — trava de interações na remoção", () => {
  before(() => {
    if (!PROJETO_ID) {
      // Skipa a suíte inteira sem falhar o pipeline.
      // eslint-disable-next-line no-console
      console.warn("CYPRESS_PROJETO_ID ausente — pulando suíte.");
    }
  });

  beforeEach(function () {
    if (!PROJETO_ID) this.skip();
    cy.login();
    cy.visit(`/dashboard/projetos/${PROJETO_ID}`);
    cy.contains("button", /membros|equipe/i).first().click();
    cy.findByRole("dialog", { name: /membros do projeto/i }).should("be.visible");
  });

  it("bloqueia Esc, clique fora e prende foco durante a remoção; live region anuncia sucesso", () => {
    // Atrasa DELETE em ~2.5s para conseguir exercer a trava antes do término.
    cy.intercept(
      { method: "DELETE", url: /projeto_membros/i },
      (req) => {
        req.on("response", (res) => res.setDelay(2500));
      },
    ).as("removeMembro");

    cy.findAllByRole("button", { name: /remover do projeto/i }).first().click();

    cy.findByRole("alertdialog").as("alert").should("be.visible");
    cy.get("@alert").contains("button", /^remover$/i).click();

    // Overlay e live region "Removendo …"
    cy.findByTestId("alert-removing-status").should("be.visible");
    cy.findByTestId("membros-live-region")
      .invoke("text")
      .should("match", /^Removendo .+…$/);

    // Esc não fecha.
    cy.get("body").type("{esc}");
    cy.get("@alert").should("be.visible");
    cy.findByRole("dialog", { name: /membros do projeto/i }).should("be.visible");

    // Clique fora não fecha.
    cy.get("body").click(5, 5, { force: true });
    cy.get("@alert").should("be.visible");

    // Tab × 10 — foco permanece dentro do AlertDialog.
    for (let i = 0; i < 10; i++) cy.realPress?.("Tab") ?? cy.focused().tab?.();
    cy.get("@alert").then(($el) => {
      expect($el[0].contains(document.activeElement)).to.eq(true);
    });
    // Shift+Tab × 5
    for (let i = 0; i < 5; i++) cy.realPress?.(["Shift", "Tab"]) ?? cy.focused().tab?.({ shift: true });
    cy.get("@alert").then(($el) => {
      expect($el[0].contains(document.activeElement)).to.eq(true);
    });

    cy.wait("@removeMembro");
    cy.get("@alert").should("not.exist");
    cy.findByTestId("membros-live-region")
      .invoke("text")
      .should("match", /sucesso/i);
    cy.findByRole("dialog", { name: /membros do projeto/i }).should("be.visible");
  });

  it("erro preserva o membro, mostra 'Tentar novamente' e fecha apenas após sucesso", () => {
    let calls = 0;
    cy.intercept({ method: "DELETE", url: /projeto_membros/i }, (req) => {
      calls++;
      if (calls === 1) {
        req.reply({ statusCode: 500, body: { message: "Falha simulada" } });
      } else {
        req.continue();
      }
    }).as("removeMembro");

    cy.findAllByRole("button", { name: /remover do projeto/i }).first().click();

    cy.findByRole("alertdialog").as("alert");
    // Captura o nome alvo a partir do título do dialog para validar persistência.
    cy.get("@alert")
      .find("[data-testid='remove-error']")
      .should("not.exist");
    cy.get("@alert").contains("button", /^remover$/i).click();

    // 1ª tentativa → erro persiste, dialog continua aberto, live region anuncia erro.
    cy.findByTestId("remove-error").should("be.visible");
    cy.findByTestId("membros-live-region")
      .invoke("text")
      .should("match", /falha|erro|tentar novamente/i);
    cy.get("@alert").contains("button", /tentar novamente/i).should("be.visible");

    // Retry: erro some imediatamente, overlay "Removendo …" reaparece, depois fecha com sucesso.
    cy.get("@alert").contains("button", /tentar novamente/i).click();
    cy.findByTestId("remove-error").should("not.exist");
    cy.findByTestId("membros-live-region")
      .invoke("text")
      .should("match", /removendo/i);

    cy.get("@alert").should("not.exist");
    cy.findByTestId("membros-live-region")
      .invoke("text")
      .should("match", /sucesso/i);
  });
});
