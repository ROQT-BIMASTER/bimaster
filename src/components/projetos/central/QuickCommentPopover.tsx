import { useState, useRef, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MAX_LEN = 1000;

interface Props {
  tarefaId: string;
  count: number;
  /** Compacto para uso dentro do ListRow (ícone discreto). */
  compact?: boolean;
}

/**
 * Popover de comentário rápido por tarefa. Permite o usuário registrar
 * contexto (até 1000 chars) sem abrir a tela completa de detalhe. Salva
 * em `projeto_tarefa_messages` (RLS já cobre membros do projeto).
 */
export function QuickCommentPopover({ tarefaId, count, compact = true }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      // pequena espera para o popover renderizar
      setTimeout(() => textareaRef.current?.focus(), 50);
    } else {
      setValue("");
    }
  }, [open]);

  const sendMessage = useMutation({
    mutationFn: async () => {
      const conteudo = value.trim();
      if (!conteudo) throw new Error("Comentário vazio");
      if (conteudo.length > MAX_LEN) throw new Error("Comentário muito longo");
      const { error } = await supabase.from("projeto_tarefa_messages" as any).insert({
        tarefa_id: tarefaId,
        user_id: user!.id,
        conteudo,
        mentions: [],
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comentário registrado");
      queryClient.invalidateQueries({ queryKey: ["tarefa-message-counts"] });
      queryClient.invalidateQueries({ queryKey: ["minha-tarefa-messages", tarefaId] });
      setOpen(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Não foi possível salvar o comentário");
    },
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (value.trim()) sendMessage.mutate();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          aria-label={count > 0 ? `${count} comentários — abrir comentário rápido` : "Adicionar comentário rápido"}
          className={cn(
            "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs transition-colors hover:bg-muted",
            count > 0 ? "text-foreground" : "text-muted-foreground/60 opacity-0 group-hover:opacity-100",
            compact ? "h-6" : "h-8",
          )}
        >
          <MessageSquare className={cn("shrink-0", count > 0 ? "h-3.5 w-3.5 fill-current/10" : "h-3.5 w-3.5")} />
          {count > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px] font-medium">
              {count}
            </Badge>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[360px] p-3"
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-foreground">Comentário rápido</p>
          {count > 0 && (
            <span className="text-[10px] text-muted-foreground">{count} já registrado{count > 1 ? "s" : ""}</span>
          )}
        </div>
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, MAX_LEN))}
          onKeyDown={handleKeyDown}
          placeholder="Adicione contexto, dúvida ou próximo passo..."
          className="min-h-[88px] text-sm resize-none"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[10px] text-muted-foreground">
            Ctrl+Enter envia · Esc fecha · {value.length}/{MAX_LEN}
          </span>
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={() => sendMessage.mutate()}
            disabled={!value.trim() || sendMessage.isPending}
          >
            {sendMessage.isPending ? "Enviando..." : "Enviar"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
