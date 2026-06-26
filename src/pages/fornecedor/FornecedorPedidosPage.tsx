import { useMemo, useState } from "react";
import { RefreshCw, Search, KanbanSquare, Table as TableIcon, ShoppingCart } from "lucide-react";
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
import { useFornecedorPedidos } from "@/hooks/fornecedor/useFornecedorPedidos";
import { PedidosKanban } from "@/components/fornecedor/pedidos/PedidosKanban";
import { PedidosTable } from "@/components/fornecedor/pedidos/PedidosTable";

export default function FornecedorPedidosPage() {
  const [dateFrom, setDateFrom] = useState<Date | undefined>(() => subDays(new Date(), 30));
  const [dateTo, setDateTo] = useState<Date | undefined>(() => new Date());
  const [busca, setBusca] = useState("");
  const [limiarParado, setLimiarParado] = useState(2);
  const [view, setView] = useState<"kanban" | "tabela">("kanban");

  const { data, isLoading, isFetching, refetch, error } = useFornecedorPedidos({ dateFrom, dateTo });

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
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-pink-100 dark:bg-pink-900/40">
              <ShoppingCart className="h-6 w-6 text-pink-600 dark:text-pink-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Pedidos em andamento</h1>
              <p className="text-sm text-muted-foreground">
                Painel de pedidos de venda do fornecedor (Futura) — sincronizado a cada 5 minutos
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        <Card>
          <CardContent className="p-4 flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Período (emissão)</Label>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-[400px] w-full" />
                ))}
              </div>
            ) : error ? (
              <EmptyState title="Erro ao carregar pedidos" description={(error as Error).message} />
            ) : pedidos.length === 0 ? (
              <EmptyState title="Nenhum pedido no período" description="Ajuste o período ou aguarde a próxima sincronização." />
            ) : (
              <PedidosKanban pedidos={pedidos} limiarParado={limiarParado} />
            )}
          </TabsContent>

          <TabsContent value="tabela" className="mt-4">
            {isLoading ? (
              <Skeleton className="h-[400px] w-full" />
            ) : error ? (
              <EmptyState title="Erro ao carregar pedidos" description={(error as Error).message} />
            ) : (
              <PedidosTable pedidos={pedidos} limiarParado={limiarParado} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
