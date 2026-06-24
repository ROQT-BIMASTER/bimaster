/**
 * Categoria sintética "Administração" para o AppRail v2.
 *
 * Espelha 1:1 o bloco JSX hardcoded de AppSidebar.tsx (linhas ~1370–1438).
 * Não vem do banco — é injetada em useNavV2Data quando o usuário é admin.
 */
import type { NavV2Category, NavV2Module, NavV2Page } from "./useNavV2Data";

interface AdminPerms {
  isAdmin: boolean;
  hasModulePermission: (code: string) => boolean;
  hasScreen: (code: string) => boolean;
}

interface RawPage {
  id: string;
  label: string;
  route: string;
  icon: string;
  screen?: string;
}

function toPages(items: RawPage[], perms: AdminPerms): NavV2Page[] {
  return items
    .filter((it) => !it.screen || perms.isAdmin || perms.hasScreen(it.screen))
    .map<NavV2Page>((it) => ({
      id: it.id,
      label: it.label,
      route: it.route,
      icon: it.icon,
    }));
}

export function buildAdminCategory(perms: AdminPerms): NavV2Category | null {
  if (!perms.isAdmin) return null;

  const seguranca: RawPage[] = [
    { id: "adm-seg-painel", label: "Painel Segurança", route: "/dashboard/seguranca-dashboard", icon: "ShieldCheck" },
    { id: "adm-seg-explorer", label: "Security Explorer", route: "/dashboard/security-explorer", icon: "Search" },
    { id: "adm-seg-trilha", label: "Trilha de Acessos", route: "/dashboard/trilha-auditoria-acessos", icon: "Footprints" },
    { id: "adm-seg-rel", label: "Rel. Segurança", route: "/dashboard/relatorio-seguranca", icon: "Shield" },
    { id: "adm-seg-aud", label: "Auditoria", route: "/dashboard/auditoria", icon: "ClipboardCheck", screen: "auditoria" },
  ];

  const acesso: RawPage[] = [
    { id: "adm-acc-config", label: "Config. Acesso", route: "/dashboard/configuracoes/acesso", icon: "UserCheck" },
    { id: "adm-acc-perm", label: "Permissões Módulo", route: "/dashboard/configuracoes/permissoes-modulo", icon: "Users" },
    { id: "adm-acc-lgpd", label: "LGPD", route: "/dashboard/configuracoes/lgpd", icon: "Shield" },
    { id: "adm-acc-forn", label: "Config. Fornecedores", route: "/dashboard/configuracoes/fornecedores-visibilidade", icon: "Eye" },
  ];

  const govFinanceira: RawPage[] = [
    { id: "adm-fin-ap", label: "Painel AP Central", route: "/dashboard/financeiro/ap-central", icon: "Landmark" },
    { id: "adm-fin-fila-erp", label: "Fila Exportação ERP", route: "/dashboard/financeiro/contas-a-pagar/exportacao-erp", icon: "Upload" },
    { id: "adm-fin-sync-cad", label: "Sync Cadastros AP", route: "/dashboard/financeiro/contas-a-pagar/sync-cadastros", icon: "RefreshCw" },
    { id: "adm-fin-conc", label: "Conciliação Manual", route: "/dashboard/financeiro/contas-a-pagar/conciliacao", icon: "GitCompare" },
    { id: "adm-fin-sync-ap", label: "Sync Contas a Pagar", route: "/dashboard/financeiro/contas-a-pagar/sync", icon: "RefreshCw" },
    { id: "adm-fin-sync-ar", label: "Sync Contas a Receber", route: "/dashboard/financeiro/contas-a-receber/sync", icon: "RefreshCw" },
    { id: "adm-fin-sync-vendas", label: "Sync Vendas / Faturamento", route: "/dashboard/financeiro/vendas/sync", icon: "RefreshCw" },
    { id: "adm-fin-rel-ap", label: "Rel. AP Module", route: "/dashboard/relatorio-ap-module", icon: "DollarSign" },
    { id: "adm-fin-rel-ap-erp", label: "Rel. AP x ERP", route: "/configuracoes/admin/relatorio-ap-erp", icon: "Scale" },
  ];

  const sistema: RawPage[] = [
    { id: "adm-sis-cal", label: "Calendário Corporativo", route: "/dashboard/admin/calendario-corporativo", icon: "CalendarDays" },
    { id: "adm-sis-menu", label: "Config. Menu", route: "/dashboard/configuracoes/menu", icon: "LayoutGrid" },
    { id: "adm-sis-api-health", label: "API Health", route: "/dashboard/configuracoes/api-health", icon: "HeartPulse" },
    { id: "adm-sis-rel-apis", label: "Rel. APIs", route: "/dashboard/relatorio-apis", icon: "Network" },
    { id: "adm-sis-rel-dev", label: "Rel. Desenvolvimento", route: "/dashboard/relatorio-desenvolvimento", icon: "Package" },
    { id: "adm-sis-portal-erp", label: "Portal ERP", route: "/dashboard/integracao-erp", icon: "Key", screen: "__erp_module__" },
    { id: "adm-sis-sup-api", label: "Suporte API", route: "/dashboard/admin-api-support", icon: "MessageCircle" },
    { id: "adm-sis-sup-central", label: "Central de Suporte", route: "/admin/suporte", icon: "LifeBuoy" },
    { id: "adm-sis-doc", label: "Documentação Técnica", route: "/admin/documentacao-tecnica", icon: "FileText" },
    { id: "adm-sis-asana", label: "Asana Sync", route: "/dashboard/integracoes/asana", icon: "RefreshCw" },
    { id: "adm-sis-shipsgo", label: "Integração ShipsGo", route: "/dashboard/integracoes/shipsgo", icon: "Ship" },
    { id: "adm-sis-est-sync", label: "Sync Estoque ERP", route: "/dashboard/estoque/sync-erp", icon: "RefreshCw" },
    { id: "adm-sis-est-an", label: "Análise Estoque ERP", route: "/dashboard/estoque/analise-erp", icon: "BarChart3" },
    { id: "adm-sis-comp-sync", label: "Sync Composição ERP", route: "/dashboard/composicao/sync", icon: "RefreshCw" },
    { id: "adm-sis-sim", label: "Simulação de Dados", route: "/dashboard/simulacao", icon: "Database" },
  ];

  // Filtro especial: Portal ERP usa hasModulePermission("integracao_erp").
  const sistemaFiltrado = sistema.filter((p) =>
    p.id === "adm-sis-portal-erp" ? perms.hasModulePermission("integracao_erp") : true,
  );

  const modules: NavV2Module[] = [
    {
      code: "admin_seguranca",
      label: "Segurança & Auditoria",
      icon: "ShieldCheck",
      pages: toPages(seguranca, perms),
    },
    {
      code: "admin_acesso",
      label: "Acesso & Permissões",
      icon: "UserCheck",
      pages: toPages(acesso, perms),
    },
    ...(perms.hasModulePermission("financeiro")
      ? [{
          code: "admin_financeiro_gov",
          label: "Governança Financeira",
          icon: "Landmark",
          pages: toPages(govFinanceira, perms),
        } as NavV2Module]
      : []),
    {
      code: "admin_sistema",
      label: "Sistema & Integrações",
      icon: "Settings",
      pages: toPages(sistemaFiltrado, perms),
    },
  ].filter((m) => m.pages.length > 0);

  if (modules.length === 0) return null;

  return {
    key: "administracao",
    label: "Administração",
    icon: "Settings",
    modules,
  };
}
