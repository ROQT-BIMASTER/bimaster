import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ExternalLink, PlayCircle, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useResolverNC } from "@/hooks/useChinaNaoConformidades";

const TIPO_COLOR: Record<string, string> = {
  faltante: "bg-orange-500",
  avariado: "bg-red-500",
  errado: "bg-purple-500",
  atraso: "bg-amber-500",
  qualidade: "bg-blue-500",
  outro: "bg-slate-500",
};
const SEV_COLOR: Record<string, string> = {
  baixa: "bg-slate-500",
  media: "bg-amber-500",
  alta: "bg-orange-600",
  critica: "bg-red-600",
};

interface Props {
  nc: any;
}

export function DivergenciaDetailPanel({ nc }: Props) {
  const navigate = useNavigate();
  const resolver = useResolverNC();
  const [resolucao, setResolucao] = useState(nc.resolucao || "");
  const [motivoCancel, setMotivoCancel] = useState("");

  const ativa = nc.status === "aberta" || nc.status === "em_tratativa";

  return (
    <div className="space-y-3">
      <Card className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-semibold text-sm">{nc.numero_nc}</span>
              <Badge className={`${TIPO_COLOR[nc.tipo]} text-white`}>{nc.tipo}</Badge>
              <Badge className={`${SEV_COLOR[nc.severidade]} text-white uppercase text-[10px]`}>{nc.severidade}</Badge>
              <Badge variant="outline">{nc.status}</Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              OC <span className="font-mono">{nc.oc?.numero_oc}</span> · {nc.oc?.produto_codigo}
            </div>
            <div className="text-xs mt-1">Qty envolvida: <strong>{Number(nc.qty_envolvida || 0).toLocaleString("pt-BR")}</strong></div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard/fabrica-china/ordens/${nc.ordem_compra_id}`)}>
            <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir OC
          </Button>
        </div>

        <div className="mt-3 text-sm whitespace-pre-wrap border-t border-border pt-2">
          {nc.descricao}
        </div>
      </Card>

      <Card className="p-3">
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <Clock className="h-4 w-4" /> Linha do tempo
        </h4>
        <div className="space-y-1 text-xs">
          <div><span className="text-muted-foreground w-32 inline-block">Aberta</span> {new Date(nc.created_at).toLocaleString("pt-BR")}</div>
          {nc.iniciada_em && <div><span className="text-muted-foreground w-32 inline-block">Em tratativa</span> {new Date(nc.iniciada_em).toLocaleString("pt-BR")}</div>}
          {nc.resolvida_em && <div><span className="text-muted-foreground w-32 inline-block">Resolvida</span> {new Date(nc.resolvida_em).toLocaleString("pt-BR")}</div>}
          {nc.cancelada_em && <div><span className="text-muted-foreground w-32 inline-block">Cancelada</span> {new Date(nc.cancelada_em).toLocaleString("pt-BR")}</div>}
          {nc.motivo_cancelamento && <div><span className="text-muted-foreground w-32 inline-block">Motivo</span> {nc.motivo_cancelamento}</div>}
        </div>
      </Card>

      {ativa && (
        <Card className="p-3 space-y-3">
          <h4 className="text-sm font-semibold">Ações de correção</h4>

          {nc.status === "aberta" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => resolver.mutate({ id: nc.id, status: "em_tratativa" })}
              disabled={resolver.isPending}
            >
              <PlayCircle className="h-3.5 w-3.5 mr-1" /> Iniciar tratativa
            </Button>
          )}

          <div>
            <Label>Resolução</Label>
            <Textarea
              value={resolucao}
              onChange={(e) => setResolucao(e.target.value.slice(0, 1500))}
              rows={3}
              placeholder="Descreva a correção aplicada (crédito, retrabalho, ressarcimento, etc.)"
            />
            <Button
              size="sm"
              className="mt-2"
              onClick={() => resolver.mutate({ id: nc.id, status: "resolvida", resolucao })}
              disabled={!resolucao.trim() || resolver.isPending}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Resolver
            </Button>
          </div>

          <div className="border-t border-border pt-3">
            <Label>Motivo do cancelamento</Label>
            <Textarea
              value={motivoCancel}
              onChange={(e) => setMotivoCancel(e.target.value.slice(0, 500))}
              rows={2}
              placeholder="Por que esta NC deve ser cancelada"
            />
            <Button
              size="sm"
              variant="outline"
              className="mt-2 text-red-600 border-red-300"
              onClick={() => resolver.mutate({ id: nc.id, status: "cancelada", motivo_cancelamento: motivoCancel })}
              disabled={!motivoCancel.trim() || resolver.isPending}
            >
              <XCircle className="h-3.5 w-3.5 mr-1" /> Cancelar NC
            </Button>
          </div>
        </Card>
      )}

      {nc.resolucao && (
        <Card className="p-3 bg-emerald-500/5">
          <h4 className="text-sm font-semibold mb-1">Resolução registrada</h4>
          <div className="text-xs whitespace-pre-wrap">{nc.resolucao}</div>
        </Card>
      )}
    </div>
  );
}
