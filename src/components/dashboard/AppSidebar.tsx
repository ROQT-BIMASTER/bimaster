import { 
  Home, Users, Building2, LogOut, Settings, Upload, Shield, 
  LayoutGrid, CheckSquare, MapPin, MessageSquare, Activity, Clock,
  Store, Calendar, Camera, Tag, TrendingUp, Brain, ChevronDown, ChevronRight, Image, ClipboardCheck, DollarSign, FileText, Download, Phone, Trophy
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
};

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { permissions, loading: permissionsLoading, hasPermission } = useScreenPermissions();
  const { hasModulePermission, loading: modulesLoading } = useModulePermissions();
  
  const [prospectsOpen, setProspectsOpen] = useState(true);
  const [tradeOpen, setTradeOpen] = useState(true);

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
    { title: "Sell Out", url: "/dashboard/trade/sellout", icon: TrendingUp },
    { title: "Medição Prateleiras", url: "/dashboard/trade/shelf-measurements", icon: Activity },
    { title: "Nossas Marcas", url: "/dashboard/trade/our-brands", icon: Tag },
    { title: "Fotos", url: "/dashboard/trade/photos", icon: Camera },
    { title: "Fotos Ideais", url: "/dashboard/trade/ideal-photos", icon: Image },
    { title: "Auditoria Gôndola", url: "/dashboard/trade/auditorias", icon: ClipboardCheck },
    { title: "Análise Competitiva", url: "/dashboard/trade/relatorio-competitivo", icon: Brain },
    { title: "Comparação Produtos", url: "/dashboard/trade/comparacao-produtos", icon: TrendingUp },
    { title: "Promoções", url: "/dashboard/trade/promotions", icon: Tag },
    { title: "Concorrentes", url: "/dashboard/trade/competitors", icon: TrendingUp },
    { title: "Financeiro", url: "/dashboard/trade/financeiro", icon: DollarSign },
    { title: "Premiações", url: "/dashboard/trade/rewards", icon: Trophy },
    { title: "Insights IA", url: "/dashboard/trade/insights", icon: Brain },
  ];

  const otherMenus = permissions.filter(screen => 
    !['prospects', 'kanban', 'atividades', 'mapa', 'trade_marketing', 'trade_stores', 
      'trade_visits', 'trade_photos', 'trade_promotions', 'trade_competitors', 'trade_insights', 
      'configuracoes', 'dashboard', 'ranking'].includes(screen.codigo)
  );

  return (
    <Sidebar>
      <SidebarContent>
        <div className="p-4 border-b">
          <img src={logoUnion} alt="Union Logo" className="w-32 mx-auto" />
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

        {/* Outras Opções */}
        {otherMenus.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Outras Opções</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {otherMenus.map((screen) => {
                  const Icon = iconMap[screen.icone] || Home;
                  return (
                    <SidebarMenuItem key={screen.codigo}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={screen.rota}
                          className={({ isActive }) =>
                            isActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground"
                              : "hover:bg-sidebar-accent/50"
                          }
                        >
                          <Icon className="h-4 w-4" />
                          <span>{screen.nome}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
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
