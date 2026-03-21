import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Download, ChevronUp, ChevronDown } from "lucide-react";
import { saveAs } from "file-saver";

interface ClienteDetail {
  cod_cliente: number;
  nome: string;
  cnpj: string | null;
  uf: string | null;
  cidade: string | null;
  vendedor: string | null;
  supervisor: string | null;
  id_empresa: number | null;
  ultima_compra: string | null;
  dias_sem_compra: number;
  receita: number;
  qtde_pedidos: number;
  ticket_medio: number;
}

interface Props {
  data: ClienteDetail[];
  isLoading: boolean;
  onClienteClick: (cod: number) => void;
}

type SortKey = keyof ClienteDetail;

const fmtMoeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("pt-BR") : "-";

export function ClientesDetalheTable({ data, isLoading, onClienteClick }: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("receita");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return data.filter(c =>
      c.nome.toLowerCase().includes(q) ||
      String(c.cod_cliente).includes(q) ||
      (c.cnpj || "").includes(q) ||
      (c.vendedor || "").toLowerCase().includes(q) ||
      (c.uf || "").toLowerCase().includes(q)
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

  const exportExcel = async () => {
    const ExcelJS = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Clientes");
    ws.columns = [
      { header: "Cod.", key: "cod_cliente", width: 10 },
      { header: "Nome", key: "nome", width: 30 },
      { header: "CNPJ", key: "cnpj", width: 18 },
      { header: "UF", key: "uf", width: 6 },
      { header: "Cidade", key: "cidade", width: 20 },
      { header: "Vendedor", key: "vendedor", width: 20 },
      { header: "Supervisor", key: "supervisor", width: 20 },
      { header: "Última Compra", key: "ultima_compra", width: 14 },
      { header: "Dias s/ Compra", key: "dias_sem_compra", width: 14 },
      { header: "Receita", key: "receita", width: 15 },
      { header: "Pedidos", key: "qtde_pedidos", width: 10 },
      { header: "Ticket Médio", key: "ticket_medio", width: 15 },
    ];
    sorted.forEach(c => ws.addRow({ ...c, ultima_compra: c.ultima_compra ? new Date(c.ultima_compra).toLocaleDateString("pt-BR") : "" }));
    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), "clientes.xlsx");
  };

  if (isLoading) {
    return <Card><CardContent className="p-4"><Skeleton className="h-96 w-full" /></CardContent></Card>;
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-semibold">Detalhamento de Clientes ({sorted.length})</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente..."
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
              <TableHead className="cursor-pointer whitespace-nowrap" onClick={() => toggleSort("cod_cliente")}>Cod.<SortIcon col="cod_cliente" /></TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("nome")}>Nome<SortIcon col="nome" /></TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("uf")}>UF<SortIcon col="uf" /></TableHead>
              <TableHead>Cidade</TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("vendedor")}>Vendedor<SortIcon col="vendedor" /></TableHead>
              <TableHead>Supervisor</TableHead>
              <TableHead className="cursor-pointer whitespace-nowrap" onClick={() => toggleSort("ultima_compra")}>Últ. Compra<SortIcon col="ultima_compra" /></TableHead>
              <TableHead className="cursor-pointer whitespace-nowrap" onClick={() => toggleSort("dias_sem_compra")}>Dias s/ Compra<SortIcon col="dias_sem_compra" /></TableHead>
              <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("receita")}>Receita<SortIcon col="receita" /></TableHead>
              <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("qtde_pedidos")}>Pedidos<SortIcon col="qtde_pedidos" /></TableHead>
              <TableHead className="cursor-pointer text-right whitespace-nowrap" onClick={() => toggleSort("ticket_medio")}>Ticket Médio<SortIcon col="ticket_medio" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((c) => (
              <TableRow
                key={c.cod_cliente}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onClienteClick(c.cod_cliente)}
              >
                <TableCell className="font-mono text-xs">{c.cod_cliente}</TableCell>
                <TableCell className="font-medium text-sm max-w-[200px] truncate">{c.nome}</TableCell>
                <TableCell className="text-xs">{c.cnpj || "-"}</TableCell>
                <TableCell>{c.uf || "-"}</TableCell>
                <TableCell className="text-xs">{c.cidade || "-"}</TableCell>
                <TableCell className="text-xs">{c.vendedor || "-"}</TableCell>
                <TableCell className="text-xs">{c.supervisor || "-"}</TableCell>
                <TableCell className="text-xs">{fmtDate(c.ultima_compra)}</TableCell>
                <TableCell className={`text-xs text-right ${c.dias_sem_compra > 60 ? "text-destructive font-bold" : ""}`}>
                  {c.receita > 0 ? c.dias_sem_compra : "-"}
                </TableCell>
                <TableCell className="text-right font-medium text-sm">{fmtMoeda(c.receita)}</TableCell>
                <TableCell className="text-right">{c.qtde_pedidos}</TableCell>
                <TableCell className="text-right text-sm">{fmtMoeda(c.ticket_medio)}</TableCell>
              </TableRow>
            ))}
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
