import { useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ReactMarkdown from "react-markdown";
import { NovidadeMidia } from "./NovidadeMidia";
import type { Novidade } from "@/hooks/useNovidades";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: Novidade[];
}

/** Histórico completo de novidades, agrupado por versão. */
export function NovidadesHistorico({ open, onOpenChange, items }: Props) {
  const grupos = useMemo(() => {
    const map = new Map<string, Novidade[]>();
    items.forEach((n) => {
      const chave = n.versao ? `Versão ${n.versao}` : "Sem versão";
      map.set(chave, [...(map.get(chave) ?? []), n]);
    });
    return Array.from(map.entries());
  }, [items]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Histórico de novidades</DialogTitle>
          <DialogDescription>Todas as atualizações publicadas no sistema.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] pr-3">
          <div className="space-y-6">
            {grupos.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma novidade publicada até o momento.</p>
            )}
            {grupos.map(([versao, lista]) => (
              <section key={versao} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{versao}</Badge>
                  {lista[0]?.publicado_em && (
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(lista[0].publicado_em), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  )}
                </div>
                {lista.map((n) => (
                  <article key={n.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">{n.titulo}</h3>
                    {n.midia_url && n.midia_tipo && (
                      <NovidadeMidia path={n.midia_url} tipo={n.midia_tipo} titulo={n.titulo} />
                    )}
                    <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
                      <ReactMarkdown>{n.descricao}</ReactMarkdown>
                    </div>
                  </article>
                ))}
              </section>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
