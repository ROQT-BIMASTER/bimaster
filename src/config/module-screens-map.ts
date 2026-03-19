/**
 * Tipagem e referência estática para módulos e telas do sistema.
 * O mapeamento real é dinâmico (via banco: telas_sistema.modulo_codigo).
 * Este arquivo serve como fallback, tipagem e referência para ícones.
 */

export interface ModuleScreenConfig {
  moduleCode: string;
  moduleName: string;
  icon: string;
  screens: {
    code: string;
    name: string;
  }[];
}

/**
 * Ícones padrão por módulo (fallback se não vier do banco)
 */
export const MODULE_ICON_MAP: Record<string, string> = {
  prospects: "Users",
  comercial: "ShoppingCart",
  marketing: "Megaphone",
  trade: "Store",
  financeiro: "DollarSign",
  fabrica: "Factory",
  china: "Globe",
  projetos: "FolderKanban",
  reunioes: "Calendar",
  configuracoes: "Settings",
};

/**
 * Retorna o nome de ícone Lucide para um módulo
 */
export function getModuleIcon(moduleCode: string, dbIcon?: string | null): string {
  return dbIcon || MODULE_ICON_MAP[moduleCode] || "Box";
}
