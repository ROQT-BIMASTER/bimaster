import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, Ship, Package, Calendar, AlertTriangle, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { InboxOC } from "@/hooks/useCompradorInboxOCs";
import { statusBucket, isAtrasada, type StatusBucket } from "@/lib/compras/inboxStatus";

const STATUS_LABEL: Record<StatusBucket, string> = {
  todas: "Todas",
  pendente: "Pendente",
  producao: "Em produção",
  patio: "Pátio",
  embarcada: "Embarcada",
  transito: "Em trânsito",
  recebida: "Recebida",
  atrasada: "Atrasada",
  divergencia: "Divergência",
};

interface Props {
  oc: InboxOC | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenReader: (ocId: string) => void;
}

function fmt(d: string | null) {
  const x = parseLocalDate(d);
  return x ? format(x, "dd/MM/yyyy", { locale: ptBR }) : "—";
}

export function OCDetailDrawer({ oc, open, onOpenChange, onOpenReader }: Props) {
  const { data: detalhes, isLoading } = useQuery({
    enabled: open && !!oc?.ordem_compra_id,
    queryKey: ["oc-drawer", oc?.ordem_compra_id],
    queryFn: async () => {
      const ocId = oc!.ordem_compra_id;
      const [embarques, itens, ncs] = await Promise.all([
        supabase
          .from("china_embarques" as any)
          .select("id, status, numero_container, numero_bl, data_embarque, data_eta, data_chegada_porto, navio, porto_origem, porto_destino")
          .eq("ordem_compra_id", ocId)
          .order("data_embarque", { ascending: false }),
        supabase
          .from("china_ordem_itens" as any)
          .select("id, sku, cor_nome, qty_pedida, qty_produzida, qty_embarcada, qty_recebida, qty_cancelada")
          .eq("ordem_compra_id", ocId)
          .order("cor_nome"),
        supabase
          .from("china_nao_conformidades" as any)
          .select("id, numero_nc, tipo, severidade, status, descricao, created_at")
          .eq("ordem_compra_id", ocId)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      return {
        embarques: (embarques.data || []) as any[],
        itens: (itens.data || []) as any[],
        ncs: (ncs.data || []) as any[],
      };
    },
  });

  if (!oc) return null;
  const bucket = statusBucket(oc);
  const atrasada = isAtrasada(oc);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="px-5 py-4 border-b">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle className="flex items-center gap-2 text-base">
                <span className="tabular-nums">{oc.numero_oc}</span>
                <Badge variant="outline" className="text-[10px]">{STATUS_LABEL[bucket]}</Badge>
                {atrasada && <Badge variant="destructive" className="text-[10px]">Atrasada</Badge>}
              </SheetTitle>
              <SheetDescription className="text-xs">
                {oc.produto_codigo} · {oc.produto_nome}
              </SheetDescription>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onOpenReader(oc.ordem_compra_id)}>
              <ExternalLink className="h-3.5 w-3.5" /> Abrir reader
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-5 space-y-4">
            {/* Resumo quantidades */}
            <Card className="p-3">
              <div className="text-[10px] uppercase text-muted-foreground mb-2 flex items-center gap-1">
                <Package className="h-3 w-3" /> Quantidades
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <Qty label="Pedido" value={oc.qty_pedida} />
                <Qty label="Produzido" value={oc.qty_produzida} />
                <Qty label="Embarcado" value={oc.qty_embarcada} />
                <Qty label="Recebido" value={oc.qty_recebida} className="text-emerald-600 dark:text-emerald-400" />
                <Qty label="Saldo aberto" value={oc.saldo_aberto} />
                <Qty label="Avaria" value={oc.qty_avariada} className={oc.qty_avariada > 0 ? "text-destructive" : ""} />
              </div>
            </Card>

            {/* Datas */}
            <Card className="p-3">
              <div className="text-[10px] uppercase text-muted-foreground mb-2 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Datas-chave
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <Info label="Emissão" value={fmt(oc.data_emissao)} />
                <Info label="ETA" value={fmt(oc.data_entrega_prevista)} highlight={atrasada} />
                <Info label="Chegada porto" value={fmt(oc.data_chegada_porto)} />
                <Info label="Desembaraço" value={fmt(oc.data_desembaraco)} />
                <Info label="Recebimento CD" value={fmt(oc.data_recebimento_cd)} />
                <Info label="Última movimentação" value={fmt(oc.ultima_movimentacao)} />
              </div>
            </Card>

            {/* OPs vinculadas */}
            <Card className="p-3">
              <div className="text-[10px] uppercase text-muted-foreground mb-2">Ordens de Produção (OPs)</div>
              {oc.ops_numeros.length === 0 ? (
                <div className="text-xs text-muted-foreground">Sem OPs vinculadas.</div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {oc.ops_numeros.map((n) => (
                    <Badge key={n} variant="secondary" className="text-[10px]">{n}</Badge>
                  ))}
                </div>
              )}
            </Card>

            {/* Embarques */}
            <Card className="p-3">
              <div className="text-[10px] uppercase text-muted-foreground mb-2 flex items-center gap-1">
                <Ship className="h-3 w-3" /> Embarques / Containers
              </div>
              {isLoading ? (
                <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              ) : !detalhes?.embarques.length ? (
                <div className="text-xs text-muted-foreground">Nenhum embarque registrado.</div>
              ) : (
                <div className="space-y-2">
                  {detalhes.embarques.map((e) => (
                    <div key={e.id} className="rounded-md border p-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium tabular-nums">{e.numero_container || "Sem container"}</div>
                        <Badge variant="outline" className="text-[10px]">{e.status}</Badge>
                      </div>
                      <div className="mt-1 grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
                        {e.numero_bl && <div>BL: <span className="text-foreground">{e.numero_bl}</span></div>}
                        {e.navio && <div>Navio: <span className="text-foreground">{e.navio}</span></div>}
                        {e.porto_origem && <div>Origem: <span className="text-foreground">{e.porto_origem}</span></div>}
                        {e.porto_destino && <div>Destino: <span className="text-foreground">{e.porto_destino}</span></div>}
                        <div>Embarque: <span className="text-foreground">{fmt(e.data_embarque)}</span></div>
                        <div>ETA: <span className="text-foreground">{fmt(e.data_eta)}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Itens / SKUs */}
            <Card className="p-3">
              <div className="text-[10px] uppercase text-muted-foreground mb-2">Itens / SKUs</div>
              {isLoading ? (
                <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              ) : !detalhes?.itens.length ? (
                <div className="text-xs text-muted-foreground">Sem itens cadastrados.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead className="text-[10px] uppercase text-muted-foreground border-b">
                      <tr>
                        <th className="text-left py-1">SKU/Cor</th>
                        <th className="text-right py-1">Ped</th>
                        <th className="text-right py-1">Prod</th>
                        <th className="text-right py-1">Emb</th>
                        <th className="text-right py-1">Rec</th>
                        <th className="text-right py-1">Canc</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalhes.itens.map((i) => (
                        <tr key={i.id} className="border-b last:border-b-0">
                          <td className="py-1">{i.sku || "—"}{i.cor_nome ? <span className="text-muted-foreground"> · {i.cor_nome}</span> : null}</td>
                          <td className="py-1 text-right tabular-nums">{i.qty_pedida}</td>
                          <td className="py-1 text-right tabular-nums">{i.qty_produzida}</td>
                          <td className="py-1 text-right tabular-nums">{i.qty_embarcada}</td>
                          <td className="py-1 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{i.qty_recebida}</td>
                          <td className="py-1 text-right tabular-nums">{i.qty_cancelada}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* NCs */}
            {detalhes?.ncs.length ? (
              <Card className="p-3 border-destructive/30">
                <div className="text-[10px] uppercase text-destructive mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Não-conformidades
                </div>
                <div className="space-y-1.5">
                  {detalhes.ncs.map((n) => (
                    <div key={n.id} className="flex items-center justify-between gap-2 text-xs border-b last:border-b-0 py-1">
                      <div className="truncate">
                        <span className="font-medium tabular-nums">{n.numero_nc}</span>
                        <span className="text-muted-foreground"> · {n.descricao}</span>
                      </div>
                      <Badge variant={n.severidade === "alta" || n.severidade === "critica" ? "destructive" : "outline"} className="text-[10px]">
                        {n.severidade}
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}

            <Separator />
            <Button className="w-full gap-1.5" onClick={() => onOpenReader(oc.ordem_compra_id)}>
              <ExternalLink className="h-3.5 w-3.5" /> Abrir reader completo
            </Button>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function Qty({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold tabular-nums ${className || ""}`}>{(value ?? 0).toLocaleString("pt-BR")}</div>
    </div>
  );
}

function Info({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className={`tabular-nums ${highlight ? "text-destructive font-medium" : ""}`}>{value}</div>
    </div>
  );
}
