/**
 * MentionAutocomplete — popover de @ menção.
 *
 * Carrega membros ativos da conversa (via conversas_participantes +
 * chat_directory) e mostra lista filtrada conforme o usuário digita
 * após o `@`. Click em um nome notifica o caller via `onPick(member)`,
 * que é responsável por:
 *   - Substituir o `@query` no texto pelo `@Nome `
 *   - Adicionar o uuid em `mencoes` que vai com o sendMessage
 *
 * Posicionamento: o caller controla via `open` + ancora o popover acima
 * do textarea. Não tentamos calcular pixel-perfect do `@` no texto
 * (overkill pra v1; quem quiser pode mover pra absolute-positioned no
 * futuro).
 */
import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface MentionMember {
  id: string;
  nome: string | null;
  avatar_url: string | null;
}

interface Props {
  conversaId: string;
  query: string;
  onPick: (member: MentionMember) => void;
  /** ID do usuário atual — pra não autocompletar com você mesmo. */
  ownUid: string;
  className?: string;
}

export function MentionAutocomplete({ conversaId, query, onPick, ownUid, className }: Props) {
  // Membros da conversa via 2 queries: participantes ativos + diretório
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["chat-mention-members", conversaId],
    enabled: !!conversaId,
    staleTime: 60_000,
    queryFn: async (): Promise<MentionMember[]> => {
      const { data: parts } = await supabase
        .from("conversas_participantes")
        .select("usuario_id")
        .eq("conversa_id", conversaId)
        .is("saiu_em", null);
      const ids = (parts ?? []).map((p) => p.usuario_id).filter((id) => id !== ownUid);
      if (!ids.length) return [];
      const { data: profs } = await (supabase.rpc as any)(
        "get_chat_directory",
        { _ids: ids },
      );
      return (profs as unknown as MentionMember[]) ?? [];
    },
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members.slice(0, 8);
    return members
      .filter((m) => (m.nome ?? "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [members, query]);

  // Suporte a teclado (setas + Enter) opcional — caller pode estender.
  // Pra v1, só click no item.
  const listRef = useRef<HTMLDivElement>(null);

  if (isLoading) {
    return (
      <div className={cn("w-64 p-2 text-xs text-muted-foreground", className)}>
        Carregando membros...
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className={cn("w-64 p-3 text-xs text-muted-foreground text-center", className)}>
        Nenhum membro encontrado
      </div>
    );
  }

  return (
    <div className={cn("w-64", className)}>
      <ScrollArea className="max-h-56" ref={listRef as any}>
        <ul className="py-1">
          {filtered.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onPick(m)}
                className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-muted text-left"
              >
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarImage src={m.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px]">
                    {(m.nome ?? "?").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm truncate">{m.nome ?? "Usuário"}</span>
              </button>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </div>
  );
}
