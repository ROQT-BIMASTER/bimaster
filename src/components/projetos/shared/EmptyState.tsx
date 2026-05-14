import * as React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  iconClass?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  /** Use em telas com fundo escuro (ex: ambiente de Projetos com `usePageBgColor`). */
  darkBg?: boolean;
}

/**
 * Empty state padronizado para o módulo Projetos.
 * Substitui as variantes ad-hoc espalhadas em ListView, KanbanView, InboxFeed,
 * MetasIA, EquipeDashboard etc. Mantém visual consistente entre views.
 */
export function EmptyState({
  icon,
  iconClass,
  title,
  description,
  action,
  className,
  darkBg = false,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center gap-2",
        darkBg ? "text-white/70" : "text-muted-foreground",
        className,
      )}
    >
      {icon ? (
        <div className={cn("opacity-50 mb-1", iconClass)} aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <p className={cn("text-sm font-medium", darkBg ? "text-white/90" : "text-foreground")}>
        {title}
      </p>
      {description ? (
        <p className={cn("text-xs max-w-md", darkBg ? "text-white/60" : "text-muted-foreground")}>
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
