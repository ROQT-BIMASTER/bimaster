import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  MapPin,
  RefreshCw,
  Search,
  Users,
  Building2,
  TrendingUp,
  Globe,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import {
  useIBGESync,
  useIBGEEstados,
  useIBGEMunicipios,
  useIBGEMicrorregioes,
  useIBGEStats,
  type IBGEFilters,
} from "@/hooks/useIBGEData";

const REGIOES = ["Norte", "Nordeste", "Sudeste", "Sul", "Centro-Oeste"];

const formatNumber = (n: number | null) => {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("pt-BR");
};

const formatCurrency = (n: number | null) => {
  if (n === null || n === undefined) return "—";
  // PIB em mil reais -> converter para R$
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)} bi`;
  if (n >= 1_000) return `R$ ${(n / 1_000).toFixed(1)} mi`;
  return `R$ ${n.toFixed(0)} mil`;
};

const formatPerCapita = (n: number | null) => {
  if (n === null || n === undefined) return "—";
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const PAGE_SIZE = 50;

const IBGEData = () => {
  const [filters, setFilters] = useState<IBGEFilters>({
    regiao: "",
    uf: "",
    microrregiao: "",
    search: "",
  });
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");

  const { syncing, syncMessage, startSync } = useIBGESync();
  const { data: stats } = useIBGEStats();
  const { data: estados } = useIBGEEstados();
  const { data: microrregioes } = useIBGEMicrorregioes(
    filters.uf ? parseInt(filters.uf) : undefined
  );
  const { data: municipiosResult, isLoading: loadingMunicipios } = useIBGEMunicipios(
    filters,
    page,
    PAGE_SIZE
  );

  const municipios = municipiosResult?.data || [];
  const totalCount = municipiosResult?.count || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleSearch = () => {
    setFilters((prev) => ({ ...prev, search: searchInput }));
    setPage(0);
  };

  const handleFilterChange = (key: keyof IBGEFilters, value: string) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      // Reset downstream filters
      if (key === "regiao") {
        next.uf = "";
        next.microrregiao = "";
      }
      if (key === "uf") {
        next.microrregiao = "";
      }
      return next;
    });
    setPage(0);
  };

  const filteredEstados = estados?.filter(
    (e) => !filters.regiao || e.regiao_nome === filters.regiao
  );

  const hasData = (stats?.totalEstados || 0) > 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <MapPin className="h-8 w-8 text-primary" />
              Dados IBGE
            </h1>
            <p className="text-muted-foreground mt-1">
              Dados geográficos e demográficos do Brasil para análise de mercado
            </p>
          </div>
          <Button
            onClick={startSync}
            disabled={syncing}
            className="gap-2"
            variant={hasData ? "outline" : "default"}
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {syncing ? "Sincronizando..." : hasData ? "Atualizar Dados" : "Sincronizar IBGE"}
          </Button>
        </div>

        {/* Sync Progress */}
        {syncing && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>{syncMessage}</span>
                </div>
                <Progress value={undefined} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  A sincronização pode levar até 60 segundos. Não feche esta página.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {!hasData && !syncing && (
          <Card className="border-dashed">
            <CardContent className="pt-6 text-center py-12">
              <Globe className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum dado carregado</h3>
              <p className="text-muted-foreground mb-4">
                Clique em "Sincronizar IBGE" para carregar os dados de estados, municípios, população e PIB.
              </p>
              <Button onClick={startSync} disabled={syncing} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Sincronizar Agora
              </Button>
            </CardContent>
          </Card>
        )}

        {hasData && (
          <>
            {/* Stats Cards */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-100 dark:bg-blue-900/50 rounded-xl">
                      <Globe className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats?.totalEstados}</p>
                      <p className="text-xs text-muted-foreground">Estados + DF</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-green-100 dark:bg-green-900/50 rounded-xl">
                      <Building2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {formatNumber(stats?.totalMunicipios || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">Municípios</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-100 dark:bg-amber-900/50 rounded-xl">
                      <Users className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {stats?.populacaoTotal
                          ? `${(stats.populacaoTotal / 1_000_000).toFixed(0)} mi`
                          : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">População Total</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-purple-100 dark:bg-purple-900/50 rounded-xl">
                      <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {stats?.pibTotal ? formatCurrency(stats.pibTotal) : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">PIB Total</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Regiões */}
            {stats?.regioes && stats.regioes.length > 0 && (
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                {stats.regioes.map((r) => (
                  <Card
                    key={r.nome}
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() =>
                      handleFilterChange("regiao", filters.regiao === r.nome ? "" : r.nome)
                    }
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <Badge
                          variant={filters.regiao === r.nome ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {r.nome}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{r.estados} UFs</span>
                      </div>
                      <p className="text-sm font-semibold">
                        {(r.populacao / 1_000_000).toFixed(1)} mi hab.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        PIB: {formatCurrency(r.pib)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Filters */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Filtros</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
                  <Select
                    value={filters.regiao}
                    onValueChange={(v) => handleFilterChange("regiao", v === "all" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Região" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as Regiões</SelectItem>
                      {REGIOES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={filters.uf}
                    onValueChange={(v) => handleFilterChange("uf", v === "all" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Estados</SelectItem>
                      {filteredEstados?.map((e) => (
                        <SelectItem key={e.id} value={e.id.toString()}>
                          {e.sigla} - {e.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={filters.microrregiao}
                    onValueChange={(v) =>
                      handleFilterChange("microrregiao", v === "all" ? "" : v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Microrregião" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as Microrregiões</SelectItem>
                      {microrregioes?.map((m) => (
                        <SelectItem key={m.id} value={m.id.toString()}>
                          {m.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex gap-2 lg:col-span-2">
                    <Input
                      placeholder="Buscar município..."
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      className="flex-1"
                    />
                    <Button variant="outline" size="icon" onClick={handleSearch}>
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Municipalities Table */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Municípios
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      ({formatNumber(totalCount)} resultados)
                    </span>
                  </CardTitle>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={page === 0}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span>
                      {page + 1} / {totalPages || 1}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Município</TableHead>
                        <TableHead className="w-16">UF</TableHead>
                        <TableHead>Região</TableHead>
                        <TableHead>Microrregião</TableHead>
                        <TableHead className="text-right">População</TableHead>
                        <TableHead className="text-right">PIB</TableHead>
                        <TableHead className="text-right">PIB per capita</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingMunicipios ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      ) : municipios.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            Nenhum município encontrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        municipios.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell className="font-medium">{m.nome}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">
                                {m.uf_sigla}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">{m.regiao_nome}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {m.microrregiao_nome}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatNumber(m.populacao_estimada)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatCurrency(m.pib_mil_reais)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatPerCapita(m.pib_per_capita)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default IBGEData;
