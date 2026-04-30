import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sparkles, Send, Loader2, Plus, FileText, ListChecks } from "lucide-react";
import { useProjetoCopilot } from "@/hooks/useProjetoCopilot";
import { cn } from "@/lib/utils";

interface ProjetoCopilotPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projetoId: string;
  projetoNome?: string;
}

const SUGESTOES = [
  { icon: ListChecks, label: "Resumo do projeto", prompt: "Faça um resumo executivo do projeto: status geral, principais riscos e próximos passos." },
  { icon: ListChecks, label: "Tarefas atrasadas", prompt: "Liste as tarefas atrasadas, agrupadas por responsável." },
  { icon: ListChecks, label: "Carga por responsável", prompt: "Mostre a carga atual por responsável (pendentes, atrasadas, em andamento)." },
  { icon: FileText, label: "Sem responsável", prompt: "Quais tarefas estão sem responsável e precisam de atribuição?" },
];

export function ProjetoCopilotPanel({ open, onOpenChange, projetoId, projetoNome }: ProjetoCopilotPanelProps) {
  const { messages, sending, send, newThread } = useProjetoCopilot(projetoId);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const handleSend = async (text?: string) => {
    const value = (text ?? input).trim();
    if (!value || sending) return;
    setInput("");
    await send(value);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
        <SheetHeader className="px-5 py-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="size-4 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-base">Copiloto do Projeto</SheetTitle>
                <SheetDescription className="text-xs">
                  {projetoNome ?? "Pergunte sobre tarefas, prazos, anexos e métricas."}
                </SheetDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { newThread(); }}
              className="h-8 gap-1"
            >
              <Plus className="size-3.5" />
              Nova conversa
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1" ref={scrollRef as any}>
          <div className="px-5 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  O copiloto consulta apenas dados deste projeto a que você tem acesso. Tente uma das sugestões abaixo:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SUGESTOES.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => handleSend(s.prompt)}
                      className="text-left rounded-lg border p-3 hover:bg-accent transition-colors flex items-start gap-2"
                      disabled={sending}
                    >
                      <s.icon className="size-4 text-primary mt-0.5 shrink-0" />
                      <div>
                        <div className="text-sm font-medium">{s.label}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2">{s.prompt}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex",
                  m.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "rounded-lg px-3 py-2 max-w-[85%] text-sm",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <ReactMarkdown>{m.content || "_Sem resposta._"}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  )}
                  {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/50 flex flex-wrap gap-1">
                      {m.sources.slice(0, 8).map((s) => (
                        <Badge key={`${s.tipo}-${s.id}`} variant="secondary" className="text-[10px] font-normal">
                          {s.tipo === "tarefa" ? "Tarefa" : s.tipo === "anexo" ? "Anexo" : s.tipo}: {s.label.length > 30 ? s.label.slice(0, 30) + "…" : s.label}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="rounded-lg px-3 py-2 bg-muted text-sm flex items-center gap-2">
                  <Loader2 className="size-3.5 animate-spin" />
                  Pensando…
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <Separator />
        <div className="p-3 flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Pergunte sobre o projeto..."
            rows={2}
            className="resize-none"
            disabled={sending}
          />
          <Button
            onClick={() => handleSend()}
            disabled={sending || !input.trim()}
            size="icon"
            className="shrink-0"
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
