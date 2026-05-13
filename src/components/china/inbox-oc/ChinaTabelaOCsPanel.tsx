import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowUpDown, ArrowUp, ArrowDown, Search, X, Ship } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import {
  type ChinaInboxOC,
  type ChinaOCSubTab,
  ocSubTabMatches,
} from "@/hooks/useChinaInboxOCs";
import { useChinaI18n } from "@/hooks/useChinaI18n";

type SortKey =
  | "numero_oc" | "produto_nome" | "status" | "data_emissao" | "data_entrega_prevista"
  | "qty_total" | "qty_produzida" | "nao_produzido" | "data_embarque" | "data_eta";
type SortDir = "asc" | "desc";

const STATUS_OPTS: { value: ChinaOCSubTab | "todas"; labelKey: string }[] = [
  { value: "todas", labelKey: "inboxOC.todas" },
  { value: "pendente", labelKey: "inboxOC.tabPendente" },
  { value: "producao", labelKey: "inboxOC.tabProducao" },
  { value: "pronto_embarque", labelKey: "inboxOC.tabProntoEmbarque" },
  { value: "embarcada", labelKey: "inboxOC.tabEmbarcada" },
  { value: "concluida", labelKey: "inboxOC.tabConcluida" },
];

const STATUS_BADGE: Record<ChinaOCSubTab, string> = {
  pendente: "bg-muted text-foreground",
  producao: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  pronto_embarque: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  embarcada: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  concluida: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

function bucketOf(o: ChinaInboxOC): ChinaOCSubTab {
  const order: ChinaOCSubTab[] = ["concluida", "embarcada", "pronto_embarque", "producao", "pendente"];
  for (const b of order) if (ocSubTabMatches(o, b)) return b;
  return "pendente";
}

function fmtDate(s: string | null): string {
  const d = parseLocalDate(s);
  return d ? format(d, "dd/MM/yy", { locale: ptBR }) : "—";
}

function num(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString("pt-BR");
}

function isAtrasada(o: ChinaInboxOC): boolean {
  const eta = parseLocalDate(o.data_entrega_prevista);
  if (!eta) return false;
  const real = parseLocalDate(o.data_entrega_real);
  if (real) return real.getTime() > eta.getTime();
  if (o.status === "concluida") return false;
  return eta.getTime() < new Date().setHours(0, 0, 0, 0);
}

interface Props {
  items: ChinaInboxOC[];
  isLoading: boolean;
  onOpen: (id: string) => void;
}

export function ChinaTabelaOCsPanel({ items, isLoading, onOpen }: Props) {
  const { t } = useChinaI18n();
  const [status, setStatus] = useState<ChinaOCSubTab | "todas">("todas");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("data_emissao");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const filtered = useMemo(() => {
    let list = items.slice();
    if (status !== "todas") list = list.filter((o) => bucketOf(o) === status);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (o) =>
          o.numero_oc.toLowerCase().includes(q) ||
          o.produto_nome.toLowerCase().includes(q) ||
          o.produto_codigo.toLowerCase().includes(q),
      );
    }
    return list;
  }, [items, status, search]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const pick = (o: ChinaInboxOC): string | number => {
      switch (sortKey) {
        case "numero_oc": return o.numero_oc;
        case "produto_nome": return o.produto_nome;
        case "status": return bucketOf(o);
        case "data_emissao": return o.data_emissao || "";
        case "data_entrega_prevista": return o.data_entrega_prevista || "";
        case "qty_total": return o.qty_total;
        case "qty_produzida": return o.qty_produzida;
        case "nao_produzido": return Math.max(0, o.qty_total - o.qty_produzida);
        case "data_embarque": return o.data_embarque || "";
        case "data_eta": return o.data_eta || "";
      }
    };
    return filtered.slice().sort((a, b) => {
      const va = pick(a); const vb = pick(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const clear = () => { setStatus("todas"); setSearch(""); };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold">Acompanhamento de OCs (Fábrica)</h3>
            <p className="text-xs text-muted-foreground">{filtered.length} OCs</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Status">
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Buscar">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="OC, produto, SKU…"
                  className="h-9 w-[260px] pl-7"
                />
              </div>
            </Field>
            <div className="ml-auto">
              <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={clear}>
                <X className="h-3.5 w-3.5" /> Limpar
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h3 className="text-sm font-semibold">Tabela de Ordens de Compra</h3>
            <span className="text-[11px] text-muted-foreground">Clique nas colunas para ordenar</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <Th onClick={() => toggleSort("numero_oc")}><span className="flex items-center gap-1">OC <SortIcon k="numero_oc" /></span></Th>
                  <Th onClick={() => toggleSort("produto_nome")}><span className="flex items-center gap-1">Produto <SortIcon k="produto_nome" /></span></Th>
                  <Th onClick={() => toggleSort("status")}><span className="flex items-center gap-1">Status <SortIcon k="status" /></span></Th>
                  <Th onClick={() => toggleSort("data_emissao")} align="right"><span className="flex items-center justify-end gap-1">Emissão <SortIcon k="data_emissao" /></span></Th>
                  <Th onClick={() => toggleSort("data_entrega_prevista")} align="right"><span className="flex items-center justify-end gap-1">Entrega <SortIcon k="data_entrega_prevista" /></span></Th>
                  <Th onClick={() => toggleSort("qty_total")} align="right"><span className="flex items-center justify-end gap-1">Pedido <SortIcon k="qty_total" /></span></Th>
                  <Th onClick={() => toggleSort("qty_produzida")} align="right"><span className="flex items-center justify-end gap-1">Produzido <SortIcon k="qty_produzida" /></span></Th>
                  <Th onClick={() => toggleSort("nao_produzido")} align="right"><span className="flex items-center justify-end gap-1">Não prod. <SortIcon k="nao_produzido" /></span></Th>
                  <Th onClick={() => toggleSort("data_embarque")} align="right"><span className="flex items-center justify-end gap-1">Embarque <SortIcon k="data_embarque" /></span></Th>
                  <Th onClick={() => toggleSort("data_eta")} align="right"><span className="flex items-center justify-end gap-1">ETA <SortIcon k="data_eta" /></span></Th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground text-xs">Carregando…</td></tr>
                )}
                {!isLoading && sorted.length === 0 && (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground text-xs">Nenhuma OC encontrada.</td></tr>
                )}
                {sorted.map((o) => {
                  const bucket = bucketOf(o);
                  const naoProd = Math.max(0, o.qty_total - o.qty_produzida);
                  const pct = o.qty_total > 0 ? Math.round((o.qty_produzida / o.qty_total) * 100) : 0;
                  return (
                    <tr
                      key={o.ordem_compra_id}
                      onClick={() => onOpen(o.ordem_compra_id)}
                      className="border-t hover:bg-muted/40 cursor-pointer"
                    >
                      <td className="px-3 py-2 font-medium text-primary">{o.numero_oc}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium truncate max-w-[260px]">{o.produto_nome}</div>
                        <div className="text-[10px] text-muted-foreground">{o.produto_codigo}</div>
                      </td>
                      <td className="px-3 py-2">
                        <Badge className={cn("text-[10px] capitalize", STATUS_BADGE[bucket])} variant="outline">
                          {STATUS_OPTS.find(s => s.value === bucket)?.label}
                        </Badge>
                        {o.has_embarque && (
                          <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">
                            <Ship className="h-2.5 w-2.5 mr-1" />{o.embarque_status ?? "embarcada"}
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-[11px]">{fmtDate(o.data_emissao)}</td>
                      <td className={cn("px-3 py-2 text-right tabular-nums text-[11px]", isAtrasada(o) && "text-destructive font-medium")}>{fmtDate(o.data_entrega_prevista)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-primary">{num(o.qty_total)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        <div>{num(o.qty_produzida)}</div>
                        <div className="text-[9px] text-muted-foreground">{pct}%</div>
                      </td>
                      <td className={cn("px-3 py-2 text-right tabular-nums", naoProd > 0 && "text-amber-600 dark:text-amber-400 font-medium")}>{num(naoProd)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-[11px]">{fmtDate(o.data_embarque)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-[11px]">{fmtDate(o.data_eta)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
      {children}
    </div>
  );
}

function Th({ children, onClick, align }: { children: React.ReactNode; onClick?: () => void; align?: "right" }) {
  return (
    <th
      onClick={onClick}
      className={cn(
        "px-3 py-2 font-medium select-none",
        align === "right" ? "text-right" : "text-left",
        onClick && "cursor-pointer hover:text-foreground",
      )}
    >
      {children}
    </th>
  );
}
