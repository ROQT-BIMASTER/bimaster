import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, ArrowRight, RotateCcw,
  Loader2, Palette, User, MessageSquare
} from "lucide-react";
import { useFluxoInstanciaDetail, useAprovarEtapa, useReprovarEtapa, useDevolverEtapaAprovacao, type FluxoTransicao, type FluxoAprovador } from "@/hooks/useFluxoAprovacaoArtes";
import { DevolucaoEtapaDialog, type DevolucaoResult } from "@/components/shared/DevolucaoEtapaDialog";
import { VinculoProjetoBadges } from "@/components/shared/VinculoProjetoBadges";
import { VincularProjetoDialog } from "@/components/shared/VincularProjetoDialog";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export default function FluxoAprovacaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: instancia, isLoading } = useFluxoInstanciaDetail(id);
  const aprovar = useAprovarEtapa();
  const reprovar = useReprovarEtapa();
  const devolver = useDevolverEtapaAprovacao();
  const [observacao, setObservacao] = useState("");
  const [observacaoReprovar, setObservacaoReprovar] = useState("");
  const [showDevolucao, setShowDevolucao] = useState(false);
  const [showVinculo, setShowVinculo] = useState(false);

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!instancia) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Instância não encontrada
      </div>
    );
  }

  const etapas = instancia.config?.etapas || [];
  const etapaAtual = instancia.etapa_atual;
  const isParallel = etapaAtual?.tipo_aprovacao === "paralela";
  const aprovadores = (instancia as any).aprovadores || [];
  const transicoes = (instancia as any).transicoes || [];
  const isFinished = instancia.status === "aprovado" || instancia.status === "reprovado";

  // Find current user's approver record (for parallel)
  const myApprover = aprovadores.find(
    (a: FluxoAprovador) => a.usuario_id === currentUser?.id && a.etapa_id === etapaAtual?.id && a.status === "pendente"
  );

  const canApprove = !isFinished && (
    isParallel ? !!myApprover : (
      etapaAtual?.responsavel_id === currentUser?.id ||
      etapaAtual?.responsavel_secundario_id === currentUser?.id
    )
  );

  const handleAprovar = () => {
    if (!etapaAtual) return;
    aprovar.mutate({
      instanciaId: instancia.id,
      etapaId: etapaAtual.id,
      etapaNome: etapaAtual.nome,
      observacao: observacao || undefined,
      aprovadorId: myApprover?.id,
    });
    setObservacao("");
  };

  const handleReprovar = () => {
    if (!etapaAtual || !observacaoReprovar.trim()) return;
    reprovar.mutate({
      instanciaId: instancia.id,
      etapaId: etapaAtual.id,
      etapaNome: etapaAtual.nome,
      observacao: observacaoReprovar,
      aprovadorId: myApprover?.id,
    });
    setObservacaoReprovar("");
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/aprovacao-artes")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="p-2 rounded-lg bg-primary/10">
          <Palette className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{instancia.config?.nome || "Fluxo de Aprovação"}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <StatusBadge status={instancia.status} />
            {instancia.rodada > 1 && (
              <Badge variant="outline" className="text-[10px]">
                Rodada {instancia.rodada}
              </Badge>
            )}
          </div>
          <VinculoProjetoBadges modulo="aprovacao_artes" registroId={id} onVincular={() => setShowVinculo(true)} />
        </div>
      </div>

      <VincularProjetoDialog modulo="aprovacao_artes" registroId={id!} open={showVinculo} onOpenChange={setShowVinculo} />

      {/* Stage Progress */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Progresso do Fluxo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {etapas.map((etapa, i) => {
              const isCurrent = etapa.ordem === instancia.etapa_atual_ordem;
              const isPast = etapa.ordem < instancia.etapa_atual_ordem;
              const isFuture = etapa.ordem > instancia.etapa_atual_ordem;

              return (
                <div key={etapa.id} className="flex items-center gap-2 flex-1">
                  <div className={cn(
                    "flex-1 rounded-lg p-3 border-2 transition-all text-center",
                    isCurrent && "border-primary bg-primary/5 shadow-sm",
                    isPast && "border-green-500/50 bg-green-50 dark:bg-green-950/20",
                    isFuture && "border-muted bg-muted/30",
                    isFinished && instancia.status === "aprovado" && "border-green-500/50 bg-green-50 dark:bg-green-950/20"
                  )}>
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      {isPast || (isFinished && instancia.status === "aprovado") ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : isCurrent ? (
                        <ArrowRight className="h-4 w-4 text-primary" />
                      ) : (
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <p className={cn(
                      "text-xs font-medium",
                      isCurrent && "text-primary",
                      isPast && "text-green-700 dark:text-green-400",
                      isFuture && "text-muted-foreground"
                    )}>
                      {etapa.nome}
                    </p>
                    {etapa.tipo_aprovacao === "paralela" && (
                      <Badge variant="outline" className="text-[9px] mt-1">Paralela</Badge>
                    )}
                  </div>
                  {i < etapas.length - 1 && (
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Main Content: Approval Panels */}
      {!isFinished && etapaAtual && (
        <div className={cn("grid gap-4", isParallel ? "grid-cols-2" : "grid-cols-1")}>
          {isParallel ? (
            // Dual panel for parallel approval
            aprovadores
              .filter((a: FluxoAprovador) => a.etapa_id === etapaAtual.id)
              .map((aprovador: FluxoAprovador) => (
                <ApprovalPanel
                  key={aprovador.id}
                  aprovador={aprovador}
                  isCurrentUser={aprovador.usuario_id === currentUser?.id}
                  onAprovar={(obs) => {
                    aprovar.mutate({
                      instanciaId: instancia.id,
                      etapaId: etapaAtual.id,
                      etapaNome: etapaAtual.nome,
                      observacao: obs,
                      aprovadorId: aprovador.id,
                    });
                  }}
                  onReprovar={(obs) => {
                    reprovar.mutate({
                      instanciaId: instancia.id,
                      etapaId: etapaAtual.id,
                      etapaNome: etapaAtual.nome,
                      observacao: obs,
                      aprovadorId: aprovador.id,
                    });
                  }}
                  isPending={aprovar.isPending || reprovar.isPending}
                />
              ))
          ) : (
            // Single panel
            <Card className="border-2 border-primary/20">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {etapaAtual.nome}
                  {canApprove && <Badge variant="default" className="text-[10px]">Sua vez</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {canApprove ? (
                  <>
                    <div>
                      <label className="text-xs text-muted-foreground">Observação (opcional para aprovação)</label>
                      <Textarea
                        value={observacao}
                        onChange={e => setObservacao(e.target.value)}
                        placeholder="Adicione uma observação..."
                        rows={2}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleAprovar}
                        disabled={aprovar.isPending}
                        className="flex-1 gap-2"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Aprovar
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" className="flex-1 gap-2">
                            <XCircle className="h-4 w-4" />
                            Reprovar
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Reprovar etapa</AlertDialogTitle>
                            <AlertDialogDescription>
                              Informe o motivo da reprovação. Este campo é obrigatório.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <Textarea
                            value={observacaoReprovar}
                            onChange={e => setObservacaoReprovar(e.target.value)}
                            placeholder="Motivo da reprovação..."
                            rows={3}
                          />
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleReprovar}
                              disabled={!observacaoReprovar.trim() || reprovar.isPending}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Confirmar Reprovação
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aguardando ação do responsável desta etapa
                  </p>
                )}

                {/* Devolver button for non-first stages */}
                {instancia.etapa_atual_ordem > 0 && canApprove && (
                  <Button variant="outline" className="w-full gap-2 text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/20" onClick={() => setShowDevolucao(true)}>
                    <RotateCcw className="h-4 w-4" />
                    Devolver para Ajuste
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Histórico de Transições
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transicoes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma transição registrada</p>
          ) : (
            <div className="space-y-3">
              {transicoes.map((t: FluxoTransicao) => (
                <div key={t.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <ActionIcon acao={t.acao} />
                    <div className="w-px flex-1 bg-border mt-1" />
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {t.usuario?.nome || "Sistema"}
                      </span>
                      <ActionBadge acao={t.acao} />
                      {t.etapa_nome && (
                        <span className="text-xs text-muted-foreground">• {t.etapa_nome}</span>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">
                        Rodada {t.rodada} • {format(new Date(t.created_at), "dd/MM HH:mm")}
                      </span>
                    </div>
                    {t.observacao && (
                      <p className="text-xs text-muted-foreground mt-1 bg-muted/50 p-2 rounded">
                        {t.observacao}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Devolução dialog */}
      {etapaAtual && (
        <DevolucaoEtapaDialog
          open={showDevolucao}
          onOpenChange={setShowDevolucao}
          entityType="fluxo_aprovacao"
          entityId={instancia.id}
          etapasAnteriores={
            etapas
              .filter(e => e.ordem < instancia.etapa_atual_ordem)
              .map(e => ({ key: String(e.ordem), label: e.nome }))
          }
          onConfirm={async (result: DevolucaoResult) => {
            await devolver.mutateAsync({
              instanciaId: instancia.id,
              etapaId: etapaAtual.id,
              etapaNome: etapaAtual.nome,
              etapaDestinoOrdem: parseInt(result.etapaDestino),
              justificativa: result.justificativa,
              userInfo: result.userInfo,
            });
          }}
        />
      )}
    </div>
  );
}

// Helper components

function ApprovalPanel({
  aprovador,
  isCurrentUser,
  onAprovar,
  onReprovar,
  isPending,
}: {
  aprovador: FluxoAprovador;
  isCurrentUser: boolean;
  onAprovar: (obs?: string) => void;
  onReprovar: (obs: string) => void;
  isPending: boolean;
}) {
  const [obs, setObs] = useState("");
  const [obsReprovar, setObsReprovar] = useState("");

  return (
    <Card className={cn(
      "border-2",
      aprovador.status === "aprovado" && "border-green-500/50",
      aprovador.status === "reprovado" && "border-destructive/50",
      aprovador.status === "pendente" && isCurrentUser && "border-primary/30",
      aprovador.status === "pendente" && !isCurrentUser && "border-muted",
    )}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={aprovador.usuario?.avatar_url || undefined} className="object-cover" />
            <AvatarFallback className="text-[10px]">
              {(aprovador.usuario?.nome || "?").charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span>{aprovador.usuario?.nome || "Responsável"}</span>
          <Badge variant="outline" className="text-[10px] ml-auto">
            {aprovador.responsavel_tipo === "principal" ? "Pré-Cadastro" : "Controle de Qualidade"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {aprovador.status === "aprovado" && (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium">Aprovado</span>
          </div>
        )}
        {aprovador.status === "reprovado" && (
          <div>
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Reprovado</span>
            </div>
            {aprovador.observacao && (
              <p className="text-xs text-muted-foreground mt-1 bg-destructive/5 p-2 rounded">
                {aprovador.observacao}
              </p>
            )}
          </div>
        )}
        {aprovador.status === "pendente" && isCurrentUser && (
          <>
            <Textarea
              value={obs}
              onChange={e => setObs(e.target.value)}
              placeholder="Observação..."
              rows={2}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => onAprovar(obs || undefined)}
                disabled={isPending}
                className="flex-1 gap-1"
              >
                <CheckCircle2 className="h-3 w-3" />
                Aprovar
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive" className="flex-1 gap-1">
                    <XCircle className="h-3 w-3" />
                    Reprovar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reprovar</AlertDialogTitle>
                    <AlertDialogDescription>Motivo obrigatório</AlertDialogDescription>
                  </AlertDialogHeader>
                  <Textarea
                    value={obsReprovar}
                    onChange={e => setObsReprovar(e.target.value)}
                    placeholder="Motivo..."
                    rows={3}
                  />
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onReprovar(obsReprovar)}
                      disabled={!obsReprovar.trim()}
                      className="bg-destructive text-destructive-foreground"
                    >
                      Confirmar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}
        {aprovador.status === "pendente" && !isCurrentUser && (
          <p className="text-xs text-muted-foreground text-center py-2">Aguardando análise</p>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: string }> = {
    pendente: { label: "Pendente", variant: "secondary" },
    em_andamento: { label: "Em Andamento", variant: "default" },
    aprovado: { label: "Aprovado", variant: "success" },
    reprovado: { label: "Reprovado", variant: "destructive" },
    devolvido: { label: "Devolvido", variant: "warning" },
  };
  const s = map[status] || map.pendente;
  return <Badge variant={s.variant as any} className="text-[10px]">{s.label}</Badge>;
}

function ActionIcon({ acao }: { acao: string }) {
  const map: Record<string, { icon: any; color: string }> = {
    iniciar: { icon: ArrowRight, color: "text-blue-500" },
    aprovar: { icon: CheckCircle2, color: "text-green-600" },
    reprovar: { icon: XCircle, color: "text-destructive" },
    devolver: { icon: RotateCcw, color: "text-amber-500" },
    avancar: { icon: ArrowRight, color: "text-primary" },
  };
  const a = map[acao] || map.iniciar;
  const Icon = a.icon;
  return <Icon className={cn("h-4 w-4", a.color)} />;
}

function ActionBadge({ acao }: { acao: string }) {
  const map: Record<string, { label: string; variant: string }> = {
    iniciar: { label: "Iniciou", variant: "secondary" },
    aprovar: { label: "Aprovou", variant: "success" },
    reprovar: { label: "Reprovou", variant: "destructive" },
    devolver: { label: "Devolveu", variant: "warning" },
    avancar: { label: "Avançou", variant: "default" },
  };
  const a = map[acao] || map.iniciar;
  return <Badge variant={a.variant as any} className="text-[10px]">{a.label}</Badge>;
}
