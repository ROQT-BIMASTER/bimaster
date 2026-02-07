import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpDown, ChevronLeft, ChevronRight, Download } from "lucide-react";
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

export function MunicipiosTable({
  data, loading, filters, totalCount, totalPages, pageSize, onSort, onPageChange, fetchAllForExport,
}: MunicipiosTableProps) {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

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

      // Style header
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
        <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting || totalCount === 0}>
          <Download className="h-4 w-4 mr-2" />
          {exporting ? 'Exportando...' : 'Exportar Excel'}
        </Button>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
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
                  {Array.from({ length: 12 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-12 text-muted-foreground">
                  Nenhum município encontrado com os filtros atuais
                </TableCell>
              </TableRow>
            ) : (
              data.map(row => {
                const badge = STATUS_BADGE[row.status_comercial] || STATUS_BADGE.Virgem;
                return (
                  <TableRow key={row.municipio_id} className="hover:bg-muted/30">
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
            {/* Show page numbers */}
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
