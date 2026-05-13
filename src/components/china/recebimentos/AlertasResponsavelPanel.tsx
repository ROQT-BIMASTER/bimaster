import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, ChevronDown, ChevronUp, ExternalLink, Check } from "lucide-react";
import { useRecebimentoAlertas, useMarcarAlertaLido, type RecebimentoAlerta } from "@/hooks/useRecebimentoAlertas";
import { useChinaI18n } from "@/hooks/useChinaI18n";

const SEV_COLOR: Record<string, string> = {
  baixa: "bg-slate-500",
  media: "bg-amber-500",
  alta: "bg-orange-600",
  critica: "bg-red-600",
};
const TIPO_KEY: Record<string, string> = {
  sla_estourado: "recebimento.tipoSlaEstourado",
  entrega_atrasada: "recebimento.tipoEntregaAtrasada",
};

interface Props {
  onSelectOC?: (ocId: string) => void;
}

export function AlertasResponsavelPanel({ onSelectOC }: Props) {
  const { t } = useChinaI18n();
  const { data: alertas = [] } = useRecebimentoAlertas();
  const marcarLido = useMarcarAlertaLido();
  const naoLidos = alertas.filter((a) => !a.lido_em).length;
  const [open, setOpen] = useState(naoLidos > 0);

  if (alertas.length === 0) return null;

  return (
    <Card className="mb-3 border-amber-500/40 bg-amber-500/5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-amber-600" />
          <span className="font-semibold text-sm">{t("recebimento.alertasTitulo")}</span>
          <Badge className="bg-amber-600">{alertas.length}</Badge>
          {naoLidos > 0 && <Badge className="bg-red-600">{t("recebimento.naoLidos", { n: naoLidos })}</Badge>}
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="border-t border-border max-h-64 overflow-auto divide-y divide-border">
          {alertas.map((a: RecebimentoAlerta) => (
            <div
              key={a.id}
              className={`p-2.5 flex items-start gap-2 hover:bg-muted/40 ${!a.lido_em ? "bg-amber-500/5" : ""}`}
            >
              <Badge className={`${SEV_COLOR[a.severidade]} text-white text-[10px] uppercase shrink-0`}>
                {a.severidade}
              </Badge>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium">{TIPO_KEY[a.tipo] ? t(TIPO_KEY[a.tipo]) : a.tipo}</div>
                <div className="text-xs text-muted-foreground">{a.mensagem}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(a.criado_em).toLocaleString("pt-BR")}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                {onSelectOC && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2"
                    onClick={() => {
                      onSelectOC(a.ordem_compra_id);
                      if (!a.lido_em) marcarLido.mutate(a.id);
                    }}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                )}
                {!a.lido_em && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2"
                    onClick={() => marcarLido.mutate(a.id)}
                    title="Marcar como lido"
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
