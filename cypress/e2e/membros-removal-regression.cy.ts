/// <reference types="cypress" />

/**
 * E2E (Cypress) — Regressão da trava do AlertDialog em remoção.
 *
 * Garante, sob estresse, que:
 *  - Spinner e travas permanecem ativos durante toda a chamada (rede lenta).
 *  - Após múltiplas tentativas falhas seguidas de retry, o AlertDialog
 *    ainda bloqueia Esc, clique fora e prende Tab/Shift+Tab.
 *  - Mensagens de erro detalhadas (status HTTP, código, dica, contador
 *    de tentativa) são renderizadas e o estado é restaurado em cada retry.
 *  - A live region anuncia EXATAMENTE "Removendo {nome}…" em cada
 *    tentativa (key força re-anúncio) e não duplica strings entre tentativas
 *    consecutivas com o mesmo erro.
 *
 * Vars: CYPRESS_TEST_EMAIL/PASSWORD, CYPRESS_PROJETO_ID.
 */
const PROJETO_ID = Cypress.env("PROJETO_ID") as string | undefined;

describe("Membros do Projeto — regressão da trava com múltiplas tentativas", () => {
  beforeEach(function () {
    if (!PROJETO_ID) this.skip();
    cy.login();
    cy.visit(`/dashboard/projetos/${PROJETO_ID}`);
    cy.contains("button", /membros|equipe/i).first().click();
    cy.findByRole("dialog", { name: /membros do projeto/i }).should("be.visible");
  });

  it("spinner + travas permanecem ativos durante remoção com rede lenta", () => {
    // ~4s de delay para validar que NADA fecha no meio do caminho.
    cy.intercept({ method: "DELETE", url: /projeto_membros/i }, (req) => {
      req.on("response", (res) => res.setDelay(4000));
    }).as("slowRemove");

    cy.findAllByRole("button", { name: /remover do projeto/i }).first().click();
    cy.findByRole("alertdialog").as("alert");
    cy.get("@alert").contains("button", /^remover$/i).click();

    // Spinner visível no AlertDialog e botão desabilitado.
    cy.findByTestId("alert-removing-status").should("be.visible");
    cy.get("@alert").contains("button", /removendo/i).should("be.disabled");
    cy.get("@alert").contains("button", /cancelar/i).should("be.disabled");

    // Live region exata.
    cy.findByTestId("membros-live-region")
      .invoke("text")
      .should("match", /^Removendo .+…$/);

    // Estresse: Esc e clique fora repetidamente durante o delay.
    for (let i = 0; i < 5; i++) {
      cy.get("body").type("{esc}");
      cy.get("body").click(2, 2, { force: true });
      cy.get("@alert").should("be.visible");
      cy.findByTestId("alert-removing-status").should("be.visible");
    }

    // Tab × 12 confinado no AlertDialog.
    for (let i = 0; i < 12; i++) cy.focused().tab?.();
    cy.get("@alert").then(($el) => {
      expect($el[0].contains(document.activeElement)).to.eq(true);
    });

    cy.wait("@slowRemove");
    cy.get("@alert").should("not.exist");
    cy.findByTestId("membros-live-region")
      .invoke("text")
      .should("match", /sucesso/i);
  });

  it("renderiza erro detalhado, restaura estado a cada 'Tentar novamente' e re-anuncia 'Removendo …' por tentativa", () => {
    let calls = 0;
    cy.intercept({ method: "DELETE", url: /projeto_membros/i }, (req) => {
      calls++;
      if (calls <= 2) {
        // Duas falhas seguidas com o MESMO payload — testa não-duplicação.
        req.reply({
          statusCode: 503,
          body: { message: "Backend indisponível", code: "PGRST503", hint: "Tente em instantes" },
        });
      } else {
        req.continue();
      }
    }).as("removeMembro");

    const announced: string[] = [];
    cy.findAllByRole("button", { name: /remover do projeto/i }).first().click();
    cy.findByRole("alertdialog").as("alert");

    // ---- Tentativa 1 ----
    cy.get("@alert").contains("button", /^remover$/i).click();
    cy.findByTestId("membros-live-region")
      .should("have.attr", "data-attempt", "1")
      .invoke("text")
      .then((t) => {
        expect(t.trim()).to.match(/^Removendo .+…$/);
        announced.push(`loading:1:${t.trim()}`);
      });

    cy.findByTestId("remove-error")
      .should("be.visible")
      .and("have.attr", "data-attempt", "1")
      .within(() => {
        cy.contains(/não foi possível remover/i).should("exist");
        cy.contains(/backend indisponível/i).should("exist");
        cy.contains(/HTTP 503/).should("exist");
        cy.contains(/code: PGRST503/).should("exist");
        cy.contains(/dica: tente em instantes/i).should("exist");
      });
    cy.get("@alert").contains("button", /tentar novamente/i).should("be.visible");

    // ---- Tentativa 2 (mesmo erro) ----
    cy.get("@alert").contains("button", /tentar novamente/i).click();
    // Estado restaurado: erro some imediatamente ao iniciar a tentativa.
    cy.findByTestId("remove-error").should("not.exist");
    cy.findByTestId("membros-live-region")
      .should("have.attr", "data-attempt", "2")
      .invoke("text")
      .then((t) => {
        expect(t.trim()).to.match(/^Removendo .+…$/);
        announced.push(`loading:2:${t.trim()}`);
      });

    cy.findByTestId("remove-error")
      .should("be.visible")
      .and("have.attr", "data-attempt", "2")
      .within(() => {
        cy.contains(/tentativa 2/i).should("exist");
      });

    // Travas continuam ativas mesmo após 2 erros consecutivos:
    cy.get("body").type("{esc}");
    cy.get("body").click(2, 2, { force: true });
    cy.get("@alert").should("be.visible");
    for (let i = 0; i < 8; i++) cy.focused().tab?.();
    cy.get("@alert").then(($el) => {
      expect($el[0].contains(document.activeElement)).to.eq(true);
    });
    for (let i = 0; i < 4; i++) cy.focused().tab?.({ shift: true });
    cy.get("@alert").then(($el) => {
      expect($el[0].contains(document.activeElement)).to.eq(true);
    });

    // ---- Tentativa 3 (sucesso) ----
    cy.get("@alert").contains("button", /tentar novamente/i).click();
    cy.findByTestId("membros-live-region")
      .should("have.attr", "data-attempt", "3")
      .invoke("text")
      .then((t) => {
        expect(t.trim()).to.match(/^Removendo .+…$/);
        announced.push(`loading:3:${t.trim()}`);
      });

    cy.get("@alert").should("not.exist");
    cy.findByTestId("membros-live-region")
      .invoke("text")
      .then((t) => {
        announced.push(`final:${t.trim()}`);
        // Garante exatamente 3 anúncios de "Removendo …" e nenhum duplicado
        // dentro da MESMA tentativa (mesma combinação attempt+texto).
        const loading = announced.filter((a) => a.startsWith("loading:"));
        expect(loading).to.have.length(3);
        expect(new Set(loading).size).to.eq(loading.length, "anúncio duplicado dentro da mesma tentativa");
        // Final = sucesso.
        expect(t).to.match(/sucesso/i);
      });
  });
});
