import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Bot,
  Inbox,
  Users,
  Ticket,
  BarChart3,
  Settings,
  Home,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";

const items = [
  { to: "/dashboard/crm", label: "Visão geral", icon: Home, end: true },
  { to: "/dashboard/crm/bots", label: "Bots & Canais", icon: Bot },
  { to: "/dashboard/crm/inbox", label: "Inbox", icon: Inbox },
  { to: "/dashboard/crm/contatos", label: "Contatos 360", icon: Users },
  { to: "/dashboard/crm/tickets", label: "Tickets & SLA", icon: Ticket },
  { to: "/dashboard/crm/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/dashboard/crm/configuracoes", label: "Configurações", icon: Settings },
];

function CrmSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5" /> CRM
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((it) => (
                <SidebarMenuItem key={it.to}>
                  <SidebarMenuButton asChild tooltip={it.label}>
                    <NavLink
                      to={it.to}
                      end={it.end}
                      className={({ isActive }) =>
                        `flex items-center gap-2 text-sidebar-foreground ${
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                            : "hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                        }`
                      }
                    >
                      <it.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{it.label}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

export default function CrmLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isRoot = pathname === "/dashboard/crm" || pathname === "/dashboard/crm/";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <CrmSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center gap-2 border-b px-3 sticky top-0 bg-background/95 backdrop-blur z-10">
            <SidebarTrigger />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => (isRoot ? navigate("/dashboard") : navigate(-1))}
              className="gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <div className="ml-auto text-xs text-muted-foreground">CRM & Atendimento · acesso restrito</div>
          </header>
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
