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
import { History, User, Ship, AlertTriangle, Package, Anchor, Truck, Stamp } from "lucide-react";
import { useHistoricoRecebimentosInternacional } from "@/hooks/useHistoricoRecebimentos";
import { BilingualLabel } from "@/components/china/BilingualLabel";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordemCompraId: string;
  numeroOC: string;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  recebido: "default",
  divergente: "destructive",
  parcial: "secondary",
  pendente: "outline",
};

export function HistoricoRecebimentosInternacionalSheet({
  open,
  onOpenChange,
  ordemCompraId,
  numeroOC,
}: Props) {
  const { data: recs = [], isLoading } = useHistoricoRecebimentosInternacional(
    open ? ordemCompraId : undefined,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-2xl w-full overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <BilingualLabel pt="Histórico de recebimentos" cn="收货历史" size="md" />
          </SheetTitle>
          <SheetDescription>
            OC <strong>{numeroOC}</strong> — auditoria de DI, datas, conferente e divergências por item.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 pr-3 -mr-3 mt-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-40 w-full" />
              ))}
            </div>
          ) : recs.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
              Nenhum recebimento registrado ainda.
            </Card>
          ) : (
            <div className="space-y-3 pb-6">
              {recs.map((r) => {
                const totalDiv = r.itens.reduce(
                  (s, i) =>
                    s + Math.abs(i.qty_esperada - i.qty_recebida) + i.qty_avariada + i.qty_faltante,
                  0,
                );
                return (
                  <Card key={r.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={STATUS_VARIANT[r.status] || "outline"} className="capitalize">
                          {r.status}
                        </Badge>
                        {r.numero_di && (
                          <Badge variant="secondary" className="gap-1">
                            <Ship className="h-3 w-3" />
                            DI {r.numero_di}
                          </Badge>
                        )}
                        {totalDiv > 0 && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {totalDiv} divergente
                          </Badge>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <DateBlock
                        icon={Anchor}
                        label="Porto"
                        date={r.data_chegada_porto}
                      />
                      <DateBlock
                        icon={Stamp}
                        label="Desembaraço"
                        date={r.data_desembaraco}
                      />
                      <DateBlock
                        icon={Truck}
                        label="CD"
                        date={r.data_recebimento_cd}
                      />
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      Conferente:{" "}
                      <strong className="text-foreground">
                        {r.conferente_nome || r.conferente_id?.slice(0, 8) || "—"}
                      </strong>
                    </div>

                    <div className="space-y-1.5">
                      {r.itens.map((it) => {
                        const div = it.qty_recebida - it.qty_esperada;
                        const tem_div =
                          div !== 0 || it.qty_avariada > 0 || it.qty_faltante > 0;
                        return (
                          <div
                            key={it.id}
                            className="text-xs bg-muted/40 rounded px-2 py-1.5 space-y-1"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate flex-1">
                                {it.item_descricao || "Item"}
                              </span>
                              <div className="flex items-center gap-2 ml-2 shrink-0 tabular-nums">
                                <span>
                                  <strong className="text-foreground">{it.qty_recebida}</strong>
                                  <span className="text-muted-foreground">
                                    {" "}
                                    / {it.qty_esperada}
                                  </span>
                                </span>
                                {tem_div && (
                                  <Badge
                                    variant="destructive"
                                    className="gap-1 h-5 text-[10px]"
                                  >
                                    {div !== 0 && <span>{div > 0 ? "+" : ""}{div}</span>}
                                    {it.qty_avariada > 0 && <span>av {it.qty_avariada}</span>}
                                    {it.qty_faltante > 0 && <span>fa {it.qty_faltante}</span>}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {it.motivo_divergencia && (
                              <p className="text-[10px] text-destructive italic">
                                {it.motivo_divergencia}
                              </p>
                            )}
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
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function DateBlock({
  icon: Icon,
  label,
  date,
}: {
  icon: any;
  label: string;
  date: string | null;
}) {
  return (
    <div className="bg-secondary/40 rounded p-1.5 flex items-center gap-1.5">
      <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="font-medium truncate">
          {date ? new Date(date).toLocaleDateString("pt-BR") : "—"}
        </p>
      </div>
    </div>
  );
}
