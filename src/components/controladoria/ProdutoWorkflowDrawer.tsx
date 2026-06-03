import { AlertTriangle, Check, ChevronRight, Circle, Clock, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { WF_FIELDS, motivosGargalo, wfTone, type WfTone } from "@/lib/controladoria";
import type { RrProduto } from "@/hooks/useRrProdutos";

interface ProdutoDrawerProps {
  produto: RrProduto | null;
  linhaNome?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TONE_NODE: Record<WfTone, { ring: string; bg: string; icon: typeof Check; iconColor: string; label: string }> = {
  done: {
    ring: "ring-emerald-500/40 border-emerald-500/60",
    bg: "bg-emerald-500/10",
    icon: Check,
    iconColor: "text-emerald-600",
    label: "Concluído",
  },
  prog: {
    ring: "ring-amber-500/40 border-amber-500/60",
    bg: "bg-amber-500/10",
    icon: Clock,
    iconColor: "text-amber-600",
    label: "Em andamento",
  },
  block: {
    ring: "ring-rose-500/40 border-rose-500/60",
    bg: "bg-rose-500/10",
    icon: X,
    iconColor: "text-rose-600",
    label: "Bloqueado",
  },
  idle: {
    ring: "ring-slate-400/30 border-border",
    bg: "bg-muted/40",
    icon: Circle,
    iconColor: "text-muted-foreground",
    label: "Não iniciado",
  },
};

function WorkflowNode({ field, value }: { field: string; value: string | null }) {
  const tone = wfTone(value);
  const cfg = TONE_NODE[tone];
  const Icon = cfg.icon;
  return (
    <div className="flex flex-col items-center gap-1.5 min-w-[110px]">
      <div
        className={cn(
          "h-14 w-14 rounded-xl border-2 ring-4 flex items-center justify-center shadow-sm",
          cfg.ring,
          cfg.bg,
        )}
      >
        <Icon className={cn("h-6 w-6", cfg.iconColor)} />
      </div>
      <div className="text-center space-y-0.5 w-full">
        <div className="text-[11px] font-medium leading-tight line-clamp-2">{field}</div>
        <div className={cn("text-[10px] uppercase tracking-wide font-medium", cfg.iconColor)}>
          {value ?? cfg.label}
        </div>
      </div>
    </div>
  );
}

function NodeConnector({ tone }: { tone: WfTone }) {
  const color =
    tone === "done"
      ? "text-emerald-500/60"
      : tone === "prog"
      ? "text-amber-500/60"
      : tone === "block"
      ? "text-rose-500/60"
      : "text-border";
  return (
    <div className="flex items-center self-start mt-5 shrink-0">
      <div className={cn("h-px w-4 bg-current", color)} />
      <ChevronRight className={cn("h-4 w-4 -ml-1", color)} />
    </div>
  );
}

export function ProdutoWorkflowDrawer({
  produto,
  linhaNome,
  open,
  onOpenChange,
}: ProdutoDrawerProps) {
  if (!produto) return null;
  const motivos = motivosGargalo(produto);
  const wf = produto.wf ?? {};

  const stats = WF_FIELDS.reduce(
    (acc, f) => {
      const t = wfTone(wf[f] ?? null);
      acc[t] += 1;
      return acc;
    },
    { done: 0, prog: 0, block: 0, idle: 0 } as Record<WfTone, number>,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-4xl p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-xl flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm px-2 py-0.5 rounded bg-muted">
                  {produto.sku ?? "—"}
                </span>
                <span className="truncate">{produto.nome_comercial ?? "—"}</span>
              </SheetTitle>
              <SheetDescription className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                <span>
                  <strong>Marca:</strong> {produto.marca ?? "—"}
                </span>
                <span>
                  <strong>Linha:</strong> {linhaNome ?? "—"}
                </span>
                <span>
                  <strong>Categoria:</strong> {produto.categoria ?? "—"}
                </span>
                <span>
                  <strong>Status:</strong> {produto.status ?? "—"}
                </span>
              </SheetDescription>
            </div>
          </div>

          {/* Stats compactas do workflow */}
          <div className="flex items-center gap-2 mt-3">
            <StatPill tone="done" label="Concluídos" value={stats.done} />
            <StatPill tone="prog" label="Em andamento" value={stats.prog} />
            <StatPill tone="block" label="Bloqueados" value={stats.block} />
            <StatPill tone="idle" label="Não iniciados" value={stats.idle} />
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {/* Motivos do gargalo */}
            {motivos.length > 0 && (
              <section className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <h3 className="text-sm font-semibold">
                    Campos faltantes ({motivos.length})
                  </h3>
                </div>
                <ul className="space-y-1.5">
                  {motivos.map((m) => (
                    <li
                      key={m.label}
                      className="flex items-start gap-2 text-sm"
                    >
                      <X className="h-3.5 w-3.5 text-rose-600 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-medium">{m.label}</span>
                        <span className="text-muted-foreground"> · {m.detail}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Workflow trilha estilo N8N */}
            <section>
              <h3 className="text-sm font-semibold mb-3">Trilha do workflow</h3>
              <div className="rounded-lg border bg-gradient-to-b from-muted/20 to-transparent p-5 overflow-x-auto">
                <div className="flex items-start min-w-max pb-2">
                  {WF_FIELDS.map((field, idx) => {
                    const v = wf[field] ?? null;
                    const tone = wfTone(v);
                    return (
                      <div key={field} className="flex items-start">
                        <WorkflowNode field={field} value={v} />
                        {idx < WF_FIELDS.length - 1 && <NodeConnector tone={tone} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Dados regulatórios */}
            <section>
              <h3 className="text-sm font-semibold mb-3">Regulatório</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <DataField
                  label="Composição PT"
                  ok={!!produto.composicao_pt}
                  value={produto.composicao_pt ? "Preenchida" : "Ausente"}
                />
                <DataField
                  label="Composição EN"
                  ok={!!produto.composicao_en}
                  value={produto.composicao_en ? "Preenchida" : "Ausente"}
                />
                <DataField
                  label="ANVISA"
                  ok={!!produto.anvisa}
                  value={produto.anvisa ?? "Sem registro"}
                />
              </div>
              {produto.ultima_revisao_regulatoria && (
                <p className="text-xs text-muted-foreground mt-3">
                  Última revisão regulatória:{" "}
                  <strong>{produto.ultima_revisao_regulatoria}</strong>
                </p>
              )}
            </section>

            {produto.synced_at && (
              <>
                <Separator />
                <p className="text-[11px] text-muted-foreground">
                  Sincronizado em{" "}
                  {new Date(produto.synced_at).toLocaleString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                  })}
                </p>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function StatPill({
  tone,
  label,
  value,
}: {
  tone: WfTone;
  label: string;
  value: number;
}) {
  const cfg = TONE_NODE[tone];
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs",
        cfg.bg,
        cfg.ring.split(" ").find((c) => c.startsWith("border-")) ?? "border-border",
      )}
    >
      <span className={cn("font-semibold tabular-nums", cfg.iconColor)}>{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function DataField({
  label,
  ok,
  value,
}: {
  label: string;
  ok: boolean;
  value: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-3",
        ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5",
      )}
    >
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        {ok ? (
          <Check className="h-4 w-4 text-emerald-600" />
        ) : (
          <X className="h-4 w-4 text-rose-600" />
        )}
        <span className="text-sm font-medium truncate">{value}</span>
      </div>
    </div>
  );
}
