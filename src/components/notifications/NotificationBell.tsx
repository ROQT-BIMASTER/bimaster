import { Bell, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationItem } from "./NotificationItem";
import { useInbox } from "@/hooks/useInbox";
import { useInboxDrawer } from "@/contexts/InboxDrawerContext";
import { Separator } from "@/components/ui/separator";

export const NotificationBell = () => {
  const { notifications, unreadCount, markAllAsRead } = useNotifications();
  const { counts } = useInbox();
  const { openDrawer } = useInboxDrawer();

  const inboxAcao = counts.acao_minha ?? 0;
  const totalBadge = unreadCount + inboxAcao;

  return (
    <div className="flex items-center gap-1">
      {/* Atalho direto para Caixa de Entrada */}
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={openDrawer}
        aria-label={`Caixa de Entrada${inboxAcao > 0 ? ` - ${inboxAcao} aguardam ação` : ''}`}
        title="Caixa de Entrada (i)"
      >
        <Inbox className="h-5 w-5" />
        {inboxAcao > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 px-1 text-xs"
          >
            {inboxAcao > 9 ? "9+" : inboxAcao}
          </Badge>
        )}
      </Button>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={`Notificações${unreadCount > 0 ? ` - ${unreadCount} não lidas` : ''}`}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                aria-label={`${unreadCount} notificações não lidas`}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0" align="end">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold">Notificações</h3>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="text-xs"
              >
                Marcar todas como lidas
              </Button>
            )}
          </div>
          {inboxAcao > 0 && (
            <>
              <button
                onClick={openDrawer}
                className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-accent/50 transition-colors text-sm"
              >
                <span className="flex items-center gap-2">
                  <Inbox className="h-4 w-4 text-primary" />
                  <span className="font-medium">Caixa de Entrada</span>
                </span>
                <Badge className="h-5 px-1.5 text-[10px]">{inboxAcao} ação</Badge>
              </button>
              <Separator />
            </>
          )}
          <ScrollArea className="h-96">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                Nenhuma notificação
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((notification) => (
                  <NotificationItem key={notification.id} notification={notification} />
                ))}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
};
