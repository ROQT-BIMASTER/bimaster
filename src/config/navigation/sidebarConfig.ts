/**
 * Fonte única de configuração da navegação v2 (rail + sidebar contextual + launcher).
 *
 * Inerte nesta PR: exportado mas não importado por nenhum componente de produção.
 * Será consumido na Fase 1 tanto pela v1 (compatibilidade) quanto pela v2.
 *
 * Combina:
 *   - sidebar_categories          (via useSidebarConfig)
 *   - sidebar_category_modules    (via useSidebarConfig)
 *   - src/config/module-screens-map.ts (mapa estático de páginas por módulo)
 *
 * Zero hooks, zero side-effects — função pura testável.
 */

import type {
  NavCategory,
  NavModule,
  NavPage,
  NavTree,
} from "./types";

/** Shape mínimo esperado de uma categoria vinda do banco. */
export interface RawCategory {
  id: string;
  key: string;
  label: string;
  icon: string;
  ordem: number;
  ativo: boolean;
}

/** Shape mínimo esperado de um vínculo categoria↔módulo vindo do banco. */
export interface RawCategoryModule {
  id: string;
  category_id: string;
  module_code: string;
  label_override: string | null;
  icon_override: string | null;
  ordem: number;
  ativo: boolean;
}

/** Página vinda de module-screens-map.ts (subset usado aqui). */
export interface RawScreen {
  path: string;
  label: string;
  icon?: string;
}

/** Mapa: module_code → lista de páginas. */
export type ModuleScreensMap = Record<string, RawScreen[]>;

/** Sinais opcionais por módulo (sync ERP, pendências). Vem do back na Fase 1. */
export interface ModuleSignals {
  syncStatus?: "ok" | "drift" | "error";
  pendentes?: number;
}
export type ModuleSignalsMap = Record<string, ModuleSignals>;

export interface BuildNavTreeInput {
  categories: RawCategory[];
  categoryModules: RawCategoryModule[];
  screens: ModuleScreensMap;
  /** Módulos permitidos ao usuário (pré-filtrados por has_role + ABAC). */
  allowedModuleCodes: ReadonlySet<string>;
  /** Sinais opcionais (sync, pendências). */
  signals?: ModuleSignalsMap;
  /** Rota atual (para marcar highlight "AQUI"). */
  currentPath?: string;
}

/**
 * Constrói a árvore de navegação determinística.
 * Filtra categorias/módulos inativos e módulos sem permissão.
 */
export function buildNavTree(input: BuildNavTreeInput): NavTree {
  const {
    categories,
    categoryModules,
    screens,
    allowedModuleCodes,
    signals = {},
    currentPath,
  } = input;

  let totalPages = 0;

  const cats: NavCategory[] = categories
    .filter((c) => c.ativo)
    .sort((a, b) => a.ordem - b.ordem)
    .map<NavCategory>((cat) => {
      const modules: NavModule[] = categoryModules
        .filter(
          (m) =>
            m.ativo &&
            m.category_id === cat.id &&
            allowedModuleCodes.has(m.module_code),
        )
        .sort((a, b) => a.ordem - b.ordem)
        .map<NavModule>((m) => {
          const rawPages = screens[m.module_code] ?? [];
          const pages: NavPage[] = rawPages.map((p) => ({
            path: p.path,
            label: p.label,
            icon: p.icon,
            highlight: currentPath ? p.path === currentPath : false,
          }));
          totalPages += pages.length;
          const sig = signals[m.module_code] ?? {};
          return {
            code: m.module_code,
            label: m.label_override ?? m.module_code,
            icon: m.icon_override ?? "Square",
            ordem: m.ordem,
            pages,
            syncStatus: sig.syncStatus,
            pendentes: sig.pendentes,
          };
        });

      return {
        key: cat.key,
        label: cat.label,
        icon: cat.icon,
        ordem: cat.ordem,
        modules,
      };
    })
    // Esconde categorias que ficaram vazias após o filtro de permissão.
    .filter((c) => c.modules.length > 0);

  return { categories: cats, totalPages };
}

/** Helper: encontra o módulo cuja URL prefixa a rota atual. */
export function findActiveModule(
  tree: NavTree,
  currentPath: string,
): { category: NavCategory; module: NavModule } | null {
  for (const category of tree.categories) {
    for (const module of category.modules) {
      if (module.pages.some((p) => currentPath.startsWith(p.path))) {
        return { category, module };
      }
    }
  }
  return null;
}
