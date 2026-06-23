/**
 * Hook v2: monta a árvore de navegação combinando categorias, módulos e itens
 * vindos do banco, já filtrados pelas permissões do usuário (incluindo
 * impersonação). Usado por AppRail, ContextualSidebar e Launcher.
 */
import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useSidebarConfig } from "@/hooks/useSidebarConfig";
import { useSidebarMenuItems, type SidebarMenuItem } from "@/hooks/useSidebarMenuItems";
import { useModulePermissions } from "@/hooks/useModulePermissions";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";

export interface NavPageV2 {
  path: string;
  label: string;
  icon: string | null;
  highlight: boolean;
  parentGroup: string | null;
  requireAdmin: boolean;
}

export interface NavModuleV2 {
  code: string;
  label: string;
  icon: string;
  ordem: number;
  pages: NavPageV2[];
  pendentes?: number;
}

export interface NavCategoryV2 {
  id: string;
  key: string;
  label: string;
  icon: string;
  ordem: number;
  modules: NavModuleV2[];
}

export interface NavTreeV2 {
  categories: NavCategoryV2[];
  totalPages: number;
  totalModules: number;
  isLoading: boolean;
}

export interface ActiveNav {
  category: NavCategoryV2;
  module: NavModuleV2;
  page?: NavPageV2;
}

function filterItemsByPermission(
  items: SidebarMenuItem[],
  canAccessScreen: (code: string) => boolean,
  isAdmin: boolean,
): SidebarMenuItem[] {
  return items.filter((it) => {
    if (!it.ativo) return false;
    if (it.require_admin && !isAdmin) return false;
    if (it.screen_code && !canAccessScreen(it.screen_code)) return false;
    return true;
  });
}

export function useNavTreeV2(): NavTreeV2 {
  const { pathname } = useLocation();
  const { categories, isLoading: catLoading } = useSidebarConfig();
  const { items, isLoading: itemsLoading } = useSidebarMenuItems();
  const { hasModulePermission } = useModulePermissions();
  const { canAccessScreen, isAdmin } = useScreenPermissions();

  return useMemo(() => {
    const built: NavCategoryV2[] = categories
      .map<NavCategoryV2>((cat) => {
        const mods: NavModuleV2[] = cat.modules
          .filter((m) => m.ativo)
          .filter((m) => hasModulePermission(m.module_code))
          .sort((a, b) => a.ordem - b.ordem)
          .map<NavModuleV2>((m) => {
            const rawItems = items.filter((it) => it.module_code === m.module_code);
            const visible = filterItemsByPermission(rawItems, canAccessScreen, isAdmin);
            const pages: NavPageV2[] = visible
              .filter((it) => !!it.route)
              .map((it) => ({
                path: it.route as string,
                label: it.label_override ?? it.label,
                icon: it.icon_override ?? it.icon,
                highlight: pathname === it.route || pathname.startsWith(`${it.route}/`),
                parentGroup: it.parent_group,
                requireAdmin: it.require_admin,
              }));
            return {
              code: m.module_code,
              label: m.label_override ?? m.module_code,
              icon: m.icon_override ?? "Square",
              ordem: m.ordem,
              pages,
            };
          });
        return {
          id: cat.id,
          key: cat.key,
          label: cat.label,
          icon: cat.icon,
          ordem: cat.ordem,
          modules: mods,
        };
      })
      .filter((c) => c.modules.length > 0)
      .sort((a, b) => a.ordem - b.ordem);

    const totalModules = built.reduce((acc, c) => acc + c.modules.length, 0);
    const totalPages = built.reduce(
      (acc, c) => acc + c.modules.reduce((a2, m) => a2 + m.pages.length, 0),
      0,
    );

    return {
      categories: built,
      totalPages,
      totalModules,
      isLoading: catLoading || itemsLoading,
    };
  }, [categories, items, hasModulePermission, canAccessScreen, isAdmin, pathname, catLoading, itemsLoading]);
}

export function findActive(tree: NavTreeV2, pathname: string): ActiveNav | null {
  for (const category of tree.categories) {
    for (const module of category.modules) {
      const page = module.pages.find(
        (p) => pathname === p.path || pathname.startsWith(`${p.path}/`),
      );
      if (page) return { category, module, page };
    }
  }
  // Sem página específica: tenta casar pelo prefixo /dashboard/<module>
  const seg = pathname.split("/").filter(Boolean);
  if (seg[0] === "dashboard" && seg[1]) {
    for (const category of tree.categories) {
      const mod = category.modules.find((m) => m.code === seg[1]);
      if (mod) return { category, module: mod };
    }
  }
  return null;
}
