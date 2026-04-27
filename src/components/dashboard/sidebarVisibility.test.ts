import { describe, it, expect } from "vitest";
import {
  canSeeProjetosRelatorios,
  canSeeCalendarioCorporativo,
} from "./sidebarVisibility";

describe("Sidebar — visibilidade do atalho 'Relatórios' (Projetos)", () => {
  it("deve aparecer para Admin", () => {
    expect(
      canSeeProjetosRelatorios({ isAdmin: true, isAdminOrSupervisor: true })
    ).toBe(true);
  });

  it("deve aparecer para Supervisor/Gerente (não-admin, mas isAdminOrSupervisor)", () => {
    expect(
      canSeeProjetosRelatorios({ isAdmin: false, isAdminOrSupervisor: true })
    ).toBe(true);
  });

  it("NÃO deve aparecer para usuário comum", () => {
    expect(
      canSeeProjetosRelatorios({ isAdmin: false, isAdminOrSupervisor: false })
    ).toBe(false);
  });
});

describe("Sidebar — visibilidade do atalho 'Calendário Corporativo' (Admin)", () => {
  it("deve aparecer apenas para Admin", () => {
    expect(
      canSeeCalendarioCorporativo({ isAdmin: true, isAdminOrSupervisor: true })
    ).toBe(true);
  });

  it("NÃO deve aparecer para Supervisor/Gerente sem flag de admin", () => {
    expect(
      canSeeCalendarioCorporativo({ isAdmin: false, isAdminOrSupervisor: true })
    ).toBe(false);
  });

  it("NÃO deve aparecer para usuário comum", () => {
    expect(
      canSeeCalendarioCorporativo({ isAdmin: false, isAdminOrSupervisor: false })
    ).toBe(false);
  });
});
