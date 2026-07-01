import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  CheckCircle2, XCircle, Clock, FileText, Loader2, AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { cn } from "@/lib/utils";
import {
  useLoteEtapas, useLoteEventos, useLoteDocumentos, useAvancarEtapa,
  type LoteAprovacao,
} from "@/hooks/useLoteAprovacao";
import { AccessDeniedNotice } from "@/components/ui/access-denied-notice";
import { isPermissionError } from "@/lib/utils/permissionErrors";

interface Props {
  lote: LoteAprovacao;
}

export function LoteAprovacaoCard({ lote }: Props) {
  const { data: etapas = [] } = useLoteEtapas(lote.config_id);
  const { data: eventos = [], error: eventosError } = useLoteEventos(lote.id);
  const { data: docs = [] } = useLoteDocumentos(lote.id);
  const avancar = useAvancarEtapa();
  const semPermissao = isPermissionError(eventosError);

  const [comentario, setComentario] = useState("");

  const eventoAtual = eventos.find(
    (e) => e.etapa_ordem === lote.etapa_atual_ordem && e.decisao === "pendente",
  );

  const prazoVencido = (() => {
    if (!eventoAtual?.prazo_em) return false;
    const d = parseLocalDate(eventoAtual.prazo_em);
    return d ? d.getTime() < Date.now() : false;
  })();

  const isFinalizado = lote.status === "concluido" || lote.status === "cancelado";

  async function decidir(decisao: "aprovado" | "rejeitado") {
    await avancar.mutateAsync({
      instanciaId: lote.id,
      decisao,
      comentario: comentario.trim() || undefined,
    });
    setComentario("");
  }

  return (
    <Card className="p-3 space-y-3 bg-card/70 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold truncate">
              {lote.lote_nome || lote.titulo || "Lote sem nome"}
            </p>
            <Badge variant={isFinalizado ? "secondary" : "outline"} className="text-[10px] h-4">
              {lote.status}
            </Badge>
            {lote.rodada > 1 && (
              <Badge variant="destructive" className="text-[10px] h-4">R{lote.rodada}</Badge>
            )}
          </div>
          {lote.prazo_lote && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Prazo do lote: {format(parseLocalDate(lote.prazo_lote)!, "dd MMM yyyy", { locale: ptBR })}
            </p>
          )}
        </div>
      </div>

      {semPermissao && (
        <AccessDeniedNotice
          title="Sem permissão para ver o histórico de aprovação"
          description="Você não é responsável nem membro do projeto/tarefa vinculada a este lote. Solicite acesso ao gestor do projeto."
          compact
        />
      )}



      {/* Pipeline de etapas */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {etapas.map((et) => {
          const isAtual = et.ordem === lote.etapa_atual_ordem && !isFinalizado;
          const isPassada = et.ordem < lote.etapa_atual_ordem || (isFinalizado && lote.status === "concluido");
          return (
            <div key={et.id} className="flex items-center gap-1 shrink-0">
              <div
                className={cn(
                  "px-2 py-1 rounded text-[10px] font-medium border",
                  isAtual && "bg-primary text-primary-foreground border-primary",
                  isPassada && "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
                  !isAtual && !isPassada && "bg-muted/40 text-muted-foreground border-border",
                )}
              >
                {et.nome}
              </div>
              {et.ordem < etapas.length && <span className="text-muted-foreground text-[10px]">→</span>}
            </div>
          );
        })}
      </div>

      {/* Documentos */}
      {docs.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Documentos</p>
          <div className="space-y-1">
            {docs.map((d) => (
              <div key={d.id} className="flex items-center gap-2 text-xs px-2 py-1 rounded bg-muted/30">
                <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="truncate flex-1">{d.nome_arquivo || d.tipo_documento}</span>
                {d.tipo_documento && (
                  <span className="text-[10px] text-muted-foreground">{d.tipo_documento}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status atual / ações */}
      {eventoAtual && !isFinalizado && (
        <div className="space-y-2 border-t border-border/50 pt-2">
          <div className="flex items-center gap-2 text-xs">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">
              Aguardando aprovação · {eventoAtual.etapa_nome}
            </span>
            {prazoVencido && (
              <Badge variant="destructive" className="text-[10px] h-4 gap-1">
                <AlertTriangle className="h-2.5 w-2.5" /> Vencido
              </Badge>
            )}
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="w-full h-8">
                Decidir etapa
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 space-y-2">
              <Textarea
                placeholder="Comentário (opcional)"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                className="min-h-[60px] text-xs"
              />
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="default"
                  className="h-8"
                  disabled={avancar.isPending}
                  onClick={() => decidir("aprovado")}
                >
                  {avancar.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <><CheckCircle2 className="h-3 w-3 mr-1" /> Aprovar</>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-8"
                  disabled={avancar.isPending}
                  onClick={() => decidir("rejeitado")}
                >
                  <XCircle className="h-3 w-3 mr-1" /> Rejeitar
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Histórico resumido */}
      {eventos.length > 0 && (
        <details className="text-[10px] text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">
            Histórico ({eventos.length})
          </summary>
          <ul className="mt-1 space-y-0.5 pl-2">
            {eventos.slice().reverse().map((e) => (
              <li key={e.id} className="flex items-center gap-1">
                {e.decisao === "aprovado" && <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />}
                {e.decisao === "rejeitado" && <XCircle className="h-2.5 w-2.5 text-destructive" />}
                {e.decisao === "pendente" && <Clock className="h-2.5 w-2.5" />}
                <span>
                  {e.etapa_nome} · R{e.rodada} · {e.decisao}
                  {e.concluido_em && ` · ${format(new Date(e.concluido_em), "dd/MM HH:mm")}`}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}
