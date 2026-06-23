/**
 * Tile horizontal de "RECENTES" — usado na linha superior da área direita.
 */
import { resolveIcon } from "../icon";
import { getModuleAccent, accentStyle } from "./moduleColors";
import { Badge } from "@/components/ui/badge";
import type { RecentEntry } from "./useRecents";

interface Props {
  entry: RecentEntry;
  isCurrent: boolean;
  onSelect: (route: string) => void;
}

export function RecentTile({ entry, isCurrent, onSelect }: Props) {
  const Icon = resolveIcon(entry.icon);
  const token = getModuleAccent(entry.moduleCode);

  return (
    <button
      type="button"
      onClick={() => onSelect(entry.route)}
      className="group relative flex items-center gap-3 rounded-xl p-3 text-left transition-all hover:-translate-y-0.5"
      style={{
        background: "hsl(var(--launcher-surface-elevated))",
        boxShadow: "inset 0 0 0 1px hsl(var(--launcher-border))",
      }}
    >
      <div
        className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
        style={accentStyle(token)}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="text-[13px] font-semibold leading-tight truncate"
          style={{ color: "hsl(var(--launcher-foreground))" }}
        >
          {entry.moduleLabel}
        </div>
        <div
          className="text-[11px] truncate"
          style={{ color: "hsl(var(--launcher-muted))" }}
        >
          {entry.pageLabel}
        </div>
      </div>
      {isCurrent && (
        <Badge
          className="absolute top-2 right-2 text-[9px] h-4 px-1.5 border-0"
          style={{
            background: `hsl(var(${token}))`,
            color: "hsl(var(--launcher-surface))",
          }}
        >
          AQUI
        </Badge>
      )}
    </button>
  );
}
