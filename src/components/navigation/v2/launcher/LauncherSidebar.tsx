/**
 * Sidebar esquerda do Launcher: "Acesso rápido".
 */
import { Clock, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  recentsCount: number;
  shortcutsCount: number;
  active: "recents" | "shortcuts";
  onSelect: (key: "recents" | "shortcuts") => void;
}

export function LauncherSidebar({ recentsCount, shortcutsCount, active, onSelect }: Props) {
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
      {shortcutsCount > 0 && (
        <SidebarItem
          icon={<Zap className="h-3.5 w-3.5 opacity-70" />}
          label="Atalhos"
          count={shortcutsCount}
          active={active === "shortcuts"}
          onClick={() => onSelect("shortcuts")}
        />
      )}
      <SidebarItem
        icon={<Clock className="h-3.5 w-3.5 opacity-70" />}
        label="Recentes"
        count={recentsCount}
        active={active === "recents"}
        onClick={() => onSelect("recents")}
      />
    </aside>
  );
}

function SidebarItem({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left",
      )}
      style={{
        background: active ? "hsl(var(--launcher-surface-hover))" : "transparent",
        color: "hsl(var(--launcher-foreground))",
      }}
    >
      {icon}
      <span className="flex-1">{label}</span>
      <span
        className="text-[10px] px-1.5 py-0.5 rounded"
        style={{
          background: "hsl(var(--launcher-surface-elevated))",
          color: "hsl(var(--launcher-muted))",
        }}
      >
        {count}
      </span>
    </button>
  );
}
