import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpDown, ChevronLeft, ChevronRight, Download } from "lucide-react";
import type { WhitespaceRow, WhitespaceSortConfig } from "@/hooks/useWhitespaceAnalysis";
import { useCallback } from "react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  data: WhitespaceRow[];
  totalCount: number;
  loading: boolean;
  sort: WhitespaceSortConfig;
  page: number;
  totalPages: number;
  pageSize: number;
  filters: { uf: string | null; regiao: string | null; minPenetracao: number };
  onSort: (column: string) => void;
  onPageChange: (page: number) => void;
  onRowClick: (row: WhitespaceRow) => void;
}

const formatNumber = (n: number) => new Intl.NumberFormat("pt-BR").format(n);

const formatCurrency = (n: number) => {
  if (n >= 1e6) return `R$ ${(n / 1e6).toFixed(1)} mi`;
  if (n >= 1e3) return `R$ ${(n / 1e3).toFixed(0)} mil`;
  return `R$ ${n.toFixed(0)}`;
};

const getPenetracaoBadge = (p: number) => {
  if (p >= 70) return <Badge variant="default" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 hover:bg-green-100">{p}%</Badge>;
  if (p >= 40) return <Badge variant="default" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 hover:bg-amber-100">{p}%</Badge>;
  return <Badge variant="default" className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 hover:bg-red-100">{p}%</Badge>;
};

const columns = [
  { key: "rank", label: "#", sortable: false },
  { key: "municipio_nome", label: "Município", sortable: true },
  { key: "uf", label: "UF", sortable: false },
  { key: "microrregiao", label: "Microrregião", sortable: false },
  { key: "populacao", label: "População", sortable: true },
  { key: "pib_per_capita", label: "PIB/Capita", sortable: true },
  { key: "penetracao", label: "Penetração", sortable: true },
  { key: "clientes_vizinhos", label: "Clientes Viz.", sortable: false },
  { key: "receita_micro", label: "Receita Micro", sortable: false },
  { key: "vendedor", label: "Vendedor", sortable: false },
  { key: "score_expansao", label: "Score", sortable: true },
];

export function WhitespaceTable({
  data,
  totalCount,
  loading,
  sort,
  page,
  totalPages,
  pageSize,
  filters,
  onSort,
  onPageChange,
  onRowClick,
}: Props) {

  const handleExport = useCallback(async () => {
    // Fetch ALL data for export (no pagination)
    const { data: allData, error } = await supabase.rpc("fn_get_whitespace_analysis", {
      p_uf: filters.uf,
      p_regiao: filters.regiao,
      p_min_penetracao: filters.minPenetracao,
      p_sort_column: "score_expansao",
      p_sort_direction: "desc",
      p_limit: 10000,
      p_offset: 0,
    });

    if (error || !allData) return;

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Whitespace Analysis");

    ws.columns = [
      { header: "Rank", key: "rank", width: 8 },
      { header: "Município", key: "municipio", width: 28 },
      { header: "UF", key: "uf", width: 6 },
      { header: "Região", key: "regiao", width: 14 },
      { header: "Microrregião", key: "micro", width: 28 },
      { header: "População", key: "pop", width: 14 },
      { header: "PIB (mil R$)", key: "pib", width: 16 },
      { header: "PIB per Capita", key: "pib_pc", width: 14 },
      { header: "Total Mun. Micro", key: "total_micro", width: 14 },
      { header: "Ativos Micro", key: "ativos_micro", width: 14 },
      { header: "Penetração %", key: "penetracao", width: 14 },
      { header: "Clientes Vizinhos", key: "clientes", width: 14 },
      { header: "Receita Micro", key: "receita", width: 16 },
      { header: "Vendedor", key: "vendedor", width: 24 },
      { header: "Score Expansão", key: "score", width: 16 },
    ];

    (allData as any[]).forEach((row: any, i: number) => {
      ws.addRow({
        rank: i + 1,
        municipio: row.municipio_nome,
        uf: row.uf,
        regiao: row.regiao,
        micro: row.microrregiao_nome,
        pop: Number(row.populacao),
        pib: Number(row.pib_mil_reais),
        pib_pc: Number(row.pib_per_capita),
        total_micro: Number(row.total_municipios_micro),
        ativos_micro: Number(row.municipios_ativos_micro),
        penetracao: Number(row.penetracao_micro),
        clientes: Number(row.clientes_vizinhos),
        receita: Number(row.receita_micro),
        vendedor: row.vendedor_nome || "",
        score: Number(row.score_expansao),
      });
    });

    // Style header
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, `whitespace-analysis-${new Date().toISOString().split("T")[0]}.xlsx`);
  }, [filters]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading ? "Carregando..." : `${formatNumber(totalCount)} municípios encontrados`}
        </p>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={loading || totalCount === 0}>
          <Download className="h-4 w-4 mr-2" />
          Exportar Excel
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className="text-xs whitespace-nowrap">
                  {col.sortable ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 font-medium text-xs hover:bg-transparent"
                      onClick={() => onSort(col.key)}
                    >
                      {col.label}
                      <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  ) : (
                    col.label
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((col) => (
                    <TableCell key={col.key}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                  Nenhum município encontrado com os filtros atuais
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, i) => (
                <TableRow
                  key={row.municipio_id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => onRowClick(row)}
                >
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {page * pageSize + i + 1}
                  </TableCell>
                  <TableCell className="text-xs font-medium">{row.municipio_nome}</TableCell>
                  <TableCell className="text-xs">{row.uf}</TableCell>
                  <TableCell className="text-xs max-w-[140px] truncate" title={row.microrregiao_nome}>
                    {row.microrregiao_nome}
                  </TableCell>
                  <TableCell className="text-xs text-right">{formatNumber(Number(row.populacao))}</TableCell>
                  <TableCell className="text-xs text-right">
                    R$ {formatNumber(Math.round(Number(row.pib_per_capita)))}
                  </TableCell>
                  <TableCell className="text-xs text-center">
                    {getPenetracaoBadge(Number(row.penetracao_micro))}
                  </TableCell>
                  <TableCell className="text-xs text-center">{Number(row.clientes_vizinhos)}</TableCell>
                  <TableCell className="text-xs text-right">{formatCurrency(Number(row.receita_micro))}</TableCell>
                  <TableCell className="text-xs max-w-[100px] truncate" title={row.vendedor_nome || ""}>
                    {row.vendedor_nome || "—"}
                  </TableCell>
                  <TableCell className="text-xs font-bold text-right">
                    {formatNumber(Math.round(Number(row.score_expansao)))}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Página {page + 1} de {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
