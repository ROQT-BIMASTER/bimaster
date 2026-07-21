import { useMemo, useState, useEffect } from "react";
import { RefreshCw, Search, ShoppingCart, KanbanSquare, Table as TableIcon, AlertTriangle, ArrowUpDown } from "lucide-react";
import { subDays } from "date-fns";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { useRubyspPedidos } from "@/hooks/fornecedor/useRubyspPedidos";
import { useDimEmpresas } from "@/hooks/useDimEmpresas";
import { PedidosKanban, type PedidosKanbanOrdem } from "@/components/fornecedor/pedidos/PedidosKanban";
import { PedidosTable } from "@/components/fornecedor/pedidos/PedidosTable";
import { PedidoResultDetalheDrawer } from "@/components/fornecedor/pedidos/PedidoResultDetalheDrawer";
import { LeadTimeKpisCard } from "@/components/fornecedor/pedidos/LeadTimeKpisCard";
import { KANBAN_COLUNAS_RESULT } from "@/components/fornecedor/pedidos/etapaTheme";
import { FuturaBackButton } from "@/components/fornecedor/FuturaBackButton";
import { SyncStatusBarResult } from "@/components/fornecedor/pedidos/SyncStatusBarResult";
import type { PedidoRubyspExt } from "@/hooks/fornecedor/useRubyspPedidos";

const ORDEM_KEY = "pedidos-result:ordem";
const FILIAL_KEY = "pedidos-result:filial";
const ETAPA_KEY = "pedidos-result:etapa";

export default function PedidosResultPage() {
  const [dateFrom, setDateFrom] = useState<Date | undefined>(() => subDays(new Date(), 30));
  const [dateTo, setDateTo] = useState<Date | undefined>(() => new Date());
  const [busca, setBusca] = useState("");
  const [limiarParado, setLimiarParado] = useState(2);
  const [pedidoSelecionado, setPedidoSelecionado] = useState<PedidoRubyspExt | null>(null);
  const [view, setView] = useState<"kanban" | "tabela">("kanban");
  const [filialId, setFilialId] = useState<string>(() => {
    try { return localStorage.getItem(FILIAL_KEY) ?? "all"; } catch { return "all"; }
  });
  const [ordem, setOrdem] = useState<PedidosKanbanOrdem>(() => {
    try {
      const v = localStorage.getItem(ORDEM_KEY);
      return v === "recente" || v === "valor" ? v : "parado";
    } catch { return "parado"; }
  });
  const [apenasParados, setApenasParados] = useState(false);
  const [etapaId, setEtapaId] = useState<string>(() => {
    try { return localStorage.getItem(ETAPA_KEY) ?? "all"; } catch { return "all"; }
  });

  useEffect(() => { try { localStorage.setItem(FILIAL_KEY, filialId); } catch { /* ignore */ } }, [filialId]);
  useEffect(() => { try { localStorage.setItem(ORDEM_KEY, ordem); } catch { /* ignore */ } }, [ordem]);
  useEffect(() => { try { localStorage.setItem(ETAPA_KEY, etapaId); } catch { /* ignore */ } }, [etapaId]);

  const { data, isLoading, isFetching, refetch, error } = useRubyspPedidos({ dateFrom, dateTo });
  const { data: filiais = [] } = useDimEmpresas();

  // Somente filiais realmente presentes nos dados atuais aparecem no dropdown,
  // mantendo o resto disponível apenas quando existir pedido.
  const filiaisAtivas = useMemo(() => {
    const ids = new Set<number>();
    for (const p of data ?? []) if (p.empresa_id != null) ids.add(p.empresa_id);
    return filiais.filter((f) => ids.has(f.id_empresa));
  }, [filiais, data]);

  const pedidos = useMemo(() => {
    let arr = data ?? [];
    if (filialId !== "all") {
      const idNum = Number(filialId);
      arr = arr.filter((p) => p.empresa_id === idNum);
    }
    if (etapaId !== "all") {
      const coluna = KANBAN_COLUNAS_RESULT.find((c) => c.id === etapaId);
      const etapasAceitas = new Set(coluna?.etapas ?? [etapaId]);
      arr = arr.filter((p) => etapasAceitas.has(p.etapa));
    }
    if (apenasParados) {
      arr = arr.filter((p) => p.em_andamento && (p.dias_na_etapa ?? 0) > limiarParado);
    }
    const q = busca.trim().toLowerCase();
    if (q) {
      arr = arr.filter(
        (p) =>
          p.cliente_nome?.toLowerCase().includes(q) ||
          p.nro_pedido?.toLowerCase().includes(q) ||
          String(p.futura_pedido_id).includes(q),
      );
    }
    return arr;
  }, [data, busca, filialId, etapaId, apenasParados, limiarParado]);

  const paradosCount = useMemo(
    () => (data ?? []).filter((p) => p.em_andamento && (p.dias_na_etapa ?? 0) > limiarParado).length,
    [data, limiarParado],
  );

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <FuturaBackButton />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-900/40">
              <ShoppingCart className="h-6 w-6 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Pedidos em andamento — Result</h1>
              <p className="text-sm text-muted-foreground">
                Painel de pedidos do fornecedor Result (Ruby_SP) — atualiza a cada 60s
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {paradosCount > 0 && (
              <Button
                variant={apenasParados ? "destructive" : "outline"}
                size="sm"
                onClick={() => setApenasParados((v) => !v)}
                className="gap-2"
                title={apenasParados ? "Mostrar todos" : "Filtrar apenas pedidos parados"}
              >
                <AlertTriangle className="h-4 w-4" />
                {paradosCount} parado{paradosCount === 1 ? "" : "s"}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>

        <SyncStatusBarResult />

        <Card>
          <CardContent className="p-4 flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Período (pedido)</Label>
              <DateRangeFilter
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateFromChange={setDateFrom}
                onDateToChange={setDateTo}
              />
            </div>
            <div className="flex flex-col gap-1 min-w-[220px]">
              <Label className="text-xs text-muted-foreground">Filial</Label>
              <Select value={filialId} onValueChange={setFilialId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todas as filiais" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as filiais</SelectItem>
                  {filiaisAtivas.map((f) => (
                    <SelectItem key={f.id_empresa} value={String(f.id_empresa)}>
                      {f.nome_empresa}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <Label className="text-xs text-muted-foreground">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Cliente ou nº do pedido"
                  className="pl-8 h-9"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Ordenação (kanban)</Label>
              <Select value={ordem} onValueChange={(v) => setOrdem(v as PedidosKanbanOrdem)}>
                <SelectTrigger className="h-9 w-[170px]">
                  <ArrowUpDown className="h-3.5 w-3.5 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="parado">Mais parado</SelectItem>
                  <SelectItem value="recente">Mais recente</SelectItem>
                  <SelectItem value="valor">Maior valor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Alerta parado (dias)</Label>
              <Input
                type="number"
                min={0}
                step={1}
                value={limiarParado}
                onChange={(e) => setLimiarParado(Math.max(0, Number(e.target.value) || 0))}
                className="h-9 w-28"
              />
            </div>
          </CardContent>
        </Card>

        <LeadTimeKpisCard />

        {(filialId !== "all" || apenasParados) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Filtros ativos:</span>
            {filialId !== "all" && (
              <Badge variant="secondary" className="gap-1">
                {filiaisAtivas.find((f) => String(f.id_empresa) === filialId)?.nome_empresa ?? `Filial ${filialId}`}
              </Badge>
            )}
            {apenasParados && (
              <Badge variant="destructive" className="gap-1">
                Apenas parados
              </Badge>
            )}
          </div>
        )}

        <Tabs value={view} onValueChange={(v) => setView(v as "kanban" | "tabela")}>
          <TabsList>
            <TabsTrigger value="kanban" className="gap-2">
              <KanbanSquare className="h-4 w-4" /> Kanban
            </TabsTrigger>
            <TabsTrigger value="tabela" className="gap-2">
              <TableIcon className="h-4 w-4" /> Tabela
            </TabsTrigger>
          </TabsList>

          <TabsContent value="kanban" className="mt-4">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-[400px] w-full" />
                ))}
              </div>
            ) : error ? (
              <EmptyState title="Erro ao carregar pedidos" description={(error as Error).message} />
            ) : pedidos.length === 0 ? (
              <EmptyState
                title="Nenhum pedido no período"
                description="Ajuste o período, a filial ou o filtro de parados. O painel popula automaticamente conforme a sincronização avança."
              />
            ) : (
              <PedidosKanban
                pedidos={pedidos}
                limiarParado={limiarParado}
                onPedidoClick={(p) => setPedidoSelecionado(p as PedidoRubyspExt)}
                colunas={KANBAN_COLUNAS_RESULT}
                ordem={ordem}
              />
            )}
          </TabsContent>

          <TabsContent value="tabela" className="mt-4">
            {isLoading ? (
              <Skeleton className="h-[400px] w-full" />
            ) : error ? (
              <EmptyState title="Erro ao carregar pedidos" description={(error as Error).message} />
            ) : (
              <PedidosTable
                pedidos={pedidos}
                limiarParado={limiarParado}
                onPedidoClick={(p) => setPedidoSelecionado(p as PedidoRubyspExt)}
              />
            )}
          </TabsContent>
        </Tabs>

        <PedidoResultDetalheDrawer
          pedido={pedidoSelecionado}
          open={pedidoSelecionado !== null}
          onOpenChange={(o) => { if (!o) setPedidoSelecionado(null); }}
          limiarParado={limiarParado}
        />
      </div>
    </DashboardLayout>
  );
}
