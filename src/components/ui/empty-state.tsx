import { cn } from "@/lib/utils";
import { LucideIcon, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  children?: React.ReactNode;
  /** Use em telas com fundo escuro (ex: ambiente de Projetos com `usePageBgColor`). */
  darkBg?: boolean;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  className,
  children,
  darkBg = false,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center py-12 px-6 text-center animate-fade-in",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center h-14 w-14 rounded-2xl mb-4",
          darkBg ? "bg-white/10" : "bg-muted/80",
        )}
      >
        <Icon className={cn("h-7 w-7", darkBg ? "text-white/70" : "text-muted-foreground")} />
      </div>
      <h3
        className={cn(
          "text-base font-semibold",
          darkBg ? "text-white/90" : "text-foreground",
        )}
      >
        {title}
      </h3>
      {description && (
        <p
          className={cn(
            "text-sm mt-1 max-w-sm",
            darkBg ? "text-white/60" : "text-muted-foreground",
          )}
        >
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button onClick={onAction} size="sm" className="mt-4">
          {actionLabel}
        </Button>
      )}
      {children}
    </div>
  );
}
