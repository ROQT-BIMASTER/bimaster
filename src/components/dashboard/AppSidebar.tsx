import { 
  Home, Users, Building2, LogOut, Settings, Upload, Shield, 
  LayoutGrid, CheckSquare, MapPin, MessageSquare, Activity, Clock,
  Store, Calendar, Camera, Tag, TrendingUp, Brain, ChevronDown, ChevronRight, Image, ClipboardCheck, DollarSign, FileText, Download, Phone, Trophy, BarChart3, Sparkles, Package, Factory, Receipt, Layers, Cog, UserCircle, AlertCircle, AlertTriangle, Pause, Wrench, List, Bot, Wallet, Grid3X3, Briefcase, Rocket, PartyPopper, CreditCard, Pickaxe, Compass, Ticket, FolderKanban, Inbox, Mic, Globe, ShoppingCart, Send, Landmark, Palette, Settings
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import logoUnion from "@/assets/logo-union.png";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
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

// Fábrica module grouped menus
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
      "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-all duration-200",
      colors.bgLight,
      colors.hover
    )}>
      <div className={cn(
        "flex items-center justify-center w-8 h-8 rounded-lg",
        colors.bg
      )}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <span className={cn("font-semibold text-sm flex-1", colors.text)}>
        {title}
      </span>
      <ChevronDown className={cn(
        "h-4 w-4 transition-transform duration-200",
        colors.text,
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
  const colors = colorKey ? moduleColors[colorKey] : null;
  
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild>
        <NavLink
          to={to}
          end={end}
          className={({ isActive }) => cn(
            "relative flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200",
            isActive
              ? cn(
                  "font-medium",
                  colors ? cn(colors.bgLight, colors.text, "ltr:border-l-2 rtl:border-r-2", colors.border) : "bg-sidebar-accent text-sidebar-accent-foreground ltr:border-l-2 rtl:border-r-2 border-primary"
                )
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          <Icon className="h-4 w-4" />
          <span className="flex-1">{title}</span>
          {badge}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};

export function AppSidebar({ side }: { side?: "left" | "right" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { permissions, loading: permissionsLoading, hasPermission } = useScreenPermissions();
  const { hasModulePermission, loading: modulesLoading } = useModulePermissions();
  const { isAdminOrSupervisor, isAdmin } = useUserRole();
  const { user } = useAuth();
  const { data: userDepartments = [] } = useUserDepartments();
  const { t, dir } = useLanguage();
  const isRTL = dir === "rtl";
  
  const [prospectsOpen, setProspectsOpen] = useState(true);
  const [financeiroOpen, setFinanceiroOpen] = useState(true);
  const [tradeOpen, setTradeOpen] = useState(true);
  const [marketingOpen, setMarketingOpen] = useState(true);
  const [fabricaOpen, setFabricaOpen] = useState(true);
  const [comercialOpen, setComercialOpen] = useState(true);
  const [chinaOpen, setChinaOpen] = useState(true);
  const [eventosOpen, setEventosOpen] = useState(true);
  const [departamentosOpen, setDepartamentosOpen] = useState(true); // Mantido para compatibilidade futura
  const [precosOpen, setPrecosOpen] = useState(true);
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

  const loading = permissionsLoading || modulesLoading;

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
    ];
    return allModules.filter(m => hasModulePermission(m.code));
  }, [hasModulePermission]);

  // Empty set = show all (no filter active)
  // showModule já inclui verificação de permissão automaticamente
  // Qualquer novo módulo usando showModule("código") estará protegido por padrão
  const showModule = (code: string) => hasModulePermission(code) && (selectedModules.size === 0 || selectedModules.has(code));

  const toggleModule = (code: string) => {
    setSelectedModules(prev => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
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

  // Fetch user name
  useEffect(() => {
    const fetchUserName = async () => {
      if (!user?.id) return;
      
      const { data } = await supabase
        .from("profiles")
        .select("nome")
        .eq("id", user.id)
        .single();
      
      if (data?.nome) {
        setUserName(data.nome.split(" ")[0]);
      }
    };
    
    fetchUserName();
  }, [user?.id]);

  // Buscar tabelas pendentes - APENAS se tiver permissão do módulo de preços
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
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fabrica_tabelas_preco',
        },
        () => fetchPendentes()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loading, hasModulePermission]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: t("logout.title"),
      description: t("logout.description"),
    });
    navigate("/auth/login");
  };

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

  const prospectsSubMenus = [
    { title: t("nav.dashboard"), url: "/dashboard", icon: Home, screenCode: "dashboard" },
    { title: t("prospects.list"), url: "/dashboard/prospects/list", icon: Users, screenCode: "PROSPECTS_LISTA" },
    { title: t("prospects.kanban"), url: "/dashboard/prospects/kanban", icon: LayoutGrid, screenCode: "PROSPECTS_KANBAN" },
    { title: t("prospects.activities"), url: "/dashboard/prospects/atividades", icon: Activity, screenCode: "PROSPECTS_ATIVIDADES" },
    { title: t("prospects.tasks"), url: "/dashboard/tarefas", icon: CheckSquare, screenCode: "tarefas" },
    { title: t("prospects.demands"), url: "/dashboard/demandas", icon: Ticket, screenCode: "PROSPECTS_DEMANDAS" },
  ];

  const financeiroSubMenus = [
    { title: t("financeiro.overview"), url: "/dashboard/financeiro", icon: Home, end: true, screenCode: "financeiro_dashboard" },
    { title: t("financeiro.consolidated"), url: "/dashboard/financeiro/consolidado", icon: Layers, screenCode: "financeiro_dashboard" },
    { title: t("financeiro.dre"), url: "/dashboard/financeiro/dre-analitico", icon: FileText, screenCode: "financeiro_dre" },
    { title: t("financeiro.departments"), url: "/dashboard/financeiro/visao-departamentos", icon: Building2, screenCode: "financeiro_departamentos" },
    { title: t("financeiro.trade_budget"), url: "/dashboard/financeiro/trade", icon: Store, screenCode: "financeiro_verbas" },
    { title: t("financeiro.payments_center"), url: "/dashboard/financeiro/central-pagamentos", icon: CreditCard, screenCode: "financeiro_contas_pagar" },
    { title: t("financeiro.dept_approvals"), url: "/dashboard/departamentos/aprovacoes", icon: ClipboardCheck, screenCode: "financeiro_aprovacoes_depts" },
    { title: t("financeiro.payables"), url: "/dashboard/financeiro/contas-a-pagar", icon: Receipt, screenCode: "financeiro_contas_pagar" },
    { title: t("financeiro.receivables"), url: "/dashboard/financeiro/contas-a-receber", icon: DollarSign, screenCode: "financeiro_contas_receber" },
    { title: t("financeiro.cashflow"), url: "/dashboard/financeiro/fluxo-de-caixa", icon: TrendingUp, screenCode: "financeiro_fluxo_caixa" },
    { title: t("financeiro.bank_balances"), url: "/dashboard/financeiro/saldos-bancarios", icon: Wallet, screenCode: "financeiro_saldos_bancarios" },
    { title: t("financeiro.chart_accounts"), url: "/dashboard/financeiro/plano-contas", icon: List, screenCode: "financeiro_plano_contas" },
    { title: t("financeiro.classify_bank"), url: "/dashboard/financeiro/classificar-banco", icon: ClipboardCheck, screenCode: "financeiro_classificar" },
    { title: "Conciliação Bancária", url: "/dashboard/financeiro/conciliacao-bancaria", icon: Landmark, screenCode: "financeiro_saldos_bancarios" },
    { title: "Investimentos", url: "/dashboard/financeiro/investimentos", icon: TrendingUp, screenCode: "financeiro_saldos_bancarios" },
  ];

  const tradeSubMenus = [
    { title: t("trade.admin"), url: "/dashboard/trade/admin", icon: Settings, screenCode: "trade_admin" },
    { title: t("trade.my_team"), url: "/dashboard/trade/minha-equipe", icon: Users, screenCode: "TRADE_DASHBOARD", requireAdminOrSupervisor: true },
    { title: t("trade.pdvs"), url: "/dashboard/trade/stores", icon: Store, screenCode: "TRADE_LOJAS" },
    { title: t("trade.visits"), url: "/dashboard/trade/visits", icon: Calendar, screenCode: "TRADE_VISITAS" },
    { title: t("trade.sellout"), url: "/dashboard/trade/sellout", icon: DollarSign, screenCode: "trade_sellout" },
    { title: t("trade.shelf"), url: "/dashboard/trade/shelf-measurements", icon: Activity, screenCode: "trade_shelf" },
    { title: t("trade.brands"), url: "/dashboard/trade/our-brands", icon: Tag, screenCode: "trade_brands" },
    { title: t("trade.photos"), url: "/dashboard/trade/photos", icon: Camera, screenCode: "TRADE_FOTOS" },
    { title: t("trade.ideal_photos"), url: "/dashboard/trade/ideal-photos", icon: Image, screenCode: "trade_ideal_photos" },
    { title: t("trade.audit"), url: "/dashboard/trade/auditorias", icon: ClipboardCheck, screenCode: "TRADE_AUDITORIAS" },
    { title: t("trade.competitive"), url: "/dashboard/trade/relatorio-competitivo", icon: BarChart3, screenCode: "trade_competitors", requireAdminOrSupervisor: true },
    { title: t("trade.rewards"), url: "/dashboard/trade/rewards", icon: Trophy, screenCode: "trade_rewards" },
    { title: t("trade.whatsapp"), url: "/dashboard/trade/whatsapp", icon: MessageSquare, screenCode: "trade_whatsapp" },
    { title: t("trade.ai_insights"), url: "/dashboard/trade/insights", icon: Sparkles, screenCode: "trade_insights", requireAdminOrSupervisor: true },
  ];

  const marketingSubMenus = [
    { title: t("marketing.dashboards"), url: "/dashboard/marketing/social", icon: BarChart3, screenCode: "MARKETING_SOCIAL" },
  ];

  const precosSubMenus = [
    { title: t("precos.dashboard"), url: "/dashboard/precos", icon: Home, end: true, screenCode: "precos_dashboard" },
    { title: t("precos.matrix"), url: "/dashboard/precos/matriz", icon: Grid3X3, screenCode: "precos_matriz" },
    { title: t("precos.manage"), url: "/dashboard/precos/tabelas", icon: Receipt, screenCode: "precos_tabelas" },
    { title: t("precos.approval"), url: "/dashboard/precos/aprovacao", icon: CheckSquare, screenCode: "precos_aprovacao" },
    { title: t("precos.client_portal"), url: "/dashboard/precos/portal-cliente", icon: Users, screenCode: "precos_portal" },
    { title: t("precos.access_control"), url: "/dashboard/precos/acesso", icon: Shield, screenCode: "precos_acesso" },
  ];

  return (
    <Sidebar side={side} className={cn("border-sidebar-border", isRTL ? "border-l" : "border-r")}>
      {/* Header with logo */}
      <div className="p-4 border-b border-sidebar-border bg-gradient-to-b from-sidebar-background to-sidebar-accent/30">
        <img src={logoUnion} alt="Logo Union - Sistema de Gestão Huggs" className="w-28 mx-auto" />
      </div>

      {/* Module filter */}
      {moduleFilterOptions.length > 1 && (
        <div className="px-3 py-2 border-b border-sidebar-border">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="w-full h-9 justify-between text-xs bg-sidebar-accent/30 border-sidebar-border"
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
        {/* Geral */}
        <SidebarGroup className="py-2">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1 px-2">
              {isAdmin && hasPermission("auditoria") && (
                <MenuItemLink to="/dashboard/auditoria" icon={Shield} title={t("nav.audit")} />
              )}
              
              {/* Instalar App - visível para todos os usuários */}
              <MenuItemLink to="/dashboard/instalar-app" icon={Download} title={t("nav.install_app")} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="mx-4 w-auto" />

        {/* Módulo de Prospects */}
        {showModule("prospects") && (
          <SidebarGroup className="py-2 px-2">
            <Collapsible open={prospectsOpen} onOpenChange={setProspectsOpen}>
              <CollapsibleTrigger className="w-full">
                <ModuleHeader 
                  icon={Users} 
                  title={t("module.prospects")} 
                  isOpen={prospectsOpen} 
                  colorKey="prospects" 
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent className="mt-1">
                  <SidebarMenu className="space-y-0.5 ps-2">
                    {hasPermission("PROSPECTS_DASHBOARD") && (
                      <MenuItemLink 
                        to="/dashboard/prospects" 
                        icon={Home} 
                        title={t("prospects.overview")} 
                        colorKey="prospects"
                        end 
                      />
                    )}
                    {prospectsSubMenus
                      .filter((item) => hasPermission(item.screenCode))
                      .map((item) => (
                        <MenuItemLink 
                          key={item.url}
                          to={item.url} 
                          icon={item.icon} 
                          title={item.title} 
                          colorKey="prospects"
                        />
                      ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}

        {/* Módulo Financeiro */}
        {showModule("financeiro") && (
          <SidebarGroup className="py-2 px-2">
            <Collapsible open={financeiroOpen} onOpenChange={setFinanceiroOpen} defaultOpen>
              <CollapsibleTrigger className="w-full">
                <ModuleHeader 
                  icon={DollarSign} 
                  title={t("module.financeiro")} 
                  isOpen={financeiroOpen} 
                  colorKey="financeiro" 
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent className="mt-1">
                  <SidebarMenu className="space-y-0.5 ps-2">
                    {financeiroSubMenus
                      .filter((item) => hasPermission(item.screenCode))
                      .map((item) => (
                        <MenuItemLink 
                          key={item.url}
                          to={item.url} 
                          icon={item.icon} 
                          title={item.title} 
                          colorKey="financeiro"
                          end={item.end}
                        />
                      ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}

        {/* Módulo de Marketing */}
        {showModule("marketing") && (
          <SidebarGroup className="py-2 px-2">
            <Collapsible open={marketingOpen} onOpenChange={setMarketingOpen}>
              <CollapsibleTrigger className="w-full">
                <ModuleHeader 
                  icon={BarChart3} 
                  title={t("module.marketing")} 
                  isOpen={marketingOpen} 
                  colorKey="marketing" 
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent className="mt-1">
                  <SidebarMenu className="space-y-0.5 ps-2">
                    {hasPermission("MARKETING_DASHBOARD") && (
                      <MenuItemLink 
                        to="/dashboard/marketing" 
                        icon={Home} 
                        title={t("marketing.overview")} 
                        colorKey="marketing"
                        end 
                      />
                    )}
                    {marketingSubMenus
                      .filter((item) => hasPermission(item.screenCode))
                      .map((item) => (
                        <MenuItemLink 
                          key={item.url}
                          to={item.url} 
                          icon={item.icon} 
                          title={item.title} 
                          colorKey="marketing"
                        />
                      ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}

        {/* Módulo de Trade Marketing */}
        {showModule("trade") && (
          <SidebarGroup className="py-2 px-2">
            <Collapsible open={tradeOpen} onOpenChange={setTradeOpen}>
              <CollapsibleTrigger className="w-full">
                <ModuleHeader 
                  icon={Store} 
                  title={t("module.trade")} 
                  isOpen={tradeOpen} 
                  colorKey="trade" 
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent className="mt-1">
                  <ScrollArea className="max-h-64">
                    <SidebarMenu className="space-y-0.5 ps-2">
                      {hasPermission("TRADE_DASHBOARD") && (
                        <MenuItemLink 
                          to="/dashboard/trade" 
                          icon={Home} 
                          title={t("prospects.overview")} 
                          colorKey="trade"
                          end 
                        />
                      )}
                      {tradeSubMenus
                        .filter((item) => hasPermission(item.screenCode) && (!item.requireAdminOrSupervisor || isAdminOrSupervisor))
                        .map((item) => (
                          <MenuItemLink 
                            key={item.url}
                            to={item.url} 
                            icon={item.icon} 
                            title={item.title} 
                            colorKey="trade"
                          />
                        ))}
                    </SidebarMenu>
                  </ScrollArea>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}

        {/* Módulo de Fábrica - Com grupos */}
        {showModule("fabrica") && (
          <SidebarGroup className="py-2 px-2">
            <Collapsible open={fabricaOpen} onOpenChange={setFabricaOpen}>
              <CollapsibleTrigger className="w-full">
                <ModuleHeader 
                  icon={Factory} 
                  title={t("module.fabrica")} 
                  isOpen={fabricaOpen} 
                  colorKey="fabrica" 
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent className="mt-1">
                  <ScrollArea className="max-h-72">
                    <SidebarMenu className="space-y-0.5 ps-2">
                      {hasPermission("fabrica_dashboard") && (
                        <MenuItemLink 
                          to="/dashboard/fabrica" 
                          icon={Home} 
                          title={t("fabrica.dashboard")} 
                          colorKey="fabrica"
                          end 
                        />
                      )}
                      
                      {fabricaGroups.map((group) => {
                        const filteredItems = group.items.filter((item) => isAdmin || hasPermission(item.screenCode));
                        if (filteredItems.length === 0) return null;
                        
                        return (
                          <div key={group.label} className="mt-2 first:mt-0">
                            <span className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                              {group.label}
                            </span>
                            {filteredItems.map((item) => (
                              <MenuItemLink 
                                key={item.url}
                                to={item.url} 
                                icon={item.icon} 
                                title={item.title} 
                                colorKey="fabrica"
                              />
                            ))}
                          </div>
                        );
                      })}
                    </SidebarMenu>
                  </ScrollArea>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}

        {/* Módulo Fábrica China */}
        {showModule("china") && (
          <SidebarGroup className="py-2 px-2">
            <Collapsible open={chinaOpen} onOpenChange={setChinaOpen}>
              <CollapsibleTrigger className="w-full">
                <ModuleHeader 
                  icon={Globe} 
                  title="Fábrica China 中国工厂" 
                  isOpen={chinaOpen} 
                  colorKey="china" 
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent className="mt-1">
                  <SidebarMenu className="space-y-0.5 ps-2">
                    <MenuItemLink 
                      to="/dashboard/fabrica-china" 
                      icon={Home} 
                      title="Painel 面板" 
                      colorKey="china"
                      end 
                    />
                    <MenuItemLink 
                      to="/dashboard/fabrica-china/nova" 
                      icon={Upload} 
                      title="Nova Submissão 新提交" 
                      colorKey="china"
                    />
                    <MenuItemLink 
                      to="/dashboard/fabrica-china/recebimentos" 
                      icon={Package} 
                      title="Submissões 提交" 
                      colorKey="china"
                    />
                    <MenuItemLink 
                      to="/dashboard/fabrica-china/ordens" 
                      icon={ShoppingCart} 
                      title="Ordens de Compra 采购订单" 
                      colorKey="china"
                    />
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}


        {showModule("comercial") && (
          <SidebarGroup className="py-2 px-2">
            <Collapsible open={comercialOpen} onOpenChange={setComercialOpen}>
              <CollapsibleTrigger className="w-full">
                <ModuleHeader 
                  icon={Briefcase} 
                  title={t("module.comercial")} 
                  isOpen={comercialOpen} 
                  colorKey="comercial" 
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent className="mt-1">
                  <SidebarMenu className="space-y-0.5 ps-2">
                    {hasPermission("comercial_dashboard") && (
                      <MenuItemLink 
                        to="/dashboard/comercial" 
                        icon={Home} 
                        title={t("comercial.dashboard")} 
                        colorKey="comercial"
                        end 
                      />
                    )}
                    {hasPermission("comercial_lancamentos") && (
                      <MenuItemLink 
                        to="/dashboard/comercial/lancamentos" 
                        icon={Rocket} 
                        title={t("comercial.launches")} 
                        colorKey="comercial"
                      />
                    )}
                    <MenuItemLink 
                      to="/dashboard/comercial/ibge" 
                      icon={MapPin} 
                      title={t("comercial.ibge")} 
                      colorKey="comercial"
                    />
                    <MenuItemLink 
                      to="/dashboard/comercial/mineracao" 
                      icon={Pickaxe} 
                      title={t("comercial.mining")} 
                      colorKey="comercial"
                    />
                    <MenuItemLink 
                      to="/dashboard/comercial/reativacao" 
                      icon={AlertTriangle} 
                      title={t("comercial.reactivation")} 
                      colorKey="comercial"
                    />
                    <MenuItemLink 
                      to="/dashboard/comercial/municipios-inteligencia" 
                      icon={Building2} 
                      title={t("comercial.municipalities")} 
                      colorKey="comercial"
                    />
                    <MenuItemLink 
                      to="/dashboard/comercial/whitespace" 
                      icon={Compass} 
                      title={t("comercial.whitespace")} 
                      colorKey="comercial"
                    />
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}

        {/* Módulo de Eventos Corporativos */}
        {showModule("eventos") && (
          <SidebarGroup className="py-2 px-2">
            <Collapsible open={eventosOpen} onOpenChange={setEventosOpen}>
              <CollapsibleTrigger className="w-full">
                <ModuleHeader 
                  icon={PartyPopper} 
                  title={t("module.eventos")} 
                  isOpen={eventosOpen} 
                  colorKey="eventos" 
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent className="mt-1">
                  <SidebarMenu className="space-y-0.5 ps-2">
                    {hasPermission("eventos_dashboard") && (
                      <MenuItemLink 
                        to="/dashboard/eventos" 
                        icon={Home} 
                        title={t("eventos.events")} 
                        colorKey="eventos"
                        end 
                      />
                    )}
                    {hasPermission("eventos_analytics") && (
                      <MenuItemLink 
                        to="/dashboard/eventos/dashboard" 
                        icon={BarChart3} 
                        title={t("eventos.dashboard")} 
                        colorKey="eventos"
                      />
                    )}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}

        {/* Módulo de Departamentos - Cada departamento com submenu */}
        {showModule("departamentos") && userDepartments.length > 0 && userDepartments.map((dept, index) => {
          // Cores harmoniosas para cada departamento
          const deptColors = [
            { bg: "bg-blue-500", bgLight: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-600 dark:text-blue-400", hover: "hover:bg-blue-100 dark:hover:bg-blue-900/40" },
            { bg: "bg-emerald-500", bgLight: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-600 dark:text-emerald-400", hover: "hover:bg-emerald-100 dark:hover:bg-emerald-900/40" },
            { bg: "bg-amber-500", bgLight: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-600 dark:text-amber-400", hover: "hover:bg-amber-100 dark:hover:bg-amber-900/40" },
            { bg: "bg-violet-500", bgLight: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-600 dark:text-violet-400", hover: "hover:bg-violet-100 dark:hover:bg-violet-900/40" },
            { bg: "bg-rose-500", bgLight: "bg-rose-50 dark:bg-rose-950/30", text: "text-rose-600 dark:text-rose-400", hover: "hover:bg-rose-100 dark:hover:bg-rose-900/40" },
            { bg: "bg-cyan-500", bgLight: "bg-cyan-50 dark:bg-cyan-950/30", text: "text-cyan-600 dark:text-cyan-400", hover: "hover:bg-cyan-100 dark:hover:bg-cyan-900/40" },
            { bg: "bg-orange-500", bgLight: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-600 dark:text-orange-400", hover: "hover:bg-orange-100 dark:hover:bg-orange-900/40" },
            { bg: "bg-teal-500", bgLight: "bg-teal-50 dark:bg-teal-950/30", text: "text-teal-600 dark:text-teal-400", hover: "hover:bg-teal-100 dark:hover:bg-teal-900/40" },
          ];
          const color = deptColors[index % deptColors.length];
          
          return (
            <SidebarGroup key={dept.id} className="py-2 px-2">
              <Collapsible defaultOpen={false}>
                <CollapsibleTrigger className="w-full">
                  <div className={cn(
                    "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-all duration-200",
                    color.bgLight,
                    color.hover
                  )}>
                    <div className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-lg",
                      color.bg
                    )}>
                      <Building2 className="h-4 w-4 text-white" />
                    </div>
                    <span className={cn("font-semibold text-sm flex-1 text-left", color.text)}>
                      {dept.nome}
                    </span>
                    <ChevronDown className={cn(
                      "h-4 w-4 transition-transform duration-200",
                      color.text
                    )} />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent className="mt-1">
                    <SidebarMenu className="space-y-0.5 ps-2">
                      <MenuItemLink 
                        to={`/dashboard/departamentos/${dept.id}`} 
                        icon={FileText} 
                        title={t("dept.expenses")} 
                        colorKey="departamentos"
                        end
                      />
                      <MenuItemLink 
                        to={`/dashboard/departamentos/${dept.id}/dashboard`} 
                        icon={BarChart3} 
                        title={t("dept.dashboard")} 
                        colorKey="departamentos"
                      />
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </Collapsible>
            </SidebarGroup>
          );
        })}

        {/* Módulo de Projetos */}
        {showModule("projetos") && (
        <SidebarGroup className="py-2 px-2">
          <Collapsible defaultOpen={false}>
            <CollapsibleTrigger className="w-full">
              <div className={cn(
                "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-all duration-200",
                "bg-indigo-50 dark:bg-indigo-950/30",
                "hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
              )}>
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500">
                  <FolderKanban className="h-4 w-4 text-white" />
                </div>
                <span className="font-semibold text-sm flex-1 text-indigo-600 dark:text-indigo-400">Projetos</span>
                <ChevronDown className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent className="mt-1">
                <SidebarMenu className="space-y-0.5 ps-2">
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
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>
        )}

        {/* Módulo de Reuniões */}
        {showModule("reunioes") && (
        <SidebarGroup className="py-2 px-2">
          <Collapsible defaultOpen={false}>
            <CollapsibleTrigger className="w-full">
              <div className={cn(
                "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-all duration-200",
                "bg-teal-50 dark:bg-teal-950/30",
                "hover:bg-teal-100 dark:hover:bg-teal-900/40"
              )}>
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-teal-500">
                  <Mic className="h-4 w-4 text-white" />
                </div>
                <span className="font-semibold text-sm flex-1 text-teal-600 dark:text-teal-400">Reuniões</span>
                <ChevronDown className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent className="mt-1">
                <SidebarMenu className="space-y-0.5 ps-2">
                  <MenuItemLink to="/dashboard/reunioes" icon={Mic} title="Reuniões" end />
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>
        )}

        {/* Módulo de Estoque */}
        {showModule("estoque") && (
          <SidebarGroup className="py-2 px-2">
            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger className="w-full">
                <div className={cn(
                  "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-all duration-200",
                  "bg-emerald-50 dark:bg-emerald-950/30",
                  "hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                )}>
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500">
                    <Package className="h-4 w-4 text-white" />
                  </div>
                  <span className="font-semibold text-sm flex-1 text-emerald-600 dark:text-emerald-400">Estoque</span>
                  <ChevronDown className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent className="mt-1">
                  <SidebarMenu className="space-y-0.5 ps-2">
                    <MenuItemLink to="/dashboard/estoque" icon={Home} title="Painel" end />
                    <MenuItemLink to="/dashboard/estoque/distribuidoras" icon={Building2} title="Distribuidoras" />
                    <MenuItemLink to="/dashboard/estoque/produtos-master" icon={Package} title="Produtos Master" />
                    <MenuItemLink to="/dashboard/estoque/saldos" icon={Layers} title="Saldos" />
                    <MenuItemLink to="/dashboard/estoque/consolidado" icon={BarChart3} title="Consolidado" />
                    <MenuItemLink to="/dashboard/estoque/vinculacoes" icon={Send} title="Vinculações" />
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}

        {/* Módulo de Aprovação de Artes */}
        {showModule("aprovacao_artes") && (
          <SidebarGroup className="py-2 px-2">
            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger className="w-full">
                <div className={cn(
                  "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-all duration-200",
                  "bg-violet-50 dark:bg-violet-950/30",
                  "hover:bg-violet-100 dark:hover:bg-violet-900/40"
                )}>
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-500">
                    <Palette className="h-4 w-4 text-white" />
                  </div>
                  <span className="font-semibold text-sm flex-1 text-violet-600 dark:text-violet-400">Aprovação de Artes</span>
                  <ChevronDown className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent className="mt-1">
                  <SidebarMenu className="space-y-0.5 ps-2">
                    <MenuItemLink to="/dashboard/aprovacao-artes" icon={Home} title="Painel" end />
                    <MenuItemLink to="/dashboard/aprovacao-artes/configuracao" icon={Settings} title="Configuração" />
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}


          <SidebarGroup className="py-2 px-2">
            <Collapsible open={precosOpen} onOpenChange={setPrecosOpen}>
              <CollapsibleTrigger className="w-full">
                <ModuleHeader 
                  icon={DollarSign} 
                  title={t("module.precos")} 
                  isOpen={precosOpen} 
                  colorKey="precos" 
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent className="mt-1">
                  <SidebarMenu className="space-y-0.5 ps-2">
                    {precosSubMenus
                      .filter((item) => hasPermission(item.screenCode))
                      .map((item) => (
                        <MenuItemLink 
                          key={item.url}
                          to={item.url} 
                          icon={item.icon} 
                          title={item.title} 
                          colorKey="precos"
                          end={item.end}
                          badge={
                            item.title === "Aprovação" && tabelasPendentes > 0 ? (
                              <Badge className="ml-auto bg-yellow-500 hover:bg-yellow-600 text-xs h-5 min-w-5 flex items-center justify-center">
                                {tabelasPendentes}
                              </Badge>
                            ) : undefined
                          }
                        />
                      ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}
      </SidebarContent>
      
      {/* Footer profissional */}
      <SidebarFooter className="border-t border-sidebar-border bg-gradient-to-t from-sidebar-background to-sidebar-accent/20">
        {/* User info */}
        {userName && (
          <div className="px-4 py-2 border-b border-sidebar-border/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <span className="text-xs font-bold text-white">
                  {userName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{userName}</p>
                <p className="text-xs text-muted-foreground">{t("nav.connected")}</p>
              </div>
            </div>
          </div>
        )}
        
        <SidebarMenu className="px-2 py-2">
          {hasModulePermission("configuracoes") && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <NavLink 
                  to="/dashboard/configuracoes"
                  className={({ isActive }) => cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg transition-all",
                    isActive 
                      ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <Settings className="h-4 w-4" />
                  <span>{t("nav.settings")}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          {isAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <NavLink 
                  to="/dashboard/configuracoes/lgpd"
                  className={({ isActive }) => cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg transition-all",
                    isActive 
                      ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <Shield className="h-4 w-4" />
                  <span>LGPD</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          {isAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <NavLink 
                  to="/dashboard/relatorio-seguranca"
                  className={({ isActive }) => cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg transition-all",
                    isActive 
                      ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <Shield className="h-4 w-4" />
                  <span>Rel. Segurança</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          {isAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <NavLink 
                  to="/dashboard/relatorio-desenvolvimento"
                  className={({ isActive }) => cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg transition-all",
                    isActive 
                      ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <Package className="h-4 w-4" />
                  <span>Rel. Desenvolvimento</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive transition-all"
            >
              <LogOut className="h-4 w-4" />
              <span>{t("nav.logout")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        
        {/* Links legais LGPD */}
        <div className="px-4 py-2 border-t border-sidebar-border/50 flex gap-3">
          <a href="/politica-privacidade" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <FileText className="h-3 w-3" />
            Privacidade
          </a>
          <a href="/termos-de-uso" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <FileText className="h-3 w-3" />
            Termos
          </a>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
