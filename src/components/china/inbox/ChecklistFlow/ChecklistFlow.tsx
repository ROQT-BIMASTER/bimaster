import { useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, ChevronDown, Info, Plus, Workflow } from "lucide-react";
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
  bucketForDoc,
  bucketToTone,
  type FlowBucket,
} from "@/lib/china/flowTones";
import {
  ChinaStatusFilterChips,
  useChinaStatusFilter,
} from "@/components/china/ChinaStatusFilterChips";
import { FlowNode } from "./FlowNode";
import { FlowConnector } from "./FlowConnector";
import type { FlowItemContext } from "./types";
import { useChinaI18n } from "@/hooks/useChinaI18n";

interface Props {
  group: MailboxGroup;
  perspective: "china" | "brasil";
  selectedTipo?: string | null;
  onFocusItem: (ctx: FlowItemContext) => void;
  /**
   * Layout do checklist:
   *  - "primary-first" (default): seção principal aberta + "Outros documentos" colapsável.
   *  - "split": duas seções irmãs rotuladas por responsabilidade (Brasil / China),
   *    ambas abertas. Usado na Mesa de Vínculo China.
   */
  layout?: "primary-first" | "split";
  /** Callback opcional — botão "+ Novo item" inline no header Brasil → China (layout split). */
  onAddBrasilItem?: () => void;
  /**
   * Filtra qual seção mostrar no layout "split":
   *  - "c2b" → apenas Responsabilidade China (China → Brasil)
   *  - "b2c" → apenas Responsabilidade Brasil (Brasil → China)
   *  - "both" (default) → as duas seções
   */
  side?: "c2b" | "b2c" | "both";
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
  activeBuckets,
}: {
  category: MergedChecklistCategory;
  group: MailboxGroup;
  perspective: "china" | "brasil";
  selectedTipo?: string | null;
  getDocType: ReturnType<typeof useMergedChinaChecklist>["getDocType"];
  onFocusItem: Props["onFocusItem"];
  /** Estágios ativos no filtro; vazio = mostrar todos. */
  activeBuckets: FlowBucket[];
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

  const tiposVisiveis = useMemo(
    () =>
      activeBuckets.length === 0
        ? category.tipos
        : category.tipos.filter((tipo) =>
            activeBuckets.includes(bucketForDoc(docsByTipo.get(tipo))),
          ),
    [activeBuckets, category.tipos, docsByTipo],
  );

  if (category.tipos.length === 0) return null;
  if (tiposVisiveis.length === 0) return null;

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
          {tiposVisiveis.map((tipo, idx) => {
            const dt = getDocType(tipo);
            const doc = docsByTipo.get(tipo) ?? null;
            const bucket = bucketForDoc(doc);
            const labelPt = dt?.labelPt ?? tipo;
            const labelCn = dt?.labelCn;
            const needs = needsActionForPerspective(bucket, perspective);
            const prevBucket =
              idx === 0 ? bucket : bucketForDoc(docsByTipo.get(tiposVisiveis[idx - 1]));
            return (
              <div key={tipo} className="flex items-start">
                {idx > 0 && <FlowConnector fromBucket={prevBucket} />}
                <FlowNode
                  label={labelPt}
                  labelCn={labelCn}
                  bucket={bucket}
                  status={doc?.doc_status}
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


/**
 * Legenda que também é filtro: cada etiqueta liga/desliga um estágio do fluxo.
 */
function Legend({
  counts,
  selected,
  onChange,
}: {
  counts: Partial<Record<FlowBucket, number>>;
  selected: FlowBucket[];
  onChange: (next: FlowBucket[]) => void;
}) {
  const { t } = useChinaI18n();
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-border/60 bg-muted/20 px-2 py-1">
      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Info className="h-3 w-3" /> {t("inbox.right.legenda")}
      </span>
      <ChinaStatusFilterChips
        counts={counts}
        selected={selected}
        onChange={onChange}
        idioma="bi"
        hideEmpty={false}
      />
    </div>
  );
}


/**
 * Cabeçalho de uma seção "Responsabilidade X" no layout split.
 * Mostra ícone direcional, título, subtítulo e contadores agregados.
 */
function SectionHeader({
  side,
  categories,
  group,
  action,
}: {
  side: "brasil" | "china";
  categories: MergedChecklistCategory[];
  group: MailboxGroup;
  action?: React.ReactNode;
}) {
  const docsByTipo = useMemo(() => {
    const m = new Map<string, MailboxItem>();
    for (const d of group.docs) {
      const tipo = d.tipo_documento;
      if (!tipo) continue;
      const prev = m.get(tipo);
      if (!prev) { m.set(tipo, d); continue; }
      const a = new Date(prev.created_at || 0).getTime();
      const b = new Date(d.created_at || 0).getTime();
      if (b >= a) m.set(tipo, d);
    }
    return m;
  }, [group.docs]);

  const totals = useMemo(() => {
    let done = 0, pending = 0, blocked = 0, total = 0;
    for (const cat of categories) {
      for (const tipo of cat.tipos) {
        total++;
        const bucket = bucketForDoc(docsByTipo.get(tipo));
        if (bucket === "aprovado") done++;
        else if (bucket === "rejeitado") blocked++;
        else if (bucket === "nao_criado" || bucket === "pendente") pending++;
      }
    }
    return { done, pending, blocked, total };
  }, [categories, docsByTipo]);

  const isBrasil = side === "brasil";
  const Icon = isBrasil ? ArrowUpFromLine : ArrowDownToLine;
  const title = isBrasil ? "Responsabilidade Brasil" : "Responsabilidade China";
  const direction = isBrasil ? "Brasil → China" : "China → Brasil";
  const subtitle = isBrasil
    ? "Anexe documentos e solicite aprovação interna antes de enviar."
    : "Acompanhe os documentos enviados pela China e aprove quando chegarem.";
  const accent = isBrasil
    ? "border-emerald-500/40 bg-emerald-500/5"
    : "border-amber-500/40 bg-amber-500/5";
  const iconTone = isBrasil ? "text-emerald-600" : "text-amber-600";

  return (
    <div className={cn("flex items-start justify-between gap-2 rounded-md border px-2.5 py-1.5", accent)}>
      <div className="flex min-w-0 items-start gap-2">
        <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", iconTone)} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11.5px] font-semibold text-foreground">{title}</span>
            <span className="rounded-sm bg-background/60 px-1 text-[9.5px] font-medium text-muted-foreground">
              {direction}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <div className="flex items-center gap-1 text-[10px] tabular-nums">
          <span className="text-emerald-600 font-medium">{totals.done}</span>
          <span className="text-muted-foreground/60">/</span>
          <span className="text-foreground/80">{totals.total}</span>
          {totals.blocked > 0 && (
            <span className="ml-1 rounded-sm bg-rose-500/15 px-1 text-rose-600">{totals.blocked} dev.</span>
          )}
          {totals.pending > 0 && (
            <span className="ml-1 rounded-sm bg-muted/60 px-1 text-muted-foreground">{totals.pending} pend.</span>
          )}
        </div>
        {action}
      </div>
    </div>
  );
}

/**
 * ChecklistFlow — fluxo visual (n8n-like) do checklist de uma submissão,
 * organizado em linhas horizontais por categoria. Suporta dois layouts:
 *  - "primary-first" (default): seção principal + colapsável "Outros documentos".
 *  - "split": duas seções irmãs rotuladas por responsabilidade (Brasil / China),
 *    usado na Mesa de Vínculo China.
 */
export function ChecklistFlow({
  group,
  perspective,
  selectedTipo,
  onFocusItem,
  layout = "primary-first",
  onAddBrasilItem,
  side = "both",
}: Props) {
  const { t } = useChinaI18n();
  const merged = useMergedChinaChecklist(group.submissao_id);
  const [showOthers, setShowOthers] = useState(false);
  const statusFilter = useChinaStatusFilter("china:checklist-flow:status");

  const brasilCats = merged.categoriesBrasilEnvia.filter((c) => c.tipos.length > 0);
  const chinaCats = merged.categoriesChinaEnvia.filter((c) => c.tipos.length > 0);

  const totalTipos = merged.categories.reduce((s, c) => s + c.tipos.length, 0);

  /** Contagem por estágio considerando todos os tipos do checklist da submissão. */
  const bucketCounts = useMemo(() => {
    const latest = new Map<string, MailboxItem>();
    for (const d of group.docs) {
      const tipo = d.tipo_documento;
      if (!tipo) continue;
      const prev = latest.get(tipo);
      if (!prev || new Date(d.created_at || 0) >= new Date(prev.created_at || 0)) {
        latest.set(tipo, d);
      }
    }
    const counts: Partial<Record<FlowBucket, number>> = {};
    for (const cat of merged.categories) {
      for (const tipo of cat.tipos) {
        const b = bucketForDoc(latest.get(tipo));
        counts[b] = (counts[b] || 0) + 1;
      }
    }
    return counts;
  }, [group.docs, merged.categories]);

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

  const legend = (
    <Legend
      counts={bucketCounts}
      selected={statusFilter.selected}
      onChange={statusFilter.setSelected}
    />
  );

  const renderCategory = (cat: MergedChecklistCategory) => (
    <CategoryRow
      key={cat.key}
      category={cat}
      group={group}
      perspective={perspective}
      selectedTipo={selectedTipo}
      getDocType={merged.getDocType}
      onFocusItem={onFocusItem}
      activeBuckets={statusFilter.selected}
    />
  );


  if (layout === "split") {
    const showB2C = side === "both" || side === "b2c";
    const showC2B = side === "both" || side === "c2b";
    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Workflow className="h-3.5 w-3.5" />
            {t("inbox.right.fluxoChecklist")}
          </div>
          <Legend />
        </div>

        {/* Responsabilidade Brasil — Brasil → China */}
        {showB2C && (
          <div className="space-y-2">
            <SectionHeader
              side="brasil"
              categories={brasilCats}
              group={group}
              action={
                onAddBrasilItem ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 gap-1 px-1.5 text-[10px]"
                    onClick={onAddBrasilItem}
                  >
                    <Plus className="h-3 w-3" />
                    Novo item
                  </Button>
                ) : null
              }
            />
            {brasilCats.length > 0 ? (
              <div className="space-y-2">{brasilCats.map(renderCategory)}</div>
            ) : (
              <div className="rounded-md border border-dashed border-border/60 px-3 py-3 text-center text-[10.5px] text-muted-foreground">
                Nenhum item Brasil → China configurado ainda. Use "Novo item" para começar.
              </div>
            )}
          </div>
        )}

        {/* Responsabilidade China — China → Brasil */}
        {showC2B && (
          <div className="space-y-2">
            <SectionHeader side="china" categories={chinaCats} group={group} />
            {chinaCats.length > 0 ? (
              <div className="space-y-2">{chinaCats.map(renderCategory)}</div>
            ) : (
              <div className="rounded-md border border-dashed border-border/60 px-3 py-3 text-center text-[10.5px] text-muted-foreground">
                A China ainda não definiu itens China → Brasil para esta submissão.
              </div>
            )}
          </div>
        )}
      </section>
    );
  }

  // Layout legado: primário + colapsável
  const primary = perspective === "china" ? merged.categoriesChinaEnvia : merged.categoriesBrasilEnvia;
  const secondary = perspective === "china" ? merged.categoriesBrasilEnvia : merged.categoriesChinaEnvia;
  const primaryFiltered = primary.filter((c) => c.tipos.length > 0);
  const secondaryFiltered = secondary.filter((c) => c.tipos.length > 0);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Workflow className="h-3.5 w-3.5" />
          {t("inbox.right.fluxoChecklist")}
        </div>
        <Legend />
      </div>

      <div className="space-y-2">{primaryFiltered.map(renderCategory)}</div>

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
            {secondaryFiltered.map(renderCategory)}
          </CollapsibleContent>
        </Collapsible>
      )}
    </section>
  );
}
