/**
 * Combina configuração da sidebar (categorias + módulos do banco), itens de menu
 * (páginas por módulo) e permissões do usuário para produzir uma árvore filtrada
 * pronta para o AppRail / ContextualSidebar / Launcher.
 *
 * Mantém paridade de permissões com a v1: usa exatamente os mesmos hooks
 * (useModulePermissions, useScreenPermissions, useUserRole).
 */
import { useMemo } from "react";
import { useSidebarConfig } from "@/hooks/useSidebarConfig";
import { useSidebarMenuItems, type SidebarMenuItem } from "@/hooks/useSidebarMenuItems";
import { useModulePermissions } from "@/hooks/useModulePermissions";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import { useUserRole } from "@/hooks/useUserRole";
import { buildAdminCategory } from "./adminCategory";

export interface NavV2Page {
  id: string;
  label: string;
  route: string;
  icon?: string | null;
}

export interface NavV2Module {
  code: string;
  label: string;
  icon: string;
  pages: NavV2Page[];
}

export interface NavV2Category {
  key: string;
  label: string;
  icon?: string | null;
  modules: NavV2Module[];
}

export interface NavV2Tree {
  categories: NavV2Category[];
  isLoading: boolean;
}

function itemAllowed(
  item: SidebarMenuItem,
  perms: {
    isAdmin: boolean;
    isAdminOrSupervisor: boolean;
    hasScreen: (code: string) => boolean;
  },
): boolean {
  if (!item.ativo) return false;
  if (item.require_admin && !perms.isAdmin) return false;
  if (item.require_admin_or_supervisor && !perms.isAdminOrSupervisor) return false;
  if (item.screen_code && !perms.isAdmin && !perms.hasScreen(item.screen_code)) {
    return false;
  }
  return true;
}

export function useNavV2Data(): NavV2Tree {
  const { categories: dbCategories, isLoading: configLoading } = useSidebarConfig();
  const { itemsByModule, isLoading: itemsLoading } = useSidebarMenuItems();
  const { hasModulePermission, loading: modLoading } = useModulePermissions();
  const { hasPermission, loading: permLoading } = useScreenPermissions();
  const { isAdmin, isAdminOrSupervisor } = useUserRole();

  const tree = useMemo<NavV2Category[]>(() => {
    const perms = { isAdmin, isAdminOrSupervisor, hasScreen: hasPermission };
    const base = dbCategories
      .filter((c) => c.ativo)
      .map<NavV2Category>((cat) => {
        const modules = (cat.modules ?? [])
          .filter((m) => m.ativo && (isAdmin || hasModulePermission(m.module_code)))
          .sort((a, b) => a.ordem - b.ordem)
          .map<NavV2Module>((m) => {
            const rawItems = itemsByModule[m.module_code] ?? [];
            const pages = rawItems
              .filter((it) => itemAllowed(it, perms))
              .filter((it) => !!it.route)
              .sort((a, b) => a.ordem - b.ordem)
              .map<NavV2Page>((it) => ({
                id: it.id,
                label: it.label_override ?? it.label,
                route: it.route as string,
                icon: it.icon_override ?? it.icon,
              }));
            return {
              code: m.module_code,
              label: m.label_override ?? m.module_code,
              icon: m.icon_override ?? "Square",
              pages,
            };
          })
          // mantém o módulo mesmo sem páginas — admin pode querer ver
          .filter((m) => isAdmin || m.pages.length > 0);

        return {
          key: cat.key,
          label: cat.label,
          icon: cat.icon,
          modules,
        };
      })
      .filter((c) => c.modules.length > 0);
    const adminCat = buildAdminCategory({
      isAdmin,
      hasModulePermission,
      hasScreen: hasPermission,
    });
    return adminCat ? [...base, adminCat] : base;
  }, [
    dbCategories,
    itemsByModule,
    hasModulePermission,
    hasPermission,
    isAdmin,
    isAdminOrSupervisor,
  ]);

  return {
    categories: tree,
    isLoading: configLoading || itemsLoading || modLoading || permLoading,
  };
}

/** Encontra módulo cuja rota prefixa a URL atual. */
export function findActiveModule(
  tree: NavV2Category[],
  currentPath: string,
): { category: NavV2Category; module: NavV2Module } | null {
  for (const category of tree) {
    for (const module of category.modules) {
      if (module.pages.some((p) => currentPath.startsWith(p.route))) {
        return { category, module };
      }
    }
  }
  return null;
}
