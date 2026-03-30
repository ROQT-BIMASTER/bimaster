import { ArrowLeft, LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  subtitle?: string;
  icon?: LucideIcon;
  backTo?: string;
  backLabel?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: React.ReactNode;
  badges?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  subtitle,
  icon: Icon,
  backTo,
  backLabel = "Voltar",
  breadcrumbs,
  actions,
  badges,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("space-y-2 sm:space-y-3 animate-fade-in", className)}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-border">/</span>}
              {crumb.href ? (
                <Link to={crumb.href} className="hover:text-foreground transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-foreground font-medium">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* Back link */}
      {backTo && !breadcrumbs && (
        <Link
          to={backTo}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{backLabel}</span>
        </Link>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0 flex items-center gap-3">
          {Icon && (
            <div className="hidden sm:flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 flex-shrink-0">
              <Icon className="h-5 w-5 text-primary" />
            </div>
          )}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">
              {title}
            </h1>
            {description && (
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                {description}
              </p>
            )}
            {subtitle && !description && (
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                {subtitle}
              </p>
            )}
          </div>
          {badges && <div className="flex items-center gap-2">{badges}</div>}
        </div>

        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
