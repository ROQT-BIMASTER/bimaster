import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { DASHBOARD_TEMPLATES, type DashboardTemplate } from "./widgets/dashboardTemplates";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (params: { nome: string; widgets: DashboardTemplate["widgets"] }) => void;
  isPending?: boolean;
}

function PreviewSchematic({ template }: { template: DashboardTemplate }) {
  if (template.preview.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/40 rounded-md border border-dashed border-border/60">
        <span className="text-[10px] text-muted-foreground">Em branco</span>
      </div>
    );
  }
  const kpis = template.preview.filter((p) => p === "kpi");
  const others = template.preview.filter((p) => p !== "kpi");
  return (
    <div className="h-full p-2 bg-muted/30 rounded-md flex flex-col gap-1.5">
      {kpis.length > 0 && (
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(kpis.length, 4)}, 1fr)` }}>
          {kpis.slice(0, 4).map((_, i) => (
            <div key={i} className="h-4 rounded-sm bg-primary/20 ring-1 ring-primary/10" />
          ))}
        </div>
      )}
      {others.length > 0 && (
        <div className="grid grid-cols-3 gap-1 flex-1">
          {others.slice(0, 6).map((kind, i) => {
            const span = kind === "chart-lg" ? "col-span-2" : "col-span-1";
            const bg =
              kind === "heatmap"
                ? "bg-success/25"
                : kind === "list"
                ? "bg-accent/25 ring-accent/10"
                : "bg-primary/15";
            return (
              <div
                key={i}
                className={cn("rounded-sm ring-1 ring-border/40", span, bg)}
                style={{ minHeight: 18 }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export function DashboardTemplateGallery({ open, onOpenChange, onCreate, isPending }: Props) {
  const [selectedId, setSelectedId] = useState<string>(DASHBOARD_TEMPLATES[0].id);
  const [nome, setNome] = useState<string>(DASHBOARD_TEMPLATES[0].nome);

  const selected = DASHBOARD_TEMPLATES.find((t) => t.id === selectedId)!;

  const handleSelect = (t: DashboardTemplate) => {
    setSelectedId(t.id);
    setNome(t.nome);
  };

  const handleCreate = () => {
    if (!nome.trim()) return;
    onCreate({ nome: nome.trim(), widgets: selected.widgets });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display">Escolher modelo de dashboard</DialogTitle>
          <DialogDescription>
            Comece com um modelo pronto, ou monte do zero. Você pode editar widgets depois.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[440px] overflow-y-auto pr-1">
          {DASHBOARD_TEMPLATES.map((t) => {
            const active = selectedId === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => handleSelect(t)}
                className={cn(
                  "relative text-left rounded-lg border bg-card transition-all overflow-hidden",
                  "hover:border-primary/50 hover:shadow-md",
                  active ? "border-primary ring-2 ring-primary/30 shadow-sm" : "border-border/60",
                )}
              >
                {active && (
                  <span className="absolute top-2 right-2 z-10 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <Check className="h-3 w-3" />
                  </span>
                )}
                <div className="h-24 border-b border-border/40 p-2">
                  <PreviewSchematic template={t} />
                </div>
                <div className="p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "h-6 w-6 rounded-md flex items-center justify-center shrink-0",
                      active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                    )}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-sm font-semibold text-foreground truncate">{t.nome}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                    {t.descricao}
                  </p>
                  <p className="text-[10px] text-muted-foreground/80 tabular-nums">
                    {t.widgets.length} widget{t.widgets.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="space-y-1.5 pt-2 border-t border-border/40">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Nome do dashboard
          </label>
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Meu Dashboard"
            className="h-9"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={!nome.trim() || isPending}>
            {isPending ? "Criando..." : "Criar Dashboard"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
