import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Download, ChevronUp, ChevronDown } from "lucide-react";
import { saveAs } from "file-saver";
import type { VendaDetalhe } from "@/hooks/useDetalhamentoVendas";

interface Props {
  data: VendaDetalhe[];
  isLoading: boolean;
}

type SortKey = keyof VendaDetalhe;

const fmtMoeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString("pt-BR") : "-";

export function DetalhamentoTable({ data, isLoading }: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("data");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return data.filter(r =>
      r.cliente.toLowerCase().includes(q) ||
      r.descricao.toLowerCase().includes(q) ||
      String(r.pedido).includes(q) ||
      r.vendedor.toLowerCase().includes(q) ||
      r.marca.toLowerCase().includes(q)
    );
  }, [data, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [filtered, sortKey, sortDir]);

  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(sorted.length / pageSize);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
    setPage(0);
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3 inline ml-1" /> : <ChevronDown className="h-3 w-3 inline ml-1" />;
  };

  // Summary row
  const totals = useMemo(() => {
    return {
      quantidade: filtered.reduce((s, r) => s + r.quantidade, 0),
      receita: filtered.reduce((s, r) => s + r.receita, 0),
      vl_desconto: filtered.reduce((s, r) => s + r.vl_desconto, 0),
    };
  }, [filtered]);

  const exportExcel = async () => {
    const ExcelJS = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Vendas");
    ws.columns = [
      { header: "Data", key: "data", width: 12 },
      { header: "Pedido", key: "pedido", width: 10 },
      { header: "Nota", key: "nota", width: 10 },
      { header: "Cliente", key: "cliente", width: 25 },
      { header: "Cod.Cliente", key: "cod_cliente", width: 12 },
      { header: "Produto", key: "descricao", width: 30 },
      { header: "Marca", key: "marca", width: 15 },
      { header: "Qtde", key: "quantidade", width: 8 },
      { header: "Receita", key: "receita", width: 14 },
      { header: "Desconto", key: "vl_desconto", width: 12 },
      { header: "ICMS Subst", key: "vl_icm_subst", width: 12 },
      { header: "Tabela", key: "tabela", width: 12 },
      { header: "Vendedor", key: "vendedor", width: 20 },
      { header: "Supervisor", key: "supervisor", width: 20 },
      { header: "Empresa", key: "empresa", width: 15 },
      { header: "UF", key: "uf", width: 6 },
      { header: "Cidade", key: "cidade", width: 18 },
      { header: "Operação", key: "operacao", width: 18 },
    ];
    sorted.forEach(r => ws.addRow({ ...r, data: fmtDate(r.data) }));
    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), "detalhamento-vendas.xlsx");
  };

  if (isLoading) {
    return <Card><CardContent className="p-4"><Skeleton className="h-96 w-full" /></CardContent></Card>;
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-semibold">
            Vendas Detalhadas ({sorted.length.toLocaleString("pt-BR")} registros)
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="pl-9 h-9 w-64 text-sm"
              />
            </div>
            <Button variant="outline" size="sm" onClick={exportExcel}>
              <Download className="h-4 w-4 mr-1" /> Excel
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer whitespace-nowrap" onClick={() => toggleSort("data")}>Data<SortIcon col="data" /></TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("pedido")}>Pedido<SortIcon col="pedido" /></TableHead>
              <TableHead>Nota</TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("cliente")}>Cliente<SortIcon col="cliente" /></TableHead>
              <TableHead>Produto</TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("marca")}>Marca<SortIcon col="marca" /></TableHead>
              <TableHead className="text-right cursor-pointer" onClick={() => toggleSort("quantidade")}>Qtde<SortIcon col="quantidade" /></TableHead>
              <TableHead className="text-right cursor-pointer" onClick={() => toggleSort("receita")}>Receita<SortIcon col="receita" /></TableHead>
              <TableHead className="text-right">Desc.</TableHead>
              <TableHead>Tabela</TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("vendedor")}>Vendedor<SortIcon col="vendedor" /></TableHead>
              <TableHead>Supervisor</TableHead>
              <TableHead>UF</TableHead>
              <TableHead>Operação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs whitespace-nowrap">{fmtDate(r.data)}</TableCell>
                <TableCell className="font-mono text-xs">{r.pedido}</TableCell>
                <TableCell className="font-mono text-xs">{r.nota || "-"}</TableCell>
                <TableCell className="text-sm max-w-[150px] truncate">{r.cliente}</TableCell>
                <TableCell className="text-xs max-w-[180px] truncate">{r.descricao}</TableCell>
                <TableCell className="text-xs">{r.marca}</TableCell>
                <TableCell className="text-right">{r.quantidade}</TableCell>
                <TableCell className="text-right font-medium text-sm">{fmtMoeda(r.receita)}</TableCell>
                <TableCell className="text-right text-xs">{fmtMoeda(r.vl_desconto)}</TableCell>
                <TableCell className="text-xs">{r.tabela}</TableCell>
                <TableCell className="text-xs">{r.vendedor}</TableCell>
                <TableCell className="text-xs">{r.supervisor}</TableCell>
                <TableCell className="text-xs">{r.uf}</TableCell>
                <TableCell className="text-xs">{r.operacao}</TableCell>
              </TableRow>
            ))}
            {/* Totals row */}
            <TableRow className="bg-muted/50 font-bold">
              <TableCell colSpan={6} className="text-right text-sm">TOTAIS</TableCell>
              <TableCell className="text-right">{totals.quantidade.toLocaleString("pt-BR")}</TableCell>
              <TableCell className="text-right text-sm">{fmtMoeda(totals.receita)}</TableCell>
              <TableCell className="text-right text-xs">{fmtMoeda(totals.vl_desconto)}</TableCell>
              <TableCell colSpan={5} />
            </TableRow>
          </TableBody>
        </Table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
            <span>Página {page + 1} de {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Próxima</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
