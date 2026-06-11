import { useMemo, useState } from "react";
import { ChevronDown, Info, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { MailboxItem } from "@/hooks/useChinaMailbox";
import type { MailboxGroup } from "@/lib/china/groupMailboxItems";
import {
  useMergedChinaChecklist,
  type MergedChecklistCategory,
} from "@/hooks/useMergedChinaChecklist";
import {
  BUCKET_LABEL,
  FLOW_TONE,
  bucketToTone,
  type FlowBucket,
} from "@/lib/china/flowTones";
import { FlowNode } from "./FlowNode";
import { FlowConnector } from "./FlowConnector";
import type { FlowItemContext } from "./types";

interface Props {
  group: MailboxGroup;
  perspective: "china" | "brasil";
  selectedTipo?: string | null;
  onFocusItem: (ctx: FlowItemContext) => void;
}

function bucketForDoc(d: MailboxItem | undefined | null): FlowBucket {
  if (!d) return "nao_criado";
  const s = (d.doc_status || "").toLowerCase();
  if (s === "aprovado") return "aprovado";
  if (s === "rejeitado") return "rejeitado";
  if (s === "contestado") return "em_analise";
  if (s === "enviado" || s === "enviado_brasil") return "enviado";
  if (s === "pendente") return "em_analise";
  if (s === "rascunho") return "pendente";
  return "pendente";
}

function needsActionForPerspective(
  bucket: FlowBucket,
  perspective: "china" | "brasil",
): boolean {
  if (perspective === "china") {
    return bucket === "nao_criado" || bucket === "pendente" || bucket === "rejeitado";
  }
  // Brasil age sobre o que está chegando para análise.
  return bucket === "enviado" || bucket === "em_analise" || bucket === "pendente";
}

function CategoryRow({
  category,
  group,
  perspective,
  selectedTipo,
  getDocType,
  onFocusItem,
}: {
  category: MergedChecklistCategory;
  group: MailboxGroup;
  perspective: "china" | "brasil";
  selectedTipo?: string | null;
  getDocType: ReturnType<typeof useMergedChinaChecklist>["getDocType"];
  onFocusItem: Props["onFocusItem"];
}) {
  const docsByTipo = useMemo(() => {
    const m = new Map<string, MailboxItem>();
    for (const d of group.docs) {
      const tipo = d.tipo_documento;
      if (!tipo) continue;
      const prev = m.get(tipo);
      if (!prev) {
        m.set(tipo, d);
        continue;
      }
      const a = new Date(prev.created_at || 0).getTime();
      const b = new Date(d.created_at || 0).getTime();
      if (b >= a) m.set(tipo, d);
    }
    return m;
  }, [group.docs]);

  const stats = useMemo(() => {
    let done = 0;
    let pending = 0;
    let blocked = 0;
    for (const tipo of category.tipos) {
      const bucket = bucketForDoc(docsByTipo.get(tipo));
      if (bucket === "aprovado") done++;
      else if (bucket === "rejeitado") blocked++;
      else if (bucket === "nao_criado" || bucket === "pendente") pending++;
    }
    return { done, pending, blocked, total: category.tipos.length };
  }, [category.tipos, docsByTipo]);

  if (category.tipos.length === 0) return null;

  return (
    <div className="rounded-md border border-border/70 bg-card/40">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-2.5 py-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[11.5px] font-semibold text-foreground/90">
            {category.labelPt}
          </span>
          {category.labelCn && (
            <span className="truncate text-[10px] text-muted-foreground/70">
              · {category.labelCn}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1 text-[10px] tabular-nums">
          <span className="text-emerald-600">{stats.done}</span>
          <span className="text-muted-foreground/60">/</span>
          <span className="text-foreground/80">{stats.total}</span>
          {stats.blocked > 0 && (
            <span className="ml-1 rounded-sm bg-rose-500/15 px-1 text-rose-600">
              {stats.blocked} dev.
            </span>
          )}
          {stats.pending > 0 && (
            <span className="ml-1 rounded-sm bg-muted/60 px-1 text-muted-foreground">
              {stats.pending} pend.
            </span>
          )}
        </div>
      </div>

      <ScrollArea className="w-full">
        <div className="flex items-start gap-0 px-2 py-2">
          {category.tipos.map((tipo, idx) => {
            const dt = getDocType(tipo);
            const doc = docsByTipo.get(tipo) ?? null;
            const bucket = bucketForDoc(doc);
            const labelPt = dt?.labelPt ?? tipo;
            const labelCn = dt?.labelCn;
            const needs = needsActionForPerspective(bucket, perspective);
            const prevBucket =
              idx === 0 ? bucket : bucketForDoc(docsByTipo.get(category.tipos[idx - 1]));
            return (
              <div key={tipo} className="flex items-start">
                {idx > 0 && <FlowConnector fromBucket={prevBucket} />}
                <FlowNode
                  label={labelPt}
                  labelCn={labelCn}
                  bucket={bucket}
                  selected={selectedTipo === tipo}
                  needsAction={needs}
                  onClick={() =>
                    onFocusItem({
                      submissaoId: group.submissao_id,
                      produtoCodigo: group.produto_codigo,
                      produtoNome: group.produto_nome,
                      tipo,
                      category,
                      docType: dt,
                      doc,
                      bucket,
                    })
                  }
                />
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border/60 bg-muted/20 px-2 py-1 text-[10px]">
      <span className="flex items-center gap-1 text-muted-foreground">
        <Info className="h-3 w-3" /> Legenda
      </span>
      {(["aprovado", "em_analise", "enviado", "pendente", "rejeitado"] as FlowBucket[]).map((b) => {
        const tone = bucketToTone(b);
        const cfg = FLOW_TONE[tone];
        const Icon = cfg.icon;
        return (
          <span key={b} className="flex items-center gap-1">
            <span
              className={cn(
                "inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border ring-2",
                cfg.border,
                cfg.bg,
                cfg.ring,
              )}
            >
              <Icon className={cn("h-2.5 w-2.5", cfg.text)} />
            </span>
            <span className={cn("font-medium", cfg.text)}>{BUCKET_LABEL[b]}</span>
          </span>
        );
      })}
    </div>
  );
}

/**
 * ChecklistFlow — fluxo visual (n8n-like) do checklist de uma submissão,
 * organizado em linhas horizontais por categoria. Substitui o tooltip que
 * vivia no Kanban e transforma o painel em um ambiente facilitador: cada
 * nó pendente abre um drawer focado para anexar/enviar o documento.
 */
export function ChecklistFlow({ group, perspective, selectedTipo, onFocusItem }: Props) {
  const merged = useMergedChinaChecklist(group.submissao_id);
  const [showOthers, setShowOthers] = useState(false);

  const primary = perspective === "china"
    ? merged.categoriesChinaEnvia
    : merged.categoriesBrasilEnvia;
  const secondary = perspective === "china"
    ? merged.categoriesBrasilEnvia
    : merged.categoriesChinaEnvia;

  const primaryFiltered = primary.filter((c) => c.tipos.length > 0);
  const secondaryFiltered = secondary.filter((c) => c.tipos.length > 0);

  const totalTipos = merged.categories.reduce((s, c) => s + c.tipos.length, 0);

  if (merged.isLoading) {
    return (
      <div className="rounded-md border border-dashed border-border/60 px-3 py-4 text-center text-[11px] text-muted-foreground">
        Carregando checklist…
      </div>
    );
  }
  if (totalTipos === 0) {
    return (
      <div className="rounded-md border border-dashed border-border/60 px-3 py-4 text-center text-[11px] text-muted-foreground">
        Esta submissão ainda não tem itens no checklist.
      </div>
    );
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Workflow className="h-3.5 w-3.5" />
          Fluxo do checklist
        </div>
        <Legend />
      </div>

      <div className="space-y-2">
        {primaryFiltered.map((cat) => (
          <CategoryRow
            key={cat.key}
            category={cat}
            group={group}
            perspective={perspective}
            selectedTipo={selectedTipo}
            getDocType={merged.getDocType}
            onFocusItem={onFocusItem}
          />
        ))}
      </div>

      {secondaryFiltered.length > 0 && (
        <Collapsible open={showOthers} onOpenChange={setShowOthers}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-full justify-between gap-1.5 px-2 text-[11px] text-muted-foreground hover:bg-muted/40"
            >
              <span className="flex items-center gap-1.5">
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform",
                    showOthers ? "rotate-0" : "-rotate-90",
                  )}
                />
                Outros documentos do processo
              </span>
              <span className="tabular-nums">
                {secondaryFiltered.reduce((s, c) => s + c.tipos.length, 0)} itens
              </span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-1">
            {secondaryFiltered.map((cat) => (
              <CategoryRow
                key={cat.key}
                category={cat}
                group={group}
                perspective={perspective}
                selectedTipo={selectedTipo}
                getDocType={merged.getDocType}
                onFocusItem={onFocusItem}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </section>
  );
}
