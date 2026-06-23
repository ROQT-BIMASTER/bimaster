/**
 * Header do Launcher: lupa + input + kbd chips (⌘K, ESC).
 */
import { Search } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onEscape: () => void;
  onEnter?: () => void;
  placeholder?: string;
}

export function LauncherHeader({
  value,
  onChange,
  onEscape,
  onEnter,
  placeholder = "Para onde você quer ir?",
}: Props) {
  return (
    <div
      className="flex items-center gap-3 px-5 h-[64px] border-b"
      style={{ borderColor: "hsl(var(--launcher-border))" }}
    >
      <Search
        className="h-4 w-4 shrink-0"
        style={{ color: "hsl(var(--launcher-muted))" }}
      />
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onEscape();
          } else if (e.key === "Enter" && onEnter) {
            e.preventDefault();
            onEnter();
          }
        }}
        placeholder={placeholder}
        className="flex-1 bg-transparent outline-none text-[15px] placeholder:text-[hsl(var(--launcher-muted))]"
        style={{ color: "hsl(var(--launcher-foreground))" }}
      />
      <div className="flex items-center gap-1 text-[10px] font-medium">
        <Kbd>⌘K</Kbd>
        <Kbd>ESC</Kbd>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="px-1.5 py-0.5 rounded border uppercase tracking-wide"
      style={{
        background: "hsl(var(--launcher-surface-elevated))",
        borderColor: "hsl(var(--launcher-border))",
        color: "hsl(var(--launcher-muted))",
      }}
    >
      {children}
    </span>
  );
}
