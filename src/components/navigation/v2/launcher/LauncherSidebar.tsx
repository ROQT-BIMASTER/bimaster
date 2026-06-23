/**
 * Sidebar esquerda do Launcher: "Acesso rápido".
 */
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  recentsCount: number;
  active: "recents";
  onSelect: (key: "recents") => void;
}

export function LauncherSidebar({ recentsCount, active, onSelect }: Props) {
  return (
    <aside
      className="w-[180px] shrink-0 border-r flex flex-col py-5 px-3 gap-1"
      style={{
        borderColor: "hsl(var(--launcher-border))",
        background: "hsl(var(--launcher-surface))",
      }}
    >
      <div
        className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: "hsl(var(--launcher-muted))" }}
      >
        Acesso rápido
      </div>
      <button
        type="button"
        onClick={() => onSelect("recents")}
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left",
        )}
        style={{
          background:
            active === "recents"
              ? "hsl(var(--launcher-surface-hover))"
              : "transparent",
          color: "hsl(var(--launcher-foreground))",
        }}
      >
        <Clock className="h-3.5 w-3.5 opacity-70" />
        <span className="flex-1">Recentes</span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded"
          style={{
            background: "hsl(var(--launcher-surface-elevated))",
            color: "hsl(var(--launcher-muted))",
          }}
        >
          {recentsCount}
        </span>
      </button>
    </aside>
  );
}
