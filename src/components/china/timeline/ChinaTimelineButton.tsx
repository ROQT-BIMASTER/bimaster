import { useState } from "react";
import { Button } from "@/components/ui/button";
import { History } from "lucide-react";
import { ChinaUnifiedTimeline } from "./ChinaUnifiedTimeline";
import { SubmissionTimelineSheet } from "./SubmissionTimelineSheet";
import type { ChinaTimelineScope } from "@/lib/china/timeline/types";
import type { MailboxItem } from "@/hooks/useChinaMailbox";
import { cn } from "@/lib/utils";

interface Props {
  scope: ChinaTimelineScope;
  label?: string;
  title?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "icon";
  className?: string;
  iconOnly?: boolean;
  /** Quando fornecido, abre a versão unificada (Linha do tempo + Histórico de eventos). */
  submissao?: Pick<
    MailboxItem,
    "submissao_id" | "submissao_status" | "aprovado_em" | "created_at" | "numero_ordem" | "produto_codigo" | "produto_nome"
  > | null;
  ocId?: string | null;
}

export function ChinaTimelineButton({
  scope,
  label = "Linha do tempo",
  title,
  variant = "outline",
  size = "sm",
  className,
  iconOnly = false,
  submissao,
  ocId,
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={iconOnly ? "icon" : size}
        className={cn("gap-1.5", className)}
        onClick={() => setOpen(true)}
        title={label}
      >
        <History className="h-3.5 w-3.5" />
        {!iconOnly && <span className="text-xs">{label}</span>}
      </Button>
      {submissao ? (
        <SubmissionTimelineSheet
          open={open}
          onOpenChange={setOpen}
          scope={scope}
          submissao={submissao}
          ocId={ocId}
          title={title}
        />
      ) : (
        <ChinaUnifiedTimeline open={open} onOpenChange={setOpen} scope={scope} title={title} />
      )}
    </>
  );
}
