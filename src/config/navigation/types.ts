/**
 * Tipos da nova navegação (v2). Inerte: não importado por código de produção.
 * Ver docs/audit/2026-Q2/NAV_V2_PLAN.md
 */

export type NavVersion = "v1" | "v2";

export interface NavPage {
  /** Rota absoluta (ex.: "/dashboard/estoque/saldos"). */
  path: string;
  /** Rótulo curto exibido na sidebar contextual. */
  label: string;
  /** Nome de ícone lucide-react opcional. */
  icon?: string;
  /** Marca a página como destacada (ex.: "AQUI" no launcher). */
  highlight?: boolean;
}

export interface NavModule {
  /** Código estável do módulo (ex.: "estoque", "fabrica-china"). */
  code: string;
  /** Rótulo exibido (pode vir de label_override). */
  label: string;
  /** Nome de ícone lucide-react. */
  icon: string;
  /** Ordem dentro da categoria. */
  ordem: number;
  /** Páginas pertencentes ao módulo. */
  pages: NavPage[];
  /** Indicador opcional de sync ERP / integração. */
  syncStatus?: "ok" | "drift" | "error";
  /** Contagem de pendências (badge âmbar). */
  pendentes?: number;
}

export interface NavCategory {
  /** Chave estável (ex.: "operacao", "fixos"). */
  key: string;
  /** Rótulo exibido. */
  label: string;
  /** Ícone opcional da categoria. */
  icon?: string;
  /** Ordem global. */
  ordem: number;
  /** Módulos da categoria já filtrados por permissão. */
  modules: NavModule[];
}

export interface NavTree {
  categories: NavCategory[];
  /** Total de páginas visíveis ao usuário (usado pelo launcher). */
  totalPages: number;
}
