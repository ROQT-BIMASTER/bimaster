import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChinaPageShell } from "@/components/china/ChinaPageShell";
import { ChinaPageHeader } from "@/components/china/ChinaPageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Globe, Package, Ship, AlertTriangle, Link2, Search, Clock, ShoppingCart, History,
} from "lucide-react";
import { useComprasPendencias, useComprasKpis } from "@/hooks/useComprasPendencias";
import { VincularBrasilDialog } from "@/components/compras/VincularBrasilDialog";
import { HistoricoRecebimentosInternacionalSheet } from "@/components/compras/HistoricoRecebimentosInternacionalSheet";

export default function ComprasInternacionais() {
  const navigate = useNavigate();
  const kpis = useComprasKpis();
  const [aba, setAba] = useState("pendencias");
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "atrasadas" | "abertas">("todos");
  const [vincOpen, setVincOpen] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [linhaSel, setLinhaSel] = useState<any>(null);

  const { data: pend = [], isLoading } = useComprasPendencias({
    origem: "china",
    apenas_pendentes: true,
    apenas_atrasadas: filtroStatus === "atrasadas",
  });

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return pend;
    return pend.filter(
      (p) =>
        p.numero.toLowerCase().includes(termo) ||
        p.descricao.toLowerCase().includes(termo) ||
        (p.produto_nome || "").toLowerCase().includes(termo),
    );
  }, [pend, busca]);

  const fmtNum = (n: number) =>
    new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n);

  return (
    <ChinaPageShell>
      <ChinaPageHeader
        icon={Globe}
        iconTone="primary"
        titlePt="Central de Compras Internacionais"
        titleCn="国际采购中心"
        subtitle="Brasil ↔ China · saldo, embarques e vínculos com produção"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          title="OCs com saldo aberto"
          value={fmtNum(kpis.ocsAbertas)}
          icon={ShoppingCart}
          variant="info"
          loading={kpis.isLoading}
        />
        <KpiCard
          title="Unidades pendentes"
          value={fmtNum(kpis.totalPendente)}
          subtitle={`China: ${fmtNum(kpis.chinaPendente)} · Brasil: ${fmtNum(kpis.brasilPendente)}`}
          icon={Package}
          variant="warning"
          loading={kpis.isLoading}
        />
        <KpiCard
          title="OCs atrasadas"
          value={fmtNum(kpis.atrasadas)}
          icon={Clock}
          variant={kpis.atrasadas > 0 ? "destructive" : "default"}
          loading={kpis.isLoading}
        />
        <KpiCard
          title="Embarques em trânsito"
          value="—"
          subtitle="Veja na aba Embarques"
          icon={Ship}
          variant="accent"
        />
      </div>

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList>
          <TabsTrigger value="pendencias">Pendências por SKU</TabsTrigger>
          <TabsTrigger value="oc">Por OC</TabsTrigger>
        </TabsList>

        <TabsContent value="pendencias" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar OC, SKU, produto..."
                className="pl-9"
              />
            </div>
            <Button
              size="sm"
              variant={filtroStatus === "todos" ? "default" : "outline"}
              onClick={() => setFiltroStatus("todos")}
            >
              Todas
            </Button>
            <Button
              size="sm"
              variant={filtroStatus === "atrasadas" ? "destructive" : "outline"}
              onClick={() => setFiltroStatus("atrasadas")}
            >
              <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Atrasadas
            </Button>
          </div>

          {isLoading ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">Carregando...</Card>
          ) : filtradas.length === 0 ? (
            <Card>
              <EmptyState
                icon={Package}
                title="Nenhuma pendência"
                description="Todas as OCs estão entregues ou sem saldo em aberto."
              />
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">OC</th>
                    <th className="px-3 py-2 font-medium">Produto / SKU</th>
                    <th className="px-3 py-2 font-medium text-right">Pedido</th>
                    <th className="px-3 py-2 font-medium text-right">Produzido</th>
                    <th className="px-3 py-2 font-medium text-right">Embarcado</th>
                    <th className="px-3 py-2 font-medium text-right">Recebido</th>
                    <th className="px-3 py-2 font-medium text-right">Pendente</th>
                    <th className="px-3 py-2 font-medium">ETA</th>
                    <th className="px-3 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((p) => {
                    const atrasada =
                      p.data_entrega_prevista &&
                      p.data_entrega_prevista < new Date().toISOString().slice(0, 10);
                    return (
                      <tr key={`${p.oc_id}-${p.item_id}`} className="border-t hover:bg-muted/30">
                        <td className="px-3 py-2">
                          <button
                            className="text-primary hover:underline font-medium"
                            onClick={() => navigate(`/dashboard/fabrica-china/ordens/${p.oc_id}`)}
                          >
                            {p.numero}
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <p className="font-medium truncate max-w-[200px]">
                            {p.produto_nome || "—"}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                            {p.descricao}
                          </p>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(p.qty_pedida)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {p.qty_produzida != null ? fmtNum(p.qty_produzida) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {p.qty_embarcada != null ? fmtNum(p.qty_embarcada) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(p.qty_recebida)}</td>
                        <td className="px-3 py-2 text-right">
                          <Badge variant="outline" className="font-mono">
                            {fmtNum(p.qty_pendente)}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          {p.data_entrega_prevista ? (
                            <span
                              className={
                                atrasada ? "text-destructive font-medium" : "text-muted-foreground"
                              }
                            >
                              {p.data_entrega_prevista}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setLinhaSel(p);
                              setVincOpen(true);
                            }}
                          >
                            <Link2 className="h-3.5 w-3.5 mr-1" /> Vincular Brasil
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="oc">
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Acesse cada OC pela aba "Pendências por SKU" para ver detalhes, embarques e vínculos.
          </Card>
        </TabsContent>
      </Tabs>

      {linhaSel && (
        <VincularBrasilDialog
          open={vincOpen}
          onOpenChange={setVincOpen}
          ocId={linhaSel.oc_id}
          numeroOC={linhaSel.numero}
          itemId={linhaSel.item_id}
          itemDescricao={linhaSel.descricao}
          qtyDisponivel={Number(linhaSel.qty_recebida) || Number(linhaSel.qty_pendente) || 0}
        />
      )}
    </ChinaPageShell>
  );
}
