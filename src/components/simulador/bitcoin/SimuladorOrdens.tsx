import { format } from "date-fns";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters";
import { formatBtc, type MarketTrade, type Order } from "@/lib/simulador/btcMarketEngine";

interface Props {
  openOrders: Order[];
  history: Order[];
  trades: MarketTrade[];
  onCancel: (id: string) => void;
}

const SIDE_LABEL: Record<Order["side"], string> = { buy: "Compra", sell: "Venda" };
const TYPE_LABEL: Record<Order["type"], string> = { market: "Mercado", limit: "Limite" };
const STATUS_LABEL: Record<Order["status"], string> = { filled: "Executada", open: "Aberta", cancelled: "Cancelada" };

function SideBadge({ side }: { side: Order["side"] }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 border-0 px-1.5 text-[10px]",
        side === "buy" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
      )}
    >
      {SIDE_LABEL[side]}
    </Badge>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="py-10 text-center text-sm text-muted-foreground">{text}</div>;
}

export function SimuladorOrdens({ openOrders, history, trades, onCancel }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <Tabs defaultValue="open">
        <div className="border-b border-border px-3 pt-2">
          <TabsList className="h-8 bg-transparent p-0">
            <TabsTrigger value="open" className="h-8 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
              Ordens abertas ({openOrders.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="h-8 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
              Histórico de ordens ({history.length})
            </TabsTrigger>
            <TabsTrigger value="trades" className="h-8 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
              Negociações do mercado
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="open" className="m-0">
          {openOrders.length === 0 ? (
            <Empty text="Nenhuma ordem limitada aberta." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead>Data</TableHead>
                  <TableHead>Lado</TableHead>
                  <TableHead className="text-right">Preço limite</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {openOrders.map((o) => (
                  <TableRow key={o.id} className="font-mono text-xs tabular-nums">
                    <TableCell className="font-sans">{format(o.createdAt, "dd/MM HH:mm:ss")}</TableCell>
                    <TableCell><SideBadge side={o.side} /></TableCell>
                    <TableCell className="text-right">{formatCurrency(o.price)}</TableCell>
                    <TableCell className="text-right">{formatBtc(o.amount)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(o.total)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onCancel(o.id)}>
                        <X className="mr-1 h-3 w-3" /> Cancelar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="history" className="m-0 max-h-[360px] overflow-auto">
          {history.length === 0 ? (
            <Empty text="Você ainda não fez nenhuma operação. Use o painel ao lado para comprar ou vender." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead>Data</TableHead>
                  <TableHead>Lado</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">Taxa</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((o) => (
                  <TableRow key={o.id} className="font-mono text-xs tabular-nums">
                    <TableCell className="font-sans">{format(o.filledAt ?? o.cancelledAt ?? o.createdAt, "dd/MM HH:mm:ss")}</TableCell>
                    <TableCell><SideBadge side={o.side} /></TableCell>
                    <TableCell className="font-sans">{TYPE_LABEL[o.type]}</TableCell>
                    <TableCell className="text-right">{formatCurrency(o.price)}</TableCell>
                    <TableCell className="text-right">{formatBtc(o.amount)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{o.status === "filled" ? formatCurrency(o.fee) : "—"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(o.total)}</TableCell>
                    <TableCell className="font-sans">
                      <Badge variant={o.status === "filled" ? "secondary" : "outline"} className="h-5 px-1.5 text-[10px]">
                        {STATUS_LABEL[o.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="trades" className="m-0 max-h-[360px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead>Hora</TableHead>
                <TableHead className="text-right">Preço (BRL)</TableHead>
                <TableHead className="text-right">Quantidade (BTC)</TableHead>
                <TableHead className="text-right">Total (BRL)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trades.map((t) => (
                <TableRow key={t.id} className="font-mono text-xs tabular-nums">
                  <TableCell className="font-sans text-muted-foreground">{format(t.time, "HH:mm:ss")}</TableCell>
                  <TableCell className={cn("text-right", t.side === "buy" ? "text-success" : "text-destructive")}>
                    {formatCurrency(t.price)}
                  </TableCell>
                  <TableCell className="text-right">{formatBtc(t.amount, 6)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatCurrency(t.price * t.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </div>
  );
}
