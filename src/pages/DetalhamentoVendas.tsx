import { useState, useCallback, useMemo } from "react";
import { DashboardFiltersBar } from "@/components/painel-executivo/DashboardFilters";
import type { DashboardFilters } from "@/hooks/useDashboardKPIs";
import { useDetalhamentoVendas } from "@/hooks/useDetalhamentoVendas";
import { AdvancedDataTable, type Column } from "@/components/shared/AdvancedDataTable";
import { ValueLegend } from "@/components/ui/smart-value";
import { FileText } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const now = new Date();
const fmtMoeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString("pt-BR") : "-";

export default function DetalhamentoVendas() {
  const [filters, setFilters] = useState<DashboardFilters>({
    ano: now.getFullYear(),
    mes: now.getMonth() + 1,
  });
  const [opFilter, setOpFilter] = useState<string>("__all__");

  const handleFilterChange = useCallback((partial: Partial<DashboardFilters>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  }, []);

  const { data, isLoading, totalRows } = useDetalhamentoVendas(filters);

  // Group by operação for subtotals
  const operacoes = useMemo(() => [...new Set(data.map(d => d.operacao))].sort(), [data]);
  const filteredData = useMemo(() => 
    opFilter === "__all__" ? data : data.filter(d => d.operacao === opFilter),
  [data, opFilter]);

  // Subtotals by operação
  const subtotals = useMemo(() => {
    const map = new Map<string, { qtd: number; receita: number; count: number }>();
    for (const d of data) {
      if (!map.has(d.operacao)) map.set(d.operacao, { qtd: 0, receita: 0, count: 0 });
      const e = map.get(d.operacao)!;
      e.qtd += d.quantidade;
      e.receita += d.receita;
      e.count++;
    }
    return map;
  }, [data]);

  const totalReceita = filteredData.reduce((s, d) => s + d.receita, 0);
  const totalQtd = filteredData.reduce((s, d) => s + d.quantidade, 0);

  const columns: Column<any>[] = [
    { key: "data", label: "Data", format: (v) => fmtDate(v) },
    { key: "pedido", label: "Pedido" },
    { key: "cliente", label: "Cliente", className: "max-w-[150px] truncate" },
    { key: "cod_cliente", label: "Cod.Cli" },
    { key: "vendedor", label: "Vendedor" },
    { key: "supervisor", label: "Supervisor" },
    { key: "operacao", label: "Operação" },
    { key: "marca", label: "Marca" },
    { key: "descricao", label: "Produto", className: "max-w-[180px] truncate" },
    { key: "quantidade", label: "Qtd", align: "right", format: (v) => Number(v).toLocaleString("pt-BR") },
    { key: "preco_unitario", label: "Vl.Unit", align: "right", format: (v) => fmtMoeda(Number(v)) },
    { key: "receita", label: "Vl.Total", align: "right", format: (v) => fmtMoeda(Number(v)) },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-violet-100 dark:bg-violet-900/30">
            <FileText className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Detalhamento de Vendas</h1>
            <p className="text-sm text-muted-foreground">
              Dados completos de vendas {totalRows > 0 ? `(${totalRows.toLocaleString("pt-BR")} registros)` : ""}
            </p>
          </div>
        </div>
        <ValueLegend />
      </div>

      <DashboardFiltersBar filters={filters} onChange={handleFilterChange} />

      {/* Subtotais por Operação */}
      {subtotals.size > 0 && (
        <div className="flex flex-wrap gap-3">
          {[...subtotals.entries()].map(([op, v]) => (
            <Card key={op} className="cursor-pointer hover:border-primary transition-colors" onClick={() => setOpFilter(opFilter === op ? "__all__" : op)}>
              <CardContent className="p-3 flex items-center gap-3">
                <Badge variant={opFilter === op ? "default" : "outline"} className="text-xs">{op}</Badge>
                <div className="text-xs">
                  <span className="font-semibold">{fmtMoeda(v.receita)}</span>
                  <span className="text-muted-foreground ml-2">{v.count} itens</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filtro Operação */}
      <div className="flex items-center gap-3">
        <Select value={opFilter} onValueChange={setOpFilter}>
          <SelectTrigger className="w-[200px] h-9 text-sm">
            <SelectValue placeholder="Filtrar Operação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas Operações</SelectItem>
            {operacoes.map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <AdvancedDataTable
        title="Vendas Detalhadas"
        columns={columns}
        data={filteredData}
        pageSize={20}
        searchPlaceholder="Buscar cliente, produto, vendedor..."
        searchKeys={["cliente", "descricao", "vendedor", "marca", "supervisor"]}
        totalRow={{
          data: "",
          pedido: "",
          cliente: "TOTAIS",
          cod_cliente: "",
          vendedor: "",
          supervisor: "",
          operacao: "",
          marca: "",
          descricao: "",
          quantidade: totalQtd.toLocaleString("pt-BR"),
          preco_unitario: "",
          receita: fmtMoeda(totalReceita),
        }}
      />
    </div>
  );
}
