import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, Plus, UserCircle, ChevronRight, CheckCircle2, Clock, XCircle, AlertTriangle, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { useProcessJuntadas, type ProcessJuntada } from "@/hooks/useProcessJuntadas";
import { useDocWorkflowConfigs, useDocWorkflowEtapas, useDocWorkflowInstance } from "@/hooks/useDocWorkflow";
import { DespachoDialog } from "./DespachoDialog";
import { useModulosDespachoResolved } from "@/hooks/useModulosDespacho";
import { useProcessTiposDocumento } from "@/hooks/useProcessTiposDocumento";

const PARECER_STYLES: Record<string, { icon: any; color: string; label: string }> = {
  pendente: { icon: Clock, color: "text-amber-500", label: "Pendente" },
  aprovado: { icon: CheckCircle2, color: "text-emerald-500", label: "Aprovado" },
  pendencia: { icon: AlertTriangle, color: "text-amber-600", label: "Pendência" },
  rejeitado: { icon: XCircle, color: "text-destructive", label: "Rejeitado" },
};

interface Props {
  processId: string;
}

export function JuntadasSection({ processId }: Props) {
  const { juntadas, isLoading, addJuntada, despacharJuntada } = useProcessJuntadas(processId);
  const { tipos: tiposDocumento, addTipo } = useProcessTiposDocumento();
  const modulosDisponiveis = useModulosDespachoResolved();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedJuntada, setSelectedJuntada] = useState<ProcessJuntada | null>(null);
  const [despachoJuntada, setDespachoJuntada] = useState<ProcessJuntada | null>(null);

  // Form state
  const [titulo, setTitulo] = useState("");
  const [folhas, setFolhas] = useState("");
  const [tipo, setTipo] = useState("embalagem");
  const [parecer, setParecer] = useState("");
  const [parecerStatus, setParecerStatus] = useState("pendente");

  // Novo tipo inline
  const [showNewTipo, setShowNewTipo] = useState(false);
  const [novoTipoLabel, setNovoTipoLabel] = useState("");
  const [novoTipoModulo, setNovoTipoModulo] = useState("");

  const handleSubmit = () => {
    if (!titulo.trim()) return;
    addJuntada.mutate({
      process_id: processId,
      documento_titulo: titulo.trim(),
      folhas: folhas.trim() || undefined,
      tipo_documento: tipo,
      parecer: parecer.trim() || undefined,
      parecer_status: parecerStatus,
    }, {
      onSuccess: () => {
        setShowAddDialog(false);
        setTitulo("");
        setFolhas("");
        setParecer("");
      },
    });
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Juntadas / Documentos Oficiais
              <Badge variant="secondary" className="text-[10px]">{juntadas.length}</Badge>
            </span>
            <Button size="sm" variant="outline" onClick={() => setShowAddDialog(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Juntar Documento
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando...
            </div>
          ) : juntadas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum documento juntado ao processo.
            </p>
          ) : (
            <div className="space-y-1.5">
              {juntadas.map(j => {
                const ps = PARECER_STYLES[j.parecer_status] || PARECER_STYLES.pendente;
                const Icon = ps.icon;
                const despachoMod = j.despacho_modulo
                  ? modulosDisponiveis.find(m => m.key === j.despacho_modulo)
                  : null;
                  : null;
                return (
                  <div
                    key={j.id}
                    className="w-full text-left px-3 py-2.5 rounded-lg border bg-background hover:bg-muted/50 transition-all flex items-center gap-3"
                  >
                    <button
                      onClick={() => setSelectedJuntada(j)}
                      className="flex-1 min-w-0 flex items-center gap-3"
                    >
                      <Icon className={cn("h-4 w-4 shrink-0", ps.color)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground truncate">
                            {j.documento_titulo}
                          </span>
                          {j.folhas && (
                            <Badge variant="outline" className="text-[9px] shrink-0">
                              fls. {j.folhas}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                          <UserCircle className="h-3 w-3" />
                          <span>{j.juntado_por_nome}</span>
                          <span>•</span>
                          <span>{format(new Date(j.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[9px] shrink-0">
                        {tiposDocumento.find(t => t.valor === j.tipo_documento)?.label || j.tipo_documento}
                      </Badge>
                    </button>
                    {despachoMod ? (
                      <Badge variant="secondary" className="text-[9px] shrink-0 gap-1">
                        <Send className="h-2.5 w-2.5" />
                        <despachoMod.icon className={`h-2.5 w-2.5 ${despachoMod.color}`} /> {despachoMod.label}
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="shrink-0 h-7 px-2 text-xs gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDespachoJuntada(j);
                        }}
                      >
                        <Send className="h-3 w-3" /> Despachar
                      </Button>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 cursor-pointer" onClick={() => setSelectedJuntada(j)} />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Juntada Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Juntar Documento ao Processo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título do Documento</Label>
              <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Embalagens produto X" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Folhas</Label>
                <Input value={folhas} onChange={e => setFolhas(e.target.value)} placeholder="Ex: 35-36" />
              </div>
              <div>
                <Label className="flex items-center justify-between">
                  Tipo de Documento
                  <Button type="button" variant="ghost" size="sm" className="h-5 px-1 text-[10px] text-primary" onClick={() => setShowNewTipo(true)}>
                    <Plus className="h-3 w-3 mr-0.5" /> Novo Tipo
                  </Button>
                </Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {tiposDocumento.map(t => (
                      <SelectItem key={t.valor} value={t.valor}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Parecer</Label>
              <Textarea
                value={parecer}
                onChange={e => setParecer(e.target.value)}
                placeholder="Ex: Junto às fls. 35 e 36 de embalagens como Documentos Oficiais..."
                rows={3}
              />
            </div>
            <div>
              <Label>Status do Parecer</Label>
              <Select value={parecerStatus} onValueChange={setParecerStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="aprovado">Aprovado</SelectItem>
                  <SelectItem value="pendencia">Pendência</SelectItem>
                  <SelectItem value="rejeitado">Rejeitado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={addJuntada.isPending || !titulo.trim()}>
              Juntar ao Processo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Juntada Detail Drawer */}
      <Drawer open={!!selectedJuntada} onOpenChange={open => !open && setSelectedJuntada(null)}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {selectedJuntada?.documento_titulo}
            </DrawerTitle>
          </DrawerHeader>
          {selectedJuntada && (
            <JuntadaDetail
              juntada={selectedJuntada}
              onDespachar={() => {
                setSelectedJuntada(null);
                setDespachoJuntada(selectedJuntada);
              }}
            />
          )}
        </DrawerContent>
      </Drawer>

      {/* Despacho Dialog */}
      <DespachoDialog
        open={!!despachoJuntada}
        onOpenChange={(open) => !open && setDespachoJuntada(null)}
        documentoTitulo={despachoJuntada?.documento_titulo || ""}
        isPending={despacharJuntada.isPending}
        onDespachar={async (modulo, descricao) => {
          if (!despachoJuntada) return;
          await despacharJuntada.mutateAsync({
            juntada_id: despachoJuntada.id,
            despacho_modulo: modulo,
            despacho_descricao: descricao || undefined,
          });
          setDespachoJuntada(null);
        }}
      />

      {/* Novo Tipo de Documento Dialog */}
      <Dialog open={showNewTipo} onOpenChange={setShowNewTipo}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              Novo Tipo de Documento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome do Tipo</Label>
              <Input value={novoTipoLabel} onChange={e => setNovoTipoLabel(e.target.value)} placeholder="Ex: Certificado de Origem" />
            </div>
            <div>
              <Label>Módulo (opcional)</Label>
              <Select value={novoTipoModulo} onValueChange={setNovoTipoModulo}>
                <SelectTrigger><SelectValue placeholder="Todos os módulos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os módulos</SelectItem>
                  {modulosDisponiveis.map(m => {
                    const MIcon = m.icon;
                    return <SelectItem key={m.key} value={m.key}><span className="flex items-center gap-1.5"><MIcon className={`h-3.5 w-3.5 ${m.color}`} /> {m.label}</span></SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTipo(false)}>Cancelar</Button>
            <Button
              disabled={!novoTipoLabel.trim() || addTipo.isPending}
              onClick={() => {
                addTipo.mutate({
                  label: novoTipoLabel.trim(),
                  modulo: novoTipoModulo && novoTipoModulo !== "todos" ? novoTipoModulo : undefined,
                }, {
                  onSuccess: () => {
                    setShowNewTipo(false);
                    setNovoTipoLabel("");
                    setNovoTipoModulo("");
                  },
                });
              }}
            >
              Criar Tipo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function JuntadaDetail({ juntada, onDespachar }: { juntada: ProcessJuntada; onDespachar?: () => void }) {
  const { configs } = useDocWorkflowConfigs();
  const { instancia, transicoes, iniciarWorkflow, registrarTransicao } = useDocWorkflowInstance(juntada.id);
  const [showIniciarWf, setShowIniciarWf] = useState(false);
  const [selectedConfigId, setSelectedConfigId] = useState("");
  const [obsAcao, setObsAcao] = useState("");

  // Get etapas for instancia's config
  const { etapas } = useDocWorkflowEtapas(instancia?.config_id || null);

  const matchingConfigs = configs.filter(c => c.tipo_documento === juntada.tipo_documento && c.ativo);

  const ps = PARECER_STYLES[juntada.parecer_status] || PARECER_STYLES.pendente;
  const ParecerIcon = ps.icon;

  const handleIniciarWorkflow = () => {
    if (!selectedConfigId) return;
    iniciarWorkflow.mutate({ juntada_id: juntada.id, config_id: selectedConfigId }, {
      onSuccess: () => setShowIniciarWf(false),
    });
  };

  const handleAcao = (acao: string) => {
    if (!instancia) return;
    const etapaAtual = etapas[instancia.etapa_atual];
    const isLast = instancia.etapa_atual >= etapas.length - 1;

    registrarTransicao.mutate({
      instancia_id: instancia.id,
      etapa_nome: etapaAtual?.nome || `Etapa ${instancia.etapa_atual}`,
      acao,
      observacao: obsAcao || undefined,
      nova_etapa: acao === "aprovar" && !isLast ? instancia.etapa_atual + 1 : undefined,
      novo_status: acao === "rejeitar" ? "rejeitado" : (acao === "aprovar" && isLast ? "concluido" : undefined),
    });
    setObsAcao("");
  };

  return (
    <div className="px-4 pb-6 space-y-4 overflow-y-auto">
      {/* Metadata */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-muted/50 rounded-lg p-3">
          <span className="text-[11px] text-muted-foreground block">Folhas</span>
          <span className="font-medium">{juntada.folhas || "—"}</span>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <span className="text-[11px] text-muted-foreground block">Parecer</span>
          <span className={cn("font-medium flex items-center gap-1", ps.color)}>
            <ParecerIcon className="h-3.5 w-3.5" /> {ps.label}
          </span>
        </div>
      </div>

      {/* Despacho info or button */}
      {juntada.despacho_modulo ? (
        <div className="bg-muted/30 rounded-lg p-3 text-sm border-l-2 border-primary/30">
          <span className="text-[11px] text-muted-foreground block mb-1">Despachado para</span>
          <span className="font-medium flex items-center gap-1.5">
            {(() => { const mod = DESPACHO_MODULOS_PROCESSO.find(m => m.key === juntada.despacho_modulo); if (!mod) return juntada.despacho_modulo; const MIcon = mod.icon; return <><MIcon className={`h-4 w-4 ${mod.color}`} /> {mod.label}</>; })()}
          </span>
          {juntada.despacho_descricao && (
            <p className="text-xs text-muted-foreground mt-1 italic">"{juntada.despacho_descricao}"</p>
          )}
        </div>
      ) : onDespachar ? (
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onDespachar}>
          <Send className="h-3.5 w-3.5" /> Despachar para Módulo
        </Button>
      ) : null}

      {juntada.parecer && (
        <div className="bg-muted/30 rounded-lg p-3 text-sm text-foreground italic border-l-2 border-primary/30">
          "{juntada.parecer}"
        </div>
      )}

      {/* Workflow Section */}
      <div className="border-t pt-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          Subprocesso Documental
          {instancia && (
            <Badge variant={instancia.status === "concluido" ? "default" : instancia.status === "rejeitado" ? "destructive" : "secondary"} className="text-[10px]">
              {instancia.status === "em_andamento" ? "Em Andamento" : instancia.status === "concluido" ? "Concluído" : "Rejeitado"}
            </Badge>
          )}
        </h3>

        {!instancia ? (
          <div className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">Nenhum subprocesso vinculado.</p>
            {matchingConfigs.length > 0 ? (
              showIniciarWf ? (
                <div className="space-y-2">
                  <Select value={selectedConfigId} onValueChange={setSelectedConfigId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o workflow..." /></SelectTrigger>
                    <SelectContent>
                      {matchingConfigs.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2 justify-center">
                    <Button size="sm" variant="outline" onClick={() => setShowIniciarWf(false)}>Cancelar</Button>
                    <Button size="sm" onClick={handleIniciarWorkflow} disabled={!selectedConfigId}>Iniciar</Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setShowIniciarWf(true)}>
                  Iniciar Subprocesso
                </Button>
              )
            ) : (
              <p className="text-xs text-muted-foreground">
                Nenhum workflow configurado para "{juntada.tipo_documento}".
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Mini-timeline of etapas */}
            <div className="flex items-center gap-1 flex-wrap">
              {etapas.map((et, i) => {
                const isCurrent = i === instancia.etapa_atual && instancia.status === "em_andamento";
                const isPast = i < instancia.etapa_atual || instancia.status === "concluido";
                const isRejected = instancia.status === "rejeitado" && i === instancia.etapa_atual;
                return (
                  <div key={et.id} className="flex items-center gap-1">
                    {i > 0 && <div className={cn("w-4 h-0.5", isPast ? "bg-emerald-400" : "bg-border")} />}
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[9px] px-1.5 py-0 h-5",
                        isCurrent && "bg-blue-500/10 text-blue-600 border-blue-300 font-bold",
                        isPast && "bg-emerald-500/10 text-emerald-600 border-emerald-200",
                        isRejected && "bg-destructive/10 text-destructive border-destructive/30",
                        !isCurrent && !isPast && !isRejected && "text-muted-foreground"
                      )}
                    >
                      {isPast && <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />}
                      {isRejected && <XCircle className="h-2.5 w-2.5 mr-0.5" />}
                      {et.nome}
                    </Badge>
                  </div>
                );
              })}
            </div>

            {/* Action buttons if in progress */}
            {instancia.status === "em_andamento" && (
              <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Etapa atual: <strong>{etapas[instancia.etapa_atual]?.nome}</strong>
                </p>
                <Input
                  value={obsAcao}
                  onChange={e => setObsAcao(e.target.value)}
                  placeholder="Observação (opcional)"
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="default" onClick={() => handleAcao("aprovar")} disabled={registrarTransicao.isPending}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Aprovar
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleAcao("rejeitar")} disabled={registrarTransicao.isPending}>
                    <XCircle className="h-3.5 w-3.5 mr-1" /> Rejeitar
                  </Button>
                </div>
              </div>
            )}

            {/* Transitions timeline */}
            {transicoes.length > 0 && (
              <div className="space-y-1.5 mt-2">
                <p className="text-xs font-semibold text-muted-foreground">Histórico</p>
                {transicoes.map(t => (
                  <div key={t.id} className="flex items-start gap-2 text-xs border-l-2 border-border pl-3 py-1">
                    <span className="text-muted-foreground whitespace-nowrap">
                      {format(new Date(t.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                    <span>
                      <strong>{t.usuario_nome}</strong> — {t.acao} em "{t.etapa_nome}"
                      {t.observacao && <span className="text-muted-foreground"> ({t.observacao})</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
