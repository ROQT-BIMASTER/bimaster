import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useFabricaOPDaOC } from "@/hooks/useFabricaOPDaOC";
import { useDesvincularOP } from "@/hooks/useGerarOPDaOC";
import { GerarOPDialog } from "./GerarOPDialog";
import { RegistrarApontamentoDialog } from "./RegistrarApontamentoDialog";
import { Plus, Factory, ExternalLink, Unlink, Loader2, ClipboardList } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useChinaI18n } from "@/hooks/useChinaI18n";
import { useConfirm } from "@/hooks/useConfirm";

const STATUS_COLOR: Record<string, string> = {
  pendente: "bg-slate-500",
  em_andamento: "bg-blue-500",
  pausada: "bg-amber-500",
  concluida: "bg-emerald-600",
  cancelada: "bg-red-500",
};
const STATUS_KEY: Record<string, string> = {
  pendente: "op.stPendente",
  em_andamento: "op.stEmAndamento",
  pausada: "op.stPausada",
  concluida: "op.stConcluida",
  cancelada: "op.stCancelada",
};

interface Props {
  ocId: string;
  ocNumero: string;
  produtoCodigo?: string;
  produtoNome?: string;
  qtySugerida?: number;
}

export function OPVinculadaCard({ ocId, ocNumero, produtoCodigo, produtoNome, qtySugerida }: Props) {
  const { t } = useChinaI18n();
  const confirm = useConfirm();
  const { data: ops = [], isLoading } = useFabricaOPDaOC(ocId);
  const [openDialog, setOpenDialog] = useState(false);
  const [apontarOp, setApontarOp] = useState<{ id: string; numero: string; saldo: number } | null>(null);
  const desvincular = useDesvincularOP();
  const navigate = useNavigate();

  return (
    <Card className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Factory className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">{t("op.ordensProducao")}</h3>
          {ops.length > 0 && <Badge variant="secondary">{ops.length}</Badge>}
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpenDialog(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> {t("op.gerarVincular")}
        </Button>
      </div>

      {isLoading && (
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" /> {t("op.carregando")}
        </div>
      )}

      {!isLoading && ops.length === 0 && (
        <div className="text-xs text-muted-foreground py-3 text-center border border-dashed border-border rounded-md">
          {t("op.nenhumaOP")}
        </div>
      )}

      {ops.map((op) => {
        const pct = op.quantidade_planejada
          ? Math.min(100, Math.round((Number(op.quantidade_produzida || 0) / Number(op.quantidade_planejada)) * 100))
          : 0;
        return (
          <div key={op.vinculo_id} className="border border-border rounded-md p-2.5 space-y-2 bg-muted/30">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-sm">{op.numero}</span>
                  <Badge className={`${STATUS_COLOR[op.status] || "bg-slate-500"} text-white`}>
                    {STATUS_KEY[op.status] ? t(STATUS_KEY[op.status]) : op.status}
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {op.produto_codigo && <><span className="font-mono">{op.produto_codigo}</span> · </>}
                  {op.produto_nome}
                </div>
              </div>
              <div className="flex gap-1">
                {!["concluida", "cancelada"].includes(op.status) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    title={t("op.apontarProducao")}
                    onClick={() =>
                      setApontarOp({
                        id: op.op_id,
                        numero: op.numero,
                        saldo: Math.max(0, Number(op.quantidade_planejada) - Number(op.quantidade_produzida || 0)),
                      })
                    }
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button size="sm" variant="ghost" title={t("op.abrirOP")} onClick={() => navigate(`/dashboard/fabrica/ordens-producao?op=${op.op_id}`)}>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  title={t("op.desvincular")}
                  onClick={async () => {
                    if ((await confirm({ title: t("op.desvincularConfirm", { numero: op.numero }), destructive: true }))) {
                      desvincular.mutate(op.vinculo_id);
                    }
                  }}
                >
                  <Unlink className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>{t("op.plan")}: {Number(op.quantidade_planejada).toLocaleString("pt-BR")}</span>
                <span>{t("op.prod")}: {Number(op.quantidade_produzida || 0).toLocaleString("pt-BR")} ({pct}%)</span>
              </div>
              <Progress value={pct} className="h-1.5 mt-1" />
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
              {op.lote && <div><span className="text-muted-foreground">{t("op.lote")}:</span> {op.lote}</div>}
              {op.data_prevista && (
                <div>
                  <span className="text-muted-foreground">{t("op.prevista")}:</span>{" "}
                  {format(new Date(op.data_prevista), "dd/MM/yyyy", { locale: ptBR })}
                </div>
              )}
              {op.eficiencia_percentual != null && (
                <div><span className="text-muted-foreground">{t("op.eficiencia")}:</span> {Number(op.eficiencia_percentual).toFixed(1)}%</div>
              )}
              <div><span className="text-muted-foreground">{t("op.alocado")}:</span> {Number(op.qty_alocada).toLocaleString("pt-BR")}</div>
            </div>

            {op.apontamentos.length > 0 && (
              <details className="text-[11px]">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  {t("op.ultimosApontamentos", { n: op.apontamentos.length })}
                </summary>
                <ul className="mt-1 space-y-0.5 pl-2">
                  {op.apontamentos.map((a) => (
                    <li key={a.id} className="font-mono">
                      {format(new Date(a.timestamp_evento), "dd/MM HH:mm", { locale: ptBR })}{" "}
                      +{Number(a.quantidade_apontada).toLocaleString("pt-BR")}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        );
      })}

      <GerarOPDialog
        open={openDialog}
        onOpenChange={setOpenDialog}
        ocId={ocId}
        ocNumero={ocNumero}
        produtoCodigo={produtoCodigo}
        produtoNome={produtoNome}
        qtySugerida={qtySugerida}
      />

      {apontarOp && (
        <RegistrarApontamentoDialog
          open={!!apontarOp}
          onOpenChange={(v) => { if (!v) setApontarOp(null); }}
          opId={apontarOp.id}
          opNumero={apontarOp.numero}
          saldoSugerido={apontarOp.saldo}
        />
      )}
    </Card>
  );
}
