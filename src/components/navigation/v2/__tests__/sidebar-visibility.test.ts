import { describe, it, expect } from "vitest";
import { itemAllowed, NEUTRAL_ROUTES } from "../useNavV2Data";
import { SIDEBAR_FIXTURE } from "@/test/fixtures/sidebar-items";
import type { SidebarMenuItem } from "@/hooks/useSidebarMenuItems";

type Role = "adm" | "supervisor" | "vendedor" | "sem_role";

function makePerms(role: Role, screens: string[] = []) {
  const set = new Set(screens);
  return {
    isAdmin: role === "adm",
    isAdminOrSupervisor: role === "adm" || role === "supervisor",
    hasScreen: (code: string) => set.has(code),
  };
}

function visibleLabels(items: SidebarMenuItem[], perms: ReturnType<typeof makePerms>) {
  return items.filter((it) => itemAllowed(it, perms)).map((it) => it.label);
}

describe("sidebar visibility — itemAllowed", () => {
  it("admin vê todos os itens ativos (incluindo require_admin e órfãos)", () => {
    const perms = makePerms("adm");
    const labels = visibleLabels(SIDEBAR_FIXTURE, perms);
    expect(labels).toEqual([
      "Pedidos de Compra",
      "Gerenciar Projetos",
      "Meus Projetos",
      "Vendas Intelligence",
      "Item Órfão",
      "Dashboard",
      "Meu Perfil",
    ]);
  });

  it("supervisor: vê itens permitidos + admin-or-supervisor + neutras, bloqueia require_admin e órfãos", () => {
    const perms = makePerms("supervisor", ["projetos_lista"]);
    const labels = visibleLabels(SIDEBAR_FIXTURE, perms);
    expect(labels).toContain("Gerenciar Projetos");
    expect(labels).toContain("Meus Projetos");
    expect(labels).toContain("Dashboard");
    expect(labels).toContain("Meu Perfil");
    expect(labels).not.toContain("Pedidos de Compra");
    expect(labels).not.toContain("Vendas Intelligence");
    expect(labels).not.toContain("Item Órfão");
    expect(labels).not.toContain("Vendas Desativado");
  });

  it("vendedor: vê apenas telas liberadas + rotas neutras", () => {
    const perms = makePerms("vendedor", ["vendas_intelligence"]);
    const labels = visibleLabels(SIDEBAR_FIXTURE, perms);
    expect(labels).toEqual([
      "Vendas Intelligence",
      "Dashboard",
      "Meu Perfil",
    ]);
  });

  it("usuário sem role e sem permissões: apenas rotas neutras", () => {
    const perms = makePerms("sem_role");
    const labels = visibleLabels(SIDEBAR_FIXTURE, perms);
    expect(labels).toEqual(["Dashboard", "Meu Perfil"]);
  });

  it("regressão fail-closed: item com screen_code=null e rota não-neutra nunca vaza p/ não-admin", () => {
    for (const role of ["supervisor", "vendedor", "sem_role"] as Role[]) {
      const perms = makePerms(role, ["compras_pedidos", "vendas_intelligence", "projetos_lista"]);
      const labels = visibleLabels(SIDEBAR_FIXTURE, perms);
      expect(labels).not.toContain("Item Órfão");
    }
  });

  it("item inativo nunca aparece — nem para admin", () => {
    const perms = makePerms("adm");
    const labels = visibleLabels(SIDEBAR_FIXTURE, perms);
    expect(labels).not.toContain("Vendas Desativado");
  });

  it("require_admin_or_supervisor bloqueia vendedor mesmo com screen_code liberado", () => {
    const perms = makePerms("vendedor", ["projetos_gerenciar"]);
    const labels = visibleLabels(SIDEBAR_FIXTURE, perms);
    expect(labels).not.toContain("Gerenciar Projetos");
  });

  it("NEUTRAL_ROUTES contém as rotas esperadas (guarda contra remoção acidental)", () => {
    expect(NEUTRAL_ROUTES.has("/dashboard")).toBe(true);
    expect(NEUTRAL_ROUTES.has("/dashboard/perfil")).toBe(true);
    expect(NEUTRAL_ROUTES.has("/dashboard/notificacoes")).toBe(true);
    expect(NEUTRAL_ROUTES.has("/dashboard/central-trabalho")).toBe(true);
  });
});
