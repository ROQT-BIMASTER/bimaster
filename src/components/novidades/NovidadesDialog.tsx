import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { NovidadeMidia } from "./NovidadeMidia";
import type { Novidade } from "@/hooks/useNovidades";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: Novidade[];
  /** Chamado ao fechar, com os IDs exibidos, para registrar leitura. */
  onConcluir?: (ids: string[]) => void;
}

/**
 * Modal "Novidades": apresenta as mudanças da versão em cards navegáveis,
 * com texto, mídia opcional e atalho para a tela correspondente.
 */
export function NovidadesDialog({ open, onOpenChange, items, onConcluir }: Props) {
  const navigate = useNavigate();
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (open) setIdx(0);
  }, [open, items.length]);

  const atual = items[Math.min(idx, Math.max(items.length - 1, 0))];
  const ids = useMemo(() => items.map((i) => i.id), [items]);
  const ultimo = idx >= items.length - 1;

  if (!atual) return null;

  const fechar = () => {
    onConcluir?.(ids);
    onOpenChange(false);
  };

  const irParaTela = () => {
    if (!atual.link_destino) return;
    onConcluir?.(ids);
    onOpenChange(false);
    if (/^https?:\/\//i.test(atual.link_destino)) {
      window.location.href = atual.link_destino;
    } else {
      navigate(atual.link_destino);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : fechar())}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Novidades
          </DialogTitle>
          <DialogDescription>
            O que mudou no sistema e como usar os novos recursos.
          </DialogDescription>
        </DialogHeader>

        <article className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {atual.versao && <Badge variant="secondary">Versão {atual.versao}</Badge>}
            {atual.publicado_em && (
              <span className="text-xs text-muted-foreground">
                {format(new Date(atual.publicado_em), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </span>
            )}
          </div>

          <h2 className="text-lg font-semibold text-foreground">{atual.titulo}</h2>

          {atual.midia_url && atual.midia_tipo && (
            <NovidadeMidia path={atual.midia_url} tipo={atual.midia_tipo} titulo={atual.titulo} />
          )}

          <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
            <ReactMarkdown>{atual.descricao}</ReactMarkdown>
          </div>

          {atual.link_destino && (
            <Button variant="outline" size="sm" onClick={irParaTela}>
              Ir para a tela
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </article>

        <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {idx + 1} de {items.length}
          </span>
          <div className="flex items-center gap-2">
            {items.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIdx((i) => Math.max(0, i - 1))}
                  disabled={idx === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                {!ultimo && (
                  <Button variant="ghost" size="sm" onClick={() => setIdx((i) => i + 1)}>
                    Próximo
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
            {(ultimo || items.length === 1) && <Button onClick={fechar}>Entendi</Button>}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
