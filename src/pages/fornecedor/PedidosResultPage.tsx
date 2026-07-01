import { useMemo, useState } from "react";
import { RefreshCw, Search, ShoppingCart, KanbanSquare, Table as TableIcon } from "lucide-react";
import { subDays } from "date-fns";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { useRubyspPedidos } from "@/hooks/fornecedor/useRubyspPedidos";
import { PedidosKanban } from "@/components/fornecedor/pedidos/PedidosKanban";
import { PedidosTable } from "@/components/fornecedor/pedidos/PedidosTable";
import { PedidoResultDetalheDrawer } from "@/components/fornecedor/pedidos/PedidoResultDetalheDrawer";
import { LeadTimeKpisCard } from "@/components/fornecedor/pedidos/LeadTimeKpisCard";
import { KANBAN_COLUNAS_RESULT } from "@/components/fornecedor/pedidos/etapaTheme";
import { FuturaBackButton } from "@/components/fornecedor/FuturaBackButton";
import { SyncStatusBarResult } from "@/components/fornecedor/pedidos/SyncStatusBarResult";
import type { PedidoRubyspExt } from "@/hooks/fornecedor/useRubyspPedidos";

export default function PedidosResultPage() {
  const [dateFrom, setDateFrom] = useState<Date | undefined>(() => subDays(new Date(), 30));
  const [dateTo, setDateTo] = useState<Date | undefined>(() => new Date());
  const [busca, setBusca] = useState("");
  const [limiarParado, setLimiarParado] = useState(2);
  const [pedidoSelecionado, setPedidoSelecionado] = useState<PedidoRubyspExt | null>(null);
  const [view, setView] = useState<"kanban" | "tabela">("kanban");

  const { data, isLoading, isFetching, refetch, error } = useRubyspPedidos({ dateFrom, dateTo });

  const pedidos = useMemo(() => {
    const arr = data ?? [];
    const q = busca.trim().toLowerCase();
    if (!q) return arr;
    return arr.filter(
      (p) =>
        p.cliente_nome?.toLowerCase().includes(q) ||
        p.nro_pedido?.toLowerCase().includes(q) ||
        String(p.futura_pedido_id).includes(q),
    );
  }, [data, busca]);

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
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
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
            description="Backfill em andamento ou nenhum pedido no intervalo selecionado — o painel popula automaticamente conforme a sincronização avança."
          />
        ) : (
          <PedidosKanban
            pedidos={pedidos}
            limiarParado={limiarParado}
            onPedidoClick={(p) => setPedidoSelecionado(p as PedidoRubyspExt)}
            colunas={KANBAN_COLUNAS_RESULT}
          />
        )}

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
