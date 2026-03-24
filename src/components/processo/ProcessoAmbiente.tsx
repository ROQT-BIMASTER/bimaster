import React, { useState } from "react";
import { useProductProcess, type ProcessEvent } from "@/hooks/useProductProcess";
import { useDespachosPorProcesso, type DespachoDocumento } from "@/hooks/useDespachoDocumentos";
import { useProcessoAmbiente } from "@/hooks/useProcessoAmbiente";
import { useModuloCapabilities } from "@/hooks/useModulosDespacho";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2, XCircle, Eye, FileText, Send, MessageSquareWarning, Reply,
  Clock, User, ArrowRight, FileUp, AlertTriangle, Loader2, MessageCircle
} from "lucide-react";
import { ProcessoChat } from "./ProcessoChat";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ProcessoAmbienteProps {
  /** Tipo do produto: china | brasil | fabrica */
  produtoTipo: string;
  /** ID do produto referenciado */
  produtoRefId: string;
  /** Código do módulo que está renderizando este componente */
  moduloOrigem: string;
  /** Label do módulo para exibição */
  moduloLabel?: string;
  /** Modo compacto para sidebars */
  compact?: boolean;
}

type ActionType = "ciencia" | "aprovar" | "rejeitar" | "juntada" | "submeter" | "contestar" | "replicar" | null;

const ACTION_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  ciencia: { label: "Dar Ciência", icon: <Eye className="h-4 w-4" />, color: "text-blue-600" },
  aprovar: { label: "Aprovar", icon: <CheckCircle2 className="h-4 w-4" />, color: "text-green-600" },
  rejeitar: { label: "Rejeitar", icon: <XCircle className="h-4 w-4" />, color: "text-red-600" },
  juntada: { label: "Juntar Documento", icon: <FileUp className="h-4 w-4" />, color: "text-purple-600" },
  submeter: { label: "Submeter", icon: <Send className="h-4 w-4" />, color: "text-orange-600" },
  contestar: { label: "Contestar", icon: <MessageSquareWarning className="h-4 w-4" />, color: "text-amber-600" },
  replicar: { label: "Replicar", icon: <Reply className="h-4 w-4" />, color: "text-indigo-600" },
};

const EVENTO_ICONS: Record<string, React.ReactNode> = {
  ciencia: <Eye className="h-3.5 w-3.5 text-blue-500" />,
  aprovacao: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  rejeicao: <XCircle className="h-3.5 w-3.5 text-red-500" />,
  juntada: <FileUp className="h-3.5 w-3.5 text-purple-500" />,
  submissao: <Send className="h-3.5 w-3.5 text-orange-500" />,
  contestacao: <MessageSquareWarning className="h-3.5 w-3.5 text-amber-500" />,
  replica: <Reply className="h-3.5 w-3.5 text-indigo-500" />,
  despacho: <ArrowRight className="h-3.5 w-3.5 text-primary" />,
  etapa_change: <ArrowRight className="h-3.5 w-3.5 text-primary" />,
};

export function ProcessoAmbiente({ produtoTipo, produtoRefId, moduloOrigem, moduloLabel, compact }: ProcessoAmbienteProps) {
  const capabilities = useModuloCapabilities(moduloOrigem);
  const { process, processLoading, events } = useProductProcess(produtoTipo, produtoRefId);
  const { data: despachos = [] } = useDespachosPorProcesso(process?.id || null);
  const acoes = useProcessoAmbiente(process?.id || null);

  const [activeAction, setActiveAction] = useState<ActionType>(null);
  const [selectedDespacho, setSelectedDespacho] = useState<DespachoDocumento | null>(null);
  const [formText, setFormText] = useState("");
  const [formTitulo, setFormTitulo] = useState("");
  const [formTipoDoc, setFormTipoDoc] = useState("documento");
  const [formDestino, setFormDestino] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (processLoading) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando processo...
      </div>
    );
  }

  if (!capabilities.ambiente_habilitado) return null;

  if (!process) {
    return (
      <div className="border border-dashed rounded-lg p-4 text-center text-sm text-muted-foreground">
        <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
        Nenhum processo vinculado a este item.
      </div>
    );
  }

  // Despachos pendentes de ciência neste módulo
  const despachosPendentes = despachos.filter(
    d => d.status === "pendente" && !d.ciencia_em && d.modulo_destino === moduloOrigem
  );

  const handleExecute = async () => {
    if (!activeAction) return;
    setIsSubmitting(true);
    try {
      switch (activeAction) {
        case "ciencia":
          if (selectedDespacho) {
            await acoes.darCiencia.mutateAsync({ despacho_id: selectedDespacho.id, modulo_origem: moduloOrigem });
          }
          break;
        case "aprovar":
          await acoes.aprovar.mutateAsync({
            despacho_id: selectedDespacho?.id,
            item_descricao: formTitulo || "Item do processo",
            modulo_origem: moduloOrigem,
            observacao: formText || undefined,
          });
          break;
        case "rejeitar":
          await acoes.rejeitar.mutateAsync({
            despacho_id: selectedDespacho?.id,
            item_descricao: formTitulo || "Item do processo",
            modulo_origem: moduloOrigem,
            motivo: formText,
          });
          break;
        case "juntada":
          await acoes.juntarDocumento.mutateAsync({
            titulo: formTitulo,
            tipo_documento: formTipoDoc,
            modulo_origem: moduloOrigem,
            observacao: formText || undefined,
          });
          break;
        case "submeter":
          await acoes.submeter.mutateAsync({
            destino_modulo: formDestino,
            modulo_origem: moduloOrigem,
            descricao: formTitulo || "Submissão",
            observacao: formText || undefined,
          });
          break;
        case "contestar":
          await acoes.contestar.mutateAsync({
            despacho_id: selectedDespacho?.id,
            modulo_origem: moduloOrigem,
            motivo: formText,
          });
          break;
        case "replicar":
          await acoes.replicar.mutateAsync({
            despacho_id: selectedDespacho?.id,
            modulo_origem: moduloOrigem,
            resposta: formText,
          });
          break;
      }
      resetForm();
    } catch {
      // errors handled by hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setActiveAction(null);
    setSelectedDespacho(null);
    setFormText("");
    setFormTitulo("");
    setFormTipoDoc("documento");
    setFormDestino("");
  };

  // Filter events relevant to this module
  const moduleEvents = events.filter(e => e.modulo_origem === moduloOrigem || e.modulo_origem === "processo" || e.modulo_origem === "despacho");

  return (
    <div className="border rounded-lg bg-card">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Ambiente do Processo</span>
          <Badge variant="outline" className="text-[10px]">{process.numero_processo}</Badge>
          <Badge variant="secondary" className="text-[10px] capitalize">{process.etapa_atual.replace(/_/g, " ")}</Badge>
        </div>
        {despachosPendentes.length > 0 && (
          <Badge variant="destructive" className="text-[10px] animate-pulse">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {despachosPendentes.length} pendente(s) de ciência
          </Badge>
        )}
      </div>

      <Tabs defaultValue="acoes" className="w-full">
        <TabsList className="w-full justify-start rounded-none border-b h-9 px-3 bg-transparent">
          <TabsTrigger value="acoes" className="text-xs h-7">Ações</TabsTrigger>
          <TabsTrigger value="despachos" className="text-xs h-7">
            Despachos
            {despachosPendentes.length > 0 && (
              <span className="ml-1 bg-destructive text-destructive-foreground rounded-full px-1.5 text-[10px]">
                {despachosPendentes.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="chat" className="text-xs h-7">
            <MessageCircle className="h-3 w-3 mr-1" /> Chat
          </TabsTrigger>
          <TabsTrigger value="timeline" className="text-xs h-7">Timeline</TabsTrigger>
        </TabsList>

        {/* Ações */}
        <TabsContent value="acoes" className="p-3 pt-2 space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(Object.keys(ACTION_CONFIG) as ActionType[]).map(action => {
              if (!action) return null;
              // Filter by capabilities
              const capKey = `pode_${action}` as keyof typeof capabilities;
              if (capKey in capabilities && !capabilities[capKey]) return null;
              const cfg = ACTION_CONFIG[action];
              return (
                <Button
                  key={action}
                  variant="outline"
                  size="sm"
                  className={`flex flex-col h-auto py-2 gap-1 text-[11px] ${cfg.color} hover:bg-accent/50`}
                  onClick={() => {
                    setActiveAction(action);
                    if (action === "ciencia" && despachosPendentes.length === 1) {
                      setSelectedDespacho(despachosPendentes[0]);
                    }
                  }}
                >
                  {cfg.icon}
                  {cfg.label}
                </Button>
              );
            })}
          </div>
        </TabsContent>

        {/* Despachos */}
        <TabsContent value="despachos" className="p-0">
          <ScrollArea className={compact ? "h-[200px]" : "h-[280px]"}>
            {despachos.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Nenhum despacho neste processo</p>
            ) : (
              <div className="divide-y">
                {despachos.map(d => {
                  const pendenteCiencia = d.status === "pendente" && !d.ciencia_em && d.modulo_destino === moduloOrigem;
                  return (
                    <div key={d.id} className={`p-3 text-xs space-y-1 ${pendenteCiencia ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold">Anexo {String(d.numero_anexo).padStart(2, "0")}</span>
                          <Badge variant={d.status === "aprovado" ? "default" : d.status === "rejeitado" ? "destructive" : "secondary"} className="text-[10px]">
                            {d.status}
                          </Badge>
                        </div>
                        {pendenteCiencia && (
                          <Button size="sm" variant="outline" className="h-6 text-[10px]"
                            onClick={() => { setActiveAction("ciencia"); setSelectedDespacho(d); }}>
                            <Eye className="h-3 w-3 mr-1" /> Dar Ciência
                          </Button>
                        )}
                      </div>
                      {d.despachado_para_nome && (
                        <p className="text-muted-foreground flex items-center gap-1">
                          <User className="h-3 w-3" /> Para: <strong>{d.despachado_para_nome}</strong>
                        </p>
                      )}
                      {d.prazo_ciencia_horas && (
                        <p className="text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Prazo: {d.prazo_ciencia_horas}h
                          {d.ciencia_em && <span className="text-green-600 ml-1">✓ Ciência em {format(new Date(d.ciencia_em), "dd/MM HH:mm")}</span>}
                        </p>
                      )}
                      {d.parecer_texto && (
                        <p className="text-muted-foreground italic">Parecer: {d.parecer_texto}</p>
                      )}
                      {!pendenteCiencia && d.status === "pendente" && (
                        <div className="flex gap-1 pt-1">
                          <Button size="sm" variant="outline" className="h-6 text-[10px] text-green-600"
                            onClick={() => { setActiveAction("aprovar"); setSelectedDespacho(d); setFormTitulo(`Anexo ${d.numero_anexo}`); }}>
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Aprovar
                          </Button>
                          <Button size="sm" variant="outline" className="h-6 text-[10px] text-red-600"
                            onClick={() => { setActiveAction("rejeitar"); setSelectedDespacho(d); setFormTitulo(`Anexo ${d.numero_anexo}`); }}>
                            <XCircle className="h-3 w-3 mr-1" /> Rejeitar
                          </Button>
                          <Button size="sm" variant="outline" className="h-6 text-[10px] text-amber-600"
                            onClick={() => { setActiveAction("contestar"); setSelectedDespacho(d); }}>
                            <MessageSquareWarning className="h-3 w-3 mr-1" /> Contestar
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* Timeline */}
        <TabsContent value="timeline" className="p-0">
          <ScrollArea className={compact ? "h-[200px]" : "h-[280px]"}>
            {moduleEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Nenhum evento registrado</p>
            ) : (
              <div className="relative pl-6 py-2">
                <div className="absolute left-[15px] top-0 bottom-0 w-px bg-border" />
                {moduleEvents.slice(0, 50).map(ev => (
                  <div key={ev.id} className="relative mb-3 text-xs">
                    <div className="absolute -left-[17px] top-1 bg-card border rounded-full p-0.5">
                      {EVENTO_ICONS[ev.tipo_evento] || <FileText className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                    <div className="pl-2">
                      <p className="font-medium text-foreground">{ev.descricao || ev.tipo_evento}</p>
                      <p className="text-muted-foreground flex items-center gap-2">
                        <span>{ev.usuario_nome}</span>
                        <span>•</span>
                        <span>{format(new Date(ev.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</span>
                        <Badge variant="outline" className="text-[9px] h-4">{ev.modulo_origem}</Badge>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Action Dialog */}
      <Dialog open={!!activeAction} onOpenChange={open => { if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {activeAction && ACTION_CONFIG[activeAction]?.icon}
              {activeAction && ACTION_CONFIG[activeAction]?.label}
            </DialogTitle>
            <DialogDescription>
              Processo {process.numero_processo} — Módulo: {moduloLabel || moduloOrigem}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {activeAction === "ciencia" && selectedDespacho && (
              <p className="text-sm">
                Confirma ciência do <strong>Anexo {String(selectedDespacho.numero_anexo).padStart(2, "0")}</strong>?
              </p>
            )}

            {(activeAction === "aprovar" || activeAction === "rejeitar") && (
              <Input placeholder="Descrição do item" value={formTitulo} onChange={e => setFormTitulo(e.target.value)} />
            )}

            {activeAction === "juntada" && (
              <>
                <Input placeholder="Título do documento" value={formTitulo} onChange={e => setFormTitulo(e.target.value)} />
                <Select value={formTipoDoc} onValueChange={setFormTipoDoc}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="documento">Documento</SelectItem>
                    <SelectItem value="parecer">Parecer</SelectItem>
                    <SelectItem value="laudo">Laudo</SelectItem>
                    <SelectItem value="certificado">Certificado</SelectItem>
                    <SelectItem value="foto">Foto</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}

            {activeAction === "submeter" && (
              <>
                <Input placeholder="Descrição da submissão" value={formTitulo} onChange={e => setFormTitulo(e.target.value)} />
                <Input placeholder="Módulo destino (ex: regulatorio)" value={formDestino} onChange={e => setFormDestino(e.target.value)} />
              </>
            )}

            {activeAction !== "ciencia" && (
              <Textarea
                placeholder={
                  activeAction === "rejeitar" ? "Motivo da rejeição (obrigatório)" :
                  activeAction === "contestar" ? "Motivo da contestação (obrigatório)" :
                  activeAction === "replicar" ? "Resposta à contestação (obrigatório)" :
                  "Observação (opcional)"
                }
                value={formText}
                onChange={e => setFormText(e.target.value)}
                rows={3}
              />
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
            <Button
              onClick={handleExecute}
              disabled={
                isSubmitting ||
                (activeAction === "rejeitar" && !formText) ||
                (activeAction === "contestar" && !formText) ||
                (activeAction === "replicar" && !formText) ||
                (activeAction === "juntada" && !formTitulo) ||
                (activeAction === "submeter" && (!formTitulo || !formDestino))
              }
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
