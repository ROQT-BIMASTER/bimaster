/**
 * GenericPreview — fallback para origens da inbox que ainda não têm
 * preview rico dedicado. Mantém o resumo + metadata pretty-printed e
 * exibe apenas o botão "Abrir tela" como ação primária.
 */
import type { InboxItem } from "@/hooks/useInbox";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

interface Props {
  item: InboxItem;
  onOpen: () => void;
}

export function GenericPreview({ item, onOpen }: Props) {
  const entries = Object.entries(item.metadata ?? {}).slice(0, 12);
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {item.resumo && (
          <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
            {item.resumo}
          </div>
        )}
        {entries.length > 0 && (
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
              Detalhes
            </p>
            <dl className="text-xs space-y-1">
              {entries.map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <dt className="text-muted-foreground capitalize min-w-[100px]">
                    {k.replace(/_/g, " ")}:
                  </dt>
                  <dd className="font-medium text-foreground truncate">{String(v)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
      {item.action_url && (
        <div className="border-t p-3 bg-muted/20 flex items-center justify-end">
          <Button onClick={onOpen} size="sm" className="gap-2">
            <ExternalLink className="h-4 w-4" />
            Abrir tela
          </Button>
        </div>
      )}
    </div>
  );
}
