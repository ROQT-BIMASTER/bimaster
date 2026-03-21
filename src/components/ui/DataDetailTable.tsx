import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Download, ChevronUp, ChevronDown, ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DataColumn<T = any> {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  format?: (value: any, row: T) => string | React.ReactNode;
  className?: string;
  width?: string;
}

interface DataDetailTableProps<T = any> {
  title?: string;
  columns: DataColumn<T>[];
  data: T[];
  isLoading?: boolean;
  pageSize?: number;
  showSearch?: boolean;
  showExport?: boolean;
  showTotals?: boolean;
  totalsRow?: Record<string, any>;
  searchPlaceholder?: string;
  exportFilename?: string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  className?: string;
}

export function DataDetailTable<T extends Record<string, any>>({
  title,
  columns,
  data,
  isLoading,
  pageSize = 20,
  showSearch = true,
  showExport = true,
  showTotals = false,
  totalsRow,
  searchPlaceholder = "Buscar...",
  exportFilename = "export",
  onRowClick,
  emptyMessage = "Nenhum dado encontrado",
  className,
}: DataDetailTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter(row =>
      columns.some(col => {
        const val = row[col.key];
        return val != null && String(val).toLowerCase().includes(q);
      })
    );
  }, [data, search, columns]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (typeof av === "number" && typeof bv === "number")
        return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const toggleSort = useCallback((key: string) => {
    if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
    setPage(0);
  }, [sortKey]);

  const exportCSV = useCallback(() => {
    const header = columns.map(c => `"${c.label}"`).join(",");
    const rows = sorted.map(row =>
      columns.map(c => {
        const v = row[c.key];
        if (v == null) return "";
        if (typeof v === "number") return v;
        return `"${String(v).replace(/"/g, '""')}"`;
      }).join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${exportFilename}.csv`;
    a.click();
  }, [sorted, columns, exportFilename]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("shadow-sm", className)}>
      {(title || showSearch || showExport) && (
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            {title && (
              <CardTitle className="text-sm font-semibold">
                {title} ({sorted.length.toLocaleString("pt-BR")} registros)
              </CardTitle>
            )}
            <div className="flex items-center gap-2 ml-auto">
              {showSearch && (
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={searchPlaceholder}
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(0); }}
                    className="pl-9 h-9 w-56 text-sm"
                  />
                </div>
              )}
              {showExport && (
                <Button variant="outline" size="sm" onClick={exportCSV}>
                  <Download className="h-4 w-4 mr-1" /> CSV
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      )}
      <CardContent className="overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map(col => (
                <TableHead
                  key={col.key}
                  className={cn(
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center",
                    (col.sortable !== false) && "cursor-pointer select-none hover:text-foreground",
                    col.className,
                  )}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={() => col.sortable !== false && toggleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-0.5">
                    {col.label}
                    {sortKey === col.key && (
                      sortDir === "asc"
                        ? <ChevronUp className="h-3 w-3" />
                        : <ChevronDown className="h-3 w-3" />
                    )}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              paged.map((row, i) => (
                <TableRow
                  key={i}
                  className={onRowClick ? "cursor-pointer hover:bg-muted/50" : undefined}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map(col => (
                    <TableCell
                      key={col.key}
                      className={cn(
                        "text-sm",
                        col.align === "right" && "text-right",
                        col.align === "center" && "text-center",
                        col.className,
                      )}
                    >
                      {col.format ? col.format(row[col.key], row) : (row[col.key] ?? "-")}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
            {showTotals && totalsRow && paged.length > 0 && (
              <TableRow className="bg-muted/50 font-bold border-t-2">
                {columns.map((col, i) => (
                  <TableCell
                    key={col.key}
                    className={cn(
                      "text-sm",
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center",
                    )}
                  >
                    {i === 0 ? "TOTAIS" : totalsRow[col.key] != null ? (col.format ? col.format(totalsRow[col.key], totalsRow as any) : totalsRow[col.key]) : ""}
                  </TableCell>
                ))}
              </TableRow>
            )}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
            <span>
              {(page * pageSize + 1).toLocaleString("pt-BR")}–{Math.min((page + 1) * pageSize, sorted.length).toLocaleString("pt-BR")} de {sorted.length.toLocaleString("pt-BR")}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(0)}>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-2 text-xs">Pág. {page + 1}/{totalPages}</span>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
