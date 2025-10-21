import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { X, CheckCircle2, AlertCircle, Clock, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

interface NotificationItemProps {
  notification: {
    id: string;
    type: string;
    title: string;
    message: string;
    action_url: string | null;
    read: boolean;
    created_at: string;
  };
}

export const NotificationItem = ({ notification }: NotificationItemProps) => {
  const navigate = useNavigate();
  const { markAsRead, deleteNotification } = useNotifications();

  const handleClick = () => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    if (notification.action_url) {
      navigate(notification.action_url);
    }
  };

  const getIcon = () => {
    switch (notification.type) {
      case 'goal_achieved':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'goal_failed':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case 'activity_reminder':
        return <Clock className="h-5 w-5 text-blue-600" />;
      case 'approval_pending':
        return <AlertCircle className="h-5 w-5 text-orange-600" />;
      default:
        return <Target className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 cursor-pointer hover:bg-accent transition-colors",
        !notification.read && "bg-accent/50"
      )}
      onClick={handleClick}
    >
      <div className="mt-1">{getIcon()}</div>
      <div className="flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h4 className={cn(
            "text-sm font-medium",
            !notification.read && "font-semibold"
          )}>
            {notification.title}
          </h4>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              deleteNotification(notification.id);
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {notification.message}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(notification.created_at), {
            addSuffix: true,
            locale: ptBR
          })}
        </p>
      </div>
      {!notification.read && (
        <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />
      )}
    </div>
  );
};
