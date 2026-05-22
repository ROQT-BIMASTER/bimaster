import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  count?: number;
  actions?: ReactNode;
  tabs?: ReactNode;
}

export function CrmPageHeader({ icon: Icon, title, subtitle, count, actions, tabs }: Props) {
  return (
    <div className="border-b bg-card sticky top-12 z-[5]">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h1 className="text-sm font-semibold text-foreground truncate">{title}</h1>
            {count !== undefined && (
              <span className="text-xs text-muted-foreground tabular-nums">{count.toLocaleString("pt-BR")} registros</span>
            )}
          </div>
          {subtitle && <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {tabs && <div className="px-4">{tabs}</div>}
    </div>
  );
}
