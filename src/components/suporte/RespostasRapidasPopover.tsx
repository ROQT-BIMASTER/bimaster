import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Zap, Search, Loader2, Settings2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Macro {
  id: string;
  escopo: "global" | "fila" | "usuario";
  fila_id: string | null;
  atalho: string | null;
  titulo: string;
  conteudo: string;
}

interface TicketCtx {
  protocolo: string | null;
  titulo: string | null;
  fila_nome: string | null;
  solicitante_nome: string | null;
  responsavel_nome: string | null;
}

interface Props {
  conversaId: string;
  onPick: (texto: string) => void;
  /** Callback opcional para abrir gerenciamento de macros. */
  onGerenciar?: () => void;
}

export function RespostasRapidasPopover({ conversaId, onPick, onGerenciar }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  // Descobre se essa conversa é um ticket de suporte e o contexto para variáveis
  const { data: ticketCtx } = useQuery({
    queryKey: ["ticket-ctx", conversaId],
    enabled: open && !!conversaId,
    queryFn: async (): Promise<{ fila_id: string | null; ctx: TicketCtx } | null> => {
      const { data } = await (supabase as any)
        .from("suporte_tickets")
        .select("fila_id, protocolo, titulo, requester_id, assignee_id, suporte_filas(nome)")
        .eq("conversa_id", conversaId)
        .maybeSingle();
      if (!data) return null;
      // Nomes de requester/assignee
      const ids = [data.requester_id, data.assignee_id].filter(Boolean) as string[];
      let nomes = new Map<string, string>();
      if (ids.length) {
        const { data: profs } = await (supabase as any)
          .from("profiles")
          .select("id, nome_completo")
          .in("id", ids);
        (profs ?? []).forEach((p: any) => nomes.set(p.id, p.nome_completo));
      }
      return {
        fila_id: data.fila_id,
        ctx: {
          protocolo: data.protocolo,
          titulo: data.titulo,
          fila_nome: data.suporte_filas?.nome ?? null,
          solicitante_nome: data.requester_id ? nomes.get(data.requester_id) ?? null : null,
          responsavel_nome: data.assignee_id ? nomes.get(data.assignee_id) ?? null : null,
        },
      };
    },
  });

  const { data: macros = [], isLoading } = useQuery({
    queryKey: ["suporte-macros", ticketCtx?.fila_id ?? "none"],
    enabled: open,
    queryFn: async (): Promise<Macro[]> => {
      const { data, error } = await (supabase as any)
        .from("suporte_respostas_rapidas")
        .select("id, escopo, fila_id, atalho, titulo, conteudo")
        .eq("ativo", true)
        .order("escopo")
        .order("ordem")
        .order("titulo");
      if (error) throw error;
      // Filtro no cliente: mostra apenas globais + fila do ticket + pessoais
      return (data ?? []).filter((m: Macro) => {
        if (m.escopo === "global" || m.escopo === "usuario") return true;
        if (m.escopo === "fila") return ticketCtx?.fila_id && m.fila_id === ticketCtx.fila_id;
        return false;
      });
    },
  });

  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return macros;
    return macros.filter(
      (m) =>
        m.titulo.toLowerCase().includes(t) ||
        (m.atalho ?? "").toLowerCase().includes(t) ||
        m.conteudo.toLowerCase().includes(t),
    );
  }, [macros, q]);

  const resolverVariaveis = (texto: string): string => {
    const ctx = ticketCtx?.ctx;
    return texto
      .replaceAll("{{protocolo}}", ctx?.protocolo ?? "")
      .replaceAll("{{titulo}}", ctx?.titulo ?? "")
      .replaceAll("{{fila}}", ctx?.fila_nome ?? "")
      .replaceAll("{{solicitante}}", ctx?.solicitante_nome ?? "")
      .replaceAll("{{responsavel}}", ctx?.responsavel_nome ?? "")
      .replaceAll("{{data}}", format(new Date(), "dd/MM/yyyy", { locale: ptBR }));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 shrink-0"
          title="Respostas rápidas / macros"
          aria-label="Respostas rápidas"
        >
          <Zap className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-[420px] p-0">
        <div className="px-3 pt-3 pb-2 border-b flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por título, atalho ou conteúdo…"
              className="pl-7 h-8 text-xs"
            />
          </div>
          {onGerenciar && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0"
              onClick={() => {
                setOpen(false);
                onGerenciar();
              }}
              title="Gerenciar macros"
              aria-label="Gerenciar macros"
            >
              <Settings2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <div className="max-h-[360px] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : filtradas.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              {macros.length === 0
                ? "Nenhuma macro cadastrada."
                : "Nenhuma macro encontrada."}
            </div>
          ) : (
            <ul className="divide-y">
              {filtradas.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(resolverVariaveis(m.conteudo));
                      setOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium truncate">{m.titulo}</span>
                      {m.atalho && (
                        <Badge variant="outline" className="text-[9px] font-mono">
                          {m.atalho}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={`text-[9px] ${
                          m.escopo === "global"
                            ? "bg-blue-500/10 text-blue-700 border-blue-500/20"
                            : m.escopo === "fila"
                              ? "bg-primary/10 text-primary border-primary/20"
                              : "bg-muted"
                        }`}
                      >
                        {m.escopo === "global"
                          ? "Global"
                          : m.escopo === "fila"
                            ? "Departamento"
                            : "Pessoal"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap">
                      {resolverVariaveis(m.conteudo)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="px-3 py-2 border-t text-[10px] text-muted-foreground">
          Variáveis: <code>{"{{protocolo}}"}</code> <code>{"{{titulo}}"}</code>{" "}
          <code>{"{{solicitante}}"}</code> <code>{"{{responsavel}}"}</code>{" "}
          <code>{"{{fila}}"}</code> <code>{"{{data}}"}</code>
        </div>
      </PopoverContent>
    </Popover>
  );
}
