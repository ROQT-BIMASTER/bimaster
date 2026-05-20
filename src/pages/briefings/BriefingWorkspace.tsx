import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Sparkles } from "lucide-react";
import { useBriefingChat } from "@/hooks/useBriefingChat";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function BriefingWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { briefing, sections, messages, loading, sending, enviar } = useBriefingChat(id);
  const [input, setInput] = useState("");
  const [localPayload, setLocalPayload] = useState<Record<string, string>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (briefing) setLocalPayload(briefing.payload ?? {});
  }, [briefing?.id, briefing?.payload]);

  useEffect(() => {
    if (!sending) textareaRef.current?.focus();
  }, [sending, messages.length]);

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

  if (loading || !briefing) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
        Carregando briefing...
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center gap-3 bg-background">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate("/dashboard/briefings")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <FileText className="h-5 w-5 text-primary" />
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold truncate">{briefing.titulo}</h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="capitalize">{briefing.tipo}</span>
            <span>·</span>
            <span>{briefing.completude}% completo</span>
          </div>
        </div>
        <Badge variant="outline" className="capitalize">
          {briefing.status.replace("_", " ")}
        </Badge>
      </div>

      {/* Split: chat (40) + canvas (60) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[2fr_3fr] overflow-hidden">
        {/* Chat */}
        <div className="flex flex-col border-r min-h-0 bg-muted/20">
          <Conversation className="flex-1 min-h-0">
            <ConversationContent>
              {messages.length === 0 ? (
                <div className="text-center py-12 px-6">
                  <Sparkles className="h-10 w-10 mx-auto mb-3 text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Descreva o objetivo do briefing e o agente vai te ajudar a preencher
                    o canvas ao lado, perguntar o que faltar e buscar dados internos.
                  </p>
                </div>
              ) : (
                messages.map((m) =>
                  m.role === "user" ? (
                    <Message key={m.id} from="user">
                      <MessageContent>{m.content}</MessageContent>
                    </Message>
                  ) : m.role === "assistant" ? (
                    <Message key={m.id} from="assistant">
                      <MessageResponse>{m.content}</MessageResponse>
                      {m.proposals && m.proposals.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {m.proposals.flatMap((p) =>
                            Object.keys(p.campos ?? {}).map((k) => (
                              <Badge key={`${m.id}-${k}`} variant="secondary" className="text-[10px]">
                                Canvas: {k}
                              </Badge>
                            )),
                          )}
                        </div>
                      )}
                      {m.sources && m.sources.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {m.sources.map((s, i) => (
                            <Badge key={`${m.id}-s-${i}`} variant="outline" className="text-[10px]">
                              {s.tipo}: {s.label}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </Message>
                  ) : null,
                )
              )}
              {sending && (
                <Message from="assistant">
                  <Shimmer>Pensando...</Shimmer>
                </Message>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          <form onSubmit={handleSubmit} className="border-t p-3 bg-background">
            <div className="flex gap-2">
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
                placeholder="Conte o objetivo, o público, o canal..."
                rows={2}
                className="resize-none"
                disabled={sending}
              />
              <Button type="submit" disabled={sending || !input.trim()} size="sm">
                Enviar
              </Button>
            </div>
          </form>
        </div>

        {/* Canvas */}
        <ScrollArea className="min-h-0">
          <div className="p-6 max-w-3xl space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Canvas do briefing
              </h2>
              <span className="text-xs text-muted-foreground">
                {sections.filter((s) => (localPayload[s.key] ?? "").trim()).length}/{sections.length} campos
              </span>
            </div>
            {sections.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Este tipo de briefing ainda não tem template configurado.
              </p>
            ) : (
              sections.map((s) => (
                <div key={s.key} className="space-y-1.5">
                  <Label className="flex items-center gap-2">
                    {s.label}
                    {s.required && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1">
                        obrigatório
                      </Badge>
                    )}
                  </Label>
                  <Textarea
                    value={localPayload[s.key] ?? ""}
                    onChange={(e) =>
                      setLocalPayload((p) => ({ ...p, [s.key]: e.target.value }))
                    }
                    onBlur={(e) => salvarCampo(s.key, e.target.value)}
                    placeholder={s.placeholder ?? "Preencha ou peça ajuda ao agente"}
                    rows={3}
                    className="resize-y"
                  />
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
