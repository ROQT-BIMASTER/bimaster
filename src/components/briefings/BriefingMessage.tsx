import { AlertCircle, CheckCircle2, Database, Info, Layers, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageResponse } from "@/components/ai-elements/message";
import { isSystemNoteContent } from "./briefing-types";
import { cn } from "@/lib/utils";
import type { BriefingMsg } from "@/hooks/useBriefingChat";

interface Props {
  message: BriefingMsg;
}

export function BriefingMessage({ message }: Props) {
  // Usuário: bolha alinhada à direita
  if (message.role === "user") {
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-3.5 py-2 text-sm shadow-sm whitespace-pre-wrap break-words">
          {message.content}
        </div>
      </div>
    );
  }

  // Sistema (mensagem explícita ou heurística sobre assistant)
  const isSystem =
    message.role === "system" ||
    (message.role === "assistant" && isSystemNoteContent(message.content));

  if (isSystem) {
    const Icon = /erro|não foi|instabilidade/i.test(message.content)
      ? AlertCircle
      : /atualizado|salvo|preenchid/i.test(message.content)
        ? CheckCircle2
        : Info;
    const tone = /erro|instabilidade/i.test(message.content)
      ? "text-amber-700 dark:text-amber-300 border-amber-300/40 bg-amber-50/60 dark:bg-amber-950/30"
      : /atualizado|salvo/i.test(message.content)
        ? "text-emerald-700 dark:text-emerald-300 border-emerald-300/40 bg-emerald-50/60 dark:bg-emerald-950/30"
        : "text-muted-foreground border-dashed bg-muted/40";
    return (
      <div className="my-3 flex justify-center">
        <div
          className={cn(
            "inline-flex items-start gap-2 max-w-[90%] rounded-md border px-3 py-1.5 text-xs",
            tone,
          )}
        >
          <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span className="text-left">{message.content}</span>
        </div>
      </div>
    );
  }

  // Assistant normal: sem bolha, avatar à esquerda
  return (
    <div className="flex gap-2.5 mb-4 group">
      <Avatar className="h-7 w-7 bg-primary/10 text-primary shrink-0 mt-0.5">
        <AvatarFallback className="bg-primary/10 text-primary">
          <Sparkles className="h-3.5 w-3.5" />
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
          Assistente
        </div>
        <div className="text-sm text-foreground prose prose-sm max-w-none dark:prose-invert prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0">
          <MessageResponse>{message.content}</MessageResponse>
        </div>

        {(message.proposals?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {message.proposals!.flatMap((p, pi) =>
              Object.keys(p.campos ?? {}).map((k) => (
                <span
                  key={`${message.id}-p-${pi}-${k}`}
                  className="inline-flex items-center gap-1 rounded-md bg-accent/40 px-1.5 py-0.5 text-[10px] text-accent-foreground"
                >
                  <Layers className="h-2.5 w-2.5" />
                  Canvas: {k}
                </span>
              )),
            )}
          </div>
        )}

        {(message.sources?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.sources!.map((s, i) => (
              <span
                key={`${message.id}-s-${i}`}
                className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                <Database className="h-2.5 w-2.5" />
                {s.tipo}: {s.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
