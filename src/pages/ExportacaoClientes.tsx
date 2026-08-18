import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, FileSpreadsheet, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { exportToExcel } from "@/utils/excelExport";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const REGIOES: Record<string, string[]> = {
  Norte: ["AC", "AM", "AP", "PA", "RO", "RR", "TO"],
  Nordeste: ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"],
  "Centro-Oeste": ["DF", "GO", "MS", "MT"],
  Sudeste: ["ES", "MG", "RJ", "SP"],
  Sul: ["PR", "RS", "SC"],
};

const UFS = Object.values(REGIOES).flat().sort();

const ALL = "__all__";
const PREVIEW_SIZE = 50;
const PAGE_SIZE = 1000;
const MAX_ROWS = 50000;

interface ClienteRow {
  codigo: string;
  nome: string;
  cnpj: string | null;
  cidade: string | null;
  uf: string | null;
  status_bloqueio: string | null;
  vendedor: string | null;
  cod_vend: number | null;
  supervisor: string | null;
  nome_equipe: string | null;
  data_ultima_compra: string | null;
  valor_ultima_compra: number | null;
}

const SELECT_COLS =
  "codigo, nome, cnpj, cidade, uf, status_bloqueio, vendedor, cod_vend, supervisor, nome_equipe, data_ultima_compra, valor_ultima_compra";

const ExportacaoClientes = () => {
  const [vendedor, setVendedor] = useState<string>(ALL);
  const [regiao, setRegiao] = useState<string>(ALL);
  const [uf, setUf] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [busca, setBusca] = useState("");
  const [exporting, setExporting] = useState(false);

  const ufsDisponiveis = useMemo(
    () => (regiao === ALL ? UFS : REGIOES[regiao] ?? UFS),
    [regiao],
  );

  const { data: vendedores } = useQuery({
    queryKey: ["exportacao-clientes-vendedores"],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.rpc(
        "fn_get_relatorio_vendedores" as never,
        { p_uf: null, p_search: null, p_somente_ativos: false } as never,
      );
      if (error) throw error;
      return ((data ?? []) as unknown as { vendedor: string }[])
        .map((r) => r.vendedor)
        .filter(Boolean);
    },
    staleTime: 5 * 60_000,
  });

  const applyFilters = (query: any) => {
    let q = query;
    if (vendedor !== ALL) q = q.eq("vendedor", vendedor);
    if (uf !== ALL) q = q.eq("uf", uf);
    else if (regiao !== ALL) q = q.in("uf", REGIOES[regiao]);
    if (status !== ALL) q = q.eq("status_bloqueio", status);
    if (busca.trim()) q = q.ilike("nome", `%${busca.trim()}%`);
    return q;
  };

  const filterKey = [vendedor, regiao, uf, status, busca];

  const { data: preview, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["exportacao-clientes-preview", ...filterKey],
    queryFn: async () => {
      const base = supabase
        .from("clientes")
        .select(SELECT_COLS, { count: "exact" })
        .order("nome", { ascending: true })
        .limit(PREVIEW_SIZE);
      const { data, error, count } = await applyFilters(base);
      if (error) throw error;
      return { rows: (data ?? []) as unknown as ClienteRow[], count: count ?? 0 };
    },
    staleTime: 30_000,
  });

  const fetchAll = async (): Promise<ClienteRow[]> => {
    const all: ClienteRow[] = [];
    for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
      const base = supabase
        .from("clientes")
        .select(SELECT_COLS)
        .order("nome", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      const { data, error } = await applyFilters(base);
      if (error) throw error;
      const batch = (data ?? []) as unknown as ClienteRow[];
      all.push(...batch);
      if (batch.length < PAGE_SIZE) break;
    }
    return all;
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = await fetchAll();
      if (!rows.length) {
        toast.error("Nenhum cliente encontrado com os filtros aplicados.");
        return;
      }
      await exportToExcel(
        rows.map((c) => ({
          codigo: c.codigo,
          nome: c.nome,
          cnpj: c.cnpj ?? "",
          cidade: c.cidade ?? "",
          uf: c.uf ?? "",
          status: c.status_bloqueio ?? "",
          cod_vend: c.cod_vend ?? "",
          vendedor: c.vendedor ?? "",
          supervisor: c.supervisor ?? "",
          equipe: c.nome_equipe ?? "",
          ultima_compra: c.data_ultima_compra
            ? format(new Date(c.data_ultima_compra), "dd/MM/yyyy", { locale: ptBR })
            : "",
          valor_ultima_compra: Number(c.valor_ultima_compra ?? 0),
        })),
        {
          filename: "clientes-por-vendedor",
          sheetName: "Clientes",
          includeTimestamp: true,
          columns: [
            { header: "Código", key: "codigo", width: 14 },
            { header: "Cliente", key: "nome", width: 40 },
            { header: "CNPJ", key: "cnpj", width: 20 },
            { header: "Cidade", key: "cidade", width: 24 },
            { header: "UF", key: "uf", width: 8 },
            { header: "Status", key: "status", width: 14 },
            { header: "Cód. vendedor", key: "cod_vend", width: 14 },
            { header: "Vendedor", key: "vendedor", width: 30 },
            { header: "Supervisor", key: "supervisor", width: 28 },
            { header: "Equipe", key: "equipe", width: 24 },
            { header: "Última compra", key: "ultima_compra", width: 16 },
            { header: "Valor última compra", key: "valor_ultima_compra", width: 20 },
          ],
        },
      );
      toast.success(`${rows.length.toLocaleString("pt-BR")} clientes exportados.`);
    } catch (e) {
      toast.error("Falha ao exportar os clientes.");
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
              <FileSpreadsheet className="h-6 w-6 text-primary" />
              Exportação de Clientes por Vendedor
            </h1>
            <p className="text-sm text-muted-foreground">
              Selecione vendedor, região, UF e status para gerar a planilha.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button onClick={handleExport} disabled={exporting}>
              <Download className="mr-2 h-4 w-4" />
              {exporting ? "Gerando..." : "Exportar Excel"}
            </Button>
          </div>
        </header>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filtros</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-5">
            <div className="space-y-1">
              <Label>Vendedor</Label>
              <Select value={vendedor} onValueChange={setVendedor}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={ALL}>Todos</SelectItem>
                  {(vendedores ?? []).map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Região</Label>
              <Select
                value={regiao}
                onValueChange={(v) => {
                  setRegiao(v);
                  setUf(ALL);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas</SelectItem>
                  {Object.keys(REGIOES).map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>UF</Label>
              <Select value={uf} onValueChange={setUf}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={ALL}>Todas</SelectItem>
                  {ufsDisponiveis.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="bloqueado">Bloqueado</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="busca-cliente">Cliente</Label>
              <Input
                id="busca-cliente"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {(preview?.count ?? 0).toLocaleString("pt-BR")} clientes no filtro · prévia dos{" "}
              {PREVIEW_SIZE} primeiros
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : error ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Não foi possível carregar os clientes.
                <div className="mt-3">
                  <Button variant="outline" size="sm" onClick={() => refetch()}>
                    Tentar novamente
                  </Button>
                </div>
              </div>
            ) : !preview?.rows.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum cliente encontrado com os filtros aplicados.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Cidade</TableHead>
                      <TableHead>UF</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead>Supervisor</TableHead>
                      <TableHead>Última compra</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.map((c) => (
                      <TableRow key={c.codigo}>
                        <TableCell className="text-muted-foreground">{c.codigo}</TableCell>
                        <TableCell className="font-medium">{c.nome}</TableCell>
                        <TableCell>{c.cidade ?? "-"}</TableCell>
                        <TableCell>{c.uf ?? "-"}</TableCell>
                        <TableCell className="capitalize">{c.status_bloqueio ?? "-"}</TableCell>
                        <TableCell>{c.vendedor ?? "-"}</TableCell>
                        <TableCell>{c.supervisor ?? "-"}</TableCell>
                        <TableCell>
                          {c.data_ultima_compra
                            ? format(new Date(c.data_ultima_compra), "dd/MM/yyyy", { locale: ptBR })
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

export default ExportacaoClientes;
