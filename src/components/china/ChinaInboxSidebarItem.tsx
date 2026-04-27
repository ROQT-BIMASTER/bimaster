import { Inbox } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { useChinaInboxCount } from "@/hooks/useChinaInbox";
import { cn } from "@/lib/utils";
import { SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";

/**
 * Item de sidebar dedicado à Caixa de Entrada China com contador dinâmico
 * (atualizado via Realtime). Pisca em vermelho quando há pendências.
 */
export function ChinaInboxSidebarItem({ colorKey }: { colorKey?: string }) {
  const count = useChinaInboxCount();

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild>
        <NavLink
          to="/dashboard/fabrica-china/caixa-entrada"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2 w-full",
              isActive && "bg-accent text-accent-foreground font-medium",
            )
          }
        >
          <Inbox className={cn("h-4 w-4", count > 0 && "text-destructive animate-pulse")} />
          <span className="flex-1 text-sm">Caixa de Entrada 收件箱</span>
          {count > 0 && (
            <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px]">
              {count > 99 ? "99+" : count}
            </Badge>
          )}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
