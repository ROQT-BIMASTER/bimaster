import {
  Inbox, Link2, Link2Off, FileText, Send, Loader2, CheckCircle2, Globe,
  XCircle, AlertTriangle, Star, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { VincularFolder, VincularFolderCounts } from "@/hooks/useVincularChinaMailboxData";

interface Props {
  folder: VincularFolder;
  counts: VincularFolderCounts;
  onSelect: (f: VincularFolder) => void;
  progressPct: number;
  vinculadas: number;
  total: number;
}

const FOLDERS: Array<{
  key: VincularFolder;
  label: string;
  icon: typeof Inbox;
  countKey: keyof VincularFolderCounts;
  tone?: string;
  group?: "main" | "status" | "alerts";
}> = [
  { key: "todas", label: "Recebidos da China", icon: Inbox, countKey: "todas", group: "main" },
  { key: "nao_vinculadas", label: "A encaminhar", icon: Link2Off, countKey: "nao_vinculadas", tone: "text-amber-400", group: "main" },
  { key: "vinculadas", label: "Já encaminhados", icon: Link2, countKey: "vinculadas", tone: "text-emerald-400", group: "main" },
  { key: "estrelados", label: "Marcados", icon: Star, countKey: "estrelados", tone: "text-amber-400", group: "main" },
  { key: "snoozed", label: "Adiados", icon: Clock, countKey: "snoozed", tone: "text-sky-400", group: "main" },

  { key: "rascunho", label: "Rascunhos", icon: FileText, countKey: "rascunho", group: "status" },
  { key: "enviado", label: "Enviados", icon: Send, countKey: "enviado", group: "status" },
  { key: "em_revisao", label: "Em revisão", icon: Loader2, countKey: "em_revisao", tone: "text-amber-400", group: "status" },
  { key: "aprovado", label: "Aprovados", icon: CheckCircle2, countKey: "aprovado", tone: "text-emerald-400", group: "status" },
  { key: "enviado_brasil", label: "Recebidos da China", icon: Globe, countKey: "enviado_brasil", tone: "text-sky-400", group: "status" },
  { key: "rejeitado", label: "Rejeitados", icon: XCircle, countKey: "rejeitado", tone: "text-rose-400", group: "status" },

  { key: "pendencias", label: "Com pendências", icon: AlertTriangle, countKey: "pendencias", tone: "text-rose-400", group: "alerts" },
];

export function VincularMailboxSidebar({ folder, counts, onSelect, progressPct, vinculadas, total }: Props) {
  const renderGroup = (group: "main" | "status" | "alerts", title: string) => (
    <div className="mb-2">
      <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        {title}
      </p>
      {FOLDERS.filter((f) => f.group === group).map((f) => {
        const Icon = f.icon;
        const active = folder === f.key;
        const total = counts[f.countKey];
        return (
          <button
            key={f.key}
            type="button"
            onClick={() => onSelect(f.key)}
            className={cn(
              "group flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
              active
                ? "bg-primary/15 text-foreground font-medium"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
            )}
          >
            <Icon className={cn("h-4 w-4 shrink-0", f.tone, active && "text-primary")} />
            <span className="truncate flex-1 text-left">{f.label}</span>
            {total > 0 && (
              <span className={cn(
                "text-[11px] tabular-nums",
                active ? "text-foreground font-medium" : "text-muted-foreground",
              )}>
                {total}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <aside className="flex h-full flex-col border-r border-border bg-card/40">
      <div className="border-b border-border/60 p-3 space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-foreground">Encaminhados</span>
          <span className="tabular-nums text-muted-foreground">
            {vinculadas}/{total} · {progressPct}%
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
      <nav className="flex-1 min-h-0 overflow-y-auto px-1.5 pt-3 pb-3">
        {renderGroup("main", "Bandeja")}
        {renderGroup("status", "Status")}
        {renderGroup("alerts", "Alertas")}
        <div className="mt-3 border-t border-border/60 px-2 pt-3 text-[10px] leading-relaxed text-muted-foreground">
          <p className="font-medium text-foreground/80">Atalhos</p>
          <p>j / k — Navegar</p>
          <p>x — Selecionar · s — Marcar</p>
          <p>e — Encaminhar a projeto</p>
          <p>d — Abrir despacho · r — Encaminhar a responsável</p>
          <p>/ — Buscar</p>
        </div>
      </nav>
    </aside>
  );
}
