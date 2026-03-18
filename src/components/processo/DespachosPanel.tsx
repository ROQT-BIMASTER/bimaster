import { useState } from "react";
import { ChevronDown, ChevronRight, Send, CheckCircle2, XCircle, Clock, Undo2, FileText, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDespachosPorSubmissao, useTransicoesDespacho, type DespachoDocumento } from "@/hooks/useDespachoDocumentos";
import { ParecerDialog } from "./ParecerDialog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DespachosPanelProps {
  submissaoId: string;
  documentos: any[];
}

const STATUS_CONFIG: Record<string, { label: string; variant: "secondary" | "default" | "warning" | "success" | "destructive" | "outline"; icon: any }> = {
  pendente: { label: "Pendente", variant: "warning", icon: Clock },
  em_analise: { label: "Em Análise", variant: "default", icon: Send },
  aprovado: { label: "Aprovado", variant: "success", icon: CheckCircle2 },
  rejeitado: { label: "Rejeitado", variant: "destructive", icon: XCircle },
  devolvido_china: { label: "Devolvido China", variant: "outline", icon: Undo2 },
};

function DespachoTimeline({ despachoId }: { despachoId: string }) {
  const { data: transicoes = [] } = useTransicoesDespacho(despachoId);
  if (transicoes.length === 0) return null;

  return (
    <div className="mt-2 ml-4 space-y-1 border-l-2 border-muted pl-3">
      {transicoes.map((t) => (
        <div key={t.id} className="text-[10px] text-muted-foreground">
          <span className="font-medium text-foreground">{t.acao}</span>
          {t.usuario_nome && <span> por {t.usuario_nome}</span>}
          {t.observacao && <span> — {t.observacao}</span>}
          <span className="ml-1">{format(new Date(t.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
        </div>
      ))}
    </div>
  );
}

export function DespachosPanel({ submissaoId, documentos }: DespachosPanelProps) {
  const { data: despachos = [], isLoading } = useDespachosPorSubmissao(submissaoId);
  const [isOpen, setIsOpen] = useState(true);
  const [filterStatus, setFilterStatus] = useState("todos");
  const [parecerDespacho, setParecerDespacho] = useState<DespachoDocumento | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (despachos.length === 0 && !isLoading) return null;

  const filtered = filterStatus === "todos" ? despachos : despachos.filter((d) => d.status === filterStatus);

  const getDocName = (docId: string) => {
    const doc = documentos.find((d: any) => d.id === docId);
    return doc?.nome_arquivo || doc?.tipo_documento || "Documento";
  };

  return (
    <>
      <Card className="border-primary/20">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="py-3 px-4 cursor-pointer hover:bg-muted/30 transition-colors">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <Send className="h-4 w-4 text-primary" />
                  Despachos do Processo
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{despachos.length}</Badge>
                </span>
                <div className="flex items-center gap-1">
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                    const count = despachos.filter((d) => d.status === key).length;
                    if (!count) return null;
                    return (
                      <Badge key={key} variant={cfg.variant} className="text-[9px] h-4 px-1">
                        {count} {cfg.label}
                      </Badge>
                    );
                  })}
                </div>
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 px-4 pb-3 space-y-2">
              <div className="flex items-center gap-2">
                <Filter className="h-3 w-3 text-muted-foreground" />
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-7 text-xs w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                {filtered.map((desp) => {
                  const cfg = STATUS_CONFIG[desp.status] || STATUS_CONFIG.pendente;
                  const Icon = cfg.icon;
                  const isExpanded = expandedId === desp.id;

                  return (
                    <div key={desp.id}>
                      <div
                        className={cn(
                          "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] hover:bg-accent/50 transition-colors cursor-pointer group",
                          desp.devolvido_china && "bg-green-50/50 dark:bg-green-950/20"
                        )}
                        onClick={() => setExpandedId(isExpanded ? null : desp.id)}
                      >
                        <span className="text-muted-foreground font-mono shrink-0 w-12">
                          Ax {String(desp.numero_anexo).padStart(2, "0")}
                        </span>
                        <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="flex-1 min-w-0 truncate">{getDocName(desp.documento_id)}</span>
                        {desp.categoria_checklist && (
                          <Badge variant="outline" className="text-[8px] h-3.5 px-1 shrink-0">{desp.categoria_checklist}</Badge>
                        )}
                        <Badge variant={cfg.variant} className="text-[9px] h-4 px-1 shrink-0 gap-0.5">
                          <Icon className="h-2.5 w-2.5" />
                          {cfg.label}
                        </Badge>
                        {desp.status !== "devolvido_china" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1.5 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); setParecerDespacho(desp); }}
                          >
                            Parecer
                          </Button>
                        )}
                      </div>
                      {isExpanded && (
                        <div className="ml-14 mb-1">
                          {desp.parecer_texto && (
                            <p className="text-[10px] text-muted-foreground mt-1 italic">
                              💬 {desp.parecer_texto}
                              {desp.parecer_por_nome && <span className="ml-1">— {desp.parecer_por_nome}</span>}
                            </p>
                          )}
                          <DespachoTimeline despachoId={desp.id} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <ParecerDialog
        open={!!parecerDespacho}
        onOpenChange={(open) => { if (!open) setParecerDespacho(null); }}
        despacho={parecerDespacho}
        documentoNome={parecerDespacho ? getDocName(parecerDespacho.documento_id) : undefined}
        documentoData={parecerDespacho ? documentos.find((d: any) => d.id === parecerDespacho.documento_id) : undefined}
      />
    </>
  );
}
