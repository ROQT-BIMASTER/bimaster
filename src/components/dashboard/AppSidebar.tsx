import { Home, Users, Building2, FileText, LogOut, Settings, Upload, Shield, LayoutGrid, CheckSquare, MapPin, MessageSquare, Activity, Clock } from "lucide-react";
import { NavLink } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
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
} from "@/components/ui/sidebar";
import { useToast } from "@/hooks/use-toast";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
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
};

export function AppSidebar() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { permissions, loading, isAdmin } = useScreenPermissions();

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

  return (
    <Sidebar>
      <SidebarContent>
        <div className="p-4 border-b">
          <img src={logoUnion} alt="Union Logo" className="w-32 mx-auto" />
        </div>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {permissions.map((screen) => {
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
