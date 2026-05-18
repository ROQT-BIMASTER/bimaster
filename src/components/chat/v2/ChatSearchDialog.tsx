/**
 * ChatSearchDialog — busca global em mensagens do chat corporativo.
 *
 * Abre via botão de busca no ChatSidebar (ou atalho de teclado). Resultados
 * agrupados por conversa, ordenados por rank do tsvector. Click num
 * resultado fecha o dialog e navega o usuário pra essa conversa (passando
 * o id pra parent via onSelectConversa).
 */
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Loader2, Users, MessageSquare } from "lucide-react";
import { useChatSearch } from "@/hooks/chat/useChatSearch";
import { useConversas } from "@/hooks/chat/useConversas";
import { useAuth } from "@/contexts/AuthContext";
import { initials, nomeConversa, formatRelativo } from "./utils";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelectConversa: (id: string) => void;
}

/** Renderiza o headline do FTS — Postgres devolve com `<<...>>` envolvendo os
 *  termos que casaram. Convertemos pros tokens em <mark>. */
function HighlightedHeadline({ raw }: { raw: string }) {
  const parts = raw.split(/(<<[^>]*>>)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("<<") && p.endsWith(">>") ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-500/40 text-foreground rounded px-0.5">
            {p.slice(2, -2)}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function ChatSearchDialog({ open, onOpenChange, onSelectConversa }: Props) {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const [query, setQuery] = useState("");
  const { data: hits = [], isFetching } = useChatSearch(query);
  const { data: conversas = [] } = useConversas();

  // Lookup de conversa por id pra mostrar nome/avatar no resultado
  const conversaMap = useMemo(
    () => new Map(conversas.map((c) => [c.id, c])),
    [conversas],
  );

  const handleSelect = (conversaId: string) => {
    onSelectConversa(conversaId);
    onOpenChange(false);
    setQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setQuery(""); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-4 w-4" /> Buscar nas mensagens
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder='Ex: "fatura abril" ou prazo -atrasada'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <p className="text-[11px] text-muted-foreground -mt-2">
          Busca em todas as conversas. Suporta aspas pra frase exata e <code>-palavra</code> pra excluir.
        </p>

        <ScrollArea className="h-96 rounded-md border">
          {query.trim().length < 2 ? (
            <p className="p-8 text-center text-xs text-muted-foreground">
              Digite ao menos 2 caracteres para buscar.
            </p>
          ) : isFetching ? (
            <div className="p-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Buscando...
            </div>
          ) : hits.length === 0 ? (
            <p className="p-8 text-center text-xs text-muted-foreground">
              Nenhum resultado.
            </p>
          ) : (
            <ul className="py-1">
              {hits.map((hit) => {
                const conv = conversaMap.get(hit.conversa_id);
                const isGrupo = conv?.tipo === "group" || conv?.tipo === "grupo";
                const isMine = hit.remetente_id === uid;
                return (
                  <li key={hit.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(hit.conversa_id)}
                      className="w-full px-3 py-2.5 flex items-start gap-3 hover:bg-muted text-left transition-colors"
                    >
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={conv?.avatar_url ?? conv?.outroUsuario?.avatar_url ?? undefined} />
                        <AvatarFallback className={cn(isGrupo ? "bg-primary/15 text-primary" : "")}>
                          {isGrupo
                            ? <Users className="h-3.5 w-3.5" />
                            : conv?.outroUsuario
                              ? initials(conv.outroUsuario.nome, conv.outroUsuario.email)
                              : <MessageSquare className="h-3.5 w-3.5" />}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="text-xs font-semibold truncate">
                            {conv ? nomeConversa(conv) : "Conversa"}
                          </span>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {formatRelativo(hit.created_at)}
                          </span>
                        </div>
                        <p className="text-sm leading-snug line-clamp-2 break-words">
                          {isMine && <span className="text-muted-foreground text-xs mr-1">Você:</span>}
                          <HighlightedHeadline raw={hit.headline || hit.conteudo} />
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
