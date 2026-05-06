import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Download, Search, X, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { useCompradorInboxOCs, type InboxOC } from "@/hooks/useCompradorInboxOCs";
import { downloadInboxCSV } from "@/lib/compras/exportInboxCSV";

type StatusBucket = "todas" | "pendente" | "producao" | "patio" | "embarcada" | "transito" | "recebida" | "atrasada" | "divergencia";
type SortKey =
  | "numero_oc" | "produto_nome" | "marca" | "ops" | "status" | "data_emissao" | "data_entrega_prevista"
  | "qty_pedida" | "qty_produzida" | "nao_produzido" | "qty_embarcada" | "qty_recebida" | "saldo_aberto" | "qty_avariada";
type SortDir = "asc" | "desc";

const STATUS_OPTS: { value: StatusBucket; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "pendente", label: "Pendente" },
  { value: "producao", label: "Em produção" },
  { value: "patio", label: "Pátio" },
  { value: "embarcada", label: "Embarcada" },
  { value: "transito", label: "Em trânsito" },
  { value: "recebida", label: "Recebida" },
  { value: "atrasada", label: "Atrasada" },
  { value: "divergencia", label: "Divergência" },
];

function isAtrasada(o: InboxOC): boolean {
  if (!o.data_entrega_prevista) return false;
  if (o.oc_status === "concluida" || o.oc_status === "cancelada") return false;
  return o.data_entrega_prevista < new Date().toISOString().slice(0, 10);
}

function statusBucket(o: InboxOC): StatusBucket {
  if (o.has_divergencia) return "divergencia";
  if (isAtrasada(o)) return "atrasada";
  if (o.saldo_aberto <= 0 || o.oc_status === "concluida") return "recebida";
  if (o.data_chegada_porto && !o.data_desembaraco) return "transito";
  if (o.qty_embarcada > 0 && !o.data_chegada_porto) return "embarcada";
  if (["aprovada", "em_producao", "produzindo"].includes(o.oc_status)) return "producao";
  if (["aguardando_aprovacao", "pendente_aprovacao", "rascunho"].includes(o.oc_status)) return "pendente";
  return "pendente";
}

const STATUS_BADGE: Record<StatusBucket, string> = {
  todas: "",
  pendente: "bg-muted text-foreground",
  producao: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  patio: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  embarcada: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  transito: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  recebida: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  atrasada: "bg-destructive/15 text-destructive",
  divergencia: "bg-destructive/15 text-destructive",
};

function fmtDate(s: string | null): string {
  const d = parseLocalDate(s);
  return d ? format(d, "dd/MM/yy", { locale: ptBR }) : "—";
}

function num(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString("pt-BR");
}

export function TabelaOCsPanel() {
  const { data: items = [], isLoading } = useCompradorInboxOCs();
  const [, setParams] = useSearchParams();

  const [marca, setMarca] = useState<string>("todas");
  const [status, setStatus] = useState<StatusBucket>("todas");
  const [oc, setOc] = useState<string>("todas");
  const [period, setPeriod] = useState<{ from?: Date; to?: Date }>({});
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("data_emissao");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const marcas = useMemo(
    () => Array.from(new Set(items.map((o) => o.marca).filter(Boolean) as string[])).sort(),
    [items],
  );
  const ocs = useMemo(
    () => Array.from(new Set(items.map((o) => o.numero_oc).filter(Boolean))).sort(),
    [items],
  );

  const filtered = useMemo(() => {
    let list = items.slice();
    if (marca !== "todas") list = list.filter((o) => o.marca === marca);
    if (status !== "todas") list = list.filter((o) => statusBucket(o) === status);
    if (oc !== "todas") list = list.filter((o) => o.numero_oc === oc);
    if (period.from) {
      const fromIso = period.from.toISOString().slice(0, 10);
      list = list.filter((o) => (o.data_emissao || "") >= fromIso || (o.data_entrega_prevista || "") >= fromIso);
    }
    if (period.to) {
      const toIso = period.to.toISOString().slice(0, 10);
      list = list.filter((o) => (o.data_emissao || "") <= toIso || (o.data_entrega_prevista || "") <= toIso);
    }
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
  }, [items, marca, status, oc, period, search]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const pick = (o: InboxOC): string | number => {
      switch (sortKey) {
        case "numero_oc": return o.numero_oc;
        case "produto_nome": return o.produto_nome;
        case "marca": return o.marca || "";
        case "ops": return o.ops_numeros.length;
        case "status": return statusBucket(o);
        case "data_emissao": return o.data_emissao || "";
        case "data_entrega_prevista": return o.data_entrega_prevista || "";
        case "qty_pedida": return o.qty_pedida;
        case "qty_produzida": return o.qty_produzida;
        case "nao_produzido": return Math.max(0, (o.qty_pedida || 0) - (o.qty_produzida || 0));
        case "qty_embarcada": return o.qty_embarcada;
        case "qty_recebida": return o.qty_recebida;
        case "saldo_aberto": return o.saldo_aberto;
        case "qty_avariada": return o.qty_avariada;
      }
    };
    return filtered.slice().sort((a, b) => {
      const va = pick(a);
      const vb = pick(b);
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

  const clearFilters = () => {
    setMarca("todas"); setStatus("todas"); setOc("todas");
    setPeriod({}); setSearch("");
  };

  const openOC = (id: string) => {
    setParams((p) => { const np = new URLSearchParams(p); np.set("oc", id); return np; }, { replace: true });
  };

  const periodLabel = period.from || period.to
    ? `${period.from ? format(period.from, "dd/MM") : "—"} → ${period.to ? format(period.to, "dd/MM") : "—"}`
    : "Período";

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Filtros */}
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold">Forecast & Acompanhamento de OCs</h3>
              <p className="text-xs text-muted-foreground">{filtered.length} OCs</p>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Marca">
              <Select value={marca} onValueChange={setMarca}>
                <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {marcas.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={status} onValueChange={(v) => setStatus(v as StatusBucket)}>
                <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="OC">
              <Select value={oc} onValueChange={setOc}>
                <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {ocs.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Período">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 w-[200px] justify-start gap-2 font-normal">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    <span className="truncate">{periodLabel}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <div className="flex">
                    <div className="border-r">
                      <div className="px-3 pt-2 pb-1 text-[10px] uppercase text-muted-foreground">De</div>
                      <Calendar
                        mode="single"
                        selected={period.from}
                        onSelect={(d) => setPeriod((p) => ({ ...p, from: d }))}
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </div>
                    <div>
                      <div className="px-3 pt-2 pb-1 text-[10px] uppercase text-muted-foreground">Até</div>
                      <Calendar
                        mode="single"
                        selected={period.to}
                        onSelect={(d) => setPeriod((p) => ({ ...p, to: d }))}
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </Field>
            <Field label="Buscar">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="OC, produto, SKU…"
                  className="h-9 w-[220px] pl-7"
                />
              </div>
            </Field>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={clearFilters}>
                <X className="h-3.5 w-3.5" /> Limpar
              </Button>
              <Button
                size="sm"
                className="h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => downloadInboxCSV(sorted)}
                disabled={!sorted.length}
              >
                <Download className="h-3.5 w-3.5" /> Exportar CSV
              </Button>
            </div>
          </div>
        </div>

        {/* Tabela */}
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
                  <Th onClick={() => toggleSort("marca")}><span className="flex items-center gap-1">Marca <SortIcon k="marca" /></span></Th>
                  <Th onClick={() => toggleSort("ops")}><span className="flex items-center gap-1">OP <SortIcon k="ops" /></span></Th>
                  <Th onClick={() => toggleSort("status")}><span className="flex items-center gap-1">Status <SortIcon k="status" /></span></Th>
                  <Th onClick={() => toggleSort("data_emissao")} align="right"><span className="flex items-center justify-end gap-1">Emissão <SortIcon k="data_emissao" /></span></Th>
                  <Th onClick={() => toggleSort("data_entrega_prevista")} align="right"><span className="flex items-center justify-end gap-1">ETA <SortIcon k="data_entrega_prevista" /></span></Th>
                  <Th onClick={() => toggleSort("qty_pedida")} align="right"><span className="flex items-center justify-end gap-1">Pedido <SortIcon k="qty_pedida" /></span></Th>
                  <Th onClick={() => toggleSort("qty_produzida")} align="right"><span className="flex items-center justify-end gap-1">Produzido <SortIcon k="qty_produzida" /></span></Th>
                  <Th onClick={() => toggleSort("nao_produzido")} align="right"><span className="flex items-center justify-end gap-1">Não prod. <SortIcon k="nao_produzido" /></span></Th>
                  <Th onClick={() => toggleSort("qty_embarcada")} align="right"><span className="flex items-center justify-end gap-1">Embarcado <SortIcon k="qty_embarcada" /></span></Th>
                  <Th onClick={() => toggleSort("qty_recebida")} align="right"><span className="flex items-center justify-end gap-1">Recebido <SortIcon k="qty_recebida" /></span></Th>
                  <Th onClick={() => toggleSort("saldo_aberto")} align="right"><span className="flex items-center justify-end gap-1">Saldo <SortIcon k="saldo_aberto" /></span></Th>
                  <Th onClick={() => toggleSort("qty_avariada")} align="right"><span className="flex items-center justify-end gap-1">Avaria <SortIcon k="qty_avariada" /></span></Th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={14} className="px-4 py-8 text-center text-muted-foreground text-xs">Carregando…</td></tr>
                )}
                {!isLoading && sorted.length === 0 && (
                  <tr><td colSpan={14} className="px-4 py-8 text-center text-muted-foreground text-xs">Nenhuma OC encontrada com esses filtros.</td></tr>
                )}
                {sorted.map((o) => {
                  const bucket = statusBucket(o);
                  const naoProd = Math.max(0, (o.qty_pedida || 0) - (o.qty_produzida || 0));
                  return (
                    <tr
                      key={o.ordem_compra_id}
                      onClick={() => openOC(o.ordem_compra_id)}
                      className="border-t hover:bg-muted/40 cursor-pointer"
                    >
                      <td className="px-3 py-2 font-medium text-primary">{o.numero_oc}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium truncate max-w-[220px]">{o.produto_nome}</div>
                        <div className="text-[10px] text-muted-foreground">{o.produto_codigo}</div>
                      </td>
                      <td className="px-3 py-2">
                        {o.marca ? <Badge variant="secondary" className="text-[10px]">{o.marca}</Badge> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2 text-[11px]">
                        {o.ops_numeros.length === 0 && <span className="text-muted-foreground">—</span>}
                        {o.ops_numeros.length === 1 && <span>{o.ops_numeros[0]}</span>}
                        {o.ops_numeros.length > 1 && <Badge variant="outline" className="text-[10px]">{o.ops_numeros.length} OPs</Badge>}
                      </td>
                      <td className="px-3 py-2">
                        <Badge className={cn("text-[10px] capitalize", STATUS_BADGE[bucket])} variant="outline">{STATUS_OPTS.find(s => s.value === bucket)?.label}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-[11px]">{fmtDate(o.data_emissao)}</td>
                      <td className={cn("px-3 py-2 text-right tabular-nums text-[11px]", isAtrasada(o) && "text-destructive font-medium")}>{fmtDate(o.data_entrega_prevista)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-primary">{num(o.qty_pedida)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{num(o.qty_produzida)}</td>
                      <td className={cn("px-3 py-2 text-right tabular-nums", naoProd > 0 && "text-amber-600 dark:text-amber-400 font-medium")}>{num(naoProd)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        <div>{num(o.qty_embarcada)}</div>
                        {o.embarque_container && <div className="text-[9px] text-muted-foreground">{o.embarque_container}</div>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">{num(o.qty_recebida)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{num(o.saldo_aberto)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {o.qty_avariada > 0 ? <Badge variant="destructive" className="text-[10px]">{num(o.qty_avariada)}</Badge> : <span className="text-muted-foreground">—</span>}
                      </td>
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
