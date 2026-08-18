import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { exportToExcel } from "@/utils/excelExport";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RelatorioVendedorRow {
  cod_vend: number | null;
  vendedor: string;
  total_clientes: number;
  clientes_ativos: number;
  total_municipios: number;
  total_ufs: number;
  total_supervisores: number;
  supervisores: string | null;
  equipes: string | null;
  ultima_compra: string | null;
}

const RelatorioVendedores = () => {
  const [search, setSearch] = useState("");
  const [uf, setUf] = useState("");
  const [somenteAtivos, setSomenteAtivos] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["relatorio-vendedores", search, uf, somenteAtivos],
    queryFn: async (): Promise<RelatorioVendedorRow[]> => {
      const { data, error } = await supabase.rpc("fn_get_relatorio_vendedores" as never, {
        p_uf: uf.trim() ? uf.trim().toUpperCase() : null,
        p_search: search.trim() || null,
        p_somente_ativos: somenteAtivos,
      } as never);
      if (error) throw error;
      return (data ?? []) as unknown as RelatorioVendedorRow[];
    },
    staleTime: 60_000,
  });

  const rows = useMemo(() => data ?? [], [data]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          clientes: acc.clientes + Number(r.total_clientes || 0),
          ativos: acc.ativos + Number(r.clientes_ativos || 0),
        }),
        { clientes: 0, ativos: 0 },
      ),
    [rows],
  );

  const handleExport = async () => {
    if (!rows.length) {
      toast.error("Não há dados para exportar.");
      return;
    }
    setExporting(true);
    try {
      await exportToExcel(
        rows.map((r) => ({
          codigo: r.cod_vend ?? "-",
          vendedor: r.vendedor,
          total_clientes: Number(r.total_clientes || 0),
          clientes_ativos: Number(r.clientes_ativos || 0),
          total_municipios: Number(r.total_municipios || 0),
          total_ufs: Number(r.total_ufs || 0),
          total_supervisores: Number(r.total_supervisores || 0),
          supervisores: r.supervisores ?? "",
          equipes: r.equipes ?? "",
          ultima_compra: r.ultima_compra
            ? format(new Date(r.ultima_compra), "dd/MM/yyyy", { locale: ptBR })
            : "",
        })),
        {
          filename: "relatorio-vendedores",
          sheetName: "Vendedores",
          includeTimestamp: true,
          columns: [
            { header: "Código", key: "codigo", width: 12 },
            { header: "Vendedor", key: "vendedor", width: 34 },
            { header: "Clientes", key: "total_clientes", width: 12 },
            { header: "Clientes ativos (180d)", key: "clientes_ativos", width: 20 },
            { header: "Municípios", key: "total_municipios", width: 14 },
            { header: "UFs", key: "total_ufs", width: 10 },
            { header: "Supervisores", key: "total_supervisores", width: 16 },
            { header: "Supervisores (nomes)", key: "supervisores", width: 40 },
            { header: "Equipes", key: "equipes", width: 30 },
            { header: "Última compra", key: "ultima_compra", width: 16 },
          ],
        },
      );
      toast.success("Relatório exportado com sucesso.");
    } catch (e) {
      toast.error("Falha ao exportar o relatório.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
              <Users className="h-6 w-6 text-primary" />
              Relatório por Vendedor
            </h1>
            <p className="text-sm text-muted-foreground">
              Consolidação de clientes, municípios e supervisores por vendedor.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button onClick={handleExport} disabled={exporting || isLoading}>
              <Download className="mr-2 h-4 w-4" />
              Exportar Excel
            </Button>
          </div>
        </header>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filtros</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-4">
            <div className="w-full max-w-xs space-y-1">
              <Label htmlFor="busca">Vendedor ou supervisor</Label>
              <Input
                id="busca"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome"
              />
            </div>
            <div className="w-24 space-y-1">
              <Label htmlFor="uf">UF</Label>
              <Input
                id="uf"
                value={uf}
                maxLength={2}
                onChange={(e) => setUf(e.target.value)}
                placeholder="SP"
              />
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Switch id="ativos" checked={somenteAtivos} onCheckedChange={setSomenteAtivos} />
              <Label htmlFor="ativos">Somente clientes não bloqueados</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {rows.length} vendedores · {totals.clientes.toLocaleString("pt-BR")} clientes ·{" "}
              {totals.ativos.toLocaleString("pt-BR")} ativos (180d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : error ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Não foi possível carregar o relatório.
                <div className="mt-3">
                  <Button variant="outline" size="sm" onClick={() => refetch()}>
                    Tentar novamente
                  </Button>
                </div>
              </div>
            ) : rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum vendedor encontrado com os filtros aplicados.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-right">Clientes</TableHead>
                      <TableHead className="text-right">Ativos (180d)</TableHead>
                      <TableHead className="text-right">Municípios</TableHead>
                      <TableHead className="text-right">UFs</TableHead>
                      <TableHead className="text-right">Supervisores</TableHead>
                      <TableHead>Supervisores (nomes)</TableHead>
                      <TableHead>Última compra</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={`${r.cod_vend ?? "s"}-${r.vendedor}`}>
                        <TableCell className="text-muted-foreground">{r.cod_vend ?? "-"}</TableCell>
                        <TableCell className="font-medium">{r.vendedor}</TableCell>
                        <TableCell className="text-right">
                          {Number(r.total_clientes).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(r.clientes_ativos).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right">{r.total_municipios}</TableCell>
                        <TableCell className="text-right">{r.total_ufs}</TableCell>
                        <TableCell className="text-right">{r.total_supervisores}</TableCell>
                        <TableCell className="max-w-[280px] truncate" title={r.supervisores ?? ""}>
                          {r.supervisores ?? "-"}
                        </TableCell>
                        <TableCell>
                          {r.ultima_compra
                            ? format(new Date(r.ultima_compra), "dd/MM/yyyy", { locale: ptBR })
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default RelatorioVendedores;
