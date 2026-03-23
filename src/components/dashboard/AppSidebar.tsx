import { 
  Home, Users, Building2, LogOut, Settings, Upload, Shield, 
  LayoutGrid, CheckSquare, MapPin, MessageSquare, Activity, Clock,
  Store, Calendar, Camera, Tag, TrendingUp, Brain, ChevronDown, ChevronRight, ChevronUp, Image, ClipboardCheck, DollarSign, FileText, Download, Phone, Trophy, BarChart3, Sparkles, Package, Factory, Receipt, Layers, Cog, UserCircle, AlertCircle, AlertTriangle, Pause, Wrench, List, Bot, Wallet, Grid3X3, Briefcase, Rocket, PartyPopper, CreditCard, Pickaxe, Compass, Ticket, FolderKanban, Inbox, Mic, Globe, ShoppingCart, Send, Landmark, Palette, FlaskConical, Scale, Network, Key, Megaphone, BarChart2, UserCheck, Target
} from "lucide-react";
import { ThemeSelectorPopover } from "@/components/theme/ThemeSelectorPopover";
import { NavLink, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useSidebarConfig } from "@/hooks/useSidebarConfig";
import logoUnion from "@/assets/logo-union.png";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { useToast } from "@/hooks/use-toast";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import { useModulePermissions } from "@/hooks/useModulePermissions";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useUserDepartments } from "@/hooks/useUserDepartments";
import { useLanguage } from "@/contexts/LanguageContext";

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
  departamentos: {
    bg: "bg-[hsl(var(--module-departamentos,200_70%_45%))]",
    bgLight: "bg-[hsl(var(--module-departamentos,200_70%_45%)/0.1)]",
    text: "text-[hsl(var(--module-departamentos,200_70%_45%))]",
    border: "border-[hsl(var(--module-departamentos,200_70%_45%))]",
    hover: "hover:bg-[hsl(var(--module-departamentos,200_70%_45%)/0.15)]",
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
  isOpen: boolean;
  colorKey: keyof typeof moduleColors;
}

const ModuleHeader = ({ icon: Icon, title, isOpen, colorKey }: ModuleHeaderProps) => {
  const colors = moduleColors[colorKey];
  
  return (
    <div className={cn(
      "flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-all duration-150",
      "hover:bg-[var(--sidebar-hover-raw)]"
    )}>
      <div className={cn(
        "flex items-center justify-center w-7 h-7 rounded-md",
        colors.bg
      )}>
      <Icon className="h-3.5 w-3.5 text-white" />
      </div>
      <span className="font-medium text-sm flex-1 text-[var(--sidebar-text-hover-raw)]">
        {title}
      </span>
      <ChevronDown className={cn(
        "h-3.5 w-3.5 text-[var(--sidebar-text-raw)] transition-transform duration-200",
        !isOpen && "ltr:-rotate-90 rtl:rotate-90"
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

const MenuItemLink = ({ to, icon: Icon, title, colorKey, badge, end }: MenuItemLinkProps) => {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild>
        <NavLink
          to={to}
          end={end}
          className={({ isActive }) => cn(
            "relative flex items-center gap-3 px-3 py-1.5 rounded-md transition-all duration-150 text-[13px]",
            isActive
              ? "font-medium bg-[var(--sidebar-active-bg-raw)] text-[var(--sidebar-text-active-raw)] ltr:border-l-2 rtl:border-r-2 border-[var(--color-primary-raw)]"
              : "text-[var(--sidebar-text-raw)] hover:text-[var(--sidebar-text-hover-raw)] hover:bg-[var(--sidebar-hover-raw)]"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="flex-1">{title}</span>
          {badge}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};

// Category header - more subtle than module headers
interface CategoryHeaderProps {
  icon: React.ElementType;
  title: string;
  isOpen: boolean;
}

const CategoryHeader = ({ icon: Icon, title, isOpen }: CategoryHeaderProps) => (
  <div className={cn(
    "flex items-center gap-2.5 w-full px-3 py-2 rounded-lg transition-all duration-150",
    "hover:bg-[var(--sidebar-hover-raw)]",
    isOpen ? "bg-[var(--sidebar-hover-raw)]" : ""
  )}>
    <Icon className="h-4 w-4 text-[var(--sidebar-text-raw)]" />
    <span className="font-bold text-[10px] uppercase tracking-[0.09em] text-[var(--sidebar-text-muted-raw)] flex-1">
      {title}
    </span>
    <ChevronRight className={cn(
      "h-3.5 w-3.5 text-[var(--sidebar-text-muted-raw)] transition-transform duration-200",
      isOpen && "rotate-90"
    )} />
  </div>
);

export function AppSidebar({ side }: { side?: "left" | "right" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { permissions, loading: permissionsLoading, hasPermission } = useScreenPermissions();
  const { hasModulePermission, loading: modulesLoading } = useModulePermissions();
  const { isAdminOrSupervisor, isAdmin } = useUserRole();
  const { user } = useAuth();
  const { categories: dbCategories, isLoading: configLoading } = useSidebarConfig();
  const { data: userDepartments = [] } = useUserDepartments();
  const { t, dir } = useLanguage();
  const isRTL = dir === "rtl";
  
  const [openModules, setOpenModules] = useState<Set<string>>(new Set());
  const [openFinSubgroups, setOpenFinSubgroups] = useState<Set<string>>(new Set());
  const [footerOpen, setFooterOpen] = useState(false);
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
      { code: "departamentos", label: t("module.departamentos"), icon: Building2 },
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
    ];
    return allModules.filter(m => hasModulePermission(m.code));
  }, [hasModulePermission]);

  const showModule = (code: string) => hasModulePermission(code) && (selectedModules.size === 0 || selectedModules.has(code));

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

  // Toggle module open/close
  const toggleModuleOpen = useCallback((code: string) => {
    setOpenModules(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }, []);

  // Accordion for categories - only one open at a time
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const toggleCategory = useCallback((cat: string) => {
    setOpenCategory(prev => prev === cat ? null : cat);
  }, []);

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
    departamentos: ["/dashboard/departamentos"],
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

  // Auto-expand based on current route
  useEffect(() => {
    const path = location.pathname;
    for (const [moduleCode, routes] of Object.entries(moduleRouteMap)) {
      if (routes.some(r => path.startsWith(r))) {
        setOpenModules(prev => {
          const next = new Set(prev);
          next.add(moduleCode);
          return next;
        });
        const cat = moduleToCategoryMap[moduleCode];
        if (cat) setOpenCategory(cat);
        break;
      }
    }
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

  // Buscar tabelas pendentes
  useEffect(() => {
    if (loading || !hasModulePermission("precos")) {
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
      .channel('sidebar-tabelas-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fabrica_tabelas_preco' }, () => fetchPendentes())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loading, hasModulePermission]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: t("logout.title"), description: t("logout.description") });
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
    { title: "Saldos Bancários", url: "/dashboard/financeiro/saldos-bancarios", icon: Wallet, screenCode: "financeiro_saldos_bancarios" },
    { title: "Investimentos", url: "/dashboard/financeiro/investimentos", icon: TrendingUp, screenCode: "financeiro_saldos_bancarios" },
    { title: "Fornecedores", url: "/dashboard/fornecedores", icon: Users, screenCode: "financeiro_fornecedores" },
    { title: "Empresas", url: "/dashboard/empresas", icon: Building2, screenCode: "financeiro_empresas" },
    { title: "Centros de Custo", url: "/dashboard/centros-custo", icon: Layers, screenCode: "financeiro_centros_custo" },
  ];

  const tradeSubMenus = [
    { title: t("trade.admin"), url: "/dashboard/trade/admin", icon: Settings, screenCode: "trade_admin" },
    { title: "Banners", url: "/dashboard/trade/admin/banners", icon: Image, screenCode: "trade_admin" },
    { title: "Incentivos", url: "/dashboard/trade/admin/incentivos", icon: Trophy, screenCode: "trade_admin" },
    { title: "Catálogo Displays", url: "/dashboard/trade/admin/displays", icon: Package, screenCode: "trade_admin" },
    { title: "Catálogo Materiais", url: "/dashboard/trade/admin/materiais", icon: Package, screenCode: "trade_admin" },
    { title: "Central de Aprovações", url: "/dashboard/trade/aprovacoes", icon: Shield, screenCode: "trade_admin" },
    { title: t("trade.my_team"), url: "/dashboard/trade/minha-equipe", icon: Users, screenCode: "TRADE_DASHBOARD", requireAdminOrSupervisor: true },
    { title: t("trade.pdvs"), url: "/dashboard/trade/stores", icon: Store, screenCode: "TRADE_LOJAS" },
    { title: t("trade.visits"), url: "/dashboard/trade/visits", icon: Calendar, screenCode: "TRADE_VISITAS" },
    { title: t("trade.sellout"), url: "/dashboard/trade/sellout", icon: DollarSign, screenCode: "trade_sellout" },
    { title: t("trade.shelf"), url: "/dashboard/trade/shelf-measurements", icon: Activity, screenCode: "trade_shelf" },
    { title: "Redes", url: "/dashboard/trade/store-chains", icon: Network, screenCode: "TRADE_LOJAS" },
    { title: t("trade.brands"), url: "/dashboard/trade/our-brands", icon: Tag, screenCode: "trade_brands" },
    { title: t("trade.photos"), url: "/dashboard/trade/photos", icon: Camera, screenCode: "TRADE_FOTOS" },
    { title: t("trade.ideal_photos"), url: "/dashboard/trade/ideal-photos", icon: Image, screenCode: "trade_ideal_photos" },
    { title: t("trade.audit"), url: "/dashboard/trade/auditorias", icon: ClipboardCheck, screenCode: "TRADE_AUDITORIAS" },
    { title: "Calendário", url: "/dashboard/trade/calendar", icon: Calendar, screenCode: "TRADE_VISITAS" },
    { title: t("trade.competitive"), url: "/dashboard/trade/relatorio-competitivo", icon: BarChart3, screenCode: "trade_competitors", requireAdminOrSupervisor: true },
    { title: "Comparação Produtos", url: "/dashboard/trade/comparacao-produtos", icon: Scale, screenCode: "trade_competitors", requireAdminOrSupervisor: true },
    { title: "Promoções", url: "/dashboard/trade/promotions", icon: Megaphone, screenCode: "TRADE_DASHBOARD", requireAdminOrSupervisor: true },
    { title: "Performance", url: "/dashboard/trade/performance", icon: TrendingUp, screenCode: "TRADE_DASHBOARD", requireAdminOrSupervisor: true },
    { title: "Equipe Performance", url: "/dashboard/trade/team-performance", icon: UserCheck, screenCode: "TRADE_DASHBOARD", requireAdminOrSupervisor: true },
    { title: "Ranking", url: "/dashboard/ranking", icon: Trophy, screenCode: "TRADE_DASHBOARD", requireAdminOrSupervisor: true },
    { title: t("trade.rewards"), url: "/dashboard/trade/rewards", icon: Trophy, screenCode: "trade_rewards" },
    { title: t("trade.whatsapp"), url: "/dashboard/trade/whatsapp", icon: MessageSquare, screenCode: "trade_whatsapp" },
    { title: t("trade.ai_insights"), url: "/dashboard/trade/insights", icon: Sparkles, screenCode: "trade_insights", requireAdminOrSupervisor: true },
  ];

  const marketingSubMenus = [
    { title: t("marketing.dashboards"), url: "/dashboard/marketing/social", icon: BarChart3, screenCode: "MARKETING_SOCIAL" },
    { title: "WhatsApp", url: "/dashboard/marketing/whatsapp", icon: MessageSquare, screenCode: "MARKETING_SOCIAL" },
    { title: "ElevenLabs Studio", url: "/dashboard/marketing/elevenlabs", icon: Mic, screenCode: "MARKETING_SOCIAL" },
    { title: "Mission Control", url: "/dashboard/marketing/mission-control", icon: Target, screenCode: "MARKETING_SOCIAL" },
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

  // ============ MODULE RENDERERS ============
  const renderModuleContent = (moduleCode: string) => {
    const isModuleOpen = openModules.has(moduleCode);

    switch (moduleCode) {
      case "prospects":
        return (
          <Collapsible open={isModuleOpen} onOpenChange={() => toggleModuleOpen(moduleCode)}>
            <CollapsibleTrigger className="w-full">
              <ModuleHeader icon={Users} title={t("module.prospects")} isOpen={isModuleOpen} colorKey="prospects" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenu className="space-y-0.5 ps-2 mt-1">
                {hasPermission("PROSPECTS_DASHBOARD") && (
                  <MenuItemLink to="/dashboard/prospects" icon={Home} title={t("prospects.overview")} colorKey="prospects" end />
                )}
                {prospectsSubMenus.filter(i => hasPermission(i.screenCode)).map(item => (
                  <MenuItemLink key={item.url} to={item.url} icon={item.icon} title={item.title} colorKey="prospects" />
                ))}
              </SidebarMenu>
            </CollapsibleContent>
          </Collapsible>
        );

      case "comercial":
        return (
          <Collapsible open={isModuleOpen} onOpenChange={() => toggleModuleOpen(moduleCode)}>
            <CollapsibleTrigger className="w-full">
              <ModuleHeader icon={Briefcase} title={t("module.comercial")} isOpen={isModuleOpen} colorKey="comercial" />
            </CollapsibleTrigger>
            <CollapsibleContent>
               <ScrollArea className="max-h-64">
               <SidebarMenu className="space-y-0.5 ps-2 mt-1">
                {hasPermission("comercial_dashboard") && (
                  <MenuItemLink to="/dashboard/comercial" icon={Home} title={t("comercial.dashboard")} colorKey="comercial" end />
                )}
                {hasPermission("comercial_lancamentos") && (
                  <MenuItemLink to="/dashboard/comercial/lancamentos" icon={Rocket} title={t("comercial.launches")} colorKey="comercial" />
                )}
                <MenuItemLink to="/dashboard/painel-executivo" icon={BarChart3} title="Painel Executivo" colorKey="comercial" />
                <MenuItemLink to="/dashboard/performance-vendas" icon={TrendingUp} title="Performance Vendas" colorKey="comercial" />
                <MenuItemLink to="/dashboard/clientes" icon={Users} title="Análise Clientes" colorKey="comercial" />
                <MenuItemLink to="/dashboard/produtos" icon={Package} title="Análise Produtos" colorKey="comercial" />
                <MenuItemLink to="/dashboard/geografico" icon={MapPin} title="Análise Geográfico" colorKey="comercial" />
                <MenuItemLink to="/dashboard/metas" icon={Target} title="Metas e Projeções" colorKey="comercial" />
                <MenuItemLink to="/dashboard/comercial/ibge" icon={MapPin} title={t("comercial.ibge")} colorKey="comercial" />
                <MenuItemLink to="/dashboard/comercial/mineracao" icon={Pickaxe} title={t("comercial.mining")} colorKey="comercial" />
                <MenuItemLink to="/dashboard/comercial/inteligencia" icon={Brain} title="Inteligência de Mercado" colorKey="comercial" />
                <MenuItemLink to="/dashboard/comercial/reativacao" icon={AlertTriangle} title={t("comercial.reactivation")} colorKey="comercial" />
                <MenuItemLink to="/dashboard/comercial/mapa" icon={MapPin} title="Mapa Comercial" colorKey="comercial" />
                <MenuItemLink to="/dashboard/comercial/municipios-inteligencia" icon={Building2} title={t("comercial.municipalities")} colorKey="comercial" />
                <MenuItemLink to="/dashboard/comercial/whitespace" icon={Compass} title={t("comercial.whitespace")} colorKey="comercial" />
              </SidebarMenu>
              </ScrollArea>
            </CollapsibleContent>
          </Collapsible>
        );

      case "precos":
        return (
          <Collapsible open={isModuleOpen} onOpenChange={() => toggleModuleOpen(moduleCode)}>
            <CollapsibleTrigger className="w-full">
              <ModuleHeader icon={DollarSign} title={t("module.precos")} isOpen={isModuleOpen} colorKey="precos" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenu className="space-y-0.5 ps-2 mt-1">
                {precosSubMenus.filter(i => hasPermission(i.screenCode)).map(item => (
                  <MenuItemLink 
                    key={item.url} to={item.url} icon={item.icon} title={item.title} colorKey="precos" end={item.end}
                    badge={item.title === "Aprovação" && tabelasPendentes > 0 ? (
                      <Badge className="ml-auto bg-yellow-500 hover:bg-yellow-600 text-xs h-5 min-w-5 flex items-center justify-center">{tabelasPendentes}</Badge>
                    ) : undefined}
                  />
                ))}
              </SidebarMenu>
            </CollapsibleContent>
          </Collapsible>
        );

      case "trade":
        return (
          <Collapsible open={isModuleOpen} onOpenChange={() => toggleModuleOpen(moduleCode)}>
            <CollapsibleTrigger className="w-full">
              <ModuleHeader icon={Store} title={t("module.trade")} isOpen={isModuleOpen} colorKey="trade" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ScrollArea className="max-h-64">
                <SidebarMenu className="space-y-0.5 ps-2 mt-1">
                  {hasPermission("TRADE_DASHBOARD") && (
                    <MenuItemLink to="/dashboard/trade" icon={Home} title={t("prospects.overview")} colorKey="trade" end />
                  )}
                  {tradeSubMenus.filter(i => hasPermission(i.screenCode) && (!i.requireAdminOrSupervisor || isAdminOrSupervisor)).map(item => (
                    <MenuItemLink key={item.url} to={item.url} icon={item.icon} title={item.title} colorKey="trade" />
                  ))}
                </SidebarMenu>
              </ScrollArea>
            </CollapsibleContent>
          </Collapsible>
        );

      case "marketing":
        return (
          <Collapsible open={isModuleOpen} onOpenChange={() => toggleModuleOpen(moduleCode)}>
            <CollapsibleTrigger className="w-full">
              <ModuleHeader icon={BarChart3} title={t("module.marketing")} isOpen={isModuleOpen} colorKey="marketing" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenu className="space-y-0.5 ps-2 mt-1">
                {hasPermission("MARKETING_DASHBOARD") && (
                  <MenuItemLink to="/dashboard/marketing" icon={Home} title={t("marketing.overview")} colorKey="marketing" end />
                )}
                {marketingSubMenus.filter(i => hasPermission(i.screenCode)).map(item => (
                  <MenuItemLink key={item.url} to={item.url} icon={item.icon} title={item.title} colorKey="marketing" />
                ))}
              </SidebarMenu>
            </CollapsibleContent>
          </Collapsible>
        );

      case "eventos":
        return (
          <Collapsible open={isModuleOpen} onOpenChange={() => toggleModuleOpen(moduleCode)}>
            <CollapsibleTrigger className="w-full">
              <ModuleHeader icon={PartyPopper} title={t("module.eventos")} isOpen={isModuleOpen} colorKey="eventos" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenu className="space-y-0.5 ps-2 mt-1">
                {hasPermission("eventos_dashboard") && (
                  <MenuItemLink to="/dashboard/eventos" icon={Home} title={t("eventos.events")} colorKey="eventos" end />
                )}
                {hasPermission("eventos_analytics") && (
                  <MenuItemLink to="/dashboard/eventos/dashboard" icon={BarChart3} title={t("eventos.dashboard")} colorKey="eventos" />
                )}
              </SidebarMenu>
            </CollapsibleContent>
          </Collapsible>
        );

      case "fabrica":
        return (
          <Collapsible open={isModuleOpen} onOpenChange={() => toggleModuleOpen(moduleCode)}>
            <CollapsibleTrigger className="w-full">
              <ModuleHeader icon={Factory} title={t("module.fabrica")} isOpen={isModuleOpen} colorKey="fabrica" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ScrollArea className="max-h-72">
                <SidebarMenu className="space-y-0.5 ps-2 mt-1">
                  {hasPermission("fabrica_dashboard") && (
                    <MenuItemLink to="/dashboard/fabrica" icon={Home} title={t("fabrica.dashboard")} colorKey="fabrica" end />
                  )}
                  {fabricaGroups.map(group => {
                    const filteredItems = group.items.filter(item => isAdmin || hasPermission(item.screenCode));
                    if (filteredItems.length === 0) return null;
                    return (
                      <div key={group.label} className="mt-2 first:mt-0">
                        <span className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                          {group.label}
                        </span>
                        {filteredItems.map(item => (
                          <MenuItemLink key={item.url} to={item.url} icon={item.icon} title={item.title} colorKey="fabrica" />
                        ))}
                      </div>
                    );
                  })}
                </SidebarMenu>
              </ScrollArea>
            </CollapsibleContent>
          </Collapsible>
        );

      case "china":
        return (
          <Collapsible open={isModuleOpen} onOpenChange={() => toggleModuleOpen(moduleCode)}>
            <CollapsibleTrigger className="w-full">
              <ModuleHeader icon={Globe} title="Fábrica China 中国工厂" isOpen={isModuleOpen} colorKey="china" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenu className="space-y-0.5 ps-2 mt-1">
                <MenuItemLink to="/dashboard/fabrica-china" icon={Home} title="Painel 面板" colorKey="china" end />
                <MenuItemLink to="/dashboard/fabrica-china/nova" icon={Upload} title="Nova Submissão 新提交" colorKey="china" />
                <MenuItemLink to="/dashboard/fabrica-china/recebimentos" icon={Package} title="Submissões 提交" colorKey="china" />
                <MenuItemLink to="/dashboard/fabrica-china/ordens" icon={ShoppingCart} title="Ordens de Compra 采购订单" colorKey="china" />
              </SidebarMenu>
            </CollapsibleContent>
          </Collapsible>
        );

      case "composicao":
        return (
          <Collapsible open={isModuleOpen} onOpenChange={() => toggleModuleOpen(moduleCode)}>
            <CollapsibleTrigger className="w-full">
              <ModuleHeader icon={FlaskConical} title="Composição" isOpen={isModuleOpen} colorKey="fabrica" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenu className="space-y-0.5 ps-2 mt-1">
                <MenuItemLink to="/dashboard/composicao" icon={Home} title="Checklist Composição" colorKey="fabrica" end />
              </SidebarMenu>
            </CollapsibleContent>
          </Collapsible>
        );

      case "amostras":
        return (
          <Collapsible open={isModuleOpen} onOpenChange={() => toggleModuleOpen(moduleCode)}>
            <CollapsibleTrigger className="w-full">
              <ModuleHeader icon={Package} title="Amostras" isOpen={isModuleOpen} colorKey="fabrica" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenu className="space-y-0.5 ps-2 mt-1">
                <MenuItemLink to="/dashboard/amostras" icon={Home} title="Recebimento de Amostras" colorKey="fabrica" end />
              </SidebarMenu>
            </CollapsibleContent>
          </Collapsible>
        );

      case "analise_embalagem":
        return (
          <Collapsible open={isModuleOpen} onOpenChange={() => toggleModuleOpen(moduleCode)}>
            <CollapsibleTrigger className="w-full">
              <ModuleHeader icon={Layers} title="Embalagem" isOpen={isModuleOpen} colorKey="fabrica" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenu className="space-y-0.5 ps-2 mt-1">
                <MenuItemLink to="/dashboard/analise-embalagem" icon={Home} title="Análise de Embalagem" colorKey="fabrica" end />
              </SidebarMenu>
            </CollapsibleContent>
          </Collapsible>
        );

      case "etiqueta_bula":
        return (
          <Collapsible open={isModuleOpen} onOpenChange={() => toggleModuleOpen(moduleCode)}>
            <CollapsibleTrigger className="w-full">
              <ModuleHeader icon={Tag} title="Etiqueta / Bula" isOpen={isModuleOpen} colorKey="fabrica" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenu className="space-y-0.5 ps-2 mt-1">
                <MenuItemLink to="/dashboard/etiqueta-bula" icon={Home} title="Checklist Etiqueta/Bula" colorKey="fabrica" end />
              </SidebarMenu>
            </CollapsibleContent>
          </Collapsible>
        );

      case "aprovacao_artes":
        return (
          <Collapsible open={isModuleOpen} onOpenChange={() => toggleModuleOpen(moduleCode)}>
            <CollapsibleTrigger className="w-full">
              <ModuleHeader icon={Palette} title="Aprovação de Artes" isOpen={isModuleOpen} colorKey="fabrica" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenu className="space-y-0.5 ps-2 mt-1">
                <MenuItemLink to="/dashboard/fluxo-artes" icon={Palette} title="Motor de Artes" colorKey="fabrica" end />
                <MenuItemLink to="/dashboard/aprovacao-artes" icon={ClipboardCheck} title="Fluxos Legado" colorKey="fabrica" end />
                <MenuItemLink to="/dashboard/aprovacao-artes/configuracao" icon={Cog} title="Configuração" colorKey="fabrica" end />
              </SidebarMenu>
            </CollapsibleContent>
          </Collapsible>
        );

      case "financeiro":
        return (
          <Collapsible open={isModuleOpen} onOpenChange={() => toggleModuleOpen(moduleCode)}>
            <CollapsibleTrigger className="w-full">
              <ModuleHeader icon={DollarSign} title={t("module.financeiro")} isOpen={isModuleOpen} colorKey="financeiro" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ScrollArea className="max-h-[420px]">
                <SidebarMenu className="space-y-0.5 ps-2 mt-1">
                  {/* Top-level items */}
                  {financeiroTopItems.filter(i => hasPermission(i.screenCode)).map(item => (
                    <MenuItemLink key={item.url} to={item.url} icon={item.icon} title={item.title} colorKey="financeiro" end={item.end} />
                  ))}

                  {/* Collapsible subgroups */}
                  {finSubgroups.map(sg => {
                    const visibleItems = sg.items.filter(i => hasPermission(i.screenCode));
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
                              "flex items-center gap-2 w-full px-3 py-1.5 rounded-md transition-all duration-150 text-[11px]",
                              "hover:bg-[var(--sidebar-hover-raw)]",
                              isSgOpen && "bg-[var(--sidebar-hover-raw)]"
                            )}>
                              <sg.icon className="h-3.5 w-3.5 text-[var(--sidebar-text-muted-raw)]" />
                              <span className="font-semibold uppercase tracking-wider text-[var(--sidebar-text-muted-raw)] flex-1 text-left">
                                {sg.label}
                              </span>
                              <ChevronRight className={cn(
                                "h-3 w-3 text-[var(--sidebar-text-muted-raw)] transition-transform duration-200",
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
                </SidebarMenu>
              </ScrollArea>
            </CollapsibleContent>
          </Collapsible>
        );

      case "departamentos":
        return userDepartments.length > 0 ? (
          <>
            {userDepartments.map((dept) => (
              <Collapsible key={dept.id} open={openModules.has(`dept_${dept.id}`)} onOpenChange={() => toggleModuleOpen(`dept_${dept.id}`)}>
                <CollapsibleTrigger className="w-full">
                  <ModuleHeader icon={Building2} title={dept.nome} isOpen={openModules.has(`dept_${dept.id}`)} colorKey="departamentos" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenu className="space-y-0.5 ps-2 mt-1">
                    <MenuItemLink to={`/dashboard/departamentos/${dept.id}`} icon={FileText} title={t("dept.expenses")} colorKey="departamentos" end />
                    <MenuItemLink to={`/dashboard/departamentos/${dept.id}/dashboard`} icon={BarChart3} title={t("dept.dashboard")} colorKey="departamentos" />
                  </SidebarMenu>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </>
        ) : null;

      case "estoque":
        return (
          <Collapsible open={isModuleOpen} onOpenChange={() => toggleModuleOpen(moduleCode)}>
            <CollapsibleTrigger className="w-full">
              <ModuleHeader icon={Package} title="Estoque" isOpen={isModuleOpen} colorKey="financeiro" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenu className="space-y-0.5 ps-2 mt-1">
                <MenuItemLink to="/dashboard/estoque" icon={Home} title="Painel" end />
                <MenuItemLink to="/dashboard/estoque/distribuidoras" icon={Building2} title="Distribuidoras" />
                <MenuItemLink to="/dashboard/estoque/produtos-master" icon={Package} title="Produtos Master" />
                <MenuItemLink to="/dashboard/estoque/saldos" icon={Layers} title="Saldos" />
                <MenuItemLink to="/dashboard/estoque/consolidado" icon={BarChart3} title="Consolidado" />
                <MenuItemLink to="/dashboard/estoque/vinculacoes" icon={Send} title="Vinculações" />
              </SidebarMenu>
            </CollapsibleContent>
          </Collapsible>
        );

      case "projetos":
        return (
          <Collapsible open={isModuleOpen} onOpenChange={() => toggleModuleOpen(moduleCode)}>
            <CollapsibleTrigger className="w-full">
              <ModuleHeader icon={FolderKanban} title="Projetos" isOpen={isModuleOpen} colorKey="comercial" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenu className="space-y-0.5 ps-2 mt-1">
                <MenuItemLink to="/dashboard/projetos/inbox" icon={Inbox} title="Caixa de Entrada" />
                <MenuItemLink to="/dashboard/projetos" icon={FolderKanban} title="Meus Projetos" end />
                {(isAdmin || userDepartments.some(d => d.id === '9937b2ff-bb1d-4f92-9d8b-4b3c0c7ad130')) && (
                  <>
                    <MenuItemLink to="/dashboard/projetos/vincular-china" icon={Globe} title="Vincular China" />
                    <MenuItemLink to="/dashboard/projetos/produto-brasil" icon={Package} title="Produtos Importados" />
                  </>
                )}
                {isAdminOrSupervisor && (
                  <MenuItemLink to="/dashboard/projetos/minha-equipe" icon={Users} title="Minha Equipe" />
                )}
              </SidebarMenu>
            </CollapsibleContent>
          </Collapsible>
        );

      case "reunioes":
        return (
          <Collapsible open={isModuleOpen} onOpenChange={() => toggleModuleOpen(moduleCode)}>
            <CollapsibleTrigger className="w-full">
              <ModuleHeader icon={Mic} title="Reuniões" isOpen={isModuleOpen} colorKey="comercial" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenu className="space-y-0.5 ps-2 mt-1">
                <MenuItemLink to="/dashboard/reunioes" icon={Mic} title="Reuniões" end />
              </SidebarMenu>
            </CollapsibleContent>
          </Collapsible>
        );

      case "processos":
        return (
          <Collapsible open={isModuleOpen} onOpenChange={() => toggleModuleOpen(moduleCode)}>
            <CollapsibleTrigger className="w-full">
              <ModuleHeader icon={Scale} title="Processos" isOpen={isModuleOpen} colorKey="comercial" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenu className="space-y-0.5 ps-2 mt-1">
                <MenuItemLink to="/dashboard/processos/consulta" icon={Scale} title="Consulta de Processos" end />
                <MenuItemLink to="/dashboard/processos/etapas" icon={Settings} title="Configurar Etapas" end />
                <MenuItemLink to="/dashboard/processos/workflows" icon={Layers} title="Workflows Documentais" end />
              </SidebarMenu>
            </CollapsibleContent>
          </Collapsible>
        );

      default:
        return null;
    }
  };




  return (
    <Sidebar side={side} className={cn("border-none", isRTL ? "border-l" : "border-r")} style={{ borderRight: '1px solid var(--sidebar-border-raw)' }}>
      {/* Header with logo */}
      <div className="p-4" style={{ backgroundColor: 'var(--sidebar-bg-raw)', borderBottom: '1px solid var(--sidebar-border-raw)' }}>
        <img src={logoUnion} alt="Logo Union - Sistema de Gestão Huggs" className="w-28 mx-auto" />
      </div>

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

      <SidebarContent className="scrollbar-thin">
        {/* Central de Inteligência — protegido por módulo */}
        {hasModulePermission("central_inteligencia") && (
        <SidebarGroup className="py-1 px-2">
          <Collapsible open={openModules.has("inteligencia")} onOpenChange={() => toggleModuleOpen("inteligencia")}>
            <CollapsibleTrigger className="w-full">
              <div className={cn(
                "flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-all duration-150",
                "hover:bg-[var(--sidebar-hover-raw)]"
              )}>
                <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary">
                  <BarChart3 className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="font-medium text-sm flex-1 text-[var(--sidebar-text-hover-raw)]">
                  Central de Inteligência
                </span>
                <ChevronDown className={cn(
                  "h-3.5 w-3.5 text-[var(--sidebar-text-raw)] transition-transform duration-200",
                  !openModules.has("inteligencia") && "ltr:-rotate-90 rtl:rotate-90"
                )} />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenu className="space-y-0.5 ps-2 mt-1">
                <MenuItemLink to="/dashboard/painel-executivo" icon={BarChart2} title="Painel Executivo" />
                <MenuItemLink to="/dashboard/performance-vendas" icon={TrendingUp} title="Perf. Vendas" />
                <MenuItemLink to="/dashboard/clientes" icon={UserCheck} title="Clientes" />
                <MenuItemLink to="/dashboard/detalhamento" icon={FileText} title="Detalhamento" />
                <MenuItemLink to="/dashboard/geografico" icon={Globe} title="Geográfico" />
                <MenuItemLink to="/dashboard/produtos" icon={Package} title="Produtos" />
                <MenuItemLink to="/dashboard/consolidado" icon={Layers} title="Consolidado" />
                {isAdmin && <MenuItemLink to="/dashboard/metas" icon={Target} title="Metas" />}
              </SidebarMenu>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>
        )}

        {/* Geral */}
        <SidebarGroup className="py-1">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5 px-2">
              {isAdmin && hasPermission("auditoria") && (
                <MenuItemLink to="/dashboard/auditoria" icon={Shield} title={t("nav.audit")} />
              )}
              <MenuItemLink to="/dashboard/instalar-app" icon={Download} title={t("nav.install_app")} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="mx-4 w-auto" />

        {/* Categories with accordion */}
        {categories.map(cat => {
          const visibleModules = cat.modules.filter(m => showModule(m));
          if (visibleModules.length === 0) return null;

          const isCatOpen = openCategory === cat.key;

          return (
            <SidebarGroup key={cat.key} className="py-1 px-2">
              <Collapsible open={isCatOpen} onOpenChange={() => toggleCategory(cat.key)}>
                <CollapsibleTrigger className="w-full">
                  <CategoryHeader icon={cat.icon} title={cat.label} isOpen={isCatOpen} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-1 mt-1 ps-1">
                    {visibleModules.map(moduleCode => (
                      <div key={moduleCode}>
                        {renderModuleContent(moduleCode)}
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      
      {/* Footer */}
      <SidebarFooter style={{ backgroundColor: 'var(--sidebar-bg-raw)', borderTop: '1px solid var(--sidebar-border-raw)' }}>
        <Collapsible open={footerOpen} onOpenChange={setFooterOpen}>
          {userName && (
            <CollapsibleTrigger asChild>
              <button className="w-full px-4 py-2 hover:bg-[var(--sidebar-item-hover-raw)] transition-colors duration-150 cursor-pointer" style={{ borderBottom: '1px solid var(--sidebar-border-raw)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary-raw)' }}>
                    <span className="text-xs font-bold text-white">
                      {userName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium truncate text-[var(--sidebar-text-active-raw)]">{userName}</p>
                    <p className="text-xs text-[var(--sidebar-text-raw)]">{t("nav.connected")}</p>
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <ThemeSelectorPopover />
                  </div>
                  <ChevronUp className={cn(
                    "h-4 w-4 text-[var(--sidebar-text-raw)] transition-transform duration-200",
                    !footerOpen && "rotate-180"
                  )} />
                </div>
              </button>
            </CollapsibleTrigger>
          )}
          
          <CollapsibleContent>
            <SidebarMenu className="px-2 py-2">
              {hasModulePermission("configuracoes") && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to="/dashboard/configuracoes"
                      className={({ isActive }) => cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150",
                        isActive ? "bg-[var(--sidebar-active-bg-raw)] text-[var(--sidebar-text-active-raw)]" : "text-[var(--sidebar-text-raw)] hover:text-[var(--sidebar-text-hover-raw)] hover:bg-[var(--sidebar-hover-raw)]"
                      )}
                    >
                      <Settings className="h-4 w-4" />
                      <span>{t("nav.settings")}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {isAdmin && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink 
                        to="/dashboard/configuracoes/lgpd"
                        className={({ isActive }) => cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150",
                          isActive ? "bg-[var(--sidebar-active-bg-raw)] text-[var(--sidebar-text-active-raw)]" : "text-[var(--sidebar-text-raw)] hover:text-[var(--sidebar-text-hover-raw)] hover:bg-[var(--sidebar-hover-raw)]"
                        )}
                      >
                        <Shield className="h-4 w-4" />
                        <span>LGPD</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink 
                        to="/dashboard/configuracoes/menu"
                        className={({ isActive }) => cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150",
                          isActive ? "bg-[var(--sidebar-active-bg-raw)] text-[var(--sidebar-text-active-raw)]" : "text-[var(--sidebar-text-raw)] hover:text-[var(--sidebar-text-hover-raw)] hover:bg-[var(--sidebar-hover-raw)]"
                        )}
                      >
                        <LayoutGrid className="h-4 w-4" />
                        <span>Config. Menu</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink 
                        to="/dashboard/relatorio-seguranca"
                        className={({ isActive }) => cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150",
                          isActive ? "bg-[var(--sidebar-active-bg-raw)] text-[var(--sidebar-text-active-raw)]" : "text-[var(--sidebar-text-raw)] hover:text-[var(--sidebar-text-hover-raw)] hover:bg-[var(--sidebar-hover-raw)]"
                        )}
                      >
                        <Shield className="h-4 w-4" />
                        <span>Rel. Segurança</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink 
                        to="/dashboard/relatorio-apis"
                        className={({ isActive }) => cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150",
                          isActive ? "bg-[var(--sidebar-active-bg-raw)] text-[var(--sidebar-text-active-raw)]" : "text-[var(--sidebar-text-raw)] hover:text-[var(--sidebar-text-hover-raw)] hover:bg-[var(--sidebar-hover-raw)]"
                        )}
                      >
                        <Network className="h-4 w-4" />
                        <span>Rel. APIs</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink 
                        to="/dashboard/relatorio-desenvolvimento"
                        className={({ isActive }) => cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150",
                          isActive ? "bg-[var(--sidebar-active-bg-raw)] text-[var(--sidebar-text-active-raw)]" : "text-[var(--sidebar-text-raw)] hover:text-[var(--sidebar-text-hover-raw)] hover:bg-[var(--sidebar-hover-raw)]"
                        )}
                      >
                        <Package className="h-4 w-4" />
                        <span>Rel. Desenvolvimento</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink 
                        to="/dashboard/relatorio-ap-module"
                        className={({ isActive }) => cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150",
                          isActive ? "bg-[var(--sidebar-active-bg-raw)] text-[var(--sidebar-text-active-raw)]" : "text-[var(--sidebar-text-raw)] hover:text-[var(--sidebar-text-hover-raw)] hover:bg-[var(--sidebar-hover-raw)]"
                        )}
                      >
                        <DollarSign className="h-4 w-4" />
                        <span>Rel. AP Module</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {hasModulePermission("integracao_erp") && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink 
                        to="/dashboard/integracao-erp"
                        className={({ isActive }) => cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150",
                          isActive ? "bg-[var(--sidebar-active-bg-raw)] text-[var(--sidebar-text-active-raw)]" : "text-[var(--sidebar-text-raw)] hover:text-[var(--sidebar-text-hover-raw)] hover:bg-[var(--sidebar-hover-raw)]"
                        )}
                      >
                        <Key className="h-4 w-4" />
                        <span>Portal ERP</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  )}
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink 
                        to="/dashboard/configuracoes/acesso"
                        className={({ isActive }) => cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150",
                          isActive ? "bg-[var(--sidebar-active-bg-raw)] text-[var(--sidebar-text-active-raw)]" : "text-[var(--sidebar-text-raw)] hover:text-[var(--sidebar-text-hover-raw)] hover:bg-[var(--sidebar-hover-raw)]"
                        )}
                      >
                        <UserCheck className="h-4 w-4" />
                        <span>Config. Acesso</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-150"
                >
                  <LogOut className="h-4 w-4" />
                  <span>{t("nav.logout")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </CollapsibleContent>
        </Collapsible>
        
        <div className="px-4 py-2 flex gap-3" style={{ borderTop: '1px solid var(--sidebar-border-raw)' }}>
          <a href="/politica-privacidade" target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--sidebar-text-muted-raw)] hover:text-[var(--sidebar-text-raw)] flex items-center gap-1">
            <FileText className="h-3 w-3" />
            Privacidade
          </a>
          <a href="/termos-de-uso" target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--sidebar-text-muted-raw)] hover:text-[var(--sidebar-text-raw)] flex items-center gap-1">
            <FileText className="h-3 w-3" />
            Termos
          </a>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
