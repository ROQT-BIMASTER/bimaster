import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { User, MessageSquare } from "lucide-react";
import { relativeTime } from "@/lib/crm/format";

type Row = {
  kind: "contato" | "mensagem";
  id: string;
  conversa_id: string | null;
  titulo: string;
  subtitulo: string | null;
  trecho: string | null;
  rank: number;
  quando: string | null;
};

export function CrmSearchResults({
  empresaId, query, onPick,
}: {
  empresaId: number | undefined | null;
  query: string;
  onPick: (conversaId: string) => void;
}) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["crm-search", empresaId, query],
    enabled: !!empresaId && query.trim().length >= 2,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("rpc_crm_search", {
        _empresa_id: empresaId, _q: query.trim(), _limit: 30,
      });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  if (!query.trim() || query.trim().length < 2) return null;

  const contatos = data.filter(r => r.kind === "contato");
  const mensagens = data.filter(r => r.kind === "mensagem");

  return (
    <ScrollArea className="flex-1">
      {isLoading && <div className="p-4 text-center text-xs text-muted-foreground">Buscando…</div>}
      {!isLoading && data.length === 0 && (
        <div className="p-6 text-center text-xs text-muted-foreground">Nenhum resultado para "{query}"</div>
      )}
      {contatos.length > 0 && (
        <div>
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground bg-muted/40">Contatos · {contatos.length}</div>
          {contatos.map(r => (
            <button
              key={`c-${r.id}`}
              onClick={() => r.conversa_id && onPick(r.conversa_id)}
              disabled={!r.conversa_id}
              className="w-full text-left px-3 py-2 hover:bg-muted/50 flex items-start gap-2 border-b"
            >
              <User className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-foreground truncate">{r.titulo}</div>
                <div className="text-[11px] text-muted-foreground truncate">{r.subtitulo}</div>
              </div>
            </button>
          ))}
        </div>
      )}
      {mensagens.length > 0 && (
        <div>
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground bg-muted/40">Mensagens · {mensagens.length}</div>
          {mensagens.map(r => (
            <button
              key={`m-${r.id}`}
              onClick={() => r.conversa_id && onPick(r.conversa_id)}
              className="w-full text-left px-3 py-2 hover:bg-muted/50 flex items-start gap-2 border-b"
            >
              <MessageSquare className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-medium text-foreground truncate">{r.titulo}</div>
                  <div className="text-[10px] text-muted-foreground shrink-0">{r.quando ? relativeTime(r.quando) : r.subtitulo}</div>
                </div>
                <div
                  className="text-[11px] text-muted-foreground line-clamp-2 [&_mark]:bg-primary/20 [&_mark]:text-foreground [&_mark]:rounded [&_mark]:px-0.5"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(r.trecho ?? "", {
                      ALLOWED_TAGS: ["mark"],
                      ALLOWED_ATTR: [],
                    }),
                  }}
                />
              </div>
            </button>
          ))}
        </div>
      )}
    </ScrollArea>
  );
}
