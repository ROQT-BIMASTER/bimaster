import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Sparkles } from "lucide-react";
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
import { BriefingMessage } from "@/components/briefings/BriefingMessage";
import { BriefingCanvasField } from "@/components/briefings/BriefingCanvasField";
import { VincularProjetoDialog } from "@/components/briefings/VincularProjetoDialog";
import { EnviarAprovacaoDialog } from "@/components/briefings/EnviarAprovacaoDialog";
import { AprovacaoTimeline } from "@/components/briefings/AprovacaoTimeline";

export default function BriefingWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { briefing, sections, messages, loading, sending, enviar, recarregar } =
    useBriefingChat(id);
  const [input, setInput] = useState("");
  const [localPayload, setLocalPayload] = useState<Record<string, string>>({});
  const [projetoNome, setProjetoNome] = useState<string | null>(null);
  const [vincDialogOpen, setVincDialogOpen] = useState(false);
  const [aprovDialogOpen, setAprovDialogOpen] = useState(false);
  const [aprovRefresh, setAprovRefresh] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (briefing) setLocalPayload(briefing.payload ?? {});
  }, [briefing?.id, briefing?.payload]);

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
    if (!t || sending) return;
    setInput("");
    await enviar(t);
  };

  const salvarCampo = async (key: string, valor: string) => {
    if (!briefing) return;
    const novoPayload = { ...localPayload, [key]: valor };
    setLocalPayload(novoPayload);
    const totalCampos = sections.length || 1;
    const preenchidos = Object.values(novoPayload).filter(
      (v) => typeof v === "string" && v.trim().length > 0,
    ).length;
    const completude = Math.min(100, Math.round((preenchidos / totalCampos) * 100));
    const { error } = await supabase
      .from("briefings")
      .update({ payload: novoPayload, completude, status: "em_andamento" })
      .eq("id", briefing.id);
    if (error) toast.error("Erro ao salvar campo");
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
        podeEnviarAprovacao={briefing.completude >= 100 && briefing.status !== "em_aprovacao"}
        jaEmAprovacao={briefing.status === "em_aprovacao"}
        onEnviarAprovacao={() => setAprovDialogOpen(true)}
        onCancelarAprovacao={cancelarAprovacao}
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
                messages.map((m) => <BriefingMessage key={m.id} message={m} />)
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
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground px-1.5">
                  Enter para enviar · Shift+Enter para nova linha
                </span>
                <Button
                  type="submit"
                  disabled={sending || !input.trim() || readOnly}
                  size="sm"
                >
                  Enviar
                </Button>
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

            <div className="sticky top-0 -mx-2 px-2 py-2 bg-muted/30 backdrop-blur-sm flex items-center justify-between z-10">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Canvas do briefing
              </h2>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="relative h-6 w-6">
                  <svg viewBox="0 0 24 24" className="h-6 w-6 -rotate-90">
                    <circle cx="12" cy="12" r="9" className="fill-none stroke-muted" strokeWidth="3" />
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
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
              sections.map((s) => (
                <BriefingCanvasField
                  key={s.key}
                  section={s}
                  value={localPayload[s.key] ?? ""}
                  readOnly={readOnly}
                  onChange={(v) => setLocalPayload((p) => ({ ...p, [s.key]: v }))}
                  onBlurSave={(v) => salvarCampo(s.key, v)}
                  onAskAgent={pedirAjudaAoAgente}
                />
              ))
            )}
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
        onEnviado={async () => {
          await recarregar();
          setAprovRefresh((x) => x + 1);
        }}
      />
    </div>
  );
}
