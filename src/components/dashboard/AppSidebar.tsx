import { 
  Home, Users, Building2, LogOut, Settings, Upload, Shield, 
  LayoutGrid, CheckSquare, MapPin, MessageSquare, Activity, Clock,
  Store, Calendar, Camera, Tag, TrendingUp, Brain, ChevronDown, ChevronRight, Image, ClipboardCheck, DollarSign, FileText, Download, Phone, Trophy, BarChart3, Sparkles, Package, Factory
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
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
  const [tradeOpen, setTradeOpen] = useState(true);
  const [marketingOpen, setMarketingOpen] = useState(true);
  const [fabricaOpen, setFabricaOpen] = useState(true);

  const loading = permissionsLoading || modulesLoading;

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
    { title: "Financeiro", url: "/dashboard/trade/financeiro", icon: FileText },
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

        {/* Módulo de Marketing */}
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
                        <NavLink to="/dashboard/fabrica/ordens-producao" className={({ isActive }) => isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50"}>
                          <ClipboardCheck className="h-4 w-4" />
                          <span>Ordens de Produção</span>
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
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink to="/dashboard/configuracoes">
                <Settings className="h-4 w-4" />
                <span>Configurações</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
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
