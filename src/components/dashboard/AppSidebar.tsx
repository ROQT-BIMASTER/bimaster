import { 
  Home, Users, Building2, LogOut, Settings, Upload, Shield, 
  LayoutGrid, CheckSquare, MapPin, MessageSquare, Activity, Clock,
  Store, Calendar, Camera, Tag, TrendingUp, Brain, ChevronDown, ChevronRight, ChevronUp, Image, ClipboardCheck, DollarSign, FileText, Download, Phone, Trophy, BarChart3, Sparkles, Package, Factory, Receipt, Layers, Cog, UserCircle, AlertCircle, AlertTriangle, Pause, Wrench, List, Bot, Wallet, Grid3X3, Briefcase, Rocket, PartyPopper, CreditCard, Pickaxe, Compass, Ticket, FolderKanban, Inbox, Mic, Globe, ShoppingCart, Send, Landmark, Palette, FlaskConical, Scale, Network, Key, Megaphone, BarChart2, UserCheck, Target, RefreshCw, X, Headset,
  ShieldCheck, HeartPulse, Eye, GitCompare, Database, Footprints, MessageCircle, Share2, Wand2, CalendarDays, Workflow, Ship, AlertOctagon, LifeBuoy, Headset, PackageSearch, KanbanSquare,
  Truck, LayoutDashboard, ClipboardList
} from "lucide-react";
import { ThemeSelectorPopover } from "@/components/theme/ThemeSelectorPopover";
import { LanguagePreferencePopover } from "@/components/profile/LanguagePreferencePopover";

import { NavLink, useLocation } from "react-router-dom";
import { MODULE_LOADERS } from "@/hooks/useModulePreloader";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSidebarConfig } from "@/hooks/useSidebarConfig";
import { isSuporteV2Enabled } from "@/lib/featureFlags";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import { useModulePermissions } from "@/hooks/useModulePermissions";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2, Link as LinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useInboxDrawer } from "@/contexts/InboxDrawerContext";
import { APP_VERSION, forceCleanReload } from "@/lib/version";
import { useInbox } from "@/hooks/useInbox";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { canSeeProjetosRelatorios, canSeeCalendarioCorporativo } from "./sidebarVisibility";
import { useUserDepartments } from "@/hooks/useUserDepartments";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePWA } from "@/hooks/usePWA";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChinaInboxSidebarItem } from "@/components/china/ChinaInboxSidebarItem";
import { uniqueChannelName } from "@/lib/realtime/channelName";

import { toast } from "sonner";
import { useConfirm } from "@/hooks/useConfirm";
// Module color configuration
const moduleColors = {
  prospects: {
    bg: "bg-[hsl(var(--module-prospects))]",
    bgLight: "bg-[hsl(var(--module-prospects)/0.1)]",
    text: "text-[hsl(var(--module-prospects))]",
    border: "border-[hsl(var(--module-prospects))]",
    hover: "hover:bg-[hsl(var(--module-prospects)/0.15)]",
  },
  financeiro: {
    bg: "bg-[hsl(var(--module-financeiro))]",
    bgLight: "bg-[hsl(var(--module-financeiro)/0.1)]",
    text: "text-[hsl(var(--module-financeiro))]",
    border: "border-[hsl(var(--module-financeiro))]",
    hover: "hover:bg-[hsl(var(--module-financeiro)/0.15)]",
  },
  marketing: {
    bg: "bg-[hsl(var(--module-marketing))]",
    bgLight: "bg-[hsl(var(--module-marketing)/0.1)]",
    text: "text-[hsl(var(--module-marketing))]",
    border: "border-[hsl(var(--module-marketing))]",
    hover: "hover:bg-[hsl(var(--module-marketing)/0.15)]",
  },
  trade: {
    bg: "bg-[hsl(var(--module-trade))]",
    bgLight: "bg-[hsl(var(--module-trade)/0.1)]",
    text: "text-[hsl(var(--module-trade))]",
    border: "border-[hsl(var(--module-trade))]",
    hover: "hover:bg-[hsl(var(--module-trade)/0.15)]",
  },
  fabrica: {
    bg: "bg-[hsl(var(--module-fabrica))]",
    bgLight: "bg-[hsl(var(--module-fabrica)/0.1)]",
    text: "text-[hsl(var(--module-fabrica))]",
    border: "border-[hsl(var(--module-fabrica))]",
    hover: "hover:bg-[hsl(var(--module-fabrica)/0.15)]",
  },
  precos: {
    bg: "bg-[hsl(var(--module-precos))]",
    bgLight: "bg-[hsl(var(--module-precos)/0.1)]",
    text: "text-[hsl(var(--module-precos))]",
    border: "border-[hsl(var(--module-precos))]",
    hover: "hover:bg-[hsl(var(--module-precos)/0.15)]",
  },
  comercial: {
    bg: "bg-[hsl(var(--module-comercial,210_80%_50%))]",
    bgLight: "bg-[hsl(var(--module-comercial,210_80%_50%)/0.1)]",
    text: "text-[hsl(var(--module-comercial,210_80%_50%))]",
    border: "border-[hsl(var(--module-comercial,210_80%_50%))]",
    hover: "hover:bg-[hsl(var(--module-comercial,210_80%_50%)/0.15)]",
  },
  eventos: {
    bg: "bg-[hsl(var(--module-eventos,280_60%_50%))]",
    bgLight: "bg-[hsl(var(--module-eventos,280_60%_50%)/0.1)]",
    text: "text-[hsl(var(--module-eventos,280_60%_50%))]",
    border: "border-[hsl(var(--module-eventos,280_60%_50%))]",
    hover: "hover:bg-[hsl(var(--module-eventos,280_60%_50%)/0.15)]",
  },
  china: {
    bg: "bg-[hsl(0_72%_51%)]",
    bgLight: "bg-[hsl(0_72%_51%/0.1)]",
    text: "text-[hsl(0_72%_51%)]",
    border: "border-[hsl(0_72%_51%)]",
    hover: "hover:bg-[hsl(0_72%_51%/0.15)]",
  },
};

// Icon name to component mapping for dynamic config
const iconMap: Record<string, React.ElementType> = {
  Home, Users, Building2, Settings, Upload, Shield, LayoutGrid, CheckSquare, MapPin,
  MessageSquare, Activity, Clock, Store, Calendar, Camera, Tag, TrendingUp, Brain,
  Image, ClipboardCheck, DollarSign, FileText, Download, Phone, Trophy, BarChart3,
  Sparkles, Package, Factory, Receipt, Layers, Cog, UserCircle, AlertCircle,
  AlertTriangle, Pause, Wrench, List, Bot, Wallet, Grid3X3, Briefcase, Rocket,
  PartyPopper, CreditCard, Pickaxe, Compass, Ticket, FolderKanban, Inbox, Mic,
  Globe, ShoppingCart, Send, Landmark, Palette, FlaskConical, LogOut,
};


const fabricaGroups = [
  {
    label: "Entrada",
    items: [
      { title: "Recebimento NF-e", url: "/dashboard/fabrica/recebimentos", icon: Upload, screenCode: "fabrica_recebimentos" },
      { title: "Matérias-Primas", url: "/dashboard/fabrica/materias-primas", icon: Package, screenCode: "fabrica_mps" },
    ]
  },
  {
    label: "Produção",
    items: [
      { title: "Fórmulas (BOM)", url: "/dashboard/fabrica/formulas", icon: FileText, screenCode: "fabrica_formulas" },
      { title: "Planejamento MRP", url: "/dashboard/fabrica/planejamento", icon: Calendar, screenCode: "fabrica_planejamento" },
      { title: "Ordens de Produção", url: "/dashboard/fabrica/ordens-producao", icon: ClipboardCheck, screenCode: "fabrica_producao" },
      { title: "Apontamentos", url: "/dashboard/fabrica/apontamentos", icon: Clock, screenCode: "fabrica_apontamentos" },
    ]
  },
  {
    label: "Qualidade",
    items: [
      { title: "Qualidade", url: "/dashboard/fabrica/qualidade", icon: AlertCircle, screenCode: "fabrica_qualidade" },
      { title: "Paradas", url: "/dashboard/fabrica/paradas", icon: Pause, screenCode: "fabrica_paradas" },
    ]
  },
  {
    label: "Recursos",
    items: [
      { title: "Máquinas", url: "/dashboard/fabrica/maquinas", icon: Wrench, screenCode: "fabrica_maquinas" },
      { title: "Operadores", url: "/dashboard/fabrica/operadores", icon: UserCircle, screenCode: "fabrica_operadores" },
    ]
  },
  {
    label: "Fiscal",
    items: [
      { title: "Fiscal", url: "/dashboard/fabrica/fiscal", icon: Receipt, screenCode: "fabrica_fiscal" },
      { title: "Tabela de Impostos", url: "/dashboard/fabrica/tabela-impostos", icon: FileText, screenCode: "fabrica_impostos" },
    ]
  },
  {
    label: "Saída",
    items: [
      { title: "Produtos Acabados", url: "/dashboard/fabrica/produtos-acabados", icon: Package, screenCode: "fabrica_produtos" },
      { title: "Comunicação Revisões", url: "/dashboard/fabrica/comunicacao-revisoes", icon: MessageSquare, screenCode: "fabrica_produtos" },
      { title: "Revisão de Fichas", url: "/dashboard/fabrica/revisao-fichas", icon: CheckSquare, screenCode: "fabrica_revisao_fichas" },
    ]
  },
  {
    label: "Ferramentas",
    items: [
      { title: "Agente Huggs", url: "/dashboard/agente-huggs", icon: Bot, screenCode: "agente_huggs" },
      { title: "Agente de QA", url: "/dashboard/qa-agent", icon: Shield, screenCode: "qa_agent" },
    ]
  },
];

interface ModuleHeaderProps {
  icon: React.ElementType;
  title: string;
  isOpen?: boolean;
  colorKey?: keyof typeof moduleColors;
  subItemCount?: number;
}

const ModuleHeader = ({ icon: Icon, title, isOpen, subItemCount }: ModuleHeaderProps) => {
  return (
    <div className={cn(
      "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-all duration-150 cursor-pointer",
      "hover:bg-[var(--sidebar-hover-raw)]",
      isOpen && "bg-[hsl(var(--primary)/0.08)]"
    )}>
      <Icon className={cn(
        "h-5 w-5 shrink-0 transition-colors",
        isOpen ? "text-[hsl(var(--primary))]" : "text-[var(--sidebar-text-muted-raw)]"
      )} />
      <span className={cn(
        "font-semibold text-[14px] flex-1 leading-tight",
        isOpen ? "text-[hsl(var(--primary))]" : "text-[var(--sidebar-text-hover-raw)]"
      )}>
        {title}
      </span>
      {subItemCount != null && subItemCount > 0 && (
        <span className="bg-muted text-muted-foreground text-[10px] font-medium px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
          {subItemCount}
        </span>
      )}
      <ChevronRight className={cn(
        "h-3.5 w-3.5 text-[var(--sidebar-text-muted-raw)] transition-transform duration-200",
        isOpen && "rotate-90"
      )} />
    </div>
  );
};

interface MenuItemLinkProps {
  to: string;
  icon: React.ElementType;
  title: string;
  colorKey?: keyof typeof moduleColors;
  badge?: React.ReactNode;
  end?: boolean;
}

const MenuItemLink = ({ to, icon: Icon, title, badge, end }: MenuItemLinkProps) => {
  // Prefetch the route's chunk on hover/focus so navigation feels instant.
  // Safe no-op for routes not registered in the prefetch map.
  const handlePrefetch = () => {
    // Lazy import to avoid pulling the registry into the critical sidebar bundle path.
    import("@/lib/routePrefetch").then((m) => m.prefetchRoute(to)).catch(() => {});
  };
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild>
        <NavLink
          to={to}
          end={end}
          onMouseEnter={handlePrefetch}
          onFocus={handlePrefetch}
          onTouchStart={handlePrefetch}
          className={({ isActive }) => cn(
            "relative flex items-center gap-2.5 px-3 py-1.5 rounded-md transition-all duration-150 text-[12px]",
            isActive
              ? "font-medium bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))]"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 truncate">{title}</span>
          {badge}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};

// Botão estilizado como item de menu — usado para ações (ex.: abrir drawer global)
const MenuItemButton = ({ icon: Icon, title, onClick, badge }: { icon: React.ElementType; title: string; onClick: () => void; badge?: React.ReactNode }) => {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild>
        <button
          type="button"
          onClick={onClick}
          className={cn(
            "relative flex items-center gap-2.5 px-3 py-1.5 rounded-md transition-all duration-150 text-[12px] w-full",
            "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 truncate text-left">{title}</span>
          {badge}
        </button>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};

// Category divider label — always visible, no accordion
const CategoryDivider = ({ title }: { title: string }) => (
  <div className="flex items-center gap-2 px-3 pt-4 pb-1">
    <div className="flex-1 h-px bg-[var(--sidebar-border-raw)]" />
    <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--sidebar-text-muted-raw)] whitespace-nowrap">
      {title}
    </span>
    <div className="flex-1 h-px bg-[var(--sidebar-border-raw)]" />
  </div>
);

export function AppSidebar({ side }: { side?: "left" | "right" }) {
  const confirm = useConfirm();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const { permissions, loading: permissionsLoading, hasPermission } = useScreenPermissions();
  const { hasModulePermission, loading: modulesLoading } = useModulePermissions();
  const { isAdminOrSupervisor, isAdmin } = useUserRole();
  const { user } = useAuth();
  const { categories: dbCategories, isLoading: configLoading } = useSidebarConfig();
  const { data: userDepartments = [] } = useUserDepartments();
  const { t, dir } = useLanguage();
  const isRTL = dir === "rtl";
  const { needRefresh } = usePWA();
  const { openDrawer: openInboxDrawer } = useInboxDrawer();
  const { counts: inboxCounts } = useInbox();
  
  const [openModules, setOpenModules] = useState<Set<string>>(new Set());
  const [openFinSubgroups, setOpenFinSubgroups] = useState<Set<string>>(new Set());
  const [adminOpen, setAdminOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [tabelasPendentes, setTabelasPendentes] = useState(0);
  const [userName, setUserName] = useState<string>("");
  const [selectedModules, setSelectedModules] = useState<Set<string>>(() => {
    try {
      const saved = sessionStorage.getItem("sidebar-module-filter");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  useEffect(() => {
    sessionStorage.setItem(
      "sidebar-module-filter",
      JSON.stringify(Array.from(selectedModules))
    );
  }, [selectedModules]);

  const loading = permissionsLoading || modulesLoading || configLoading;

  // Build available modules list based on permissions
  const moduleFilterOptions = useMemo(() => {
    const allModules = [
      { code: "prospects", label: t("module.prospects"), icon: Users },
      { code: "financeiro", label: t("module.financeiro"), icon: DollarSign },
      { code: "marketing", label: t("module.marketing"), icon: BarChart3 },
      { code: "trade", label: t("module.trade"), icon: Store },
      { code: "fabrica", label: t("module.fabrica"), icon: Factory },
      { code: "comercial", label: t("module.comercial"), icon: Briefcase },
      { code: "eventos", label: t("module.eventos"), icon: PartyPopper },
      
      { code: "precos", label: t("module.precos"), icon: DollarSign },
      { code: "projetos", label: "Projetos", icon: FolderKanban },
      { code: "reunioes", label: "Reuniões", icon: Mic },
      { code: "china", label: "Fábrica China", icon: Globe },
      { code: "estoque", label: "Estoque", icon: Package },
      { code: "aprovacao_artes", label: "Aprovação de Artes", icon: Palette },
      { code: "composicao", label: "Composição", icon: FlaskConical },
      { code: "amostras", label: "Amostras", icon: Package },
      { code: "analise_embalagem", label: "Embalagem", icon: Layers },
      { code: "etiqueta_bula", label: "Etiqueta/Bula", icon: Tag },
      ...(isAdmin ? [{ code: "design_studio", label: "Design Studio", icon: Wand2 }] : []),
    ];
    return allModules.filter(m => hasModulePermission(m.code));
  }, [hasModulePermission, isAdmin]);

  const showModule = (code: string) => {
    // design_studio is admin-only at the moment
    if (code === "design_studio") {
      return isAdmin && (selectedModules.size === 0 || selectedModules.has(code));
    }
    return hasModulePermission(code) && (selectedModules.size === 0 || selectedModules.has(code));
  };

  const toggleModule = (code: string) => {
    setSelectedModules(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const filterLabel = useMemo(() => {
    if (selectedModules.size === 0) return t("nav.all_modules");
    if (selectedModules.size === 1) {
      const code = Array.from(selectedModules)[0];
      return moduleFilterOptions.find(m => m.code === code)?.label || code;
    }
    return `${selectedModules.size} ${t("nav.n_modules")}`;
  }, [selectedModules, moduleFilterOptions]);

  // Set module open/close (explicit boolean or toggle)
  const setModuleOpen = useCallback((code: string, open?: boolean) => {
    setOpenModules(prev => {
      const next = new Set(prev);
      const shouldOpen = open ?? !next.has(code);
      if (shouldOpen) next.add(code);
      else next.delete(code);
      return next;
    });
  }, []);

  // Category accordion removed — categories are always visible now

  // Route-based module/category mapping for auto-expand
  const moduleRouteMap: Record<string, string[]> = useMemo(() => ({
    prospects: ["/dashboard/prospects", "/dashboard/tarefas", "/dashboard/demandas"],
    comercial: ["/dashboard/comercial"],
    precos: ["/dashboard/precos"],
    trade: ["/dashboard/trade"],
    marketing: ["/dashboard/marketing"],
    eventos: ["/dashboard/eventos"],
    fabrica: ["/dashboard/fabrica", "/dashboard/agente-huggs", "/dashboard/qa-agent"],
    china: ["/dashboard/fabrica-china"],
    composicao: ["/dashboard/composicao"],
    amostras: ["/dashboard/amostras"],
    analise_embalagem: ["/dashboard/analise-embalagem"],
    etiqueta_bula: ["/dashboard/etiqueta-bula"],
    aprovacao_artes: ["/dashboard/aprovacao-artes", "/dashboard/fluxo-artes"],
    financeiro: ["/dashboard/financeiro"],
    
    estoque: ["/dashboard/estoque"],
    projetos: ["/dashboard/projetos"],
    reunioes: ["/dashboard/reunioes"],
    processos: ["/dashboard/processos"],
    inteligencia: ["/dashboard/painel-executivo", "/dashboard/performance-vendas", "/dashboard/clientes", "/dashboard/detalhamento", "/dashboard/geografico", "/dashboard/produtos", "/dashboard/metas", "/dashboard/consolidado"],
  }), []);

  // Dynamic moduleToCategoryMap from DB config
  const moduleToCategoryMap: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {};
    dbCategories.forEach(cat => {
      cat.modules.forEach(m => {
        map[m.module_code] = cat.key;
      });
    });
    return map;
  }, [dbCategories]);

  // Auto-expand financeiro subgroups (internal collapsibles, not popovers) based on route
  useEffect(() => {
    const path = location.pathname;
    // Auto-expand financeiro subgroups based on route
    if (path.startsWith("/dashboard/financeiro") || path.startsWith("/dashboard/trade/financeiro")) {
      const finSubgroupRoutes: Record<string, string[]> = {
        verbas: ["/dashboard/trade/financeiro", "/dashboard/financeiro/verbas", "/dashboard/financeiro/extrato", "/dashboard/financeiro/aprovacoes", "/dashboard/financeiro/verbas-semestrais"],
        campanhas: ["/dashboard/trade/financeiro/campanhas", "/dashboard/trade/financeiro/lancamentos", "/dashboard/trade/financeiro/contas", "/dashboard/financeiro/painel-lancamentos", "/dashboard/financeiro/campanhas", "/dashboard/financeiro/contas-correntes", "/dashboard/financeiro/lancamentos"],
        contas: ["/dashboard/financeiro/contas-a-pagar", "/dashboard/financeiro/contas-a-receber", "/dashboard/financeiro/conciliacao", "/dashboard/financeiro/cobranca", "/dashboard/financeiro/plano-contas"],
        analises: ["/dashboard/financeiro/fluxo", "/dashboard/financeiro/dre", "/dashboard/financeiro/visao-departamentos", "/dashboard/financeiro/classificar", "/dashboard/financeiro/classificacao-ia"],
      };
      for (const [sg, routes] of Object.entries(finSubgroupRoutes)) {
        if (routes.some(r => path.startsWith(r))) {
          setOpenFinSubgroups(prev => {
            if (prev.has(sg)) return prev; // same ref — no re-render
            const next = new Set(prev);
            next.add(sg);
            return next;
          });
        }
      }
    }
  }, [location.pathname, moduleRouteMap, moduleToCategoryMap]);

  // Fetch user name
  useEffect(() => {
    const fetchUserName = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from("profiles")
        .select("nome")
        .eq("id", user.id)
        .single();
      if (data?.nome) setUserName(data.nome.split(" ")[0]);
    };
    fetchUserName();
  }, [user?.id]);

  // Ref estável para hasModulePermission (evita loop infinito por mudança de identidade)
  const hasModulePermRef = useRef(hasModulePermission);
  hasModulePermRef.current = hasModulePermission;

  // Buscar tabelas pendentes
  useEffect(() => {
    if (loading || !hasModulePermRef.current("precos")) {
      setTabelasPendentes(0);
      return;
    }
    const fetchPendentes = async () => {
      const { count } = await supabase
        .from("fabrica_tabelas_preco")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending_approval");
      setTabelasPendentes(count || 0);
    };
    fetchPendentes();
    const channel = supabase
      .channel(uniqueChannelName('sidebar-tabelas-changes'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fabrica_tabelas_preco' }, () => fetchPendentes())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loading]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success(t("logout.title"), { description: t("logout.description") });
    navigate("/auth/login");
  };
  // ============ CATEGORY DEFINITIONS (from DB) ============
  const categories = useMemo(() => 
    dbCategories.map(cat => ({
      key: cat.key,
      label: cat.label,
      icon: iconMap[cat.icon] || Briefcase,
      modules: cat.modules.map(m => m.module_code),
    })),
    [dbCategories]
  );
  // Module title map for search (must be before early return)
  const moduleSearchTitles: Record<string, string[]> = useMemo(() => ({
    prospects: [t("module.prospects"), "prospects", "dashboard", "kanban", "atividades", "tarefas", "demandas", "ia analytics", "qa agent", "agente huggs"],
    comercial: [t("module.comercial"), "comercial", "painel executivo", "performance", "clientes", "produtos", "geográfico", "metas", "ibge", "mineração", "inteligência", "reativação", "mapa", "whitespace"],
    precos: [t("module.precos"), "preços", "matriz", "tabelas", "aprovação", "simulador", "portal"],
    trade: [t("module.trade"), "trade", "banners", "incentivos", "displays", "materiais", "aprovações", "pdvs", "visitas", "sellout", "shelf", "redes", "marcas", "fotos", "auditorias", "ranking", "performance", "whatsapp"],
    marketing: [t("module.marketing"), "marketing", "social", "whatsapp", "elevenlabs", "mission control"],
    design_studio: ["design studio", "stitch", "criação", "arte", "brand kit", "templates"],
    eventos: [t("module.eventos"), "eventos"],
    fabrica: [t("module.fabrica"), "fábrica", "recebimento", "matérias-primas", "fórmulas", "planejamento", "ordens", "apontamentos", "qualidade", "paradas", "máquinas", "operadores", "fiscal", "impostos", "produtos acabados"],
    china: ["fábrica china", "china", "submissão", "ordens de compra"],
    composicao: ["composição", "checklist"],
    amostras: ["amostras", "recebimento"],
    analise_embalagem: ["embalagem", "análise"],
    etiqueta_bula: ["etiqueta", "bula"],
    aprovacao_artes: ["aprovação de artes", "motor de artes", "fluxos"],
    financeiro: [t("module.financeiro"), "financeiro", "verbas", "extrato", "aprovações", "campanhas", "lançamentos", "contas a pagar", "contas a receber", "conciliação", "cobrança", "plano de contas", "fluxo de caixa", "dre", "classificação", "saldos", "investimentos", "fornecedores", "empresas", "centros de custo"],
    
    estoque: ["estoque", "distribuidoras", "produtos master", "saldos", "consolidado", "vinculações"],
    projetos: ["projetos", "inbox", "vincular china"],
    reunioes: ["reuniões"],
    processos: ["processos", "workflows", "etapas"],
  }), [t]);

  // Auto-open modules matching search (must be before early return)
  useEffect(() => {
    const s = searchQuery.toLowerCase().trim();
    if (!s) return;
    const matchingModules = Object.keys(moduleSearchTitles).filter(code => {
      const titles = moduleSearchTitles[code] || [code];
      return titles.some(t => t.toLowerCase().includes(s));
    });
    if (matchingModules.length > 0) {
      setOpenModules(prev => {
        const next = new Set(prev);
        matchingModules.forEach(m => next.add(m));
        return next;
      });
    }
  }, [searchQuery, moduleSearchTitles]);

  if (loading) {
    return (
      <Sidebar side={side}>
        <SidebarContent>
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </SidebarContent>
      </Sidebar>
    );
  }

  // ============ SUB-MENU DATA ============
  const prospectsSubMenus = [
    { title: t("nav.dashboard"), url: "/dashboard", icon: Home, screenCode: "dashboard" },
    { title: t("prospects.list"), url: "/dashboard/prospects/list", icon: Users, screenCode: "PROSPECTS_LISTA" },
    { title: t("prospects.kanban"), url: "/dashboard/prospects/kanban", icon: LayoutGrid, screenCode: "PROSPECTS_KANBAN" },
    { title: t("prospects.activities"), url: "/dashboard/prospects/atividades", icon: Activity, screenCode: "PROSPECTS_ATIVIDADES" },
    { title: t("prospects.tasks"), url: "/dashboard/tarefas", icon: CheckSquare, screenCode: "tarefas" },
    { title: t("prospects.demands"), url: "/dashboard/demandas", icon: Ticket, screenCode: "PROSPECTS_DEMANDAS" },
    { title: "IA Analytics", url: "/dashboard/ai-analytics", icon: Brain, screenCode: "ai_analytics" },
    { title: "QA Agent", url: "/dashboard/qa-agent", icon: Bot, screenCode: "ai_analytics" },
    { title: "Agente Huggs", url: "/dashboard/agente-huggs", icon: Sparkles, screenCode: "ai_analytics" },
  ];

  // Financeiro subgroups definition
  const financeiroTopItems = [
    { title: "Visão Geral", url: "/dashboard/financeiro", icon: Home, end: true, screenCode: "financeiro_dashboard" },
    { title: "Dashboard Consolidado", url: "/dashboard/financeiro/consolidado", icon: Layers, screenCode: "financeiro_dashboard" },
  ];

  const finSubgroups = [
    {
      key: "verbas",
      label: "Verbas e Investimentos",
      icon: TrendingUp,
      items: [
        { title: "Gestão de Verbas", url: "/dashboard/trade/financeiro", icon: Store, screenCode: "financeiro_verbas" },
        { title: "Meu Extrato", url: "/dashboard/trade/financeiro/extrato", icon: FileText, screenCode: "financeiro_verbas" },
        { title: "Aprovações", url: "/dashboard/trade/financeiro/aprovacoes", icon: ClipboardCheck, screenCode: "financeiro_verbas" },
        { title: "Verbas Semestrais", url: "/dashboard/trade/financeiro/verbas", icon: Calendar, screenCode: "financeiro_verbas" },
      ],
    },
    {
      key: "campanhas",
      label: "Campanhas e Lançamentos",
      icon: Megaphone,
      items: [
        { title: "Campanhas", url: "/dashboard/trade/financeiro/campanhas", icon: Megaphone, screenCode: "trade_admin" },
        { title: "Painel de Lançamentos", url: "/dashboard/trade/financeiro/lancamentos-campanhas", icon: FileText, screenCode: "trade_admin" },
        { title: "Contas Correntes", url: "/dashboard/trade/financeiro/contas", icon: Wallet, screenCode: "trade_admin" },
        { title: "Lançamentos", url: "/dashboard/trade/financeiro/lancamentos", icon: FileText, screenCode: "trade_admin" },
      ],
    },
    {
      key: "contas",
      label: "Contas a Pagar e Receber",
      icon: CreditCard,
      items: [
        { title: "Contas a Pagar", url: "/dashboard/financeiro/contas-a-pagar", icon: Receipt, screenCode: "financeiro_contas_pagar" },
        { title: "Painel AP Central", url: "/dashboard/financeiro/ap-central", icon: BarChart2, screenCode: "financeiro_contas_pagar", requireAdmin: true },
        { title: "Fila Exportação ERP", url: "/dashboard/financeiro/contas-a-pagar/exportacao-erp", icon: Upload, screenCode: "financeiro_contas_pagar", requireAdmin: true },
        { title: "Sync Cadastros AP", url: "/dashboard/financeiro/contas-a-pagar/sync-cadastros", icon: RefreshCw, screenCode: "financeiro_contas_pagar", requireAdmin: true },
        { title: "Conciliação Manual AP", url: "/dashboard/financeiro/contas-a-pagar/conciliacao", icon: Scale, screenCode: "financeiro_contas_pagar", requireAdmin: true },
        { title: "Contas a Receber", url: "/dashboard/financeiro/contas-a-receber", icon: DollarSign, screenCode: "financeiro_contas_receber" },
        { title: "Conciliação Bancária", url: "/dashboard/financeiro/conciliacao-bancaria", icon: Landmark, screenCode: "financeiro_saldos_bancarios" },
        { title: "Cobrança Inadimplentes", url: "/dashboard/financeiro/cobranca", icon: AlertTriangle, screenCode: "financeiro_contas_receber" },
        { title: "Plano de Contas", url: "/dashboard/financeiro/plano-contas", icon: List, screenCode: "financeiro_plano_contas" },
      ],
    },
    {
      key: "analises",
      label: "Análises e Relatórios",
      icon: BarChart2,
      items: [
        { title: "Fluxo de Caixa", url: "/dashboard/financeiro/fluxo-de-caixa", icon: TrendingUp, screenCode: "financeiro_fluxo_caixa" },
        { title: "DRE Analítico", url: "/dashboard/financeiro/dre-analitico", icon: FileText, screenCode: "financeiro_dre" },
        { title: "Visão Departamental", url: "/dashboard/financeiro/visao-departamentos", icon: Building2, screenCode: "financeiro_departamentos" },
        { title: "Classificação IA", url: "/dashboard/financeiro/classificar-banco", icon: Brain, screenCode: "financeiro_classificar" },
      ],
    },
  ];

  const finBottomItems = [
    { title: "Central de Pagamentos", url: "/dashboard/financeiro/central-pagamentos", icon: CreditCard, screenCode: "financeiro_contas_pagar" },
    { title: "Pagamentos", url: "/dashboard/pagamentos", icon: CreditCard, screenCode: "financeiro_pagamentos" },
    { title: "Contas Bancárias", url: "/dashboard/bancos", icon: Building2, screenCode: "financeiro_contas_bancarias" },
    { title: "Gestão Contas a Pagar", url: "/dashboard/contas-pagar", icon: FileText, screenCode: "financeiro_contas_pagar_gestao" },
    { title: "Saldos Bancários", url: "/dashboard/financeiro/saldos-bancarios", icon: Wallet, screenCode: "financeiro_saldos_bancarios" },
    { title: "Investimentos", url: "/dashboard/financeiro/investimentos", icon: TrendingUp, screenCode: "financeiro_saldos_bancarios" },
    { title: "Fornecedores", url: "/dashboard/fornecedores", icon: Users, screenCode: "financeiro_fornecedores" },
    { title: "Empresas", url: "/dashboard/empresas", icon: Building2, screenCode: "financeiro_empresas" },
    { title: "Centros de Custo", url: "/dashboard/centros-custo", icon: Layers, screenCode: "financeiro_centros_custo" },
  ];

  const tradeSubMenus = [
    // — Operacional —
    { title: t("trade.pdvs"), url: "/dashboard/trade/stores", icon: Store, screenCode: "trade_stores" },
    { title: "Redes", url: "/dashboard/trade/store-chains", icon: Network, screenCode: "trade_stores" },
    { title: t("trade.visits"), url: "/dashboard/trade/visits", icon: Calendar, screenCode: "trade_visits" },
    { title: "Calendário", url: "/dashboard/trade/calendar", icon: Calendar, screenCode: "trade_calendar" },
    { title: t("trade.photos"), url: "/dashboard/trade/photos", icon: Camera, screenCode: "trade_photos" },
    { title: t("trade.ideal_photos"), url: "/dashboard/trade/ideal-photos", icon: Image, screenCode: "trade_ideal_photos" },
    { title: t("trade.sellout"), url: "/dashboard/trade/sellout", icon: DollarSign, screenCode: "trade_sellout" },
    { title: t("trade.shelf"), url: "/dashboard/trade/shelf-measurements", icon: Activity, screenCode: "trade_shelf" },
    { title: t("trade.audit"), url: "/dashboard/trade/auditorias", icon: ClipboardCheck, screenCode: "trade_auditorias" },
    { title: t("trade.brands"), url: "/dashboard/trade/our-brands", icon: Tag, screenCode: "trade_brands" },
    { title: t("trade.competitive"), url: "/dashboard/trade/relatorio-competitivo", icon: BarChart3, screenCode: "trade_competitors", requireAdminOrSupervisor: true },
    { title: "Comparação Produtos", url: "/dashboard/trade/comparacao-produtos", icon: Scale, screenCode: "trade_competitors", requireAdminOrSupervisor: true },
    { title: "Catálogo Materiais", url: "/dashboard/trade/materiais", icon: Package, screenCode: "trade_materiais" },
    { title: "Minhas Solicitações", url: "/dashboard/trade/minhas-solicitacoes", icon: ClipboardCheck, screenCode: "trade_solicitacoes" },
    { title: t("trade.rewards"), url: "/dashboard/trade/rewards", icon: Trophy, screenCode: "trade_rewards" },
    { title: t("trade.whatsapp"), url: "/dashboard/trade/whatsapp", icon: MessageSquare, screenCode: "trade_whatsapp" },
    // — Performance —
    { title: "separator", url: "", icon: TrendingUp, screenCode: "", isSeparator: true, separatorLabel: "Performance" },
    { title: t("trade.my_team"), url: "/dashboard/trade/minha-equipe", icon: Users, screenCode: "trade_equipe", requireAdminOrSupervisor: true },
    { title: "Performance", url: "/dashboard/trade/performance", icon: TrendingUp, screenCode: "trade_performance", requireAdminOrSupervisor: true },
    { title: "Equipe Performance", url: "/dashboard/trade/team-performance", icon: UserCheck, screenCode: "trade_performance", requireAdminOrSupervisor: true },
    { title: "Ranking", url: "/dashboard/ranking", icon: Trophy, screenCode: "trade_ranking", requireAdminOrSupervisor: true },
    { title: "Promoções", url: "/dashboard/trade/promotions", icon: Megaphone, screenCode: "trade_promotions", requireAdminOrSupervisor: true },
    { title: t("trade.ai_insights"), url: "/dashboard/trade/insights", icon: Sparkles, screenCode: "trade_insights", requireAdminOrSupervisor: true },
    // — Admin & Financeiro —
    { title: "separator", url: "", icon: Settings, screenCode: "", isSeparator: true, separatorLabel: "Administração" },
    { title: t("trade.admin"), url: "/dashboard/trade/admin", icon: Settings, screenCode: "trade_admin" },
    { title: "Banners", url: "/dashboard/trade/admin/banners", icon: Image, screenCode: "trade_admin" },
    { title: "Incentivos", url: "/dashboard/trade/admin/incentivos", icon: Trophy, screenCode: "trade_admin" },
    { title: "Catálogo Displays", url: "/dashboard/trade/admin/displays", icon: Package, screenCode: "trade_admin" },
    { title: "Catálogo Materiais (Admin)", url: "/dashboard/trade/admin/materiais", icon: Package, screenCode: "trade_admin" },
    { title: "Importar Lojas", url: "/dashboard/trade/import-stores", icon: Upload, screenCode: "trade_import", requireAdminOrSupervisor: true },
    { title: "Central de Aprovações", url: "/dashboard/trade/aprovacoes", icon: Shield, screenCode: "trade_admin" },
    { title: "Visão Executiva", url: "/dashboard/trade/admin/executivo", icon: BarChart2, screenCode: "trade_admin", requireAdminOrSupervisor: true },
  ];

  const marketingSubMenus = [
    { title: "Visão geral orgânica", url: "/dashboard/marketing/visao-geral", icon: BarChart3, screenCode: "MARKETING_SOCIAL" },
    { title: t("marketing.dashboards"), url: "/dashboard/marketing/social", icon: BarChart3, screenCode: "MARKETING_SOCIAL" },
    { title: "WhatsApp", url: "/dashboard/marketing/whatsapp", icon: MessageSquare, screenCode: "MARKETING_SOCIAL" },
    { title: "ElevenLabs Studio", url: "/dashboard/marketing/elevenlabs", icon: Mic, screenCode: "MARKETING_SOCIAL" },
    { title: "Mission Control", url: "/dashboard/marketing/mission-control", icon: Target, screenCode: "MARKETING_SOCIAL" },
    { title: "Redes Sociais", url: "/dashboard/marketing/redes-sociais", icon: Share2, screenCode: "MARKETING_SOCIAL" },
  ];

  const precosSubMenus = [
    { title: t("precos.dashboard"), url: "/dashboard/precos", icon: Home, end: true, screenCode: "precos_dashboard" },
    { title: t("precos.matrix"), url: "/dashboard/precos/matriz", icon: Grid3X3, screenCode: "precos_matriz" },
    { title: t("precos.manage"), url: "/dashboard/precos/tabelas", icon: Receipt, screenCode: "precos_tabelas" },
    { title: t("precos.approval"), url: "/dashboard/precos/aprovacao", icon: CheckSquare, screenCode: "precos_aprovacao" },
    { title: "Simulador", url: "/dashboard/precos/simulador", icon: Activity, screenCode: "precos_simulador" },
    { title: t("precos.client_portal"), url: "/dashboard/precos/portal-cliente", icon: Users, screenCode: "precos_portal" },
    { title: t("precos.access_control"), url: "/dashboard/precos/acesso", icon: Shield, screenCode: "precos_acesso" },
  ];

  // Search query normalization
  const sq = searchQuery.toLowerCase().trim();

  // Check if a module matches the search query
  const moduleMatchesSearch = (moduleCode: string): boolean => {
    if (!sq) return true;
    const titles = moduleSearchTitles[moduleCode] || [moduleCode];
    return titles.some(t => t.toLowerCase().includes(sq));
  };

  // Helper to count visible sub-items for a module
  const getSubItemCount = (moduleCode: string): number => {
    const filterItems = (items: { screenCode?: string; requireAdminOrSupervisor?: boolean; title: string }[]) =>
      items.filter(i => (!i.screenCode || hasPermission(i.screenCode)) && (!('requireAdminOrSupervisor' in i) || !i.requireAdminOrSupervisor || isAdminOrSupervisor));
    
    switch (moduleCode) {
      case "prospects": return filterItems(prospectsSubMenus).length + (hasPermission("PROSPECTS_DASHBOARD") ? 1 : 0);
      case "trade": return filterItems(tradeSubMenus.filter(i => !i.isSeparator)).length + (hasPermission("trade_marketing") ? 1 : 0);
      case "marketing": return isAdmin
        ? filterItems(marketingSubMenus).length + (hasPermission("MARKETING_DASHBOARD") ? 1 : 0) + 1
        : 1;
      case "design_studio": return 5;
      case "precos": return filterItems(precosSubMenus).length;
      case "fabrica": {
        let c = hasPermission("fabrica_dashboard") ? 1 : 0;
        fabricaGroups.forEach(g => { c += g.items.filter(i => isAdmin || hasPermission(i.screenCode)).length; });
        return c;
      }
      case "financeiro": {
        let c = financeiroTopItems.filter(i => hasPermission(i.screenCode)).length;
        finSubgroups.forEach(sg => { c += sg.items.filter(i => hasPermission(i.screenCode) && (!('requireAdmin' in i) || !i.requireAdmin || isAdmin)).length; });
        c += finBottomItems.filter(i => hasPermission(i.screenCode)).length;
        return c;
      }
      case "comercial": return 15; // large module
      case "china": return 4;
      case "estoque": return 6;
      case "projetos": return 3 + (isAdmin || userDepartments.some(d => d.id === '9937b2ff-bb1d-4f92-9d8b-4b3c0c7ad130') ? 2 : 0) + (isAdminOrSupervisor ? 1 : 0);
      case "processos": return 3;
      case "eventos": return (hasPermission("eventos_dashboard") ? 1 : 0) + (hasPermission("eventos_analytics") ? 1 : 0);
      case "aprovacao_artes": return 3;
      case "fornecedor_vendas": return 6;
      default: return 0;
    }
  };


  // ============ MODULE RENDERERS — Popover (desktop) / Drawer (mobile) ============
  const renderModuleContent = (moduleCode: string) => {
    const isModuleOpen = openModules.has(moduleCode);

    // Responsive wrapper: Popover on desktop, Drawer on mobile
    const ModuleSubmenu = ({ icon, title, colorKey, children, count }: {
      icon: React.ElementType;
      title: string;
      colorKey?: keyof typeof moduleColors;
      children: React.ReactNode;
      count?: number;
    }) => {
      const headerEl = (
        <ModuleHeader icon={icon} title={title} isOpen={isModuleOpen} colorKey={colorKey} subItemCount={count ?? getSubItemCount(moduleCode)} />
      );

      const menuContent = (
        <SidebarMenu className="space-y-0.5">
          {children}
        </SidebarMenu>
      );

      if (isMobile) {
        return (
          <Drawer open={isModuleOpen} onOpenChange={(open) => setModuleOpen(moduleCode, open)}>
            <DrawerTrigger asChild>
              <button
                className="w-full text-left"
                onMouseEnter={() => { (MODULE_LOADERS as any)[moduleCode]?.().catch(() => {}); }}
                onFocus={() => { (MODULE_LOADERS as any)[moduleCode]?.().catch(() => {}); }}
              >
                {headerEl}
              </button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <DrawerTitle className="text-sm font-semibold">{title}</DrawerTitle>
                  <button onClick={() => setModuleOpen(moduleCode, false)} className="rounded-sm p-1 opacity-70 hover:opacity-100 transition-opacity">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </DrawerHeader>
              <ScrollArea className="max-h-[60vh] px-4 pb-6">
                {menuContent}
              </ScrollArea>
            </DrawerContent>
          </Drawer>
        );
      }

      return (
        <Popover open={isModuleOpen} onOpenChange={(open) => setModuleOpen(moduleCode, open)}>
          <PopoverTrigger asChild>
            <button
              className="w-full text-left"
              onMouseEnter={() => { (MODULE_LOADERS as any)[moduleCode]?.().catch(() => {}); }}
              onFocus={() => { (MODULE_LOADERS as any)[moduleCode]?.().catch(() => {}); }}
            >
              {headerEl}
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="right"
            align="start"
            sideOffset={8}
            className="w-64 p-2 max-h-[70vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between px-2 pb-2 mb-1 border-b border-border">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</span>
              <button onClick={() => setModuleOpen(moduleCode, false)} className="rounded-sm p-1 opacity-70 hover:opacity-100 transition-opacity">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {menuContent}
          </PopoverContent>
        </Popover>
      );
    };

    switch (moduleCode) {
      case "prospects":
        return (
          <ModuleSubmenu icon={Users} title={t("module.prospects")} colorKey="prospects">
            {hasPermission("PROSPECTS_DASHBOARD") && (
              <MenuItemLink to="/dashboard/prospects" icon={Home} title={t("prospects.overview")} colorKey="prospects" end />
            )}
            {prospectsSubMenus.filter(i => hasPermission(i.screenCode)).map(item => (
              <MenuItemLink key={item.url} to={item.url} icon={item.icon} title={item.title} colorKey="prospects" />
            ))}
          </ModuleSubmenu>
        );

      case "comercial": {
        const comercialItems = [
          { url: "/dashboard/comercial", icon: Home, title: t("comercial.dashboard"), screenCode: "comercial_dashboard", end: true },
          { url: "/dashboard/comercial/lancamentos", icon: Rocket, title: t("comercial.launches"), screenCode: "comercial_lancamentos" },
          { url: "/dashboard/painel-executivo", icon: BarChart3, title: "Painel Executivo", screenCode: "ci_executivo" },
          { url: "/dashboard/performance-vendas", icon: TrendingUp, title: "Performance Vendas", screenCode: "ci_performance" },
          { url: "/dashboard/clientes", icon: Users, title: "Análise Clientes", screenCode: "ci_clientes" },
          { url: "/dashboard/detalhamento", icon: FileText, title: "Detalhamento", screenCode: "ci_consolidado" },
          { url: "/dashboard/produtos", icon: Package, title: "Análise Produtos", screenCode: "ci_produtos" },
          { url: "/dashboard/geografico", icon: MapPin, title: "Análise Geográfico", screenCode: "ci_geografico" },
          { url: "/dashboard/consolidado", icon: Layers, title: "Consolidado", screenCode: "ci_consolidado" },
          { url: "/dashboard/metas", icon: Target, title: "Metas e Projeções", screenCode: "ci_metas" },
          { url: "/dashboard/comercial/ibge", icon: MapPin, title: t("comercial.ibge"), screenCode: "comercial_ibge" },
          { url: "/dashboard/comercial/mineracao", icon: Pickaxe, title: t("comercial.mining"), screenCode: "comercial_mineracao" },
          { url: "/dashboard/comercial/inteligencia", icon: Brain, title: "Inteligência de Mercado", screenCode: "comercial_inteligencia" },
          { url: "/dashboard/comercial/reativacao", icon: AlertTriangle, title: t("comercial.reactivation"), screenCode: "comercial_reativacao" },
          { url: "/dashboard/comercial/mapa", icon: MapPin, title: "Mapa Comercial", screenCode: "comercial_mapa" },
          { url: "/dashboard/comercial/municipios-inteligencia", icon: Building2, title: t("comercial.municipalities"), screenCode: "comercial_municipios" },
          { url: "/dashboard/comercial/whitespace", icon: Compass, title: t("comercial.whitespace"), screenCode: "comercial_whitespace" },
        ];
        const visible = comercialItems.filter(i => hasPermission(i.screenCode));
        if (visible.length === 0) return null;
        return (
          <ModuleSubmenu icon={Briefcase} title={t("module.comercial")} colorKey="comercial">
            {visible.map(item => (
              <MenuItemLink key={item.url} to={item.url} icon={item.icon} title={item.title} colorKey="comercial" end={item.end} />
            ))}
          </ModuleSubmenu>
        );
      }


      case "precos":
        return (
          <ModuleSubmenu icon={DollarSign} title={t("module.precos")} colorKey="precos">
            {precosSubMenus.filter(i => hasPermission(i.screenCode)).map(item => (
              <MenuItemLink 
                key={item.url} to={item.url} icon={item.icon} title={item.title} colorKey="precos" end={item.end}
                badge={item.title === "Aprovação" && tabelasPendentes > 0 ? (
                  <Badge className="ml-auto bg-warning text-warning-foreground text-xs h-5 min-w-5 flex items-center justify-center">{tabelasPendentes}</Badge>
                ) : undefined}
              />
            ))}
          </ModuleSubmenu>
        );

      case "trade":
        return (
          <ModuleSubmenu icon={Store} title={t("module.trade")} colorKey="trade">
            {hasPermission("trade_marketing") && (
              <MenuItemLink to="/dashboard/trade" icon={Home} title={t("prospects.overview")} colorKey="trade" end />
            )}
            {tradeSubMenus.filter(i => i.isSeparator || (hasPermission(i.screenCode) && (!i.requireAdminOrSupervisor || isAdminOrSupervisor))).map((item, idx) => 
              item.isSeparator ? (
                <div key={`sep-${idx}`} className="pt-3 pb-1 px-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">{item.separatorLabel}</p>
                </div>
              ) : (
                <MenuItemLink key={item.url} to={item.url} icon={item.icon} title={item.title} colorKey="trade" />
              )
            )}
          </ModuleSubmenu>
        );

      case "marketing":
        return (
          <ModuleSubmenu icon={BarChart3} title={t("module.marketing")} colorKey="marketing">
            <MenuItemLink
              to="/dashboard/marketing/influencers"
              icon={Users}
              title="Influenciadores"
              colorKey="marketing"
            />
            {isAdmin && hasPermission("MARKETING_DASHBOARD") && (
              <MenuItemLink to="/dashboard/marketing" icon={Home} title={t("marketing.overview")} colorKey="marketing" end />
            )}
            {isAdmin && marketingSubMenus.filter(i => hasPermission(i.screenCode)).map(item => (
              <MenuItemLink key={item.url} to={item.url} icon={item.icon} title={item.title} colorKey="marketing" />
            ))}
          </ModuleSubmenu>
        );

      case "design_studio":
        return (
          <ModuleSubmenu icon={Wand2} title="Design Studio" colorKey="marketing">
            <MenuItemLink to="/dashboard/design-studio" icon={Wand2} title="Gerar Design" colorKey="marketing" end />
            <MenuItemLink to="/dashboard/design-studio?tab=templates" icon={LayoutGrid} title="Templates" colorKey="marketing" />
            <MenuItemLink to="/dashboard/design-studio?tab=galeria" icon={Image} title="Galeria" colorKey="marketing" />
            <MenuItemLink to="/dashboard/design-studio?tab=brandkit" icon={Palette} title="Brand Kit" colorKey="marketing" />
            <MenuItemLink to="/dashboard/design-studio?tab=versoes" icon={GitCompare} title="Versões" colorKey="marketing" />
          </ModuleSubmenu>
        );

      case "eventos":
        return (
          <ModuleSubmenu icon={PartyPopper} title={t("module.eventos")} colorKey="eventos">
            {hasPermission("eventos_dashboard") && (
              <MenuItemLink to="/dashboard/eventos" icon={Home} title={t("eventos.events")} colorKey="eventos" end />
            )}
            {hasPermission("eventos_analytics") && (
              <MenuItemLink to="/dashboard/eventos/dashboard" icon={BarChart3} title={t("eventos.dashboard")} colorKey="eventos" />
            )}
          </ModuleSubmenu>
        );

      case "fabrica":
        return (
          <ModuleSubmenu icon={Factory} title={t("module.fabrica")} colorKey="fabrica">
            {hasPermission("fabrica_dashboard") && (
              <MenuItemLink to="/dashboard/fabrica" icon={Home} title={t("fabrica.dashboard")} colorKey="fabrica" end />
            )}
            <MenuItemLink to="/dashboard/compras-nacionais" icon={ShoppingCart} title="Compras Nacionais" colorKey="fabrica" />
            {fabricaGroups.map(group => {
              const filteredItems = group.items.filter(item => isAdmin || hasPermission(item.screenCode));
              if (filteredItems.length === 0) return null;
              return (
                <div key={group.label} className="mt-2 first:mt-0">
                  <span className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {group.label}
                  </span>
                  {filteredItems.map(item => (
                    <MenuItemLink key={item.url} to={item.url} icon={item.icon} title={item.title} colorKey="fabrica" />
                  ))}
                </div>
              );
            })}
          </ModuleSubmenu>
        );

      case "china": {
        const chinaItems = [
          { url: "/dashboard/fabrica-china", icon: Home, title: "Painel 面板", screenCode: "china_dashboard", end: true },
          { url: "/dashboard/fabrica-china/nova", icon: Upload, title: "Nova Submissão 新提交", screenCode: "china_submissoes" },
          { url: "/dashboard/fabrica-china/recebimentos", icon: Package, title: "Submissões 提交", screenCode: "china_submissoes" },
          { url: "/dashboard/fabrica-china/ordens-producao", icon: Factory, title: "Ordens de Produção 生产订单", screenCode: "china_ordens_producao" },
        ];
        const visible = chinaItems.filter(i => hasPermission(i.screenCode));
        const showInbox = isAdmin || hasPermission("compras_inbox_comprador");
        if (visible.length === 0 && !showInbox) return null;
        return (
          <ModuleSubmenu icon={Globe} title="Fábrica China 中国工厂" colorKey="china">
            <ChinaInboxSidebarItem colorKey="china" />
            {showInbox && (
              <MenuItemLink to="/dashboard/compras-internacionais/inbox" icon={Inbox} title="Inbox do Comprador 采购员收件箱" colorKey="china" />
            )}
            {visible.map((item, idx) => (
              <MenuItemLink key={item.url} to={item.url} icon={item.icon} title={item.title} colorKey="china" end={item.end} />
            ))}
          </ModuleSubmenu>
        );
      }


      case "composicao": {
        if (!hasPermission("composicao_checklist")) return null;
        return (
          <ModuleSubmenu icon={FlaskConical} title="Composição" colorKey="fabrica">
            <MenuItemLink to="/dashboard/central/composicao" icon={Inbox} title="Central da Equipe" colorKey="fabrica" end />
            <MenuItemLink to="/dashboard/composicao" icon={FlaskConical} title="Checklist INCI" colorKey="fabrica" end />
            {isAdmin && (
              <MenuItemLink to="/dashboard/composicao/sync" icon={RefreshCw} title="Sync ERP" colorKey="fabrica" end />
            )}
          </ModuleSubmenu>
        );
      }

      case "amostras": {
        if (!hasPermission("amostras_recebimento")) return null;
        return (
          <ModuleSubmenu icon={Package} title="Amostras" colorKey="fabrica">
            <MenuItemLink to="/dashboard/central/amostras" icon={Inbox} title="Central da Equipe" colorKey="fabrica" end />
            <MenuItemLink to="/dashboard/amostras" icon={Package} title="Recebimentos" colorKey="fabrica" end />
          </ModuleSubmenu>
        );
      }

      case "analise_embalagem": {
        if (!hasPermission("embalagem_analise")) return null;
        return (
          <ModuleSubmenu icon={Layers} title="Embalagem" colorKey="fabrica">
            <MenuItemLink to="/dashboard/central/embalagens" icon={Inbox} title="Central da Equipe" colorKey="fabrica" end />
            <MenuItemLink to="/dashboard/analise-embalagem" icon={Layers} title="Análises" colorKey="fabrica" end />
          </ModuleSubmenu>
        );
      }

      case "etiqueta_bula": {
        if (!hasPermission("etiqueta_checklist")) return null;
        return (
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink to="/dashboard/etiqueta-bula" className={({ isActive }) => cn(
                "relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150",
                isActive ? "font-semibold bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))]" : "text-[var(--sidebar-text-hover-raw)] hover:bg-[var(--sidebar-hover-raw)]"
              )}>
                <Tag className="h-5 w-5 text-[var(--sidebar-text-muted-raw)]" />
                <span className="flex-1 font-semibold text-[14px]">Etiqueta / Bula</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      }

      case "aprovacao_artes": {
        const artesItems = [
          { url: "/dashboard/central/motor-artes", icon: Inbox, title: "Central da Equipe", screenCode: "aprovacao_artes_lista" },
          { url: "/dashboard/fluxo-artes", icon: Palette, title: "Motor de Artes", screenCode: "aprovacao_artes_lista" },
          { url: "/dashboard/aprovacao-artes", icon: ClipboardCheck, title: "Fluxos Legado", screenCode: "aprovacao_artes_lista" },
          { url: "/dashboard/aprovacao-artes/configuracao", icon: Cog, title: "Configuração", screenCode: "aprovacao_artes_config" },
        ];
        const visible = artesItems.filter(i => hasPermission(i.screenCode));
        if (visible.length === 0) return null;
        return (
          <ModuleSubmenu icon={Palette} title="Aprovação de Artes" colorKey="fabrica">
            {visible.map(item => (
              <MenuItemLink key={item.url} to={item.url} icon={item.icon} title={item.title} colorKey="fabrica" end />
            ))}
          </ModuleSubmenu>
        );
      }


      case "financeiro":
        return (
          <ModuleSubmenu icon={DollarSign} title={t("module.financeiro")} colorKey="financeiro">
            {/* Top-level items */}
            {financeiroTopItems.filter(i => hasPermission(i.screenCode)).map(item => (
              <MenuItemLink key={item.url} to={item.url} icon={item.icon} title={item.title} colorKey="financeiro" end={item.end} />
            ))}

            {/* Subgroups with collapsible inside submenu */}
            {finSubgroups.map(sg => {
              const visibleItems = sg.items.filter(i => hasPermission(i.screenCode) && (!('requireAdmin' in i) || !i.requireAdmin || isAdmin));
              if (visibleItems.length === 0) return null;
              const isSgOpen = openFinSubgroups.has(sg.key);
              return (
                <div key={sg.key} className="mt-1.5">
                  <Collapsible open={isSgOpen} onOpenChange={() => {
                    setOpenFinSubgroups(prev => {
                      const next = new Set(prev);
                      if (next.has(sg.key)) next.delete(sg.key);
                      else next.add(sg.key);
                      return next;
                    });
                  }}>
                    <CollapsibleTrigger className="w-full">
                      <div className={cn(
                        "flex items-center gap-2 w-full px-2 py-1.5 rounded-md transition-all duration-150 text-[11px]",
                        "hover:bg-muted/50",
                        isSgOpen && "bg-muted/50"
                      )}>
                        <sg.icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-semibold uppercase tracking-wider text-muted-foreground flex-1 text-left">
                          {sg.label}
                        </span>
                        <ChevronRight className={cn(
                          "h-3 w-3 text-muted-foreground transition-transform duration-200",
                          isSgOpen && "rotate-90"
                        )} />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ps-2 space-y-0.5 mt-0.5">
                        {visibleItems.map(item => (
                          <MenuItemLink key={item.url} to={item.url} icon={item.icon} title={item.title} colorKey="financeiro" />
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              );
            })}

            {/* Bottom standalone items */}
            {finBottomItems.filter(i => hasPermission(i.screenCode)).map(item => (
              <MenuItemLink key={item.url} to={item.url} icon={item.icon} title={item.title} colorKey="financeiro" />
            ))}
          </ModuleSubmenu>
        );

      // case "departamentos" removido: itens duplicavam os módulos próprios da sidebar.



      case "fornecedor_vendas":
        return (
          <>
            <ModuleSubmenu icon={Truck} title="Vendas Futura Fornecedor" colorKey="comercial">
              <MenuItemLink to="/dashboard/fornecedor" icon={LayoutDashboard} title="Visão geral" end />
              <MenuItemLink to="/dashboard/fornecedor/vendas" icon={BarChart3} title="Resultados de Vendas" />
              <MenuItemLink to="/dashboard/fornecedor/produtos" icon={Package} title="Vendas por produto" />
              <MenuItemLink to="/dashboard/fornecedor/analises" icon={BarChart2} title="Análises" />
              <MenuItemLink to="/dashboard/fornecedor/pedidos" icon={ClipboardList} title="Pedidos em andamento" />
              <MenuItemLink to="/dashboard/fornecedor/clientes" icon={Users} title="Clientes" />
            </ModuleSubmenu>
            <ModuleSubmenu icon={Truck} title="Vendas Result Union" colorKey="comercial">
              <MenuItemLink to="/dashboard/fornecedor/pedidos-result" icon={ClipboardList} title="Pedidos em andamento" />
            </ModuleSubmenu>
          </>
        );

      case "estoque":
        return (
          <ModuleSubmenu icon={Package} title="Estoque" colorKey="financeiro">
            <MenuItemLink to="/dashboard/estoque" icon={Home} title="Painel" end />
            <MenuItemLink to="/dashboard/estoque/visao-geral" icon={BarChart3} title="Visão de Estoque" />
            <MenuItemLink to="/dashboard/estoque/valores-por-filial" icon={Building2} title="Valores por Filial" />
            <MenuItemLink to="/dashboard/estoque/unificado" icon={Layers} title="Estoque Unificado (3 níveis)" />
            <MenuItemLink to="/dashboard/estoque/cores" icon={Layers} title="Estoque por Cor (Unidades)" />
            <MenuItemLink to="/dashboard/estoque/etiquetas" icon={Layers} title="Etiquetas de Campanha" />
            <MenuItemLink to="/dashboard/estoque/auditoria-drift" icon={Layers} title="Auditoria Drift vs ERP" />
            <MenuItemLink to="/dashboard/estoque/distribuidoras" icon={Building2} title="Distribuidoras" />
            <MenuItemLink to="/dashboard/estoque/produtos-master" icon={Package} title="Produtos Master" />
            <MenuItemLink to="/dashboard/estoque/saldos" icon={Layers} title="Saldos" />
            <MenuItemLink to="/dashboard/estoque/consolidado" icon={BarChart3} title="Consolidado" />
            <MenuItemLink to="/dashboard/estoque/vinculacoes" icon={Send} title="Vinculações" />
            <MenuItemLink to="/dashboard/estoque/fornecedor" icon={Package} title="Estoque Fornecedor" />
            {isAdmin && (
              <>
                <MenuItemLink to="/dashboard/estoque/fornecedor-depara" icon={LinkIcon} title="De-Para EAN Fornecedor" />
                <MenuItemLink to="/dashboard/estoque/sync-erp" icon={RefreshCw} title="Sync ERP" />
              </>
            )}
          </ModuleSubmenu>
        );

      case "projetos":
        return (
          <ModuleSubmenu icon={FolderKanban} title="Projetos" colorKey="comercial">
            {isAdmin && (
              <MenuItemButton
                icon={Inbox}
                title="Caixa de Entrada"
                onClick={openInboxDrawer}
                badge={inboxCounts.acao_minha > 0 ? (
                  <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[9px]">
                    {inboxCounts.acao_minha > 9 ? "9+" : inboxCounts.acao_minha}
                  </Badge>
                ) : undefined}
              />
            )}
            {hasPermission("projetos_aprovacoes_central") && (
              <MenuItemLink to="/dashboard/central/aprovacoes" icon={Shield} title="Central de Aprovações" />
            )}
            {isAdmin && hasPermission("projetos_aprovacoes_auditoria") && (
              <MenuItemLink to="/dashboard/projetos/aprovacoes/auditoria" icon={Shield} title="Auditoria de Aprovações" />
            )}
            {(isAdmin || hasPermission("projetos_minhas_tarefas")) && (
              <MenuItemLink to="/dashboard/projetos/minhas-tarefas" icon={CheckSquare} title="Minhas tarefas" />
            )}
            {(isAdmin || hasPermission("projetos_home")) && (
              <MenuItemLink to="/dashboard/projetos/central" icon={Home} title="Central de Trabalho" />
            )}
            {(isAdmin || hasPermission("projetos_dashboard")) && (
              <MenuItemLink to="/dashboard/projetos" icon={FolderKanban} title="Meus Projetos" end />
            )}

            {isAdmin && (
              <>
                <MenuItemLink to="/dashboard/projetos/vincular-china" icon={Globe} title="Vincular China" />
                <MenuItemLink to="/dashboard/projetos/produto-brasil" icon={Package} title="Produtos Importados" />
              </>
            )}
            <MenuItemLink to="/dashboard/projetos/modelos" icon={Layers} title="Modelos de Projeto" />
            {(canSeeProjetosRelatorios({ isAdmin, isAdminOrSupervisor }) || hasPermission("projetos_equipe")) && (
              <MenuItemLink to="/dashboard/projetos/minha-equipe" icon={Users} title="Minha Equipe" />
            )}
            {(canSeeProjetosRelatorios({ isAdmin, isAdminOrSupervisor }) || hasPermission("projetos_equipe")) && (
              <MenuItemLink to="/dashboard/projetos/relatorios" icon={BarChart3} title="Relatórios" />
            )}
            {(isAdmin || hasPermission("briefings_agente")) && (
              <MenuItemLink to="/dashboard/briefings" icon={Sparkles} title="Briefings" />
            )}
            {isAdmin && (
              <MenuItemLink to="/dashboard/controladoria" icon={PackageSearch} title="Controladoria" />
            )}
            <MenuItemLink to="/dashboard/rr-tasks" icon={KanbanSquare} title="RR-Tasks" />
          </ModuleSubmenu>
        );

      case "reunioes": {
        if (!hasPermission("reunioes_lista") && !hasPermission("reunioes_dashboard")) return null;
        return (
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink to="/dashboard/reunioes" className={({ isActive }) => cn(
                "relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150",
                isActive ? "font-semibold bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))]" : "text-[var(--sidebar-text-hover-raw)] hover:bg-[var(--sidebar-hover-raw)]"
              )}>
                <Mic className="h-5 w-5 text-[var(--sidebar-text-muted-raw)]" />
                <span className="flex-1 font-semibold text-[14px]">Reuniões</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      }

      case "processos": {
        const procItems = [
          { url: "/dashboard/processos/consulta", icon: Scale, title: "Consulta de Processos", screenCode: "processos_consulta" },
          { url: "/dashboard/processos/etapas", icon: Settings, title: "Configurar Etapas", screenCode: "processos_etapas" },
          { url: "/dashboard/processos/workflows", icon: Layers, title: "Workflows Documentais", screenCode: "processos_workflows" },
        ];
        const visible = procItems.filter(i => hasPermission(i.screenCode));
        if (visible.length === 0 && !isAdmin) return null;
        return (
          <ModuleSubmenu icon={Scale} title="Processos" colorKey="comercial">
            {visible.map(item => (
              <MenuItemLink key={item.url} to={item.url} icon={item.icon} title={item.title} colorKey="comercial" end />
            ))}
            {isAdmin && (
              <>
                <MenuItemLink to="/dashboard/processos/perfis" icon={Workflow} title="Perfis de Processo" end />
                <MenuItemLink to="/dashboard/processos/perfis/novo" icon={Workflow} title="Novo Perfil (Wizard)" end />
                <MenuItemLink to="/dashboard/processos/etapas-gerenciamento" icon={Layers} title="Gerenciar Etapas" end />
                <MenuItemLink to="/dashboard/processos/modulos-catalogo" icon={Layers} title="Catálogo de Módulos" end />
              </>
            )}
          </ModuleSubmenu>
        );
      }


      default:
        return null;
    }
  };




  return (
    <Sidebar side={side} collapsible="icon" className={cn("border-none", isRTL ? "border-l" : "border-r")} style={{ borderRight: '1px solid var(--sidebar-border-raw)' }}>

      {/* Module filter */}
      {moduleFilterOptions.length > 1 && (
        <div className="px-3 py-2" style={{ backgroundColor: 'var(--sidebar-bg-raw)', borderBottom: '1px solid var(--sidebar-border-raw)' }}>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="w-full h-9 justify-between text-xs text-[var(--sidebar-text-raw)] hover:text-[var(--sidebar-text-hover-raw)]"
                style={{ borderColor: 'var(--sidebar-border-raw)', backgroundColor: 'var(--sidebar-item-hover-raw)' }}
              >
                <span className="truncate">{filterLabel}</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start" side="bottom">
              <div className="space-y-1">
                <button
                  onClick={() => setSelectedModules(new Set())}
                  className={cn(
                    "flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md transition-colors",
                    selectedModules.size === 0
                      ? "bg-accent text-accent-foreground font-medium"
                      : "hover:bg-muted"
                  )}
                >
                  {t("nav.all_modules")}
                </button>
                <Separator />
                {moduleFilterOptions.map((m) => (
                  <label
                    key={m.code}
                    className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedModules.has(m.code)}
                      onCheckedChange={() => toggleModule(m.code)}
                      className="h-3.5 w-3.5"
                    />
                    <m.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{m.label}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Quick search */}
      <div className="px-3 py-2" style={{ backgroundColor: 'var(--sidebar-bg-raw)', borderBottom: '1px solid var(--sidebar-border-raw)' }}>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar menu..."
            className="h-8 pl-8 text-xs bg-[var(--sidebar-item-hover-raw)] border-[var(--sidebar-border-raw)]"
          />
        </div>
      </div>

      <SidebarContent className="scrollbar-thin relative">
        {/* Central de Inteligência foi unificada dentro do módulo Comercial */}


        {/* Geral — Instalar App sempre visível (rota genérica); demais itens dependem de permissão */}
        <SidebarGroup className="py-1">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5 px-2">
              {(isAdmin || moduleFilterOptions.some(m => m.code !== "integracao_erp")) && (
                <>
                  {(isAdmin || hasPermission("relatorios")) && (
                    <MenuItemLink to="/dashboard/relatorios" icon={BarChart3} title="Relatórios" />
                  )}
                  <MenuItemLink to="/dashboard/chat" icon={MessageCircle} title="Chat" />
                  <MenuItemLink to="/dashboard/chat/aprovacoes" icon={Inbox} title="Aprovações do Chat" />
                  {/* Suporte v2 (piloto) — visível só com a flag ff_suporte_v2 */}
                  {isSuporteV2Enabled() && (
                    <>
                      <MenuItemLink to="/dashboard/suporte" icon={LifeBuoy} title="Suporte" />
                      <MenuItemLink to="/dashboard/suporte/desk" icon={Headset} title="Desk de Suporte" />
                    </>
                  )}
                </>
              )}
              <MenuItemLink to="/dashboard/instalar-app" icon={needRefresh ? RefreshCw : Download} title={needRefresh ? "Atualizar App" : t("nav.install_app")} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>


        <Separator className="mx-4 w-auto" />

        {/* Categories — always visible, no accordion */}
        {categories.map(cat => {
          const visibleModules = cat.modules.filter(m => showModule(m) && moduleMatchesSearch(m));
          if (visibleModules.length === 0) return null;

          return (
            <SidebarGroup key={cat.key} className="py-0 px-2">
              <CategoryDivider title={cat.label} />
              <div className="space-y-0.5 mt-1">
                {visibleModules.map(moduleCode => (
                  <div key={moduleCode}>
                    {renderModuleContent(moduleCode)}
                  </div>
                ))}
              </div>
            </SidebarGroup>
          );
        })}

        {/* Design Studio standalone — admin-only at the moment */}
        {isAdmin && (
          <SidebarGroup className="py-1 px-2">
            {renderModuleContent("design_studio")}
          </SidebarGroup>
        )}

        {/* CRM standalone — admin-only */}
        {isAdmin && (
          <SidebarGroup className="py-1 px-2">
            <SidebarMenu className="space-y-0.5">
              <MenuItemLink to="/dashboard/crm" icon={Headset} title="CRM" />
            </SidebarMenu>
          </SidebarGroup>
        )}

        {/* Portal ERP standalone — for non-admin users with ERP permission */}
        {!isAdmin && hasModulePermission("integracao_erp") && (
          <SidebarGroup className="py-1 px-2">
            <SidebarMenu className="space-y-0.5">
              <MenuItemLink to="/dashboard/integracao-erp" icon={Key} title="Portal ERP" />
            </SidebarMenu>
          </SidebarGroup>
        )}

        {/* Admin links — admin OR usuário com permissão explícita à tela de configurações
            (caso do Suporte de TI sem bypass admin) */}
        {(isAdmin || hasPermission("configuracoes")) && (

          <SidebarGroup className="py-1 px-2">
            <Collapsible open={adminOpen} onOpenChange={setAdminOpen}>
              <CollapsibleTrigger className="w-full">
                <div className={cn(
                  "flex items-center gap-2 w-full px-3 py-2 rounded-md transition-all duration-150 text-[12px]",
                  "hover:bg-[var(--sidebar-hover-raw)]"
                )}>
                  <Settings className="h-4 w-4 text-[var(--sidebar-text-muted-raw)]" />
                  <span className="font-medium text-[var(--sidebar-text-muted-raw)] flex-1 text-left">
                    Administração
                  </span>
                  <ChevronUp className={cn(
                    "h-3.5 w-3.5 text-[var(--sidebar-text-muted-raw)] transition-transform duration-200",
                    !adminOpen && "rotate-180"
                  )} />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenu className="space-y-0.5 ps-2 mt-1">
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground px-3 pt-2 pb-1 block">Segurança & Auditoria</span>
                  <MenuItemLink to="/dashboard/seguranca-dashboard" icon={ShieldCheck} title="Painel Segurança" />
                  <MenuItemLink to="/dashboard/security-explorer" icon={Search} title="Security Explorer" />
                  <MenuItemLink to="/dashboard/trilha-auditoria-acessos" icon={Footprints} title="Trilha de Acessos" />
                  <MenuItemLink to="/dashboard/relatorio-seguranca" icon={Shield} title="Rel. Segurança" />
                  {hasPermission("auditoria") && (
                    <MenuItemLink to="/dashboard/auditoria" icon={ClipboardCheck} title={t("nav.audit")} />
                  )}

                  <span className="text-[10px] font-semibold uppercase text-muted-foreground px-3 pt-3 pb-1 block">Acesso & Permissões</span>
                  <MenuItemLink to="/dashboard/configuracoes/acesso" icon={UserCheck} title="Config. Acesso" />
                  <MenuItemLink to="/dashboard/configuracoes/permissoes-modulo" icon={Users} title="Permissões Módulo" />
                  <MenuItemLink to="/dashboard/configuracoes/lgpd" icon={Shield} title="LGPD" />
                  <MenuItemLink to="/dashboard/configuracoes/fornecedores-visibilidade" icon={Eye} title="Config. Fornecedores" />

                  {hasModulePermission("financeiro") && (
                    <>
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground px-3 pt-3 pb-1 block">Governança Financeira</span>
                      <MenuItemLink to="/dashboard/financeiro/ap-central" icon={Landmark} title="Painel AP Central" />
                      <MenuItemLink to="/dashboard/financeiro/contas-a-pagar/exportacao-erp" icon={Upload} title="Fila Exportação ERP" />
                      <MenuItemLink to="/dashboard/financeiro/contas-a-pagar/sync-cadastros" icon={RefreshCw} title="Sync Cadastros AP" />
                      <MenuItemLink to="/dashboard/financeiro/contas-a-pagar/conciliacao" icon={GitCompare} title="Conciliação Manual" />
                      <MenuItemLink to="/dashboard/financeiro/contas-a-pagar/sync" icon={RefreshCw} title="Sync Contas a Pagar" />
                      <MenuItemLink to="/dashboard/financeiro/contas-a-receber/sync" icon={RefreshCw} title="Sync Contas a Receber" />
                      <MenuItemLink to="/dashboard/financeiro/vendas/sync" icon={RefreshCw} title="Sync Vendas / Faturamento" />
                      <MenuItemLink to="/dashboard/relatorio-ap-module" icon={DollarSign} title="Rel. AP Module" />
                      <MenuItemLink to="/configuracoes/admin/relatorio-ap-erp" icon={Scale} title="Rel. AP x ERP" />
                    </>
                  )}

                  <span className="text-[10px] font-semibold uppercase text-muted-foreground px-3 pt-3 pb-1 block">Sistema & Integrações</span>
                  <MenuItemLink to="/dashboard/admin/calendario-corporativo" icon={CalendarDays} title="Calendário Corporativo" />
                  <MenuItemLink to="/dashboard/configuracoes/menu" icon={LayoutGrid} title="Config. Menu" />
                  <MenuItemLink to="/dashboard/configuracoes/api-health" icon={HeartPulse} title="API Health" />
                  <MenuItemLink to="/dashboard/relatorio-apis" icon={Network} title="Rel. APIs" />
                  <MenuItemLink to="/dashboard/relatorio-desenvolvimento" icon={Package} title="Rel. Desenvolvimento" />
                  {hasModulePermission("integracao_erp") && (
                    <MenuItemLink to="/dashboard/integracao-erp" icon={Key} title="Portal ERP" />
                  )}
                  <MenuItemLink to="/dashboard/admin-api-support" icon={MessageCircle} title="Suporte API" />
                  <MenuItemLink to="/admin/suporte" icon={LifeBuoy} title="Central de Suporte" />
                  <MenuItemLink to="/admin/documentacao-tecnica" icon={FileText} title="Documentação Técnica" />
                  <MenuItemLink to="/dashboard/integracoes/asana" icon={RefreshCw} title="Asana Sync" />
                  <MenuItemLink to="/dashboard/integracoes/shipsgo" icon={Ship} title="Integração ShipsGo" />
                  <MenuItemLink to="/dashboard/estoque/sync-erp" icon={RefreshCw} title="Sync Estoque ERP" />
                  <MenuItemLink to="/dashboard/estoque/analise-erp" icon={BarChart3} title="Análise Estoque ERP" />
                  <MenuItemLink to="/dashboard/composicao/sync" icon={RefreshCw} title="Sync Composição ERP" />
                  <MenuItemLink to="/dashboard/simulacao" icon={Database} title="Simulação de Dados" />
                </SidebarMenu>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}
      </SidebarContent>
      
      {/* Footer */}
      <SidebarFooter style={{ backgroundColor: 'var(--sidebar-bg-raw)', borderTop: '1px solid var(--sidebar-border-raw)' }}>
        {/* User info — always visible */}
        {userName && (
          <div className="px-4 py-3 flex items-center gap-3">
            <NavLink
              to="/meu-perfil"
              className="flex items-center gap-3 flex-1 min-w-0 rounded-md hover:bg-[var(--sidebar-hover-raw)] transition-colors -mx-1 px-1 py-1"
              title="Meu Perfil"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary-raw)' }}>
                <span className="text-xs font-bold text-white">
                  {userName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-[var(--sidebar-text-active-raw)]">{userName}</p>
                <p className="text-xs text-[var(--sidebar-text-muted-raw)]">{t("nav.connected")}</p>
              </div>
            </NavLink>
            <div className="flex items-center gap-1">
              <ThemeSelectorPopover />
              <LanguagePreferencePopover />
              <NavLink
                to="/meu-perfil"
                title="Meu Perfil"
                className="p-1.5 rounded-md text-[var(--sidebar-text-muted-raw)] hover:text-[var(--sidebar-text-hover-raw)] hover:bg-[var(--sidebar-hover-raw)] transition-colors"
              >
                <UserCircle className="h-4 w-4" />
              </NavLink>
              {hasModulePermission("configuracoes") && (
                <NavLink to="/dashboard/configuracoes" className="p-1.5 rounded-md text-[var(--sidebar-text-muted-raw)] hover:text-[var(--sidebar-text-hover-raw)] hover:bg-[var(--sidebar-hover-raw)] transition-colors">
                  <Settings className="h-4 w-4" />
                </NavLink>
              )}
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-md text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <div className="px-4 py-2 flex items-center justify-between gap-3" style={{ borderTop: '1px solid var(--sidebar-border-raw)' }}>
          <div className="flex gap-3">
            <a href="/politica-privacidade" target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--sidebar-text-muted-raw)] hover:text-[var(--sidebar-text-raw)] flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Privacidade
            </a>
            <a href="/termos-de-uso" target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--sidebar-text-muted-raw)] hover:text-[var(--sidebar-text-raw)] flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Termos
            </a>
          </div>
          <button
            type="button"
            onClick={async () => {
              if ((await confirm({ title: `Versão atual: ${APP_VERSION}`, description: `Forçar atualização agora? A página será recarregada e o cache será limpo.` }))) {
                forceCleanReload();
              }
            }}
            title={`Versão ${APP_VERSION} — clique para forçar atualização`}
            className="text-[10px] tabular-nums text-[var(--sidebar-text-muted-raw)] hover:text-[var(--sidebar-text-raw)] transition-colors"
          >
            v{APP_VERSION}
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
