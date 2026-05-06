import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Send, AlertCircle, CheckCircle2, Clock, AlertTriangle, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDespachosPorSubmissao } from "@/hooks/useDespachoDocumentos";
import { useDocumentosDaSubmissao } from "@/hooks/useChinaDocumentoVinculos";
import { DespacharDocPopover } from "./DespacharDocPopover";
import { DespacharLoteDialog } from "./DespacharLoteDialog";
import { CHINA_DOCUMENT_TYPES } from "@/lib/china-document-types";
import { format } from "date-fns";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";

function getDocLabel(tipo: string) {
  return CHINA_DOCUMENT_TYPES.find((d) => d.tipo === tipo)?.labelPt ?? tipo;
}

interface Props {
  submissaoId: string;
}

export function MesaDespachoTab({ submissaoId }: Props) {
  const { data: documentos = [] } = useDocumentosDaSubmissao(submissaoId);
  const { data: despachos = [] } = useDespachosPorSubmissao(submissaoId);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [loteOpen, setLoteOpen] = useState(false);

  const despachosByDoc = useMemo(() => {
    const map = new Map<string, any[]>();
    despachos.forEach((d: any) => {
      const arr = map.get(d.documento_id) ?? [];
      arr.push(d);
      map.set(d.documento_id, arr);
    });
    return map;
  }, [despachos]);

  const totalDocs = documentos.length;
  const naoDespachados = documentos.filter((d: any) => !despachosByDoc.has(d.id)).length;
  const despachados = totalDocs - naoDespachados;

  const toggleSel = (id: string) => {
    const next = new Set(selecionados);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelecionados(next);
  };

  return (
    <div className="space-y-3">
      {/* KPI header */}
      <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2">
        <div className="flex items-center gap-3 text-xs">
          <span className="font-semibold">{despachados} <span className="text-muted-foreground font-normal">de {totalDocs} despachados</span></span>
          {naoDespachados > 0 && (
            <Badge variant="outline" className="gap-1 border-warning/40 text-warning text-[10px]">
              <AlertCircle className="h-3 w-3" />
              {naoDespachados} pendente(s)
            </Badge>
          )}
          {naoDespachados === 0 && totalDocs > 0 && (
            <Badge className="gap-1 bg-success/10 text-success border border-success/30 text-[10px]">
              <CheckCircle2 className="h-3 w-3" />
              Tudo despachado
            </Badge>
          )}
        </div>
        {selecionados.size > 0 && (
          <Button size="sm" className="h-7 gap-1.5" onClick={() => setLoteOpen(true)}>
            <Layers className="h-3 w-3" />
            Despachar {selecionados.size} em lote
          </Button>
        )}
      </div>

      <ScrollArea className="h-[520px] pr-1">
        <div className="space-y-1">
          {documentos.map((doc: any) => {
            const docDespachos = despachosByDoc.get(doc.id) ?? [];
            const naoDesp = docDespachos.length === 0;
            const ativos = docDespachos.filter((d) => !d.concluido_em);
            const piorStatus = ativos.reduce<string>((acc, d) => {
              if (d.sla_status === "atrasado") return "atrasado";
              if (d.sla_status === "em_risco" && acc !== "atrasado") return "em_risco";
              return acc || d.sla_status || "no_prazo";
            }, "");

            return (
              <div
                key={doc.id}
                className={cn(
                  "flex items-start gap-2 rounded-md border bg-card px-2.5 py-2",
                  naoDesp && "border-l-2 border-l-warning",
                  piorStatus === "atrasado" && "border-l-2 border-l-destructive",
                  piorStatus === "em_risco" && "border-l-2 border-l-warning",
                )}
              >
                <Checkbox
                  checked={selecionados.has(doc.id)}
                  onCheckedChange={() => toggleSel(doc.id)}
                  className="mt-0.5"
                />
                <FileText className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{doc.nome_arquivo || getDocLabel(doc.tipo_documento)}</p>
                  <p className="text-[10px] text-muted-foreground">{getDocLabel(doc.tipo_documento)}</p>
                  {docDespachos.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {docDespachos.map((d: any) => {
                        const prazo = parseLocalDate(d.prazo_sla);
                        return (
                          <div key={d.id} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <Send className="h-2.5 w-2.5" />
                            <span className="truncate">{d.despachado_para_nome || d.modulo_destino || "destino"}</span>
                            {prazo && <span>· prazo {format(prazo, "dd/MM")}</span>}
                            {d.sla_status === "atrasado" && (
                              <Badge variant="destructive" className="h-3.5 px-1 text-[9px]">Atrasado</Badge>
                            )}
                            {d.sla_status === "em_risco" && (
                              <Badge className="h-3.5 px-1 text-[9px] bg-warning/15 text-warning border border-warning/30">Em risco</Badge>
                            )}
                            {d.concluido_em && (
                              <Badge className="h-3.5 px-1 text-[9px] bg-success/15 text-success border border-success/30">Concluído</Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {naoDesp ? (
                    <Badge variant="outline" className="text-[9px] gap-1 border-warning/40 text-warning">
                      <AlertCircle className="h-2.5 w-2.5" />Não despachado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[9px]">{docDespachos.length} envio(s)</Badge>
                  )}
                  <DespacharDocPopover
                    submissaoId={submissaoId}
                    documentoId={doc.id}
                    documentoNome={doc.nome_arquivo}
                    tipoDocumento={doc.tipo_documento}
                    trigger={
                      <Button size="sm" variant="ghost" className="h-7 gap-1 text-[11px]">
                        <Send className="h-3 w-3" />
                        Despachar
                      </Button>
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <DespacharLoteDialog
        open={loteOpen}
        onOpenChange={(o) => { setLoteOpen(o); if (!o) setSelecionados(new Set()); }}
        submissaoId={submissaoId}
        documentos={documentos.filter((d: any) => selecionados.has(d.id)).map((d: any) => ({
          id: d.id, nome: d.nome_arquivo, tipo: d.tipo_documento,
        }))}
      />
    </div>
  );
}
