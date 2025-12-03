import { 
  Home, Users, Building2, LogOut, Settings, Upload, Shield, 
  LayoutGrid, CheckSquare, MapPin, MessageSquare, Activity, Clock,
  Store, Calendar, Camera, Tag, TrendingUp, Brain, ChevronDown, ChevronRight, Image, ClipboardCheck, DollarSign, FileText, Download, Phone, Trophy, BarChart3, Sparkles, Package, Factory, Receipt, Layers, Cog, UserCircle, AlertCircle, Pause, Wrench, List
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

const iconMap: Record<string, any> = {
  LayoutDashboard: Home,
  Users: Users,
  KanbanSquare: LayoutGrid,
  CheckSquare: CheckSquare,
  Map: MapPin,
  MessageSquare: MessageSquare,
  MapPin: Building2,
  Activity: Activity,
  Upload: Upload,
  Shield: Shield,
  Clock: Clock,
  Settings: Settings,
  Store: Store,
  Calendar: Calendar,
  Camera: Camera,
  Tag: Tag,
  TrendingUp: TrendingUp,
  Brain: Brain,
  Trophy: Trophy,
  Sparkles: Sparkles,
};

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { permissions, loading: permissionsLoading, hasPermission } = useScreenPermissions();
  const { hasModulePermission, loading: modulesLoading } = useModulePermissions();
  
  const [prospectsOpen, setProspectsOpen] = useState(true);
  const [financeiroOpen, setFinanceiroOpen] = useState(true);
  const [tradeOpen, setTradeOpen] = useState(true);
  const [marketingOpen, setMarketingOpen] = useState(true);
  const [fabricaOpen, setFabricaOpen] = useState(true);
  const [precosOpen, setPrecosOpen] = useState(true);
  const [tabelasPendentes, setTabelasPendentes] = useState(0);

  const loading = permissionsLoading || modulesLoading;

  // Buscar tabelas pendentes - APENAS se tiver permissão do módulo de preços
  useEffect(() => {
    // Não carregar dados se não tiver permissão ou ainda estiver carregando
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

    // Realtime - apenas se tiver permissão
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
    { title: "Lista de Prospects", url: "/dashboard/prospects/list", icon: Users },
    { title: "Kanban", url: "/dashboard/prospects/kanban", icon: LayoutGrid },
    { title: "Atividades", url: "/dashboard/prospects/atividades", icon: Activity },
    { title: "Mapa", url: "/dashboard/prospects/mapa", icon: MapPin },
  ];

  const financeiroSubMenus = [
    { title: "Visão Geral", url: "/dashboard/financeiro", icon: Home },
    { title: "DRE Analítico", url: "/dashboard/financeiro/dre-analitico", icon: FileText },
    { title: "Visão por Departamento", url: "/dashboard/financeiro/visao-departamentos", icon: Building2 },
    { title: "Gestão de Verbas", url: "/dashboard/financeiro/trade", icon: Store },
    { title: "Contas a Pagar", url: "/dashboard/financeiro/contas-a-pagar", icon: Receipt },
    { title: "Plano de Contas", url: "/dashboard/financeiro/plano-contas", icon: List },
    { title: "Classificar Banco", url: "/dashboard/financeiro/classificar-banco", icon: ClipboardCheck },
  ];

  const tradeSubMenus = [
    { title: "PDVs", url: "/dashboard/trade/stores", icon: Store },
    { title: "Visitas", url: "/dashboard/trade/visits", icon: Calendar },
    { title: "Sell Out", url: "/dashboard/trade/sellout", icon: DollarSign },
    { title: "Medição Prateleiras", url: "/dashboard/trade/shelf-measurements", icon: Activity },
    { title: "Nossas Marcas", url: "/dashboard/trade/our-brands", icon: Tag },
    { title: "Fotos", url: "/dashboard/trade/photos", icon: Camera },
    { title: "Fotos Ideais", url: "/dashboard/trade/ideal-photos", icon: Image },
    { title: "Auditoria Gôndola", url: "/dashboard/trade/auditorias", icon: ClipboardCheck },
    { title: "Análise Competitiva", url: "/dashboard/trade/relatorio-competitivo", icon: BarChart3 },
    { title: "Premiações", url: "/dashboard/trade/rewards", icon: Trophy },
    { title: "WhatsApp", url: "/dashboard/trade/whatsapp", icon: MessageSquare },
    { title: "Insights IA", url: "/dashboard/trade/insights", icon: Sparkles },
  ];

  const marketingSubMenus = [
    { title: "Dashboards & IA", url: "/dashboard/marketing/social", icon: BarChart3 },
  ];

  const otherMenus = permissions.filter(screen => 
    !['prospects', 'kanban', 'atividades', 'mapa', 
      'marketing', 'marketing_dashboards', 'marketing_whatsapp',
      'trade', 'trade_stores', 'trade_visits', 'trade_sellout', 'trade_shelf_measurements',
      'trade_our_brands', 'trade_photos', 'trade_ideal_photos', 'trade_auditorias',
      'trade_relatorio_competitivo', 'trade_financeiro', 'trade_rewards', 'trade_whatsapp', 'trade_insights',
      'relatorios', 'ai_analytics', 'instalar_app',
      'configuracoes', 'dashboard', 'ranking'].includes(screen.codigo)
  );

  return (
    <Sidebar>
      <SidebarContent>
        <div className="p-4 border-b">
          <img src={logoUnion} alt="Logo Union - Sistema BiMaster" className="w-32 mx-auto" />
        </div>

        {/* Dashboard Principal */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {hasPermission("dashboard") && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/dashboard"
                      end
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "hover:bg-sidebar-accent/50"
                      }
                    >
                      <Home className="h-4 w-4" />
                      <span>Dashboard</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              
              {hasPermission("ranking") && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/dashboard/ranking"
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "hover:bg-sidebar-accent/50"
                      }
                    >
                      <TrendingUp className="h-4 w-4" />
                      <span>Ranking</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              
              {hasPermission("relatorios") && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/dashboard/relatorios"
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "hover:bg-sidebar-accent/50"
                      }
                    >
                      <FileText className="h-4 w-4" />
                      <span>Relatórios</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              
              {hasPermission("ai_analytics") && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/dashboard/ai-analytics"
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "hover:bg-sidebar-accent/50"
                      }
                    >
                      <Brain className="h-4 w-4" />
                      <span>Painel de IA</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              
              {hasPermission("chat") && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/dashboard/chat"
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "hover:bg-sidebar-accent/50"
                      }
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span>Chat</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              
              {hasPermission("tarefas") && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/dashboard/tarefas"
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "hover:bg-sidebar-accent/50"
                      }
                    >
                      <CheckSquare className="h-4 w-4" />
                      <span>Tarefas</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              
              {hasPermission("auditoria") && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/dashboard/auditoria"
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "hover:bg-sidebar-accent/50"
                      }
                    >
                      <Shield className="h-4 w-4" />
                      <span>Auditoria</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              
              {hasPermission("instalar_app") && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/dashboard/instalar-app"
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "hover:bg-sidebar-accent/50"
                      }
                    >
                      <Download className="h-4 w-4" />
                      <span>Instalar App</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Módulo de Prospects */}
        {hasModulePermission("prospects") && (
          <SidebarGroup>
            <Collapsible open={prospectsOpen} onOpenChange={setProspectsOpen}>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex items-center gap-2 w-full">
                  {prospectsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <Users className="h-4 w-4" />
                  Módulo de Prospects
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to="/dashboard/prospects"
                          end
                          className={({ isActive }) =>
                            isActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground"
                              : "hover:bg-sidebar-accent/50"
                          }
                        >
                          <Home className="h-4 w-4" />
                          <span>Visão Geral</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    {prospectsSubMenus.map((item) => (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={item.url}
                            className={({ isActive }) =>
                              isActive
                                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                : "hover:bg-sidebar-accent/50"
                            }
                          >
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}

        {/* Módulo Financeiro - Requer permissão */}
        {hasModulePermission("financeiro") && (
          <SidebarGroup>
            <Collapsible 
              open={financeiroOpen} 
              onOpenChange={setFinanceiroOpen}
              defaultOpen={true}
            >
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex items-center gap-2 w-full">
                  {financeiroOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <DollarSign className="h-4 w-4" />
                  Módulo Financeiro
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {financeiroSubMenus.map((item) => (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={item.url}
                            className={({ isActive }) =>
                              isActive
                                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                : "hover:bg-sidebar-accent/50"
                            }
                          >
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}

        {/* Módulo de Marketing - Requer permissão */}
        {hasModulePermission("marketing") && (
          <SidebarGroup>
            <Collapsible open={marketingOpen} onOpenChange={setMarketingOpen}>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex items-center gap-2 w-full">
                  {marketingOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <BarChart3 className="h-4 w-4" />
                  Módulo de Marketing
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to="/dashboard/marketing"
                          end
                          className={({ isActive }) =>
                            isActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground"
                              : "hover:bg-sidebar-accent/50"
                          }
                        >
                          <Home className="h-4 w-4" />
                          <span>Visão Geral</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    {marketingSubMenus.map((item) => (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={item.url}
                            className={({ isActive }) =>
                              isActive
                                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                : "hover:bg-sidebar-accent/50"
                            }
                          >
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}

        {/* Módulo de Trade Marketing */}
        {hasModulePermission("trade") && (
          <SidebarGroup>
            <Collapsible open={tradeOpen} onOpenChange={setTradeOpen}>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex items-center gap-2 w-full">
                  {tradeOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <Store className="h-4 w-4" />
                  Trade Marketing
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to="/dashboard/trade"
                          end
                          className={({ isActive }) =>
                            isActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground"
                              : "hover:bg-sidebar-accent/50"
                          }
                        >
                          <Home className="h-4 w-4" />
                          <span>Visão Geral</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    {tradeSubMenus.map((item) => (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={item.url}
                            className={({ isActive }) =>
                              isActive
                                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                : "hover:bg-sidebar-accent/50"
                            }
                          >
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}

        {/* Módulo de Fábrica */}
        {hasModulePermission("fabrica") && (
          <SidebarGroup>
            <Collapsible open={fabricaOpen} onOpenChange={setFabricaOpen}>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex items-center gap-2 w-full">
                  {fabricaOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <Factory className="h-4 w-4" />
                  Módulo Fábrica
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink to="/dashboard/fabrica" end className={({ isActive }) => isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50"}>
                          <Home className="h-4 w-4" />
                          <span>Dashboard</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink to="/dashboard/fabrica/recebimentos" className={({ isActive }) => isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50"}>
                          <Upload className="h-4 w-4" />
                          <span>Recebimento NF-e</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink to="/dashboard/fabrica/materias-primas" className={({ isActive }) => isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50"}>
                          <Package className="h-4 w-4" />
                          <span>Matérias-Primas</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink to="/dashboard/fabrica/formulas" className={({ isActive }) => isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50"}>
                          <FileText className="h-4 w-4" />
                          <span>Fórmulas (BOM)</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink to="/dashboard/fabrica/planejamento" className={({ isActive }) => isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50"}>
                          <Calendar className="h-4 w-4" />
                          <span>Planejamento MRP</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink to="/dashboard/fabrica/fiscal" className={({ isActive }) => isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50"}>
                          <Receipt className="h-4 w-4" />
                          <span>Fiscal</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink to="/dashboard/fabrica/tabela-impostos" className={({ isActive }) => isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50"}>
                          <FileText className="h-4 w-4" />
                          <span>Tabela de Impostos</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink to="/dashboard/fabrica/ordens-producao" className={({ isActive }) => isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50"}>
                          <ClipboardCheck className="h-4 w-4" />
                          <span>Ordens de Produção</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink to="/dashboard/fabrica/apontamentos" className={({ isActive }) => isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50"}>
                          <Clock className="h-4 w-4" />
                          <span>Apontamentos</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink to="/dashboard/fabrica/qualidade" className={({ isActive }) => isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50"}>
                          <AlertCircle className="h-4 w-4" />
                          <span>Qualidade</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink to="/dashboard/fabrica/paradas" className={({ isActive }) => isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50"}>
                          <Pause className="h-4 w-4" />
                          <span>Paradas</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink to="/dashboard/fabrica/maquinas" className={({ isActive }) => isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50"}>
                          <Wrench className="h-4 w-4" />
                          <span>Máquinas</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink to="/dashboard/fabrica/operadores" className={({ isActive }) => isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50"}>
                          <UserCircle className="h-4 w-4" />
                          <span>Operadores</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink to="/dashboard/fabrica/produtos-acabados" className={({ isActive }) => isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50"}>
                          <Package className="h-4 w-4" />
                          <span>Produtos Acabados</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}

        {/* Módulo de Tabelas de Preços - Requer permissão */}
        {hasModulePermission("precos") && (
          <SidebarGroup>
            <Collapsible open={precosOpen} onOpenChange={setPrecosOpen}>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex items-center gap-2 w-full">
                  {precosOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <DollarSign className="h-4 w-4" />
                  Tabelas de Preços
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink to="/dashboard/precos" end className={({ isActive }) => isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50"}>
                          <Home className="h-4 w-4" />
                          <span>Dashboard</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink to="/dashboard/precos/tabelas" className={({ isActive }) => isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50"}>
                          <Receipt className="h-4 w-4" />
                          <span>Gerenciar Tabelas</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink to="/dashboard/precos/aprovacao" className={({ isActive }) => isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50"}>
                          <CheckSquare className="h-4 w-4" />
                          <span>Aprovação</span>
                          {tabelasPendentes > 0 && (
                            <Badge className="ml-auto bg-yellow-500 hover:bg-yellow-600 text-xs">
                              {tabelasPendentes}
                            </Badge>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink to="/dashboard/precos/portal-cliente" className={({ isActive }) => isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50"}>
                          <Users className="h-4 w-4" />
                          <span>Portal Cliente</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}

      </SidebarContent>
      
      <SidebarFooter>
        <SidebarMenu>
          {hasModulePermission("configuracoes") && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <NavLink to="/dashboard/configuracoes">
                  <Settings className="h-4 w-4" />
                  <span>Configurações</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
