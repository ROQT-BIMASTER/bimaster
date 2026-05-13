import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Loader2, Search, FileText, ShoppingBag, Factory, PackageCheck, Ship, CheckCircle2, List, Table as TableIcon } from "lucide-react";
import { ChinaTabelaOCsPanel } from "./ChinaTabelaOCsPanel";
import {
  useChinaInboxOCs,
  chinaInboxOCCounts,
  ocSubTabMatches,
  type ChinaInboxOC,
  type ChinaOCSubTab,
} from "@/hooks/useChinaInboxOCs";
import { ChinaOCReader } from "./ChinaOCReader";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useChinaI18n } from "@/hooks/useChinaI18n";

const TABS: { key: ChinaOCSubTab; labelKey: string; icon: any }[] = [
  { key: "pendente", labelKey: "inboxOC.tabPendente", icon: ShoppingBag },
  { key: "producao", labelKey: "inboxOC.tabProducao", icon: Factory },
  { key: "pronto_embarque", labelKey: "inboxOC.tabProntoEmbarque", icon: PackageCheck },
  { key: "embarcada", labelKey: "inboxOC.tabEmbarcada", icon: Ship },
  { key: "concluida", labelKey: "inboxOC.tabConcluida", icon: CheckCircle2 },
];

function fmt(d: string | null) {
  if (!d) return "—";
  try { return format(parseLocalDate(d)!, "dd/MM", { locale: ptBR }); } catch { return d; }
}

export function ChinaInboxOCAba() {
  const { t } = useChinaI18n();
  const qc = useQueryClient();
  const [tab, setTab] = useState<ChinaOCSubTab>("pendente");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"lista" | "tabela">("lista");

  const { data: items = [], isLoading } = useChinaInboxOCs();
  const counts = useMemo(() => chinaInboxOCCounts(items), [items]);

  const filtered = useMemo(() => {
    let list = items.filter((o) => ocSubTabMatches(o, tab));
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (o) =>
          o.numero_oc.toLowerCase().includes(q) ||
          o.produto_codigo.toLowerCase().includes(q) ||
          o.produto_nome.toLowerCase().includes(q),
      );
    }
    return list;
  }, [items, tab, search]);

  const selected = items.find((o) => o.ordem_compra_id === selectedId) || null;
  const onChanged = () => qc.invalidateQueries({ queryKey: ["china-inbox-ocs"] });

  if (view === "tabela") {
    return (
      <div className="flex flex-col h-full">
        <div className="border-b p-3 flex items-center gap-2">
          <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as any)} size="sm">
            <ToggleGroupItem value="lista" className="h-8 px-2 text-xs gap-1.5"><List className="h-3.5 w-3.5" />{t("inboxOC.viewLista")}</ToggleGroupItem>
            <ToggleGroupItem value="tabela" className="h-8 px-2 text-xs gap-1.5"><TableIcon className="h-3.5 w-3.5" />{t("inboxOC.viewTabela")}</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="flex-1 overflow-hidden">
          <ChinaTabelaOCsPanel
            items={items}
            isLoading={isLoading}
            onOpen={(id) => { setSelectedId(id); setView("lista"); }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[1fr_minmax(380px,560px)] h-full">
      <div className="flex flex-col border-r overflow-hidden">
        <div className="border-b p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Tabs value={tab} onValueChange={(v) => { setTab(v as ChinaOCSubTab); setSelectedId(null); }}>
              <TabsList className="h-9">
                {TABS.map((tb) => {
                  const Icon = tb.icon;
                  return (
                    <TabsTrigger key={tb.key} value={tb.key} className="text-xs gap-1.5">
                      <Icon className="h-3.5 w-3.5" />
                      {t(tb.labelKey)}
                      {counts[tb.key] > 0 && (
                        <Badge variant="secondary" className="h-4 px-1.5 text-[10px] tabular-nums">
                          {counts[tb.key]}
                        </Badge>
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
            <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as any)} size="sm">
              <ToggleGroupItem value="lista" className="h-8 px-2 text-xs gap-1.5"><List className="h-3.5 w-3.5" />{t("inboxOC.viewLista")}</ToggleGroupItem>
              <ToggleGroupItem value="tabela" className="h-8 px-2 text-xs gap-1.5"><TableIcon className="h-3.5 w-3.5" />{t("inboxOC.viewTabela")}</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-7 h-8 text-sm"
              placeholder={t("inboxOC.buscarPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-xs text-muted-foreground">
              {t("inboxOC.nenhumaOC")}
            </div>
          ) : (
            <ul className="divide-y">
              {filtered.map((o) => (
                <OCListRow
                  key={o.ordem_compra_id}
                  oc={o}
                  active={selectedId === o.ordem_compra_id}
                  onClick={() => setSelectedId(o.ordem_compra_id)}
                  t={t}
                />
              ))}
            </ul>
          )}
        </ScrollArea>
      </div>

      <div className="bg-background overflow-hidden">
        <ChinaOCReader oc={selected} onChanged={onChanged} />
      </div>
    </div>
  );
}

function OCListRow({ oc, active, onClick, t }: { oc: ChinaInboxOC; active: boolean; onClick: () => void; t: (k: string, opts?: any) => string }) {
  const pct = oc.qty_total > 0 ? Math.round((oc.qty_produzida / oc.qty_total) * 100) : 0;
  return (
    <li
      onClick={onClick}
      className={`px-3 py-2 cursor-pointer hover:bg-muted/40 ${active ? "bg-primary/10" : ""}`}
    >
      <div className="flex items-center gap-2">
        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-semibold tabular-nums">{oc.numero_oc}</span>
        {oc.has_embarque && (
          <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
            <Ship className="h-2.5 w-2.5 mr-1" />{oc.embarque_status ?? t("inboxOC.embarcadaBadge")}
          </Badge>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">
          {t("inboxOC.entregaPrefix")} {fmt(oc.data_entrega_prevista)}
        </span>
      </div>
      <div className="mt-0.5 text-xs truncate">
        <span className="text-muted-foreground">{oc.produto_codigo}</span> · {oc.produto_nome}
      </div>
      <div className="mt-1 flex items-center gap-2">
        <div className="h-1 flex-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {oc.qty_produzida}/{oc.qty_total} ({pct}%)
        </span>
      </div>
    </li>
  );
}
