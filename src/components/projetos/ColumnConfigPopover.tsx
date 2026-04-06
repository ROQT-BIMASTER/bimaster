import { useState } from "react";
import { Settings2, GripVertical, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
  locked?: boolean; // nome is always visible
}

export const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: "produto", label: "Produto", visible: true },
  { key: "responsavel", label: "Responsável", visible: true },
  { key: "status", label: "Status", visible: true },
  { key: "timeline", label: "Timeline", visible: true },
  { key: "prazo", label: "Prazo", visible: true },
  { key: "prioridade", label: "Prioridade", visible: true },
];

export function buildGridCols(columns: ColumnConfig[]): string {
  const vis = (key: string) => columns.find(c => c.key === key)?.visible ?? true;
  const parts: string[] = ["20px", "20px", "1fr"];
  if (vis("produto")) parts.push("80px");
  parts.push("1px"); // separator
  if (vis("responsavel")) parts.push("100px");
  if (vis("status")) parts.push("90px");
  if (vis("timeline")) parts.push("120px");
  if (vis("prazo")) parts.push("80px");
  if (vis("prioridade")) parts.push("80px");
  return parts.join("_");
}

const STORAGE_KEY = "projeto-columns-config";

export function loadColumnConfig(): ColumnConfig[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as ColumnConfig[];
      // Merge with defaults to handle new columns
      return DEFAULT_COLUMNS.map(dc => {
        const found = parsed.find(p => p.key === dc.key);
        return found ? { ...dc, visible: found.visible } : dc;
      });
    }
  } catch {}
  return DEFAULT_COLUMNS;
}

export function saveColumnConfig(cols: ColumnConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cols));
}

interface ColumnConfigPopoverProps {
  columns: ColumnConfig[];
  onChange: (columns: ColumnConfig[]) => void;
  darkBg?: boolean;
  className?: string;
}

export function ColumnConfigPopover({ columns, onChange, darkBg, className }: ColumnConfigPopoverProps) {
  const [open, setOpen] = useState(false);

  const toggleColumn = (key: string) => {
    const updated = columns.map(c =>
      c.key === key ? { ...c, visible: !c.visible } : c
    );
    onChange(updated);
    saveColumnConfig(updated);
  };

  const visibleCount = columns.filter(c => c.visible).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-8 text-xs gap-1.5", darkBg && "bg-accent text-accent-foreground border-accent", className)}
        >
          <Settings2 className="h-3.5 w-3.5" />
          Colunas
          {visibleCount < columns.length && (
            <span className="bg-primary/15 text-primary text-[10px] px-1.5 rounded-full font-semibold">
              {visibleCount}/{columns.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="end">
        <div className="px-3 py-2.5 border-b border-border/50">
          <p className="text-xs font-semibold text-foreground">Colunas visíveis</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Escolha quais colunas exibir</p>
        </div>
        <div className="p-2 space-y-0.5">
          {/* Nome is always visible */}
          <div className="flex items-center justify-between px-2.5 py-2 rounded-md bg-muted/30">
            <div className="flex items-center gap-2">
              <Eye className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium">Nome da tarefa</span>
            </div>
            <span className="text-[10px] text-muted-foreground">Fixo</span>
          </div>
          {columns.map(col => (
            <button
              key={col.key}
              onClick={() => toggleColumn(col.key)}
              className="flex items-center justify-between w-full px-2.5 py-2 rounded-md hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {col.visible ? (
                  <Eye className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5 text-muted-foreground/50" />
                )}
                <span className={cn("text-xs", col.visible ? "font-medium" : "text-muted-foreground")}>
                  {col.label}
                </span>
              </div>
              <Switch checked={col.visible} className="scale-75" />
            </button>
          ))}
        </div>
        <div className="px-3 py-2 border-t border-border/50">
          <button
            onClick={() => {
              onChange(DEFAULT_COLUMNS);
              saveColumnConfig(DEFAULT_COLUMNS);
            }}
            className="text-[11px] text-primary hover:underline"
          >
            Restaurar padrão
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
