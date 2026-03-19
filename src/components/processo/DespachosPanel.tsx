import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Send, CheckCircle2, XCircle, Clock, Undo2, FileText, Filter, User, Eye, AlertTriangle, FolderOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useDespachosPorSubmissao, useTransicoesDespacho, useDarCiencia, type DespachoDocumento } from "@/hooks/useDespachoDocumentos";
import { CATEGORIES_CHINA_ENVIA, CHINA_DOCUMENT_TYPES } from "@/lib/china-document-types";
import { ParecerDialog } from "./ParecerDialog";
import { CienciaTimer } from "./CienciaTimer";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DespachosPanelProps {
  submissaoId: string;
  documentos: any[];
}

const STATUS_CONFIG: Record<string, { label: string; variant: "secondary" | "default" | "warning" | "success" | "destructive" | "outline"; icon: any; percent: number }> = {
  pendente: { label: "Pendente", variant: "warning", icon: Clock, percent: 0 },
  em_analise: { label: "Em Análise", variant: "default", icon: Send, percent: 50 },
  aprovado: { label: "Aprovado", variant: "success", icon: CheckCircle2, percent: 100 },
  rejeitado: { label: "Rejeitado", variant: "destructive", icon: XCircle, percent: 100 },
  devolvido_china: { label: "Devolvido China", variant: "outline", icon: Undo2, percent: 100 },
};

const FASE_LABELS: Record<string, string> = {
  pendente: "Aguardando Ciência",
  em_analise: "Análise em Andamento",
  aprovado: "Concluído — Aprovado",
  rejeitado: "Concluído — Rejeitado",
  devolvido_china: "Devolvido à China",
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

function ChecklistPendentes({ documentos }: { documentos: any[] }) {
  const uploadedTipos = useMemo(() => {
    const set = new Set<string>();
    documentos.forEach((d: any) => set.add(d.tipo_documento));
    return set;
  }, [documentos]);

  const pendentes = useMemo(() => {
    const result: { categoria: string; itens: { tipo: string; label: string }[] }[] = [];

    for (const cat of CATEGORIES_CHINA_ENVIA) {
      const missing = cat.tipos
        .filter((tipo) => !uploadedTipos.has(tipo))
        .map((tipo) => {
          const dt = CHINA_DOCUMENT_TYPES.find((d) => d.tipo === tipo);
          return { tipo, label: dt?.labelPt || tipo };
        });

      if (missing.length > 0) {
        result.push({ categoria: cat.labelPt, itens: missing });
      }
    }
    return result;
  }, [uploadedTipos]);

  const totalTipos = CATEGORIES_CHINA_ENVIA.reduce((sum, c) => sum + c.tipos.length, 0);
  const totalEnviados = CATEGORIES_CHINA_ENVIA.reduce(
    (sum, c) => sum + c.tipos.filter((t) => uploadedTipos.has(t)).length, 0
  );
  const percent = totalTipos > 0 ? Math.round((totalEnviados / totalTipos) * 100) : 0;

  if (pendentes.length === 0) return null;

  return (
    <div className="border border-destructive/20 rounded-md p-3 bg-destructive/5 space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
        <span className="text-xs font-medium text-destructive">
          Itens Pendentes na China
        </span>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {totalEnviados}/{totalTipos} enviados
        </span>
        <Progress value={percent} className="w-16 h-1.5" />
        <span className="text-[10px] font-mono text-muted-foreground">{percent}%</span>
      </div>

      <div className="space-y-1.5">
        {pendentes.map((cat) => (
          <div key={cat.categoria}>
            <span className="text-[10px] font-medium text-muted-foreground">{cat.categoria}</span>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {cat.itens.map((item) => (
                <Badge key={item.tipo} variant="outline" className="text-[9px] h-4 px-1.5 border-destructive/30 text-destructive">
                  {item.label}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DespachosPanel({ submissaoId, documentos }: DespachosPanelProps) {
  const { data: despachos = [], isLoading } = useDespachosPorSubmissao(submissaoId);
  const darCiencia = useDarCiencia();
  const [isOpen, setIsOpen] = useState(true);
  const [filterStatus, setFilterStatus] = useState("todos");
  const [parecerDespacho, setParecerDespacho] = useState<DespachoDocumento | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (despachos.length === 0 && !isLoading) return null;

  const filtered = filterStatus === "todos" ? despachos : despachos.filter((d) => d.status === filterStatus);

  const totalPercent = despachos.length > 0
    ? Math.round(despachos.reduce((sum, d) => sum + (STATUS_CONFIG[d.status]?.percent ?? 0), 0) / despachos.length)
    : 0;

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
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-normal">{totalPercent}%</span>
                  <Progress value={totalPercent} className="w-16 h-1.5" />
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
            <CardContent className="pt-0 px-4 pb-3 space-y-3">
              {/* Checklist items missing from China */}
              <ChecklistPendentes documentos={documentos} />

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
                  const faseLabel = FASE_LABELS[desp.status] || desp.status;

                  return (
                    <div key={desp.id}>
                      <div
                        className={cn(
                          "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] hover:bg-accent/50 transition-colors cursor-pointer group",
                          desp.devolvido_china && "bg-accent/30"
                        )}
                        onClick={() => setExpandedId(isExpanded ? null : desp.id)}
                      >
                        <span className="text-muted-foreground font-mono shrink-0 w-12">
                          Ax {String(desp.numero_anexo).padStart(2, "0")}
                        </span>
                        <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="flex-1 min-w-0 truncate">{getDocName(desp.documento_id)}</span>
                        {desp.despachado_para_nome && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground shrink-0">
                            <User className="h-2.5 w-2.5" />
                            {desp.despachado_para_nome}
                          </span>
                        )}
                        {desp.modulo_destino && (
                          <Badge variant="outline" className="text-[8px] h-3.5 px-1 shrink-0">{desp.modulo_destino}</Badge>
                        )}
                        {(desp as any).vinculo_projeto_id && (
                          <span className="inline-flex items-center shrink-0" title="Vinculado ao projeto">
                            <FolderOpen className="h-3 w-3 text-primary" />
                          </span>
                        )}
                        {desp.categoria_checklist && (
                          <Badge variant="outline" className="text-[8px] h-3.5 px-1 shrink-0">{desp.categoria_checklist}</Badge>
                        )}
                        <Badge variant={cfg.variant} className="text-[9px] h-4 px-1 shrink-0 gap-0.5">
                          <Icon className="h-2.5 w-2.5" />
                          {cfg.label}
                        </Badge>
                        {desp.ciencia_em && <CienciaTimer cienciaEm={desp.ciencia_em} />}
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
                        <div className="ml-14 mb-2 space-y-2 bg-muted/20 rounded-md p-2">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-muted-foreground">{faseLabel}</span>
                            <Progress value={cfg.percent} className="flex-1 h-1.5 max-w-32" />
                            <span className="text-[10px] font-mono text-muted-foreground">{cfg.percent}%</span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                            {desp.despachado_para_nome && (
                              <span className="inline-flex items-center gap-1">
                                <User className="h-3 w-3" />
                                Despachado para: <span className="text-foreground font-medium">{desp.despachado_para_nome}</span>
                              </span>
                            )}
                            {desp.prazo_ciencia_horas && (
                              <span>Prazo: {desp.prazo_ciencia_horas}h</span>
                            )}
                            {desp.ciencia_por_nome && (
                              <span className="inline-flex items-center gap-1">
                                <Eye className="h-3 w-3" />
                                Ciência por: <span className="text-foreground font-medium">{desp.ciencia_por_nome}</span>
                                {desp.ciencia_em && (
                                  <span className="text-muted-foreground">
                                    em {format(new Date(desp.ciencia_em), "dd/MM HH:mm", { locale: ptBR })}
                                  </span>
                                )}
                              </span>
                            )}
                            {desp.ciencia_em && <CienciaTimer cienciaEm={desp.ciencia_em} />}
                          </div>

                          {!desp.ciencia_em && desp.status === "pendente" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-[10px] gap-1"
                              disabled={darCiencia.isPending}
                              onClick={(e) => {
                                e.stopPropagation();
                                darCiencia.mutate({ despacho_id: desp.id, submissao_id: submissaoId });
                              }}
                            >
                              <Eye className="h-3 w-3" />
                              Dar Ciência
                            </Button>
                          )}

                          {desp.parecer_texto && (
                            <p className="text-[10px] text-muted-foreground italic inline-flex items-start gap-1">
                              <FileText className="h-3 w-3 shrink-0 mt-0.5" />
                              {desp.parecer_texto}
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
