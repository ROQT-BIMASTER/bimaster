import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { History, FileText, User, Calendar, AlertTriangle, Package } from "lucide-react";
import { useHistoricoRecebimentosNacional } from "@/hooks/useHistoricoRecebimentos";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compraId: string;
  numero: string;
}

export function HistoricoRecebimentosNacionalSheet({
  open,
  onOpenChange,
  compraId,
  numero,
}: Props) {
  const { data: recs = [], isLoading } = useHistoricoRecebimentosNacional(
    open ? compraId : undefined,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-2xl w-full overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Histórico de recebimentos
          </SheetTitle>
          <SheetDescription>
            Auditoria completa da compra <strong>{numero}</strong> — quem recebeu, quando, NF e divergências por item.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 pr-3 -mr-3 mt-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : recs.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
              Nenhum recebimento registrado ainda.
            </Card>
          ) : (
            <div className="space-y-3 pb-6">
              {recs.map((r) => (
                <Card key={r.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="default" className="font-mono">
                        #{r.numero_recebimento}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(r.data_recebimento).toLocaleDateString("pt-BR")}
                      </Badge>
                      {r.nota_fiscal && (
                        <Badge variant="secondary" className="gap-1">
                          <FileText className="h-3 w-3" />
                          NF {r.nota_fiscal}
                        </Badge>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    Recebido por:{" "}
                    <strong className="text-foreground">
                      {r.recebedor_nome || r.recebido_por?.slice(0, 8) || "—"}
                    </strong>
                  </div>

                  <div className="space-y-1.5">
                    {r.itens.map((it) => {
                      const tem_div = (it.divergencia ?? 0) !== 0;
                      return (
                        <div
                          key={it.id}
                          className="flex items-center justify-between text-xs bg-muted/40 rounded px-2 py-1.5"
                        >
                          <span className="truncate flex-1">
                            {it.item_descricao || "Item"}
                          </span>
                          <div className="flex items-center gap-2 ml-2 shrink-0">
                            <span className="tabular-nums">
                              <strong className="text-foreground">
                                {it.qty_recebida}
                              </strong>
                              {it.qty_pedida != null && (
                                <span className="text-muted-foreground"> / {it.qty_pedida}</span>
                              )}
                            </span>
                            {tem_div && (
                              <Badge variant="destructive" className="gap-1 h-5 text-[10px]">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                {it.divergencia! > 0 ? "+" : ""}
                                {it.divergencia}
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {r.observacoes && (
                    <div className="text-xs text-muted-foreground border-t pt-2 italic">
                      "{r.observacoes}"
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
