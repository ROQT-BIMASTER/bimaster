import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProdutoChinaRecebimentoKpi } from "@/hooks/useChinaProdutosRecebimentoKpis";
import type { OcRecebimentoKpi } from "@/hooks/useChinaRecebimentoKpis";
import { useChinaI18n } from "@/hooks/useChinaI18n";

function pct(num: number, den: number) {
  if (!den) return 0;
  return Math.min(100, Math.round((num / den) * 100));
}

interface Props {
  produto: ProdutoChinaRecebimentoKpi;
  ocs: OcRecebimentoKpi[];
  expanded: boolean;
  selectedOcId?: string | null;
  onToggle: () => void;
  onSelectOC: (id: string) => void;
}

export function ProdutoVinculadoChinaCard({
  produto,
  ocs,
  expanded,
  selectedOcId,
  onToggle,
  onSelectOC,
}: Props) {
  const { t } = useChinaI18n();
  const recPct = pct(produto.qty_recebida, produto.qty_pedida);
  const divergencia = produto.qty_avariada + produto.qty_faltante > 0;
  const semOC = produto.qtd_ocs === 0;

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full text-left p-3 hover:bg-muted/40 transition-colors",
          expanded && "bg-muted/30"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-xs truncate">
                <span className="font-mono font-semibold">{produto.produto_codigo}</span>
                <span className="text-muted-foreground"> — {produto.produto_nome}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                <Badge variant="outline" className="text-[10px] py-0 h-4">
                  {produto.qtd_ocs} {produto.qtd_ocs === 1 ? t("recebimento.ocSingular") : t("recebimento.ocPlural")}
                </Badge>
                {produto.qtd_ocs_ativas > 0 && (
                  <Badge variant="secondary" className="text-[10px] py-0 h-4">
                    {produto.qtd_ocs_ativas} {produto.qtd_ocs_ativas > 1 ? t("recebimento.ativaPlural") : t("recebimento.ativaSingular")}
                  </Badge>
                )}
                {divergencia && (
                  <Badge className="bg-amber-500 text-white text-[10px] py-0 h-4">
                    <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> {t("recebimento.divergencia")}
                  </Badge>
                )}
                {semOC && (
                  <Badge variant="outline" className="text-[10px] py-0 h-4 text-muted-foreground">
                    {t("recebimento.semOC")}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {!semOC && (
          <>
            <div className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
              <div>
                <div className="text-muted-foreground">{t("recebimento.pedido")}</div>
                <div className="font-medium">{produto.qty_pedida.toLocaleString("pt-BR")}</div>
              </div>
              <div>
                <div className="text-muted-foreground">{t("recebimento.embarcado")}</div>
                <div className="font-medium">{produto.qty_embarcada.toLocaleString("pt-BR")}</div>
              </div>
              <div>
                <div className="text-muted-foreground">{t("recebimento.recebido")}</div>
                <div className="font-medium">
                  {produto.qty_recebida.toLocaleString("pt-BR")} ({recPct}%)
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">{t("recebimento.saldo")}</div>
                <div className="font-semibold">{produto.qty_saldo.toLocaleString("pt-BR")}</div>
              </div>
            </div>
            <Progress value={recPct} className="h-1.5 mt-1.5" />
          </>
        )}
      </button>

      {expanded && ocs.length > 0 && (
        <div className="border-t border-border bg-background/50">
          {ocs.map((oc) => {
            const ocPct = pct(oc.qty_recebida, oc.qty_pedida);
            const isSel = selectedOcId === oc.ordem_compra_id;
            return (
              <button
                key={oc.ordem_compra_id}
                type="button"
                onClick={() => onSelectOC(oc.ordem_compra_id)}
                className={cn(
                  "w-full text-left px-3 py-2 border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors",
                  isSel && "bg-primary/10 hover:bg-primary/15"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono text-[11px] font-semibold">{oc.numero_oc}</div>
                  <Badge variant="outline" className="text-[10px] py-0 h-4">
                    {oc.oc_status}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>
                    Pedida {oc.qty_pedida.toLocaleString("pt-BR")} · Recebida{" "}
                    {oc.qty_recebida.toLocaleString("pt-BR")} ({ocPct}%)
                  </span>
                  <span>Saldo {oc.saldo_aberto.toLocaleString("pt-BR")}</span>
                </div>
                <Progress value={ocPct} className="h-1 mt-1" />
              </button>
            );
          })}
        </div>
      )}
      {expanded && ocs.length === 0 && (
        <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
          Nenhuma OC para os filtros atuais.
        </div>
      )}
    </Card>
  );
}
