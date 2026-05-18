/**
 * ForwardMessageDialog — encaminhar mensagem para outra conversa.
 *
 * Schema já suporta: `mensagens.encaminhada_de_id` (uuid, FK pra
 * mensagem origem). Esta UI permite o usuário escolher a conversa
 * destino e dispara o insert via `sendMessage` do useChatActions.
 *
 * Escopo v1: só texto + tipo (sem copiar anexos). Anexos têm RLS de
 * storage que liga ao conversa_id origem — copiar a linha em
 * mensagens_anexos com novo mensagem_id daria erro de leitura no
 * destino. Quem precisa do anexo abre a conversa origem. Pode evoluir
 * para copy de blob entre paths num próximo PR se virar dor real.
 */
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Loader2, CornerUpRight, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConversas, filtrarConversas } from "@/hooks/chat/useConversas";
import { useChatActions } from "@/hooks/chat/useChatActions";
import { initials, nomeConversa } from "./utils";
import type { ChatMensagem } from "@/hooks/chat/types";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Mensagem a ser encaminhada. */
  m: ChatMensagem;
}

export function ForwardMessageDialog({ open, onOpenChange, m }: Props) {
  const [busca, setBusca] = useState("");
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const { data: conversas = [], isLoading } = useConversas();
  const { sendMessage } = useChatActions();

  const filtradas = useMemo(
    () => filtrarConversas(conversas, "todas", busca).filter((c) => c.id !== m.conversa_id),
    [conversas, busca, m.conversa_id],
  );

  const toggle = (id: string) => {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const enviar = async () => {
    if (selecionadas.size === 0) return toast.error("Selecione ao menos uma conversa");
    setLoading(true);
    try {
      // Envia em paralelo para todas as conversas selecionadas
      await Promise.all(
        Array.from(selecionadas).map((conversaId) =>
          sendMessage.mutateAsync({
            conversaId,
            conteudo: m.conteudo || "",
            tipo: m.tipo,
            encaminhada_de_id: m.id,
          }),
        ),
      );
      toast.success(
        selecionadas.size === 1
          ? "Mensagem encaminhada"
          : `Mensagem encaminhada para ${selecionadas.size} conversas`,
      );
      onOpenChange(false);
      setSelecionadas(new Set());
      setBusca("");
    } catch (e: any) {
      toast.error("Falha ao encaminhar: " + (e?.message ?? ""));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CornerUpRight className="h-5 w-5" /> Encaminhar mensagem
          </DialogTitle>
        </DialogHeader>

        {/* Preview da mensagem que vai ser encaminhada */}
        <div className="rounded-lg border bg-muted/40 px-3 py-2">
          <p className="text-[10px] text-muted-foreground mb-0.5">
            De {m.remetente?.nome ?? "Usuário"}:
          </p>
          <p className="text-sm line-clamp-3 whitespace-pre-wrap break-words">
            {m.conteudo || (
              <span className="italic text-muted-foreground">
                (sem texto — anexos não são encaminhados)
              </span>
            )}
          </p>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar conversa ou grupo..."
            className="pl-8 h-9"
          />
        </div>

        <p className="text-xs text-muted-foreground">
          {selecionadas.size > 0
            ? `${selecionadas.size} conversa${selecionadas.size > 1 ? "s" : ""} selecionada${selecionadas.size > 1 ? "s" : ""}`
            : "Selecione uma ou mais conversas"}
        </p>

        <ScrollArea className="h-64 rounded-md border">
          {isLoading && <p className="text-xs text-muted-foreground p-3">Carregando...</p>}
          {!isLoading && filtradas.length === 0 && (
            <p className="p-6 text-center text-xs text-muted-foreground">Nenhuma conversa</p>
          )}
          <ul className="py-1">
            {filtradas.map((c) => {
              const isGrupo = c.tipo === "group" || c.tipo === "grupo";
              const checked = selecionadas.has(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => toggle(c.id)}
                    className={cn(
                      "w-full px-3 py-2 flex items-center gap-3 hover:bg-muted text-left transition-colors",
                      checked && "bg-muted",
                    )}
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={c.avatar_url ?? c.outroUsuario?.avatar_url ?? undefined} />
                      <AvatarFallback className={cn(isGrupo ? "bg-primary/15 text-primary" : "")}>
                        {isGrupo ? <Users className="h-4 w-4" /> : initials(c.outroUsuario?.nome, c.outroUsuario?.email)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm flex-1 truncate">{nomeConversa(c)}</span>
                    {checked && (
                      <span className="text-[10px] text-primary font-semibold uppercase">Selecionada</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={loading || selecionadas.size === 0}>
            {loading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
            ) : (
              <>Encaminhar</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
