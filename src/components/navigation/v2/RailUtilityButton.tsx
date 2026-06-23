/**
 * Botão utilitário 40×40 do AppRail (Chat / Aprovações do Chat / Instalar App).
 * Mesma estilização dos botões de categoria, com tooltip lateral compacta e
 * suporte a badge (contagem) ou dot accent (atenção).
 */
import { useLocation, useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  to: string;
  label: string;
  icon: LucideIcon;
  tooltipSide?: "left" | "right";
  attention?: boolean;
  badgeCount?: number;
}

export function RailUtilityButton({
  to,
  label,
  icon: Icon,
  tooltipSide = "right",
  attention,
  badgeCount,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = location.pathname.startsWith(to);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-current={isActive ? "page" : undefined}
          onClick={() => navigate(to)}
          className={cn(
            "relative flex items-center justify-center rounded-lg transition-all duration-150",
            "h-10 w-10 shrink-0",
          )}
          style={{
            background: isActive ? "hsl(var(--launcher-surface-hover))" : "transparent",
            color: isActive
              ? "hsl(var(--launcher-foreground))"
              : "hsl(var(--launcher-muted))",
          }}
          onMouseEnter={(e) => {
            if (isActive) return;
            e.currentTarget.style.background = "hsl(var(--launcher-surface-hover))";
            e.currentTarget.style.color = "hsl(var(--launcher-foreground))";
          }}
          onMouseLeave={(e) => {
            if (isActive) return;
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "hsl(var(--launcher-muted))";
          }}
        >
          <Icon className="h-[18px] w-[18px]" />
          {isActive && (
            <span
              className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r"
              style={{ background: "hsl(var(--launcher-foreground))" }}
            />
          )}
          {badgeCount && badgeCount > 0 ? (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center"
              style={{
                background: "hsl(var(--launcher-accent-2))",
                color: "hsl(var(--launcher-surface))",
                boxShadow: "0 0 0 2px hsl(var(--launcher-surface))",
              }}
            >
              {badgeCount > 99 ? "99+" : badgeCount}
            </span>
          ) : attention ? (
            <span
              className="absolute top-1 right-1 h-2 w-2 rounded-full"
              style={{
                background: "hsl(var(--launcher-accent-2))",
                boxShadow: "0 0 0 2px hsl(var(--launcher-surface))",
              }}
            />
          ) : null}
        </button>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide} className="text-xs z-[120]">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
