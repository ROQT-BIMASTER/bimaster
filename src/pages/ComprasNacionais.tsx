import { useState, useMemo } from "react";
import { ChinaPageShell } from "@/components/china/ChinaPageShell";
import { ChinaPageHeader } from "@/components/china/ChinaPageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ShoppingBag, Package, Truck, Search, AlertTriangle, ChevronRight, History } from "lucide-react";
import { useComprasPendencias, useComprasKpis } from "@/hooks/useComprasPendencias";
import { RegistrarRecebimentoNacionalDialog } from "@/components/compras/RegistrarRecebimentoNacionalDialog";
import { HistoricoRecebimentosNacionalSheet } from "@/components/compras/HistoricoRecebimentosNacionalSheet";

export default function ComprasNacionais() {
  const kpis = useComprasKpis();
  const { data: pend = [], isLoading } = useComprasPendencias({
    origem: "brasil",
    apenas_pendentes: true,
  });
  const [busca, setBusca] = useState("");
  const [recebOpen, setRecebOpen] = useState(false);
  const [compraSel, setCompraSel] = useState<{ id: string; numero: string } | null>(null);

  // agrupar por compra
  const compras = useMemo(() => {
    const map = new Map<string, any>();
    pend.forEach((p) => {
      const k = p.oc_id;
      if (!map.has(k)) {
        map.set(k, {
          id: p.oc_id,
          numero: p.numero,
          status: p.status,
          data_entrega_prevista: p.data_entrega_prevista,
          itens: [] as any[],
          pendente_total: 0,
        });
      }
      const c = map.get(k);
      c.itens.push(p);
      c.pendente_total += Number(p.qty_pendente || 0);
    });
    let list = Array.from(map.values());
    const termo = busca.trim().toLowerCase();
    if (termo)
      list = list.filter(
        (c) =>
          c.numero.toLowerCase().includes(termo) ||
          c.itens.some((i: any) => (i.descricao || "").toLowerCase().includes(termo)),
      );
    return list;
  }, [pend, busca]);

  const fmtNum = (n: number) =>
    new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n);

  return (
    <ChinaPageShell>
      <ChinaPageHeader
        icon={ShoppingBag}
        iconTone="primary"
        titlePt="Compras Nacionais"
        titleCn="国内采购"
        subtitle="Compras locais com saldo por item e recebimentos parciais"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          title="Compras com saldo"
          value={fmtNum(compras.length)}
          icon={ShoppingBag}
          variant="info"
          loading={isLoading}
        />
        <KpiCard
          title="Unidades pendentes"
          value={fmtNum(kpis.brasilPendente)}
          icon={Package}
          variant="warning"
          loading={kpis.isLoading}
        />
        <KpiCard
          title="Atrasadas"
          value={fmtNum(
            compras.filter(
              (c) =>
                c.data_entrega_prevista &&
                c.data_entrega_prevista < new Date().toISOString().slice(0, 10),
            ).length,
          )}
          icon={AlertTriangle}
          variant="destructive"
        />
        <KpiCard
          title="Recebimentos no mês"
          value="—"
          subtitle="Em breve"
          icon={Truck}
          variant="accent"
        />
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar compra, NF ou item..."
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">Carregando...</Card>
      ) : compras.length === 0 ? (
        <Card>
          <EmptyState
            icon={ShoppingBag}
            title="Nenhuma compra com saldo"
            description="Cadastre compras com itens em Fábrica → Matérias-primas para começar a controlar."
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {compras.map((c) => {
            const atrasada =
              c.data_entrega_prevista &&
              c.data_entrega_prevista < new Date().toISOString().slice(0, 10);
            return (
              <Card key={c.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm">{c.numero}</h3>
                      <Badge variant="outline" className="capitalize">{c.status}</Badge>
                      {atrasada && (
                        <Badge variant="destructive">
                          <AlertTriangle className="h-3 w-3 mr-1" /> Atrasada
                        </Badge>
                      )}
                      {c.data_entrega_prevista && (
                        <span className="text-xs text-muted-foreground">
                          ETA {c.data_entrega_prevista}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-1.5">
                      {c.itens.slice(0, 4).map((i: any) => (
                        <div
                          key={i.item_id}
                          className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1"
                        >
                          <span className="truncate">{i.descricao}</span>
                          <span className="tabular-nums text-warning font-medium ml-2">
                            {fmtNum(i.qty_pendente)} pend.
                          </span>
                        </div>
                      ))}
                      {c.itens.length > 4 && (
                        <p className="text-[11px] text-muted-foreground">
                          + {c.itens.length - 4} itens
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant="outline" className="font-mono">
                      {fmtNum(c.pendente_total)} pend.
                    </Badge>
                    <Button
                      size="sm"
                      onClick={() => {
                        setCompraSel({ id: c.id, numero: c.numero });
                        setRecebOpen(true);
                      }}
                    >
                      <Truck className="h-3.5 w-3.5 mr-1" /> Receber
                      <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {compraSel && (
        <RegistrarRecebimentoNacionalDialog
          open={recebOpen}
          onOpenChange={setRecebOpen}
          compraId={compraSel.id}
          numero={compraSel.numero}
        />
      )}
    </ChinaPageShell>
  );
}
