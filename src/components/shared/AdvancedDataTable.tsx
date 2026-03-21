import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Download, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  format?: (value: any, row: T) => string | React.ReactNode;
  sortable?: boolean;
  className?: string;
}

interface AdvancedDataTableProps<T> {
  title: string;
  columns: Column<T>[];
  data: T[];
  pageSize?: number;
  searchPlaceholder?: string;
  searchKeys?: string[];
  onExportCSV?: () => void;
  totalRow?: Record<string, any>;
  emptyMessage?: string;
  className?: string;
}

export function AdvancedDataTable<T extends Record<string, any>>({
  title,
  columns,
  data,
  pageSize = 20,
  searchPlaceholder = "Buscar...",
  searchKeys,
  onExportCSV,
  totalRow,
  emptyMessage = "Nenhum dado encontrado.",
  className,
}: AdvancedDataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    const keys = searchKeys || columns.map((c) => c.key);
    return data.filter((row) =>
      keys.some((k) => String(row[k] ?? "").toLowerCase().includes(q))
    );
  }, [data, search, searchKeys, columns]);

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

  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(sorted.length / pageSize);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(0);
  };

  const defaultExportCSV = () => {
    if (onExportCSV) return onExportCSV();
    const header = columns.map((c) => c.label).join(",");
    const rows = sorted.map((row) =>
      columns.map((c) => `"${String(row[c.key] ?? "").replace(/"/g, '""')}"`).join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title.replace(/\s+/g, "_").toLowerCase()}.csv`;
    a.click();
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-semibold">
            {title} ({sorted.length.toLocaleString("pt-BR")} registros)
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="pl-9 h-9 w-[220px] text-sm"
              />
            </div>
            <Button variant="outline" size="sm" onClick={defaultExportCSV}>
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-auto">
        <div className="max-h-[500px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead
                    key={col.key}
                    className={cn(
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center",
                      (col.sortable !== false) && "cursor-pointer select-none",
                      col.className
                    )}
                    onClick={() => col.sortable !== false && toggleSort(col.key)}
                  >
                    {col.label}
                    {sortKey === col.key && (
                      sortDir === "asc" ? <ChevronUp className="h-3 w-3 inline ml-1" /> : <ChevronDown className="h-3 w-3 inline ml-1" />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center text-muted-foreground py-8">
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((row, i) => (
                  <TableRow key={i}>
                    {columns.map((col) => (
                      <TableCell
                        key={col.key}
                        className={cn(
                          col.align === "right" && "text-right",
                          col.align === "center" && "text-center",
                          "text-sm",
                          col.className
                        )}
                      >
                        {col.format ? col.format(row[col.key], row) : row[col.key]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
              {totalRow && paged.length > 0 && (
                <TableRow className="bg-muted/50 font-bold border-t-2">
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn(
                        col.align === "right" && "text-right",
                        col.align === "center" && "text-center",
                        "text-sm"
                      )}
                    >
                      {totalRow[col.key] ?? ""}
                    </TableCell>
                  ))}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
            <span>
              Página {page + 1} de {totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                Próxima
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
