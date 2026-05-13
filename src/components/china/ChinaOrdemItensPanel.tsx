import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { BilingualLabel } from "./BilingualLabel";
import { ChinaOrdemItem, useChinaOrdemItens } from "@/hooks/useChinaOrdemItens";
import { Loader2, Scale, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { SaldoOCDecisionDialog } from "./SaldoOCDecisionDialog";
import { useChinaI18n } from "@/hooks/useChinaI18n";

const STATUS_CFG: Record<string, { labelKey: string; variant: any; bar: string }> = {
  aberto: { labelKey: "op.stAberto", variant: "secondary", bar: "border-l-muted-foreground/40" },
  parcial: { labelKey: "op.stParcial", variant: "warning", bar: "border-l-warning" },
  fechado: { labelKey: "op.stConcluido", variant: "success", bar: "border-l-success" },
  cancelado: { labelKey: "op.stCancelado", variant: "destructive", bar: "border-l-destructive" },
};

interface Props {
  ordemId: string;
  numeroOC: string;
  isBrasilUser?: boolean;
}

/**
 * Painel principal de itens da OC com controle de saldo.
 * Mostra qty pedida × produzida × embarcada × recebida × saldo por SKU/cor.
 */
export function ChinaOrdemItensPanel({ ordemId, numeroOC, isBrasilUser }: Props) {
  const { t } = useChinaI18n();
  const { data: itens = [], isLoading } = useChinaOrdemItens(ordemId);
  const [decisaoTarget, setDecisaoTarget] = useState<ChinaOrdemItem | null>(null);

  if (isLoading) {
    return (
      <Card className="p-8 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  if (itens.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        {t("op.nenhumItem")}
      </Card>
    );
  }

  const totalPedido = itens.reduce((s, i) => s + i.qty_pedida, 0);
  const totalRecebido = itens.reduce((s, i) => s + i.qty_recebida, 0);
  const totalEmbarcado = itens.reduce((s, i) => s + i.qty_embarcada, 0);
  const totalProduzido = itens.reduce((s, i) => s + i.qty_produzida, 0);
  const saldoTotal = itens.reduce(
    (s, i) => s + Math.max(0, i.qty_pedida - i.qty_cancelada - i.qty_recebida),
    0,
  );

  return (
    <>
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            <span className="font-semibold">{t("op.itensSaldo")}</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">
              {t("op.totalLabel")}: <strong className="text-foreground">{totalPedido.toLocaleString()}</strong>
            </span>
            <span className="text-muted-foreground">
              {t("op.saldoLabel")}: <strong className={saldoTotal > 0 ? "text-warning" : "text-success"}>
                {saldoTotal.toLocaleString()}
              </strong>
            </span>
          </div>
        </div>

        {/* Resumo agregado */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
          <div className="p-2 bg-muted/50 rounded-lg">
            <p className="text-muted-foreground">{t("op.pedido")}</p>
            <p className="text-base font-bold">{totalPedido.toLocaleString()}</p>
          </div>
          <div className="p-2 bg-primary/5 rounded-lg">
            <p className="text-muted-foreground">{t("op.produzido")}</p>
            <p className="text-base font-bold text-primary">{totalProduzido.toLocaleString()}</p>
          </div>
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <p className="text-muted-foreground">{t("op.embarcado")}</p>
            <p className="text-base font-bold text-blue-600">{totalEmbarcado.toLocaleString()}</p>
          </div>
          <div className="p-2 bg-success/10 rounded-lg">
            <p className="text-muted-foreground">{t("op.recebido")}</p>
            <p className="text-base font-bold text-success">{totalRecebido.toLocaleString()}</p>
          </div>
          <div className="p-2 bg-warning/10 rounded-lg">
            <p className="text-muted-foreground">{t("op.saldo")}</p>
            <p className="text-base font-bold text-warning">{saldoTotal.toLocaleString()}</p>
          </div>
        </div>

        {/* Linhas */}
        <div className="space-y-2">
          {itens.map((item) => {
            const cfg = STATUS_CFG[item.status] || STATUS_CFG.aberto;
            const efetiva = item.qty_pedida - item.qty_cancelada;
            const saldo = Math.max(0, efetiva - item.qty_recebida);
            const pctProd = item.qty_pedida > 0 ? (item.qty_produzida / item.qty_pedida) * 100 : 0;
            const pctRec = item.qty_pedida > 0 ? (item.qty_recebida / item.qty_pedida) * 100 : 0;
            const StatusIcon = saldo === 0 ? CheckCircle2 : AlertTriangle;

            return (
              <div
                key={item.id}
                className={`p-3 border rounded-lg border-l-[3px] ${cfg.bar} bg-card`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{item.cor_nome || item.sku || t("op.unico")}</p>
                      <Badge variant={cfg.variant} className="text-[10px]">
                        {t(cfg.labelKey)}
                      </Badge>
                      <StatusIcon
                        className={`h-3.5 w-3.5 ${saldo === 0 ? "text-success" : "text-warning"}`}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">{item.produto_codigo}</p>
                  </div>
                  {isBrasilUser && saldo > 0 && item.status !== "cancelado" && (
                    <Button size="sm" variant="outline" onClick={() => setDecisaoTarget(item)}>
                      {t("op.decidirSaldo")}
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-5 gap-2 text-[11px] mb-2">
                  <div>
                    <p className="text-muted-foreground">{t("op.pedido")}</p>
                    <p className="font-semibold">{item.qty_pedida}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t("op.produzido")}</p>
                    <p className="font-semibold text-primary">{item.qty_produzida}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t("op.embarcado")}</p>
                    <p className="font-semibold text-blue-600">{item.qty_embarcada}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t("op.recebido")}</p>
                    <p className="font-semibold text-success">{item.qty_recebida}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t("op.saldo")}</p>
                    <p className={`font-semibold ${saldo > 0 ? "text-warning" : "text-success"}`}>
                      {saldo}
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground w-16">{t("op.producao")}</span>
                    <Progress value={pctProd} className="h-1.5 flex-1" />
                    <span className="text-[10px] font-medium w-10 text-right">
                      {pctProd.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground w-16">{t("op.recebimento")}</span>
                    <Progress value={pctRec} className="h-1.5 flex-1 [&>div]:bg-success" />
                    <span className="text-[10px] font-medium w-10 text-right">
                      {pctRec.toFixed(0)}%
                    </span>
                  </div>
                </div>

                {item.qty_cancelada > 0 && (
                  <p className="text-[10px] text-destructive mt-2">
                    {t("op.unidadesCanceladas", { n: item.qty_cancelada })}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {decisaoTarget && (
        <SaldoOCDecisionDialog
          open={!!decisaoTarget}
          onOpenChange={(o) => !o && setDecisaoTarget(null)}
          ordemId={ordemId}
          numeroOC={numeroOC}
          item={decisaoTarget}
        />
      )}
    </>
  );
}
