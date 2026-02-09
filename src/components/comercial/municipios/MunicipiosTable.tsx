import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpDown, ChevronLeft, ChevronRight, Download, ChevronDown, ChevronUp, Info, Users, DollarSign, TrendingUp, MapPin, BarChart3 } from "lucide-react";
import { MunicipioIntelligence, MunicipiosFilters } from "@/hooks/useMunicipiosIntelligence";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface MunicipiosTableProps {
  data: MunicipioIntelligence[];
  loading: boolean;
  filters: MunicipiosFilters;
  totalCount: number;
  totalPages: number;
  pageSize: number;
  onSort: (column: string) => void;
  onPageChange: (page: number) => void;
  fetchAllForExport: () => Promise<MunicipioIntelligence[]>;
}

const STATUS_BADGE: Record<string, { variant: "default" | "warning" | "secondary" | "destructive" | "success"; label: string }> = {
  Ativo: { variant: "success", label: "Ativo" },
  Prospect: { variant: "warning", label: "Prospect" },
  Lead: { variant: "secondary", label: "Lead" },
  Virgem: { variant: "destructive", label: "Virgem" },
};

function SortableHeader({ label, column, currentSort, currentDir, onSort }: {
  label: string; column: string; currentSort: string; currentDir: string; onSort: (c: string) => void;
}) {
  const isActive = currentSort === column;
  return (
    <TableHead
      className="cursor-pointer select-none hover:bg-muted/50 whitespace-nowrap"
      onClick={() => onSort(column)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={`h-3 w-3 ${isActive ? 'text-foreground' : 'text-muted-foreground/50'}`} />
      </div>
    </TableHead>
  );
}

function DetailItem({ icon: Icon, label, value, explanation }: {
  icon: React.ElementType;
  label: string;
  value: string;
  explanation: string;
}) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/40 border">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary shrink-0" />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <span className="text-sm font-semibold">{value}</span>
      <span className="text-[11px] text-muted-foreground leading-tight">{explanation}</span>
    </div>
  );
}

function ExpandedRow({ row }: { row: MunicipioIntelligence }) {
  const fmtNum = (n: number) => n.toLocaleString('pt-BR');
  const fmtMoney = (n: number) => n > 0 ? `R$ ${n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}` : '-';
  
  return (
    <TableRow className="bg-muted/10 hover:bg-muted/10">
      <TableCell colSpan={12} className="p-0">
        <div className="px-6 py-4 space-y-4 border-l-4 border-primary/30">
          {/* Header */}
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Info className="h-4 w-4" />
            Detalhamento — {row.municipio_nome} ({row.uf_sigla})
          </div>

          {/* Demographics section */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Dados Demográficos (Fonte: IBGE)</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <DetailItem
                icon={Users}
                label="População"
                value={fmtNum(row.populacao)}
                explanation="Estimativa populacional IBGE 2025"
              />
              <DetailItem
                icon={DollarSign}
                label="PIB"
                value={row.pib_mil_reais > 0 ? `R$ ${fmtNum(row.pib_mil_reais)} mil` : '-'}
                explanation="PIB municipal em R$ mil (IBGE 2021)"
              />
              <DetailItem
                icon={TrendingUp}
                label="PIB per Capita"
                value={fmtMoney(row.pib_per_capita)}
                explanation={row.pib_per_capita > 0 ? `Cálculo: PIB (R$ ${fmtNum(row.pib_mil_reais * 1000)}) ÷ População (${fmtNum(row.populacao)})` : "Sem dados de PIB"}
              />
              <DetailItem
                icon={MapPin}
                label="Microrregião"
                value={row.microrregiao_nome}
                explanation={`Região: ${row.regiao_nome}`}
              />
            </div>
          </div>

          {/* Commercial section */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Dados Comerciais (Fonte: ERP)</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <DetailItem
                icon={Users}
                label="Clientes Ativos"
                value={row.total_clientes > 0 ? fmtNum(row.total_clientes) : '-'}
                explanation={
                  row.total_clientes > 0
                    ? `${row.clientes_com_compra} com compra registrada de ${row.total_clientes} total`
                    : "Nenhum cliente cadastrado neste município"
                }
              />
              <DetailItem
                icon={DollarSign}
                label="Receita"
                value={fmtMoney(row.receita_total)}
                explanation={
                  row.receita_total > 0
                    ? `Soma do valor da última compra de cada cliente ativo. Maior compra individual: ${fmtMoney(row.receita_maior)}`
                    : "Sem faturamento registrado"
                }
              />
              <DetailItem
                icon={DollarSign}
                label="Ticket Médio"
                value={fmtMoney(row.ticket_medio)}
                explanation={
                  row.ticket_medio > 0
                    ? `Cálculo: Receita (${fmtMoney(row.receita_total)}) ÷ Clientes com compra (${row.clientes_com_compra})`
                    : "Sem dados suficientes"
                }
              />
              <DetailItem
                icon={BarChart3}
                label="Densidade Comercial"
                value={row.densidade_comercial > 0 ? row.densidade_comercial.toFixed(2) : '-'}
                explanation={
                  row.densidade_comercial > 0
                    ? `Cálculo: Clientes (${row.total_clientes}) ÷ População (${fmtNum(row.populacao)}) × 10.000`
                    : "Sem clientes para calcular"
                }
              />
            </div>
          </div>

          {/* Pipeline section */}
          {(row.total_prospects > 0 || row.total_leads > 0) && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pipeline Comercial</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <DetailItem
                  icon={Users}
                  label="Prospects"
                  value={fmtNum(row.total_prospects)}
                  explanation="Empresas identificadas como potenciais clientes"
                />
                <DetailItem
                  icon={Users}
                  label="Leads"
                  value={fmtNum(row.total_leads)}
                  explanation="Leads captados aguardando qualificação"
                />
              </div>
            </div>
          )}

          {/* Status explanation */}
          <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 flex items-start gap-2">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <div>
              <strong>Status "{row.status_comercial}":</strong>{" "}
              {row.status_comercial === 'Ativo' && "Município possui clientes ativos com compras registradas."}
              {row.status_comercial === 'Prospect' && "Município possui prospects cadastrados, mas nenhum cliente ativo."}
              {row.status_comercial === 'Lead' && "Município possui leads cadastrados, mas sem prospects ou clientes."}
              {row.status_comercial === 'Virgem' && "Nenhum cliente, prospect ou lead cadastrado neste município."}
              {row.vendedor_nome && ` Vendedor responsável: ${row.vendedor_nome}.`}
            </div>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function MunicipiosTable({
  data, loading, filters, totalCount, totalPages, pageSize, onSort, onPageChange, fetchAllForExport,
}: MunicipiosTableProps) {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const toggleRow = (id: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const ExcelJS = await import('exceljs');
      const { saveAs } = await import('file-saver');

      const allData = await fetchAllForExport();

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Municípios');

      ws.columns = [
        { header: 'Município', key: 'municipio_nome', width: 30 },
        { header: 'UF', key: 'uf_sigla', width: 6 },
        { header: 'Região', key: 'regiao_nome', width: 15 },
        { header: 'Microrregião', key: 'microrregiao_nome', width: 25 },
        { header: 'População', key: 'populacao', width: 15 },
        { header: 'PIB (R$ mil)', key: 'pib_mil_reais', width: 18 },
        { header: 'PIB/Capita', key: 'pib_per_capita', width: 15 },
        { header: 'Clientes', key: 'total_clientes', width: 10 },
        { header: 'Receita', key: 'receita_total', width: 18 },
        { header: 'Ticket Médio', key: 'ticket_medio', width: 15 },
        { header: 'Prospects', key: 'total_prospects', width: 10 },
        { header: 'Leads', key: 'total_leads', width: 10 },
        { header: 'Densidade', key: 'densidade_comercial', width: 12 },
        { header: 'Status', key: 'status_comercial', width: 12 },
        { header: 'Vendedor', key: 'vendedor_nome', width: 25 },
      ];

      ws.getRow(1).eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
      });

      allData.forEach(row => ws.addRow(row));

      const buf = await wb.xlsx.writeBuffer();
      saveAs(new Blob([buf]), `inteligencia_municipal_${new Date().toISOString().slice(0, 10)}.xlsx`);

      toast({ title: "Exportado!", description: `${allData.length} municípios exportados com sucesso.` });
    } catch (err) {
      console.error(err);
      toast({ title: "Erro", description: "Falha ao exportar.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const start = filters.page * pageSize + 1;
  const end = Math.min((filters.page + 1) * pageSize, totalCount);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {totalCount > 0 ? `Exibindo ${start}-${end} de ${totalCount.toLocaleString('pt-BR')} municípios` : 'Nenhum resultado'}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:inline">Clique em uma linha para ver detalhes</span>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting || totalCount === 0}>
            <Download className="h-4 w-4 mr-2" />
            {exporting ? 'Exportando...' : 'Exportar Excel'}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-[36px]"></TableHead>
              <SortableHeader label="Município" column="nome" currentSort={filters.sortColumn} currentDir={filters.sortDirection} onSort={onSort} />
              <TableHead className="w-[50px]">UF</TableHead>
              <TableHead className="hidden lg:table-cell">Microrregião</TableHead>
              <SortableHeader label="População" column="populacao" currentSort={filters.sortColumn} currentDir={filters.sortDirection} onSort={onSort} />
              <SortableHeader label="PIB (R$ mil)" column="pib" currentSort={filters.sortColumn} currentDir={filters.sortDirection} onSort={onSort} />
              <SortableHeader label="PIB/Cap" column="pib_per_capita" currentSort={filters.sortColumn} currentDir={filters.sortDirection} onSort={onSort} />
              <SortableHeader label="Clientes" column="clientes" currentSort={filters.sortColumn} currentDir={filters.sortDirection} onSort={onSort} />
              <SortableHeader label="Receita" column="receita" currentSort={filters.sortColumn} currentDir={filters.sortDirection} onSort={onSort} />
              <TableHead className="hidden xl:table-cell">Ticket Médio</TableHead>
              <SortableHeader label="Densidade" column="densidade" currentSort={filters.sortColumn} currentDir={filters.sortDirection} onSort={onSort} />
              <SortableHeader label="Status" column="status" currentSort={filters.sortColumn} currentDir={filters.sortDirection} onSort={onSort} />
              <TableHead className="hidden xl:table-cell">Vendedor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 13 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center py-12 text-muted-foreground">
                  Nenhum município encontrado com os filtros atuais
                </TableCell>
              </TableRow>
            ) : (
              data.map(row => {
                const badge = STATUS_BADGE[row.status_comercial] || STATUS_BADGE.Virgem;
                const isExpanded = expandedRows.has(row.municipio_id);
                return (
                  <>
                    <TableRow
                      key={row.municipio_id}
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => toggleRow(row.municipio_id)}
                    >
                      <TableCell className="w-[36px] px-2">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{row.municipio_nome}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{row.uf_sigla}</Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-xs">
                        {row.microrregiao_nome}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.populacao.toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.pib_mil_reais > 0 ? row.pib_mil_reais.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '-'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.pib_per_capita > 0 ? `R$ ${row.pib_per_capita.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}` : '-'}
                      </TableCell>
                      <TableCell className="text-center tabular-nums font-medium">
                        {row.total_clientes > 0 ? row.total_clientes : '-'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.receita_total > 0 ? `R$ ${row.receita_total.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}` : '-'}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-right tabular-nums">
                        {row.ticket_medio > 0 ? `R$ ${row.ticket_medio.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}` : '-'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.densidade_comercial > 0 ? row.densidade_comercial.toFixed(2) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-xs text-muted-foreground">
                        {row.vendedor_nome || '-'}
                      </TableCell>
                    </TableRow>
                    {isExpanded && <ExpandedRow key={`detail-${row.municipio_id}`} row={row} />}
                  </>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Página {filters.page + 1} de {totalPages}
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page === 0}
              onClick={() => onPageChange(filters.page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = Math.max(0, Math.min(filters.page - 2, totalPages - 5)) + i;
              if (pageNum >= totalPages) return null;
              return (
                <Button
                  key={pageNum}
                  variant={pageNum === filters.page ? "default" : "outline"}
                  size="sm"
                  onClick={() => onPageChange(pageNum)}
                  className="w-9"
                >
                  {pageNum + 1}
                </Button>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page >= totalPages - 1}
              onClick={() => onPageChange(filters.page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
