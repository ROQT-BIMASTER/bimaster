import { Inbox } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { useChinaInboxCount } from "@/hooks/useChinaInbox";
import { cn } from "@/lib/utils";
import { SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";

/**
 * Item de sidebar dedicado à Caixa de Entrada China com contador dinâmico.
 * Estilo idêntico ao MenuItemLink padrão (AppSidebar) — bilingual title +
 * badge compacta à direita quando há pendências.
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
              "relative flex items-center gap-2.5 px-3 py-1.5 rounded-md transition-all duration-150 text-[12px]",
              isActive
                ? "font-medium bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))]"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            )
          }
        >
          <Inbox
            className={cn(
              "h-3.5 w-3.5 shrink-0",
              count > 0 && "text-destructive animate-pulse",
            )}
          />
          <span className="flex-1 truncate">Caixa de Entrada 收件箱</span>
          {count > 0 && (
            <Badge
              variant="destructive"
              className="h-4 min-w-4 px-1 text-[10px] leading-none shrink-0"
            >
              {count > 99 ? "99+" : count}
            </Badge>
          )}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
