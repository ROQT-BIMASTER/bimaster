import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Sparkles, Paperclip } from "lucide-react";
import { useBriefingChat } from "@/hooks/useBriefingChat";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { BriefingHeader } from "@/components/briefings/BriefingHeader";
import { useRRTask } from "@/hooks/useRRTask";
import { BriefingMessage } from "@/components/briefings/BriefingMessage";
import { BriefingCanvasField } from "@/components/briefings/BriefingCanvasField";
import { BriefingFieldComments } from "@/components/briefings/BriefingFieldComments";
import { BriefingRetrabalhoDiffDialog } from "@/components/briefings/BriefingRetrabalhoDiffDialog";
import { useBriefingComentarios, type ReworkResult } from "@/hooks/useBriefingComentarios";
import { useBriefingMembros } from "@/hooks/useBriefingMembros";
import { VincularProjetoDialog } from "@/components/briefings/VincularProjetoDialog";
import { GerarTarefaDialog } from "@/components/briefings/GerarTarefaDialog";
import { BriefingMicButton } from "@/components/briefings/BriefingMicButton";
import { EnviarAprovacaoDialog } from "@/components/briefings/EnviarAprovacaoDialog";
import { AprovacaoTimeline } from "@/components/briefings/AprovacaoTimeline";
import { ExportarBriefingDialog } from "@/components/briefings/export/ExportarBriefingDialog";
import { CofreTab } from "@/components/briefings/cofre/CofreTab";
import { BriefingVersoesTimeline } from "@/components/briefings/BriefingVersoesTimeline";
import { AnexarEvidenciaDialog } from "@/components/briefings/cofre/AnexarEvidenciaDialog";
import { AttachImageButton, type ChatAttachment } from "@/components/briefings/chat/AttachImageButton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function BriefingWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const deepLinkCampo = searchParams.get("campo");
  const deepLinkComentario = searchParams.get("comentario");
  const { briefing, sections, messages, loading, sending, enviar, recarregar } =
    useBriefingChat(id);
  const { enviando: rrtaskEnviando, enviarParaRRTask } = useRRTask();
  const [input, setInput] = useState("");
  const [chatAttachments, setChatAttachments] = useState<ChatAttachment[]>([]);
  const [localPayload, setLocalPayload] = useState<Record<string, string>>({});
  const [localOrigens, setLocalOrigens] = useState<Record<string, "ia" | "manual">>({});
  const lastRemotePayloadRef = useRef<Record<string, string>>({});
  const [projetoNome, setProjetoNome] = useState<string | null>(null);
  const [vincDialogOpen, setVincDialogOpen] = useState(false);
  const [aprovDialogOpen, setAprovDialogOpen] = useState(false);
  const [gerarTarefaOpen, setGerarTarefaOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [evidenciaOpen, setEvidenciaOpen] = useState(false);
  const [aprovRefresh, setAprovRefresh] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [diffData, setDiffData] = useState<(ReworkResult & { campoLabel: string; campoKey: string }) | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const coments = useBriefingComentarios(briefing?.id);
  const { membros: briefingMembros } = useBriefingMembros(briefing?.id);
  const mentionMembers = useMemo(
    () => (briefingMembros ?? []).map((m) => ({ user_id: m.user_id, nome: m.profile?.nome ?? null })),
    [briefingMembros],
  );

  // Deep-link vindo do Chat (?campo=...&comentario=...): rola até o campo
  // assim que ele estiver renderizado. Roda só uma vez por valor de campo.
  useEffect(() => {
    if (!deepLinkCampo || loading) return;
    const t = setTimeout(() => {
      const el = document.getElementById(`briefing-campo-${deepLinkCampo}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 250);
    return () => clearTimeout(t);
  }, [deepLinkCampo, loading]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  // Sincroniza payload remoto -> local sem destruir digitação em andamento.
  // Para cada campo: só substitui o valor local se o remoto realmente mudou
  // E o local ainda estava igual ao último remoto conhecido (não foi editado).
  useEffect(() => {
    if (!briefing) return;
    const remote = briefing.payload ?? {};
    const lastRemote = lastRemotePayloadRef.current;
    setLocalPayload((prev) => {
      const next = { ...prev };
      const allKeys = new Set([...Object.keys(remote), ...Object.keys(prev)]);
      for (const k of allKeys) {
        const remoteVal = remote[k] ?? "";
        const prevVal = prev[k] ?? "";
        const lastRemoteVal = lastRemote[k] ?? "";
        const remoteChanged = remoteVal !== lastRemoteVal;
        const localUntouched = prevVal === lastRemoteVal;
        if (remoteChanged && localUntouched) {
          next[k] = remoteVal;
        } else if (!(k in prev)) {
          next[k] = remoteVal;
        }
      }
      return next;
    });
    lastRemotePayloadRef.current = remote;
    setLocalOrigens(briefing.campo_origens ?? {});
  }, [briefing?.id, briefing?.payload, briefing?.campo_origens]);

  // Carrega nome do projeto vinculado
  useEffect(() => {
    if (!briefing?.projeto_id) {
      setProjetoNome(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("projetos")
        .select("nome")
        .eq("id", briefing.projeto_id!)
        .maybeSingle();
      setProjetoNome((data as any)?.nome ?? null);
    })();
  }, [briefing?.projeto_id]);

  useEffect(() => {
    if (!sending) textareaRef.current?.focus();
  }, [sending, messages.length]);

  const readOnly = briefing?.status === "em_aprovacao";

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const t = input.trim();
    if ((!t && chatAttachments.length === 0) || sending) return;
    const atts = chatAttachments;
    setInput("");
    setChatAttachments([]);
    await enviar(t, atts);
  };

  const salvarCampo = async (key: string, valor: string) => {
    if (!briefing) return;
    const novoPayload = { ...localPayload, [key]: valor };
    setLocalPayload(novoPayload);
    // Edição manual: marca origem do campo como "manual" se houver texto;
    // se esvaziar, remove a marca para o agente poder preencher de novo.
    const novasOrigens = { ...localOrigens };
    if (valor.trim().length > 0) {
      novasOrigens[key] = "manual";
    } else {
      delete novasOrigens[key];
    }
    setLocalOrigens(novasOrigens);
    lastRemotePayloadRef.current = { ...lastRemotePayloadRef.current, [key]: valor };
    const totalCampos = sections.length || 1;
    const preenchidos = Object.values(novoPayload).filter(
      (v) => typeof v === "string" && v.trim().length > 0,
    ).length;
    const completude = Math.min(100, Math.round((preenchidos / totalCampos) * 100));
    const { error } = await supabase
      .from("briefings")
      .update({
        payload: novoPayload,
        campo_origens: novasOrigens,
        completude,
        status: "em_andamento",
      })
      .eq("id", briefing.id);
    if (error) toast.error("Erro ao salvar campo");
  };

  const marcarOrigem = async (key: string, origem: "ia" | "manual") => {
    if (!briefing) return;
    const novasOrigens = { ...localOrigens, [key]: origem };
    setLocalOrigens(novasOrigens);
    const { error } = await supabase
      .from("briefings")
      .update({ campo_origens: novasOrigens })
      .eq("id", briefing.id);
    if (error) {
      toast.error("Não foi possível atualizar a origem do campo");
      return;
    }
    toast.success(
      origem === "manual"
        ? "Campo protegido contra o agente."
        : "Campo liberado para o agente.",
    );
  };

  const pedirAjudaAoAgente = (label: string) => {
    setInput(`Me ajude a preencher o campo "${label}". Pergunte o que precisar para gerar uma boa proposta.`);
    textareaRef.current?.focus();
  };

  const cancelarAprovacao = async () => {
    if (!briefing) return;
    const { error } = await supabase.rpc("rpc_cancelar_aprovacao_briefing", {
      p_briefing_id: briefing.id,
    });
    if (error) {
      toast.error(`Não foi possível cancelar: ${error.message}`);
      return;
    }
    toast.success("Aprovação cancelada");
    await recarregar();
    setAprovRefresh((x) => x + 1);
  };

  const camposPreenchidos = useMemo(
    () =>
      sections.filter((s) => (localPayload[s.key] ?? "").trim().length > 0).length,
    [sections, localPayload],
  );

  const sectionLabels = useMemo(
    () => Object.fromEntries(sections.map((s) => [s.key, s.label])),
    [sections],
  );

  if (loading || !briefing) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
        Carregando briefing...
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-background">
      <BriefingHeader
        briefing={briefing}
        projetoNome={projetoNome}
        onVoltar={() => navigate("/dashboard/briefings")}
        onVincularProjeto={() => setVincDialogOpen(true)}
        onAbrirProjeto={
          briefing.projeto_id
            ? () => navigate(`/dashboard/projetos/${briefing.projeto_id}`)
            : undefined
        }
        onExportar={() => setExportDialogOpen(true)}
        onGerarTarefa={
          briefing.projeto_id && !briefing.tarefa_id
            ? () => setGerarTarefaOpen(true)
            : undefined
        }
        onAbrirTarefa={
          briefing.projeto_id && briefing.tarefa_id
            ? () => navigate(`/dashboard/projetos/${briefing.projeto_id}n${briefing.tarefa_id}`)
            : undefined
        }
        temTarefaVinculada={!!briefing.tarefa_id}
        podeEnviarAprovacao={briefing.completude >= 100 && briefing.status !== "em_aprovacao"}
        jaEmAprovacao={briefing.status === "em_aprovacao"}
        onEnviarAprovacao={() => setAprovDialogOpen(true)}
        onCancelarAprovacao={cancelarAprovacao}
        rrtaskEnviando={rrtaskEnviando}
        onEnviarRRTask={async () => {
          try {
            await enviarParaRRTask(briefing.id);
            await recarregar();
          } catch {
            /* toast já exibido no hook */
          }
        }}
        onReenviarRRTask={async () => {
          try {
            await enviarParaRRTask(briefing.id, { force: true });
            await recarregar();
          } catch {
            /* toast já exibido no hook */
          }
        }}
        onAbrirRRTask={
          briefing.rrtask_page_url
            ? () => window.open(briefing.rrtask_page_url!, "_blank", "noopener,noreferrer")
            : undefined
        }
      />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[2fr_3fr] overflow-hidden">
        {/* Chat */}
        <div className="flex flex-col border-r min-h-0 bg-background">
          <Conversation className="flex-1 min-h-0">
            <ConversationContent className="px-4 py-4">
              {messages.length === 0 ? (
                <div className="text-center py-12 px-6">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                    Descreva o objetivo, o público e o canal. O agente preenche o canvas ao
                    lado, faz perguntas e busca dados internos quando precisar.
                  </p>
                </div>
              ) : (
                messages.map((m) => (
                  <BriefingMessage
                    key={m.id}
                    message={m}
                    sectionLabels={sectionLabels}
                    onSugestaoDecided={recarregar}
                  />
                ))
              )}
              {sending && (
                <div className="flex gap-2.5 mb-4">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <Shimmer className="text-sm">Pensando...</Shimmer>
                </div>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          <form
            onSubmit={handleSubmit}
            className="border-t p-3 bg-background"
          >
            <div className="flex flex-col gap-2 rounded-xl border bg-background focus-within:ring-1 focus-within:ring-primary/30 transition-shadow p-2">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder={
                  readOnly
                    ? "Briefing em aprovação — peça revisão pelo painel à direita"
                    : "Descreva objetivo, público e canal…"
                }
                rows={2}
                className="resize-none border-0 focus-visible:ring-0 shadow-none px-1.5 py-1 min-h-0"
                disabled={sending || readOnly}
              />
              <div className="relative flex items-center justify-between gap-2">
                <span className="text-[10px] text-muted-foreground px-1.5">
                  Enter para enviar · Shift+Enter para nova linha
                </span>
                <div className="flex items-center gap-1">
                  <AttachImageButton
                    briefingId={briefing.id}
                    attachments={chatAttachments}
                    setAttachments={setChatAttachments}
                    disabled={sending || readOnly}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    disabled={sending || readOnly}
                    onClick={() => setEvidenciaOpen(true)}
                    title="Anexar evidência ao cofre"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <BriefingMicButton
                    disabled={sending || readOnly}
                    onTranscribed={(text) => {
                      setInput((prev) => (prev ? `${prev.trim()} ${text}`.trim() : text));
                      requestAnimationFrame(() => {
                        const el = textareaRef.current;
                        if (el) {
                          el.focus();
                          el.setSelectionRange(el.value.length, el.value.length);
                        }
                      });
                    }}
                  />
                  <Button
                    type="submit"
                    disabled={sending || (!input.trim() && chatAttachments.length === 0) || readOnly}
                    size="sm"
                  >
                    Enviar
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Canvas */}
        <ScrollArea className="min-h-0 bg-muted/30">
          <div className="p-6 max-w-3xl mx-auto space-y-5">
            {briefing.status === "em_aprovacao" && (
              <AprovacaoTimeline briefingId={briefing.id} refreshKey={aprovRefresh} />
            )}

            <Tabs defaultValue="canvas">
              <TabsList className="bg-card">
                <TabsTrigger value="canvas" className="text-xs">Canvas</TabsTrigger>
                <TabsTrigger value="cofre" className="text-xs">Cofre de documentos</TabsTrigger>
                <TabsTrigger value="historico" className="text-xs">Histórico</TabsTrigger>
              </TabsList>

              <TabsContent value="canvas" className="mt-4 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Canvas do briefing
                  </h2>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="relative h-6 w-6">
                      <svg viewBox="0 0 24 24" className="h-6 w-6 -rotate-90">
                        <circle cx="12" cy="12" r="9" className="fill-none stroke-muted" strokeWidth="3" />
                        <circle
                          cx="12" cy="12" r="9"
                          className="fill-none stroke-primary transition-all"
                          strokeWidth="3"
                          strokeDasharray={`${(2 * Math.PI * 9 * briefing.completude) / 100} ${2 * Math.PI * 9}`}
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                    <span className="tabular-nums">
                      {camposPreenchidos}/{sections.length} campos
                    </span>
                  </div>
                </div>

                {sections.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Este tipo de briefing ainda não tem template configurado.
                  </p>
                ) : (
                  sections.map((s) => {
                    const campoComents = coments.byCampo(s.key);
                    const counts = coments.countsByCampo[s.key];
                    return (
                      <BriefingCanvasField
                        key={s.key}
                        section={s}
                        anchorId={`briefing-campo-${s.key}`}
                        value={localPayload[s.key] ?? ""}
                        readOnly={readOnly}
                        origem={localOrigens[s.key] ?? null}
                        onChange={(v) => setLocalPayload((p) => ({ ...p, [s.key]: v }))}
                        onBlurSave={(v) => salvarCampo(s.key, v)}
                        onAskAgent={pedirAjudaAoAgente}
                        onChangeOrigem={(o) => marcarOrigem(s.key, o)}
                        hasOpenComments={(counts?.abertos ?? 0) > 0}
                        commentsSlot={
                          <BriefingFieldComments
                            briefingId={briefing.id}
                            campoKey={s.key}
                            campoLabel={s.label}
                            comentarios={campoComents}
                            authors={coments.authors}
                            currentUserId={currentUserId}
                            readOnly={readOnly}
                            members={mentionMembers}
                            defaultOpen={deepLinkCampo === s.key}
                            highlightCommentId={deepLinkCampo === s.key ? deepLinkComentario : null}
                            onAdd={coments.add}
                            onUpdate={coments.updateBody}
                            onRemove={coments.remove}
                            onToggleResolved={coments.toggleResolved}
                            onRework={coments.rework}
                            onReworkApplied={async (r) => {
                              if (r.novo_texto !== undefined) {
                                setLocalPayload((p) => ({ ...p, [s.key]: r.novo_texto! }));
                              }
                              await recarregar();
                              setDiffData({ ...r, campoLabel: s.label, campoKey: s.key });
                            }}
                          />
                        }
                      />
                    );
                  })
                )}
              </TabsContent>

              <TabsContent value="cofre" className="mt-4">
                <CofreTab briefingId={briefing.id} tipoBriefing={briefing.tipo} />
              </TabsContent>

              <TabsContent value="historico" className="mt-4">
                <BriefingVersoesTimeline briefingId={briefing.id} secoes={sections} />
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </div>

      <VincularProjetoDialog
        open={vincDialogOpen}
        onOpenChange={setVincDialogOpen}
        briefingId={briefing.id}
        projetoIdAtual={briefing.projeto_id}
        onVinculado={async (_pid, nome) => {
          setProjetoNome(nome);
          await recarregar();
        }}
      />

      <EnviarAprovacaoDialog
        open={aprovDialogOpen}
        onOpenChange={setAprovDialogOpen}
        briefingId={briefing.id}
        briefingTitulo={briefing.titulo}
        briefingTipo={briefing.tipo}
        onEnviado={async () => {
          await recarregar();
          setAprovRefresh((x) => x + 1);
        }}
      />

      {briefing.projeto_id && (
        <GerarTarefaDialog
          open={gerarTarefaOpen}
          onOpenChange={setGerarTarefaOpen}
          briefingId={briefing.id}
          briefingTitulo={briefing.titulo}
          projetoId={briefing.projeto_id}
          projetoNome={projetoNome}
          onTarefaCriada={async () => {
            await recarregar();
          }}
        />
      )}

      <ExportarBriefingDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        briefing={briefing}
        sections={sections}
        projetoNome={projetoNome}
      />

      {diffData && (
        <BriefingRetrabalhoDiffDialog
          open={!!diffData}
          onOpenChange={(v) => { if (!v) setDiffData(null); }}
          campoLabel={diffData.campoLabel}
          textoAnterior={diffData.texto_anterior ?? ""}
          novoTexto={diffData.novo_texto ?? ""}
          racional={diffData.racional}
          mudancas={diffData.mudancas}
          onUndo={async () => {
            const prev = diffData.texto_anterior ?? "";
            setLocalPayload((p) => ({ ...p, [diffData.campoKey]: prev }));
            await salvarCampo(diffData.campoKey, prev);
          }}
        />
      )}

      <AnexarEvidenciaDialog
        open={evidenciaOpen}
        onOpenChange={setEvidenciaOpen}
        briefingId={briefing.id}
        origem="chat"
        onAnexado={async (doc) => {
          // Registra mensagens no histórico do chat para proveniência
          try {
            await supabase.from("briefing_mensagens").insert([
              {
                briefing_id: briefing.id,
                role: "user",
                content: `Anexou evidência: ${doc.nome}`,
              },
              {
                briefing_id: briefing.id,
                role: "assistant",
                content: `Evidência registrada no cofre${doc.is_oficial ? " como documento oficial" : ""}${doc.is_checklist_item ? " e adicionada ao checklist deste briefing" : ""}.`,
              },
            ]);
            await recarregar();
          } catch {
            // silencioso — upload já foi feito
          }
        }}
      />
    </div>
  );
}
