import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { BilingualLabel } from "./BilingualLabel";
import { ChinaOrdemItem } from "@/hooks/useChinaOrdemItens";
import {
  DecisaoSaldo,
  useRegistrarDecisaoSaldo,
} from "@/hooks/useChinaSaldoDecisoes";
import { AlertTriangle, GitBranch, X, RefreshCw, PauseCircle } from "lucide-react";
import { useChinaI18n } from "@/hooks/useChinaI18n";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordemId: string;
  numeroOC: string;
  item: ChinaOrdemItem;
}

const OPCOES: Array<{
  value: DecisaoSaldo;
  labelKey: string;
  cn: string;
  descKey: string;
  icon: any;
}> = [
  { value: "manter_aberta", labelKey: "saldoDecisao.manterAberta", cn: "保持开放", descKey: "saldoDecisao.manterAbertaDesc", icon: PauseCircle },
  { value: "fechar_parcial", labelKey: "saldoDecisao.fecharParcial", cn: "部分关闭", descKey: "saldoDecisao.fecharParcialDesc", icon: X },
  { value: "cancelar_saldo", labelKey: "saldoDecisao.cancelarSaldo", cn: "取消余额", descKey: "saldoDecisao.cancelarSaldoDesc", icon: AlertTriangle },
  { value: "gerar_nova_oc", labelKey: "saldoDecisao.gerarNovaOC", cn: "创建新订单", descKey: "saldoDecisao.gerarNovaOCDesc", icon: GitBranch },
];

export function SaldoOCDecisionDialog({
  open,
  onOpenChange,
  ordemId,
  numeroOC,
  item,
}: Props) {
  const { t } = useChinaI18n();
  const [decisao, setDecisao] = useState<DecisaoSaldo>("manter_aberta");
  const [justificativa, setJustificativa] = useState("");
  const registrar = useRegistrarDecisaoSaldo();

  const efetiva = item.qty_pedida - item.qty_cancelada;
  const saldo = Math.max(0, efetiva - item.qty_recebida);

  const handleConfirmar = async () => {
    await registrar.mutateAsync({
      ordem_compra_id: ordemId,
      ordem_item_id: item.id,
      qty_remanescente: saldo,
      decisao,
      justificativa,
    });
    onOpenChange(false);
    setJustificativa("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-warning" />
            <BilingualLabel pt="Decisão sobre saldo" cn="余额决策" size="md" />
          </DialogTitle>
          <DialogDescription>
            OC <strong>{numeroOC}</strong> · {item.cor_nome || "Único"} ·{" "}
            <span className="text-warning font-semibold">{saldo} unidades em saldo</span>
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={decisao} onValueChange={(v) => setDecisao(v as DecisaoSaldo)} className="space-y-2">
          {OPCOES.map((opt) => (
            <Label
              key={opt.value}
              htmlFor={opt.value}
              className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                decisao === opt.value ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              }`}
            >
              <RadioGroupItem value={opt.value} id={opt.value} className="mt-1" />
              <opt.icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-sm">
                  {opt.pt} <span className="text-xs text-muted-foreground">{opt.cn}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
              </div>
            </Label>
          ))}
        </RadioGroup>

        <div className="space-y-2">
          <Label className="text-xs">Justificativa (recomendado)</Label>
          <Textarea
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            placeholder="Ex.: atraso da fábrica, falta de matéria-prima, mudança de pedido..."
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={registrar.isPending}>
            {registrar.isPending ? "Registrando..." : "Confirmar decisão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
