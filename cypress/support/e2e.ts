/// <reference types="cypress" />

// Login helper compartilhado pelas specs.
Cypress.Commands.add("login", () => {
  const email = Cypress.env("TEST_EMAIL");
  const password = Cypress.env("TEST_PASSWORD");
  if (!email || !password) throw new Error("CYPRESS_TEST_EMAIL/PASSWORD ausentes");
  cy.visit("/auth");
  cy.contains(/e-?mail/i).parent().find("input").type(email);
  cy.contains(/senha/i).parent().find("input").type(password);
  cy.contains("button", /entrar/i).click();
  cy.url({ timeout: 30_000 }).should("match", /\/dashboard/);
});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      login(): Chainable<void>;
    }
  }
}

export {};
