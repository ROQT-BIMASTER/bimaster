import { useState, useMemo, useEffect, useRef } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ArrowUpDown, ArrowUp, ArrowDown, Search, Eye, Send, Maximize2, Link2, Link2Off,
  AlertTriangle, Package, Filter, X, FileText, Download
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";
import { exportToExcel } from "@/utils/excelExport";

export interface SubmissaoRow {
  id: string;
  produto_codigo: string;
  produto_nome: string;
  status: string;
  numero_ordem?: string;
  numero_item?: string;
  formula_codigo?: string;
  qty_total?: number;
  peso_liquido_g?: number;
  peso_bruto_g?: number;
  ean_unidade?: string;
  ean_display?: string;
  ean_caixa_master?: string;
  observacoes_brasil?: string;
  observacoes_china?: string;
  created_at?: string;
  updated_at?: string;
  // computed
  isLinked?: boolean;
  projetoNome?: string;
  projetoCor?: string;
  pendencias?: number;
  totalChecklist?: number;
  docCount?: number;
}

type SortKey = "produto_codigo" | "produto_nome" | "status" | "numero_ordem" | "pendencias" | "projetoNome" | "updated_at";
type SortDir = "asc" | "desc";

const STATUS_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "rascunho", label: "Rascunho" },
  { value: "enviado", label: "Enviado" },
  { value: "em_revisao", label: "Em Revisão" },
  { value: "aprovado", label: "Aprovado" },
  { value: "enviado_brasil", label: "Enviado ao Brasil" },
  { value: "arte_enviada", label: "Docs Enviados" },
  { value: "rejeitado", label: "Rejeitado" },
];

const VINCULO_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "vinculados", label: "Vinculados" },
  { value: "nao_vinculados", label: "Não Vinculados" },
];

function getStatusBadge(status: string) {
  const config: Record<string, { label: string; variant: "secondary" | "default" | "warning" | "success" | "destructive" | "outline" }> = {
    rascunho: { label: "Rascunho", variant: "secondary" },
    enviado: { label: "Enviado", variant: "default" },
    em_revisao: { label: "Em Revisão", variant: "warning" },
    aprovado: { label: "Aprovado", variant: "success" },
    enviado_brasil: { label: "Enviado Brasil", variant: "default" },
    arte_enviada: { label: "Docs Enviados", variant: "outline" },
    rejeitado: { label: "Rejeitado", variant: "destructive" },
  };
  const c = config[status] || { label: status, variant: "secondary" as const };
  return <Badge variant={c.variant} className="text-[10px] whitespace-nowrap">{c.label}</Badge>;
}

function getPendenciaBadge(pendencias: number, total: number) {
  if (total === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const pct = ((total - pendencias) / total) * 100;
  let color = "text-success bg-success/10 border-success/20";
  if (pendencias > 3) color = "text-destructive bg-destructive/10 border-destructive/20";
  else if (pendencias > 0) color = "text-warning bg-warning/10 border-warning/20";
  return (
    <Badge variant="outline" className={cn("text-[10px] font-mono", color)}>
      {pendencias > 0 ? `${pendencias} pend.` : "✓ OK"}
    </Badge>
  );
}

interface Props {
  data: SubmissaoRow[];
  loading?: boolean;
  projetos: Array<{ id: string; nome: string; cor?: string }>;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onRowClick: (row: SubmissaoRow) => void;
  onFocusClick: (row: SubmissaoRow) => void;
  onDespacharClick?: (ids: string[]) => void;
  filterProjeto: string;
  onFilterProjetoChange: (v: string) => void;
  statusFilter?: string;
  onStatusFilterChange?: (v: string) => void;
}

export function VincularChinaTable({
  data, loading, projetos, selectedIds, onSelectionChange,
  onRowClick, onFocusClick, onDespacharClick, filterProjeto, onFilterProjetoChange,
  statusFilter: externalStatusFilter, onStatusFilterChange,
}: Props) {
  const [search, setSearch] = useState("");
  const [internalStatusFilter, setInternalStatusFilter] = useState("todos");
  const statusFilter = externalStatusFilter ?? internalStatusFilter;
  const setStatusFilter = onStatusFilterChange ?? setInternalStatusFilter;
  const [vinculoFilter, setVinculoFilter] = useState("todos");
  const [pendenciaFilter, setPendenciaFilter] = useState<"todos" | "com" | "sem">("todos");
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    let result = data.filter(r => {
      if (!r.produto_codigo || r.produto_codigo === "null") return false;
      if (statusFilter !== "todos" && r.status !== statusFilter) return false;
      if (vinculoFilter === "vinculados" && !r.isLinked) return false;
      if (vinculoFilter === "nao_vinculados" && r.isLinked) return false;
      if (filterProjeto && filterProjeto !== "todos" && r.projetoNome !== projetos.find(p => p.id === filterProjeto)?.nome) return false;
      if (pendenciaFilter === "com" && (r.pendencias ?? 0) === 0) return false;
      if (pendenciaFilter === "sem" && (r.pendencias ?? 0) > 0) return false;
      if (search.trim()) {
        const s = search.toLowerCase();
        return r.produto_codigo.toLowerCase().includes(s) || r.produto_nome.toLowerCase().includes(s);
      }
      return true;
    });

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "produto_codigo": cmp = a.produto_codigo.localeCompare(b.produto_codigo); break;
        case "produto_nome": cmp = a.produto_nome.localeCompare(b.produto_nome); break;
        case "status": cmp = a.status.localeCompare(b.status); break;
        case "numero_ordem": cmp = (a.numero_ordem || "").localeCompare(b.numero_ordem || ""); break;
        case "pendencias": cmp = (a.pendencias ?? 0) - (b.pendencias ?? 0); break;
        case "projetoNome": cmp = (a.projetoNome || "").localeCompare(b.projetoNome || ""); break;
        case "updated_at": cmp = new Date(a.updated_at || a.created_at || 0).getTime() - new Date(b.updated_at || b.created_at || 0).getTime(); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [data, search, statusFilter, vinculoFilter, filterProjeto, pendenciaFilter, sortKey, sortDir, projetos]);

  const allSelected = filtered.length > 0 && filtered.every(r => selectedIds.has(r.id));

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const toggleAll = () => {
    if (allSelected) onSelectionChange(new Set());
    else onSelectionChange(new Set(filtered.map(r => r.id)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    onSelectionChange(next);
  };

  const activeFilterCount = [statusFilter !== "todos", vinculoFilter !== "todos", filterProjeto && filterProjeto !== "todos", pendenciaFilter !== "todos"].filter(Boolean).length;

  // Pagination
  const PAGE_SIZE = 50;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginatedData = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Reset page when filters change
  const filteredLen = filtered.length;
  const prevFilteredLenRef = useMemo(() => ({ current: filteredLen }), []);
  if (filteredLen !== prevFilteredLenRef.current) {
    prevFilteredLenRef.current = filteredLen;
    if (currentPage !== 1) setCurrentPage(1);
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar código ou nome..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <Button
          variant={showFilters ? "default" : "outline"}
          size="sm"
          className="h-9 gap-1.5"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="h-3.5 w-3.5" />
          Filtros
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="h-4 w-4 p-0 flex items-center justify-center text-[9px] ml-1">
              {activeFilterCount}
            </Badge>
          )}
        </Button>

        {selectedIds.size > 0 && onDespacharClick && (
          <Button
            size="sm"
            className="h-9 gap-1.5 bg-primary"
            onClick={() => onDespacharClick(Array.from(selectedIds))}
          >
            <Send className="h-3.5 w-3.5" />
            Despachar {selectedIds.size} selecionado(s)
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5"
          onClick={() => {
            exportToExcel(filtered.map(r => ({
              Código: r.produto_codigo,
              Produto: r.produto_nome,
              Status: r.status,
              OC: r.numero_ordem || "",
              Projeto: r.projetoNome || "",
              Vinculado: r.isLinked ? "Sim" : "Não",
              Pendências: r.pendencias ?? 0,
              Docs: r.docCount ?? 0,
            })), { filename: "vincular_china", sheetName: "Submissões", includeTimestamp: true });
          }}
        >
          <Download className="h-3.5 w-3.5" />
          Excel
        </Button>

        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} de {data.length} registros
        </span>
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/20 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterProjeto || "todos"} onValueChange={v => onFilterProjetoChange(v === "todos" ? "" : v)}>
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue placeholder="Projeto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Projetos</SelectItem>
              {projetos.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="flex items-center gap-1.5">
                    {p.cor && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.cor }} />}
                    {p.nome}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={vinculoFilter} onValueChange={setVinculoFilter}>
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue placeholder="Vínculo" />
            </SelectTrigger>
            <SelectContent>
              {VINCULO_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={pendenciaFilter} onValueChange={v => setPendenciaFilter(v as any)}>
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue placeholder="Pendências" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas Pendências</SelectItem>
              <SelectItem value="com">Com Pendências</SelectItem>
              <SelectItem value="sem">Sem Pendências</SelectItem>
            </SelectContent>
          </Select>

          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => {
              setStatusFilter("todos");
              setVinculoFilter("todos");
              onFilterProjetoChange("");
              setPendenciaFilter("todos");
            }}>
              <X className="h-3 w-3" /> Limpar
            </Button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 340px)" }}>
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead className="w-[120px] cursor-pointer select-none" onClick={() => toggleSort("produto_codigo")}>
                  <span className="flex items-center">Código <SortIcon col="produto_codigo" /></span>
                </TableHead>
                <TableHead className="cursor-pointer select-none min-w-[200px]" onClick={() => toggleSort("produto_nome")}>
                  <span className="flex items-center">Produto <SortIcon col="produto_nome" /></span>
                </TableHead>
                <TableHead className="w-[100px] cursor-pointer select-none" onClick={() => toggleSort("numero_ordem")}>
                  <span className="flex items-center">OC <SortIcon col="numero_ordem" /></span>
                </TableHead>
                <TableHead className="w-[110px] cursor-pointer select-none" onClick={() => toggleSort("status")}>
                  <span className="flex items-center">Status <SortIcon col="status" /></span>
                </TableHead>
                <TableHead className="w-[100px] cursor-pointer select-none" onClick={() => toggleSort("pendencias")}>
                  <span className="flex items-center">Pendências <SortIcon col="pendencias" /></span>
                </TableHead>
                <TableHead className="w-[60px] text-center">Docs</TableHead>
                <TableHead className="w-[150px] cursor-pointer select-none" onClick={() => toggleSort("projetoNome")}>
                  <span className="flex items-center">Projeto <SortIcon col="projetoNome" /></span>
                </TableHead>
                <TableHead className="w-[100px] cursor-pointer select-none" onClick={() => toggleSort("updated_at")}>
                  <span className="flex items-center">Atualização <SortIcon col="updated_at" /></span>
                </TableHead>
                <TableHead className="w-[90px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    Nenhuma submissão encontrada
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map(row => {
                  const isSelected = selectedIds.has(row.id);
                  const dateStr = row.updated_at || row.created_at;
                  return (
                    <TableRow
                      key={row.id}
                      className={cn(
                        "cursor-pointer transition-colors",
                        isSelected && "bg-primary/5",
                        row.isLinked && "border-l-2 border-l-success"
                      )}
                      onClick={() => onRowClick(row)}
                    >
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleOne(row.id)} />
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs font-bold text-primary">{row.produto_codigo}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium truncate">{row.produto_nome}</span>
                          {row.isLinked ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Link2 className="h-3.5 w-3.5 text-success shrink-0" />
                                </TooltipTrigger>
                                <TooltipContent>Vinculado</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <Link2Off className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{row.numero_ordem || "—"}</span>
                      </TableCell>
                      <TableCell>{getStatusBadge(row.status)}</TableCell>
                      <TableCell>{getPendenciaBadge(row.pendencias ?? 0, row.totalChecklist ?? 0)}</TableCell>
                      <TableCell>
                        {row.projetoNome ? (
                          <div className="flex items-center gap-1.5">
                            {row.projetoCor && <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: row.projetoCor }} />}
                            <span className="text-xs truncate">{row.projetoNome}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {dateStr ? format(new Date(dateStr), "dd/MM/yy") : "—"}
                        </span>
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-end">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onRowClick(row)}>
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Detalhes</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onFocusClick(row)}>
                                  <Maximize2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Modo Foco</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Página {currentPage} de {totalPages} ({filtered.length} registros)
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
              Anterior
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const page = currentPage <= 3 ? i + 1 : currentPage + i - 2;
              if (page < 1 || page > totalPages) return null;
              return (
                <Button key={page} variant={page === currentPage ? "default" : "outline"} size="sm" className="h-7 w-7 p-0 text-xs" onClick={() => setCurrentPage(page)}>
                  {page}
                </Button>
              );
            })}
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
              Próximo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
