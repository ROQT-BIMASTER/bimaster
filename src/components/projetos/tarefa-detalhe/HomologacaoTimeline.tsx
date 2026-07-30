/**
 * HomologacaoTimeline — comparação rápida entre a decisão atual e as
 * homologações anteriores do documento, com autor, motivo e diferença de
 * status entre as etapas.
 */
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, CircleDot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { docStatusTone } from "@/lib/china/docStatus";
import { DECISAO_LABEL } from "@/lib/china/homologacaoFilter";
import {
  construirLinhaDoTempo,
  intervaloLabel,
  type EtapaHomologacao,
} from "@/lib/china/homologacaoTimeline";
import type { DocAprovacaoAudit } from "@/hooks/useDecisaoDocumentoChina";

const rotulo = (d: string) => DECISAO_LABEL[d] || d;

function EtapaCard({ etapa }: { etapa: EtapaHomologacao }) {
  const intervalo = intervaloLabel(etapa.horasDesdeAnterior);
  return (
    <div className="relative pl-5">
      <span
        className={`absolute left-0 top-2 flex h-3 w-3 items-center justify-center rounded-full border ${
          etapa.atual ? "border-primary bg-primary/20" : "border-border bg-background"
        }`}
      >
        {etapa.atual && <CircleDot className="h-2.5 w-2.5 text-primary" />}
      </span>
      <div
        className={`rounded-md border p-2.5 ${
          etapa.atual ? "border-primary/50 bg-primary/5" : "border-border bg-card/40"
        }`}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="h-4 text-[10px]">
            {etapa.versao}
          </Badge>
          {etapa.atual && (
            <Badge className="h-4 bg-primary/15 text-[10px] text-primary">Decisão atual</Badge>
          )}
          {etapa.de && etapa.mudou && (
            <>
              <Badge className={`h-4 text-[10px] opacity-70 ${docStatusTone(etapa.de)}`}>
                {rotulo(etapa.de)}
              </Badge>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
            </>
          )}
          <Badge className={`h-4 text-[10px] ${docStatusTone(etapa.para)}`}>
            {rotulo(etapa.para)}
          </Badge>
          {!etapa.mudou && (
            <span className="text-[10px] text-muted-foreground">sem mudança de situação</span>
          )}
        </div>

        <p className="mt-1 text-[10.5px] text-muted-foreground">
          {etapa.autor} ·{" "}
          {format(new Date(etapa.createdAt), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })} ·
          confirmação por {etapa.metodo === "senha" ? "senha" : "sessão"}
          {etapa.origem ? ` · origem ${etapa.origem}` : ""}
          {intervalo ? ` · ${intervalo}` : ""}
        </p>

        <p className="mt-1 whitespace-pre-wrap text-[11px]">
          <span className="text-muted-foreground">Motivo: </span>
          {etapa.motivo || "não informado"}
        </p>
      </div>
    </div>
  );
}

export function HomologacaoTimeline({ trilha }: { trilha: DocAprovacaoAudit[] }) {
  const etapas = construirLinhaDoTempo(trilha);
  if (etapas.length === 0) return null;

  return (
    <div className="relative space-y-2 border-l border-border/60 pl-1.5">
      {etapas.map((e) => (
        <EtapaCard key={e.id} etapa={e} />
      ))}
    </div>
  );
}
