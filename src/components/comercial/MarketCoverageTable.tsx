import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MarketCoverageRow } from "@/hooks/useMarketCoverage";
import { Search, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MarketCoverageTableProps {
  data: MarketCoverageRow[];
  isLoading: boolean;
}

type SortField =
  | "uf"
  | "total_municipios"
  | "municipios_com_clientes"
  | "penetracao_percentual"
  | "total_clientes_erp"
  | "total_prospects"
  | "total_leads_minerados"
  | "populacao_total"
  | "pib_total_mil_reais";

const formatNumber = (n: number) => new Intl.NumberFormat("pt-BR").format(n);

const formatCurrency = (n: number) => {
  if (n >= 1_000_000_000) return `R$ ${(n / 1_000_000).toFixed(0)} mi`;
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)} mi`;
  if (n >= 1_000) return `R$ ${(n / 1_000).toFixed(0)} mil`;
  return `R$ ${formatNumber(n)}`;
};

const formatPopulation = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} mi`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} mil`;
  return formatNumber(n);
};

const getPenetracaoColor = (pct: number) => {
  if (pct >= 20) return "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300";
  if (pct >= 10) return "bg-blue-500/20 text-blue-700 dark:text-blue-300";
  if (pct >= 5) return "bg-amber-500/20 text-amber-700 dark:text-amber-300";
  if (pct > 0) return "bg-orange-500/20 text-orange-700 dark:text-orange-300";
  return "bg-muted text-muted-foreground";
};

export function MarketCoverageTable({ data, isLoading }: MarketCoverageTableProps) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("penetracao_percentual");
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = useMemo(() => {
    let rows = data;
    if (search) {
      const q = search.toUpperCase();
      rows = rows.filter(
        (r) =>
          r.uf.includes(q) ||
          (r.regiao_nome && r.regiao_nome.toUpperCase().includes(q))
      );
    }
    return [...rows].sort((a, b) => {
      const aVal = a[sortField] ?? 0;
      const bVal = b[sortField] ?? 0;
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortAsc ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
    });
  }, [data, search, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto p-0 font-medium text-muted-foreground hover:text-foreground gap-1"
      onClick={() => handleSort(field)}
    >
      {children}
      <ArrowUpDown className="h-3 w-3" />
    </Button>
  );

  // Totais
  const totals = useMemo(() => ({
    totalMunicipios: filtered.reduce((s, r) => s + r.total_municipios, 0),
    comClientes: filtered.reduce((s, r) => s + r.municipios_com_clientes, 0),
    clientes: filtered.reduce((s, r) => s + r.total_clientes_erp, 0),
    prospects: filtered.reduce((s, r) => s + r.total_prospects, 0),
    leads: filtered.reduce((s, r) => s + r.total_leads_minerados, 0),
    pop: filtered.reduce((s, r) => s + r.populacao_total, 0),
    pib: filtered.reduce((s, r) => s + r.pib_total_mil_reais, 0),
  }), [filtered]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-lg">Cobertura de Mercado por UF</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filtrar por UF ou região..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-16"><SortHeader field="uf">UF</SortHeader></TableHead>
                <TableHead className="text-right"><SortHeader field="total_municipios">Municípios</SortHeader></TableHead>
                <TableHead className="text-right"><SortHeader field="municipios_com_clientes">Com Clientes</SortHeader></TableHead>
                <TableHead className="text-right"><SortHeader field="penetracao_percentual">Penetração</SortHeader></TableHead>
                <TableHead className="text-right"><SortHeader field="total_clientes_erp">Clientes ERP</SortHeader></TableHead>
                <TableHead className="text-right"><SortHeader field="total_prospects">Prospects</SortHeader></TableHead>
                <TableHead className="text-right"><SortHeader field="total_leads_minerados">Leads</SortHeader></TableHead>
                <TableHead className="text-right"><SortHeader field="populacao_total">População</SortHeader></TableHead>
                <TableHead className="text-right"><SortHeader field="pib_total_mil_reais">PIB</SortHeader></TableHead>
                <TableHead>Vendedores</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={row.uf} className="hover:bg-muted/30">
                  <TableCell className="font-bold">{row.uf}</TableCell>
                  <TableCell className="text-right">{formatNumber(row.total_municipios)}</TableCell>
                  <TableCell className="text-right">{formatNumber(row.municipios_com_clientes)}</TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant="secondary"
                      className={`font-mono ${getPenetracaoColor(row.penetracao_percentual)}`}
                    >
                      {row.penetracao_percentual.toFixed(1)}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatNumber(row.total_clientes_erp)}</TableCell>
                  <TableCell className="text-right">
                    {row.total_prospects > 0 ? (
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        {formatNumber(row.total_prospects)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.total_leads_minerados > 0 ? (
                      <span className="text-orange-600 dark:text-orange-400 font-medium">
                        {formatNumber(row.total_leads_minerados)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatPopulation(row.populacao_total)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatCurrency(row.pib_total_mil_reais)}</TableCell>
                  <TableCell>
                    {row.vendedores_atribuidos && row.vendedores_atribuidos.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {row.vendedores_atribuidos.map((v) => (
                          <Badge key={v} variant="outline" className="text-xs">
                            {v.split(" ")[0]}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sem atribuição</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {/* Linha de totais */}
              <TableRow className="bg-muted/50 font-bold border-t-2">
                <TableCell>TOTAL</TableCell>
                <TableCell className="text-right">{formatNumber(totals.totalMunicipios)}</TableCell>
                <TableCell className="text-right">{formatNumber(totals.comClientes)}</TableCell>
                <TableCell className="text-right">
                  <Badge variant="secondary" className="font-mono bg-primary/10 text-primary">
                    {totals.totalMunicipios > 0
                      ? ((totals.comClientes / totals.totalMunicipios) * 100).toFixed(1)
                      : "0"}%
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{formatNumber(totals.clientes)}</TableCell>
                <TableCell className="text-right">{formatNumber(totals.prospects)}</TableCell>
                <TableCell className="text-right">{formatNumber(totals.leads)}</TableCell>
                <TableCell className="text-right">{formatPopulation(totals.pop)}</TableCell>
                <TableCell className="text-right">{formatCurrency(totals.pib)}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
