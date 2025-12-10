import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface TradePageHeaderProps {
  title: string;
  description?: string;
  backTo?: string;
  backLabel?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function TradePageHeader({
  title,
  description,
  backTo = "/dashboard/trade",
  backLabel = "Trade Marketing",
  actions,
  className,
}: TradePageHeaderProps) {
  return (
    <div className={cn("space-y-2 sm:space-y-4", className)}>
      {/* Breadcrumb/Back - Mobile */}
      <Link
        to={backTo}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors touch-manipulation"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="hidden sm:inline">{backLabel}</span>
        <span className="sm:hidden">Voltar</span>
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold truncate">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5 sm:mt-1 line-clamp-1">
              {description}
            </p>
          )}
        </div>
        
        {/* Actions */}
        {actions && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 -mx-1 px-1 sm:mx-0 sm:px-0 scrollbar-thin">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
