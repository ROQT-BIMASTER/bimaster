/**
 * Shared CopilotChatShell — used by every copilot UI (Central, Projeto, Sofia, ...).
 * Renders streaming assistant messages with citations, action preview cards, and
 * the C2 number-contract guardrails (unverifiable badge, source-corrected badge).
 */
import { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ActionPreviewCard } from "./ActionPreviewCard";
import { EvidenceList } from "./EvidenceList";
import { CopilotComposer } from "./CopilotComposer";
import type { Citation, CopilotActionPayload } from "@/types/copilot";

export interface CopilotMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations?: Citation[];
  actions?: CopilotActionPayload[];
  pendingAction?: boolean;
  meta?: { unverifiableCount?: number; corrected?: number };
}

interface Props {
  copilotId: string;
  title: string;
  messages: CopilotMessage[];
  isStreaming: boolean;
  onSend: (text: string) => void;
  onConfirmAction: (proposalId: string) => void;
  onCancelAction: (proposalId: string) => void;
  emptyState?: ReactNode;
  className?: string;
}

export function CopilotChatShell({
  copilotId,
  title,
  messages,
  isStreaming,
  onSend,
  onConfirmAction,
  onCancelAction,
  emptyState,
  className,
}: Props) {
  return (
    <div className={cn("flex h-full flex-col bg-background", className)} data-copilot-id={copilotId}>
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">Copilot v2 · evidências verificadas</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {emptyState ?? "Envie uma pergunta para começar."}
          </div>
        ) : (
          messages.map((m) => (
            <MessageRow
              key={m.id}
              message={m}
              onConfirm={onConfirmAction}
              onCancel={onCancelAction}
            />
          ))
        )}
        {isStreaming && (
          <div className="text-xs text-muted-foreground italic">Pensando…</div>
        )}
      </div>

      <CopilotComposer disabled={isStreaming} onSubmit={onSend} />
    </div>
  );
}

function MessageRow({
  message,
  onConfirm,
  onCancel,
}: {
  message: CopilotMessage;
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <Card className={cn("max-w-[85%] p-3 space-y-3", isUser ? "bg-primary/10" : "bg-card")}>
        <div className="prose prose-sm dark:prose-invert text-foreground">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
        {message.meta?.unverifiableCount ? (
          <Badge variant="outline" className="border-destructive text-destructive">
            {message.meta.unverifiableCount} valor(es) não verificável(is) ocultado(s) do resumo
          </Badge>
        ) : null}
        {message.citations && message.citations.length > 0 && (
          <EvidenceList citations={message.citations} />
        )}
        {message.actions?.map((action) => (
          <ActionPreviewCard
            key={action.proposalId}
            action={action}
            onConfirm={() => onConfirm(action.proposalId)}
            onCancel={() => onCancel(action.proposalId)}
          />
        ))}
      </Card>
    </div>
  );
}
