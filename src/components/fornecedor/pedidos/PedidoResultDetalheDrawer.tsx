import { useEffect, useState } from "react";
import { AlertTriangle, FileText, Maximize2, Minimize2, MapPin } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { supabase } from "@/integrations/supabase/client";
import type { PedidoFornecedor } from "@/hooks/fornecedor/useFornecedorPedidos";
import { useRubyspPedidoItens } from "@/hooks/fornecedor/useRubyspPedidoItens";
import { formatTempoEtapa, getEtapaTheme } from "./etapaTheme";

interface Props {
  pedido: (PedidoFornecedor & { tem_canhoto?: boolean }) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  limiarParado?: number;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  const parsed = parseLocalDate(d);
  return parsed ? format(parsed, "dd/MM/yyyy") : "—";
}

function formatCep(cep: string | null | undefined) {
  if (!cep) return "";
  const digits = cep.replace(/\D/g, "");
  if (digits.length === 8) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return cep;
}

function InfoRow({ label, value, valueClassName }: { label: string; value: React.ReactNode; valueClassName?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-medium text-foreground", valueClassName)}>{value}</span>
    </div>
  );
}

export function PedidoResultDetalheDrawer({ pedido, open, onOpenChange, limiarParado = 2 }: Props) {
  const rubyspId = pedido?.futura_pedido_id ?? null;
  const { data: itens, isLoading, error } = useRubyspPedidoItens(rubyspId, open);
  const [fullscreen, setFullscreen] = useState(false);
  const [solicitando, setSolicitando] = useState(false);

  useEffect(() => {
    if (!open) setFullscreen(false);
  }, [open]);

  const theme = pedido ? getEtapaTheme(pedido.etapa) : null;
  const dias = pedido?.dias_na_etapa ?? 0;
  const parado = !!pedido?.em_andamento && dias > limiarParado;
  const somaItens = (itens ?? []).reduce((acc, i) => acc + Number(i.total_item ?? 0), 0);

  const solicitarCanhoto = async () => {
    if (!rubyspId) return;
    setSolicitando(true);
    try {
      const { error: rpcErr } = await (supabase as any).rpc("solicitar_canhoto_rubysp", {
        p_rubysp_pedido_id: rubyspId,
      });
      if (rpcErr) throw rpcErr;
      toast.success("Canhoto solicitado. Estará disponível em breve.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao solicitar canhoto");
    } finally {
      setSolicitando(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "p-0 flex flex-col transition-[max-width,width] duration-200",
          fullscreen ? "w-screen max-w-none sm:max-w-none" : "w-full sm:max-w-4xl lg:max-w-5xl",
        )}
      >
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
                    {pedido.nf_numero != null && (
                      <> · <span className="text-foreground font-medium">NF {pedido.nf_numero}</span></>
                    )}
                    {pedido.cliente_cnpj_cpf ? ` · ${pedido.cliente_cnpj_cpf}` : ""}
                  </SheetDescription>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {pedido.tem_canhoto && (
                    <Badge variant="outline" className="gap-1">
                      <FileText className="h-3 w-3" /> Canhoto disponível
                    </Badge>
                  )}
                  {theme && (
                    <Badge variant="outline" className={cn("font-normal", theme.badge)}>
                      {theme.label}
                    </Badge>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={solicitarCanhoto}
                    disabled={solicitando}
                    title="Enfileirar coleta do canhoto eletrônico"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">
                      {pedido.tem_canhoto ? "Atualizar canhoto" : "Solicitar canhoto"}
                    </span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setFullscreen((v) => !v)}
                    aria-label={fullscreen ? "Sair de tela cheia" : "Expandir para tela cheia"}
                  >
                    {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </SheetHeader>

            <ScrollArea className="flex-1">
              <div className="px-6 py-5 space-y-6">
                <section className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <InfoRow label="Emissão" value={fmtDate(pedido.data_emissao)} />
                  <InfoRow label="Previsão de entrega" value={fmtDate(pedido.data_previsao)} />
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

                <section className="grid grid-cols-1 gap-3 rounded-md border border-border bg-muted/30 p-3">
                  <InfoRow
                    label="Total pedido"
                    value={formatCurrency(pedido.total_pedido ?? 0)}
                    valueClassName="text-base"
                  />
                </section>

                <section className="rounded-md border border-border p-3 space-y-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 text-sm">
                      {pedido.endereco_entrega ? (
                        <span className="text-foreground">
                          {pedido.endereco_entrega}
                          {pedido.endereco_cep && (
                            <span className="text-muted-foreground">
                              {" · CEP "}
                              {formatCep(pedido.endereco_cep)}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Endereço não informado</span>
                      )}
                    </div>
                  </div>
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    Itens do pedido {itens ? `(${itens.length})` : ""}
                  </h3>

                  {isLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-9 w-full" />
                      ))}
                    </div>
                  ) : error ? (
                    <EmptyState title="Erro ao carregar itens" description={(error as Error).message} />
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
                            <TableHead>Un.</TableHead>
                            <TableHead className="text-right">Qtd</TableHead>
                            <TableHead className="text-right">Preço</TableHead>
                            <TableHead className="text-right">Desc.</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {itens.map((it) => (
                            <TableRow key={it.id}>
                              <TableCell className="text-muted-foreground">{it.sequencia ?? "—"}</TableCell>
                              <TableCell className="font-mono text-xs">{it.produto_id ?? "—"}</TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">{it.ean ?? "—"}</TableCell>
                              <TableCell className="max-w-[260px] truncate">{it.descricao ?? "—"}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{it.unidade ?? "—"}</TableCell>
                              <TableCell className="text-right whitespace-nowrap">
                                {Number(it.quantidade ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}
                              </TableCell>
                              <TableCell className="text-right whitespace-nowrap">
                                {formatCurrency(Number(it.preco ?? 0))}
                              </TableCell>
                              <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                                {formatCurrency(Number(it.desconto ?? 0))}
                              </TableCell>
                              <TableCell className="text-right whitespace-nowrap font-medium">
                                {formatCurrency(Number(it.total_item ?? 0))}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        <TableFooter>
                          <TableRow>
                            <TableCell colSpan={8} className="text-right text-xs text-muted-foreground">
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
