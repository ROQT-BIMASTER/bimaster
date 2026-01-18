import { 
  Home, Users, Building2, LogOut, Settings, Upload, Shield, 
  LayoutGrid, CheckSquare, MapPin, MessageSquare, Activity, Clock,
  Store, Calendar, Camera, Tag, TrendingUp, Brain, ChevronDown, ChevronRight, Image, ClipboardCheck, DollarSign, FileText, Download, Phone, Trophy, BarChart3, Sparkles, Package, Factory, Receipt, Layers, Cog, UserCircle, AlertCircle, Pause, Wrench, List, Bot, Wallet
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import logoUnion from "@/assets/logo-union.png";
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
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

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
        !isOpen && "-rotate-90"
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
                  colors ? cn(colors.bgLight, colors.text, "border-l-2", colors.border) : "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-primary"
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

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { permissions, loading: permissionsLoading, hasPermission } = useScreenPermissions();
  const { hasModulePermission, loading: modulesLoading } = useModulePermissions();
  const { user } = useAuth();
  
  const [prospectsOpen, setProspectsOpen] = useState(true);
  const [financeiroOpen, setFinanceiroOpen] = useState(true);
  const [tradeOpen, setTradeOpen] = useState(true);
  const [marketingOpen, setMarketingOpen] = useState(true);
  const [fabricaOpen, setFabricaOpen] = useState(true);
  const [precosOpen, setPrecosOpen] = useState(true);
  const [tabelasPendentes, setTabelasPendentes] = useState(0);
  const [userName, setUserName] = useState<string>("");

  const loading = permissionsLoading || modulesLoading;

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
      title: "Logout realizado",
      description: "Até logo!",
    });
    navigate("/auth/login");
  };

  if (loading) {
    return (
      <Sidebar>
        <SidebarContent>
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </SidebarContent>
      </Sidebar>
    );
  }

  const prospectsSubMenus = [
    { title: "Lista de Prospects", url: "/dashboard/prospects/list", icon: Users, screenCode: "PROSPECTS_LISTA" },
    { title: "Kanban", url: "/dashboard/prospects/kanban", icon: LayoutGrid, screenCode: "PROSPECTS_KANBAN" },
    { title: "Atividades", url: "/dashboard/prospects/atividades", icon: Activity, screenCode: "PROSPECTS_ATIVIDADES" },
    { title: "Mapa", url: "/dashboard/prospects/mapa", icon: MapPin, screenCode: "PROSPECTS_MAPA" },
  ];

  const financeiroSubMenus = [
    { title: "Visão Geral", url: "/dashboard/financeiro", icon: Home, end: true, screenCode: "financeiro_dashboard" },
    { title: "DRE Analítico", url: "/dashboard/financeiro/dre-analitico", icon: FileText, screenCode: "financeiro_dre" },
    { title: "Visão por Departamento", url: "/dashboard/financeiro/visao-departamentos", icon: Building2, screenCode: "financeiro_departamentos" },
    { title: "Gestão de Verbas", url: "/dashboard/financeiro/trade", icon: Store, screenCode: "financeiro_verbas" },
    { title: "Contas a Pagar", url: "/dashboard/financeiro/contas-a-pagar", icon: Receipt, screenCode: "financeiro_contas_pagar" },
    { title: "Contas a Receber", url: "/dashboard/financeiro/contas-a-receber", icon: DollarSign, screenCode: "financeiro_contas_receber" },
    { title: "Fluxo de Caixa", url: "/dashboard/financeiro/fluxo-de-caixa", icon: TrendingUp, screenCode: "financeiro_fluxo_caixa" },
    { title: "Saldos Bancários", url: "/dashboard/financeiro/saldos-bancarios", icon: Wallet, screenCode: "financeiro_saldos_bancarios" },
    { title: "Plano de Contas", url: "/dashboard/financeiro/plano-contas", icon: List, screenCode: "financeiro_plano_contas" },
    { title: "Classificar Banco", url: "/dashboard/financeiro/classificar-banco", icon: ClipboardCheck, screenCode: "financeiro_classificar" },
  ];

  const tradeSubMenus = [
    { title: "PDVs", url: "/dashboard/trade/stores", icon: Store, screenCode: "TRADE_LOJAS" },
    { title: "Visitas", url: "/dashboard/trade/visits", icon: Calendar, screenCode: "TRADE_VISITAS" },
    { title: "Sell Out", url: "/dashboard/trade/sellout", icon: DollarSign, screenCode: "trade_sellout" },
    { title: "Medição Prateleiras", url: "/dashboard/trade/shelf-measurements", icon: Activity, screenCode: "trade_shelf" },
    { title: "Nossas Marcas", url: "/dashboard/trade/our-brands", icon: Tag, screenCode: "trade_brands" },
    { title: "Fotos", url: "/dashboard/trade/photos", icon: Camera, screenCode: "TRADE_FOTOS" },
    { title: "Fotos Ideais", url: "/dashboard/trade/ideal-photos", icon: Image, screenCode: "trade_ideal_photos" },
    { title: "Auditoria Gôndola", url: "/dashboard/trade/auditorias", icon: ClipboardCheck, screenCode: "TRADE_AUDITORIAS" },
    { title: "Análise Competitiva", url: "/dashboard/trade/relatorio-competitivo", icon: BarChart3, screenCode: "trade_competitors" },
    { title: "Premiações", url: "/dashboard/trade/rewards", icon: Trophy, screenCode: "trade_rewards" },
    { title: "WhatsApp", url: "/dashboard/trade/whatsapp", icon: MessageSquare, screenCode: "trade_whatsapp" },
    { title: "Insights IA", url: "/dashboard/trade/insights", icon: Sparkles, screenCode: "trade_insights" },
  ];

  const marketingSubMenus = [
    { title: "Dashboards & IA", url: "/dashboard/marketing/social", icon: BarChart3, screenCode: "MARKETING_SOCIAL" },
  ];

  const precosSubMenus = [
    { title: "Dashboard", url: "/dashboard/precos", icon: Home, end: true, screenCode: "precos_dashboard" },
    { title: "Gerenciar Tabelas", url: "/dashboard/precos/tabelas", icon: Receipt, screenCode: "precos_tabelas" },
    { title: "Aprovação", url: "/dashboard/precos/aprovacao", icon: CheckSquare, screenCode: "precos_aprovacao" },
    { title: "Portal Cliente", url: "/dashboard/precos/portal-cliente", icon: Users, screenCode: "precos_portal" },
    { title: "Controle de Acesso", url: "/dashboard/precos/acesso", icon: Shield, screenCode: "precos_acesso" },
  ];

  return (
    <Sidebar className="border-r border-sidebar-border">
      {/* Header with logo */}
      <div className="p-4 border-b border-sidebar-border bg-gradient-to-b from-sidebar-background to-sidebar-accent/30">
        <img src={logoUnion} alt="Logo Union - Sistema de Gestão Huggs" className="w-28 mx-auto" />
      </div>

      <SidebarContent className="scrollbar-thin">
        {/* Dashboard Principal */}
        <SidebarGroup className="py-2">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1 px-2">
              {hasPermission("dashboard") && (
                <MenuItemLink to="/dashboard" icon={Home} title="Dashboard" end />
              )}
              
              {hasPermission("ranking") && (
                <MenuItemLink to="/dashboard/ranking" icon={TrendingUp} title="Ranking" />
              )}
              
              {hasPermission("relatorios") && (
                <MenuItemLink to="/dashboard/relatorios" icon={FileText} title="Relatórios" />
              )}
              
              {hasPermission("ai_analytics") && (
                <MenuItemLink to="/dashboard/ai-analytics" icon={Brain} title="Painel de IA" />
              )}
              
              {hasPermission("chat") && (
                <MenuItemLink to="/dashboard/chat" icon={MessageSquare} title="Chat" />
              )}
              
              {hasPermission("tarefas") && (
                <MenuItemLink to="/dashboard/tarefas" icon={CheckSquare} title="Tarefas" />
              )}
              
              {hasPermission("auditoria") && (
                <MenuItemLink to="/dashboard/auditoria" icon={Shield} title="Auditoria" />
              )}
              
              {hasPermission("instalar_app") && (
                <MenuItemLink to="/dashboard/instalar-app" icon={Download} title="Instalar App" />
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="mx-4 w-auto" />

        {/* Módulo de Prospects */}
        {hasModulePermission("prospects") && (
          <SidebarGroup className="py-2 px-2">
            <Collapsible open={prospectsOpen} onOpenChange={setProspectsOpen}>
              <CollapsibleTrigger className="w-full">
                <ModuleHeader 
                  icon={Users} 
                  title="Prospects" 
                  isOpen={prospectsOpen} 
                  colorKey="prospects" 
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent className="mt-1">
                  <SidebarMenu className="space-y-0.5 pl-2">
                    {hasPermission("PROSPECTS_DASHBOARD") && (
                      <MenuItemLink 
                        to="/dashboard/prospects" 
                        icon={Home} 
                        title="Visão Geral" 
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
        {hasModulePermission("financeiro") && (
          <SidebarGroup className="py-2 px-2">
            <Collapsible open={financeiroOpen} onOpenChange={setFinanceiroOpen} defaultOpen>
              <CollapsibleTrigger className="w-full">
                <ModuleHeader 
                  icon={DollarSign} 
                  title="Financeiro" 
                  isOpen={financeiroOpen} 
                  colorKey="financeiro" 
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent className="mt-1">
                  <SidebarMenu className="space-y-0.5 pl-2">
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
        {hasModulePermission("marketing") && (
          <SidebarGroup className="py-2 px-2">
            <Collapsible open={marketingOpen} onOpenChange={setMarketingOpen}>
              <CollapsibleTrigger className="w-full">
                <ModuleHeader 
                  icon={BarChart3} 
                  title="Marketing" 
                  isOpen={marketingOpen} 
                  colorKey="marketing" 
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent className="mt-1">
                  <SidebarMenu className="space-y-0.5 pl-2">
                    {hasPermission("MARKETING_DASHBOARD") && (
                      <MenuItemLink 
                        to="/dashboard/marketing" 
                        icon={Home} 
                        title="Visão Geral" 
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
        {hasModulePermission("trade") && (
          <SidebarGroup className="py-2 px-2">
            <Collapsible open={tradeOpen} onOpenChange={setTradeOpen}>
              <CollapsibleTrigger className="w-full">
                <ModuleHeader 
                  icon={Store} 
                  title="Trade Marketing" 
                  isOpen={tradeOpen} 
                  colorKey="trade" 
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent className="mt-1">
                  <ScrollArea className="max-h-64">
                    <SidebarMenu className="space-y-0.5 pl-2">
                      {hasPermission("TRADE_DASHBOARD") && (
                        <MenuItemLink 
                          to="/dashboard/trade" 
                          icon={Home} 
                          title="Visão Geral" 
                          colorKey="trade"
                          end 
                        />
                      )}
                      {tradeSubMenus
                        .filter((item) => hasPermission(item.screenCode))
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
        {hasModulePermission("fabrica") && (
          <SidebarGroup className="py-2 px-2">
            <Collapsible open={fabricaOpen} onOpenChange={setFabricaOpen}>
              <CollapsibleTrigger className="w-full">
                <ModuleHeader 
                  icon={Factory} 
                  title="Fábrica" 
                  isOpen={fabricaOpen} 
                  colorKey="fabrica" 
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent className="mt-1">
                  <ScrollArea className="max-h-72">
                    <SidebarMenu className="space-y-0.5 pl-2">
                      {hasPermission("fabrica_dashboard") && (
                        <MenuItemLink 
                          to="/dashboard/fabrica" 
                          icon={Home} 
                          title="Dashboard" 
                          colorKey="fabrica"
                          end 
                        />
                      )}
                      
                      {fabricaGroups.map((group) => {
                        const filteredItems = group.items.filter((item) => hasPermission(item.screenCode));
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

        {/* Módulo de Tabelas de Preços */}
        {hasModulePermission("precos") && (
          <SidebarGroup className="py-2 px-2">
            <Collapsible open={precosOpen} onOpenChange={setPrecosOpen}>
              <CollapsibleTrigger className="w-full">
                <ModuleHeader 
                  icon={DollarSign} 
                  title="Tabelas de Preços" 
                  isOpen={precosOpen} 
                  colorKey="precos" 
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent className="mt-1">
                  <SidebarMenu className="space-y-0.5 pl-2">
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
                <p className="text-xs text-muted-foreground">Conectado</p>
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
                  <span>Configurações</span>
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
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
