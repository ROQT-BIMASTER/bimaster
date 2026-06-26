import { AlertTriangle, Zap } from "lucide-react";
import { format } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import type { PedidoFornecedor } from "@/hooks/fornecedor/useFornecedorPedidos";
import { usePedidoItens } from "@/hooks/fornecedor/usePedidoItens";
import { formatTempoEtapa, getEtapaTheme } from "./etapaTheme";

interface PedidoDetalheDrawerProps {
  pedido: PedidoFornecedor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  limiarParado?: number;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  const parsed = parseLocalDate(d);
  return parsed ? format(parsed, "dd/MM/yyyy") : "—";
}

function InfoRow({ label, value, valueClassName }: { label: string; value: React.ReactNode; valueClassName?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-medium text-foreground", valueClassName)}>{value}</span>
    </div>
  );
}

export function PedidoDetalheDrawer({ pedido, open, onOpenChange, limiarParado = 2 }: PedidoDetalheDrawerProps) {
  const { data: itens, isLoading, error } = usePedidoItens(pedido?.futura_pedido_id, open);

  const theme = pedido ? getEtapaTheme(pedido.etapa) : null;
  const dias = pedido?.dias_na_etapa ?? 0;
  const parado = !!pedido?.em_andamento && dias > limiarParado;
  const somaItens = (itens ?? []).reduce((acc, i) => acc + Number(i.total_item ?? 0), 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
        {pedido && (
          <>
            <SheetHeader className="px-6 py-4 border-b border-border space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <SheetTitle className="text-base truncate text-left">
                    {pedido.cliente_nome ?? "Cliente não informado"}
                  </SheetTitle>
                  <SheetDescription className="text-xs text-left">
                    Pedido Nº {pedido.nro_pedido ?? pedido.futura_pedido_id}
                    {pedido.cliente_cnpj_cpf ? ` · ${pedido.cliente_cnpj_cpf}` : ""}
                  </SheetDescription>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {pedido.urgente && (
                    <Badge variant="destructive" className="gap-1">
                      <Zap className="h-3 w-3" /> Urgente
                    </Badge>
                  )}
                  {theme && (
                    <Badge variant="outline" className={cn("font-normal", theme.badge)}>
                      {theme.label}
                    </Badge>
                  )}
                </div>
              </div>
            </SheetHeader>

            <ScrollArea className="flex-1">
              <div className="px-6 py-5 space-y-6">
                {/* Resumo */}
                <section className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <InfoRow label="Emissão" value={fmtDate(pedido.data_emissao)} />
                  <InfoRow label="Previsão" value={fmtDate(pedido.data_previsao)} />
                  <InfoRow label="Vendedor" value={pedido.vendedor_nome ?? "—"} />
                  <InfoRow label="Situação" value={pedido.situacao_desc ?? "—"} />
                  <InfoRow
                    label="Tempo na etapa"
                    value={
                      <span className={cn("flex items-center gap-1", parado && "text-destructive")}>
                        {parado && <AlertTriangle className="h-3 w-3" />}
                        {formatTempoEtapa(pedido.dias_na_etapa)}
                      </span>
                    }
                  />
                  <InfoRow
                    label="Condição de pagamento"
                    value={pedido.cond_pagto_desc ?? "—"}
                    valueClassName="text-primary"
                  />
                </section>

                {/* Totais */}
                <section className="grid grid-cols-3 gap-3 rounded-md border border-border bg-muted/30 p-3">
                  <InfoRow label="Total produtos" value={formatCurrency(pedido.total_produto ?? 0)} />
                  <InfoRow label="Desconto" value={formatCurrency(pedido.total_desconto ?? 0)} />
                  <InfoRow
                    label="Total pedido"
                    value={formatCurrency(pedido.total_pedido ?? 0)}
                    valueClassName="text-base"
                  />
                </section>

                {/* Itens */}
                <section className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">
                      Itens do pedido {itens ? `(${itens.length})` : ""}
                    </h3>
                  </div>

                  {isLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-9 w-full" />
                      ))}
                    </div>
                  ) : error ? (
                    <EmptyState
                      title="Erro ao carregar itens"
                      description={(error as Error).message}
                    />
                  ) : !itens || itens.length === 0 ? (
                    <EmptyState
                      title="Sem itens registrados"
                      description="Este pedido ainda não tem itens espelhados do ERP."
                    />
                  ) : (
                    <div className="border border-border rounded-md overflow-hidden">
                      <Table minWidthClass="min-w-[640px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">#</TableHead>
                            <TableHead>Cód.</TableHead>
                            <TableHead>EAN</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead className="text-right">Qtd</TableHead>
                            <TableHead className="text-right">Vlr unit.</TableHead>
                            <TableHead className="text-right">Desc.</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {itens.map((it) => (
                            <TableRow key={it.id}>
                              <TableCell className="text-muted-foreground">{it.sequencia ?? "—"}</TableCell>
                              <TableCell className="font-mono text-xs">{it.cod_produto ?? "—"}</TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">
                                {it.ean ?? "—"}
                              </TableCell>
                              <TableCell className="max-w-[260px] truncate">{it.descricao ?? "—"}</TableCell>
                              <TableCell className="text-right whitespace-nowrap">
                                {Number(it.quantidade ?? 0).toLocaleString("pt-BR", {
                                  maximumFractionDigits: 4,
                                })}
                              </TableCell>
                              <TableCell className="text-right whitespace-nowrap">
                                {formatCurrency(Number(it.valor_unitario ?? 0))}
                              </TableCell>
                              <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                                {formatCurrency(Number(it.desconto_valor ?? 0))}
                              </TableCell>
                              <TableCell className="text-right whitespace-nowrap font-medium">
                                {formatCurrency(Number(it.total_item ?? 0))}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        <TableFooter>
                          <TableRow>
                            <TableCell colSpan={7} className="text-right text-xs text-muted-foreground">
                              Soma dos itens
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatCurrency(somaItens)}
                            </TableCell>
                          </TableRow>
                        </TableFooter>
                      </Table>
                    </div>
                  )}
                </section>

                {pedido.observacao && (
                  <section className="space-y-1">
                    <h3 className="text-sm font-semibold text-foreground">Observação</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{pedido.observacao}</p>
                  </section>
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
