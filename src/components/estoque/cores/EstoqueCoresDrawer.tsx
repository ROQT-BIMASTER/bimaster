import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/formatters';
import type { EstoqueCorRow } from '@/hooks/estoque/useEstoqueCoresQuery';
import { EstoqueEtiquetaPopover } from './EstoqueEtiquetaPopover';

interface Props {
  row: EstoqueCorRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value ?? '—'}</p>
    </div>
  );
}

function fmtN(n: number | null | undefined) {
  if (n == null) return '—';
  return Math.round(Number(n)).toLocaleString('pt-BR');
}

export function EstoqueCoresDrawer({ row, open, onOpenChange }: Props) {
  const detalhe = row?.detalhe_desmontagem ?? [];
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="text-base">{row?.nome_prod ?? 'Detalhe da unidade'}</SheetTitle>
          <p className="text-xs text-muted-foreground">
            <Badge variant="outline" className="mr-1.5">{row?.abrev_par ?? row?.empresa_par}</Badge>
            Cód. {row?.cod_produto} {row?.cod_fabricante ? `· Fab. ${row.cod_fabricante}` : ''}
          </p>
        </SheetHeader>
        <ScrollArea className="flex-1">
          {row && (
            <div className="px-6 py-5 space-y-6">
              <section>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-3">Saldo</h3>
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Próprio (folha)" value={fmtN(row.saldo_proprio)} />
                  <Field label="Potencial desmontagem" value={fmtN(row.saldo_potencial_desmontagem)} />
                  <Field
                    label="Total disponível"
                    value={<span className="text-primary">{fmtN(row.saldo_total_disponivel)}</span>}
                  />
                  <Field label="Pedido pendente" value={fmtN(row.pedido_pendente)} />
                  <Field label="Bloqueado produto" value={fmtN(row.estoque_bloqueado_produto)} />
                  <Field label="Bloqueado endereço" value={fmtN(row.estoque_bloqueado_endereco)} />
                  <Field label="Em endereço" value={fmtN(row.estoque_endereco)} />
                  <Field label="Unidade" value={row.unidade_medida ?? '—'} />
                  <Field label="Lote" value={row.lote ?? '—'} />
                </div>
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-3">Custos</h3>
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Custo unitário" value={formatCurrency(Number(row.custo_unitario ?? 0))} />
                  <Field label="Custo total" value={formatCurrency(Number(row.custo_total ?? 0))} />
                  <Field label="Valor venda" value={formatCurrency(Number(row.valor_venda ?? 0))} />
                  <Field label="Curva física" value={row.curva_fisica ?? '—'} />
                  <Field label="Curva monetária" value={row.curva_monetaria ?? '—'} />
                  <Field label="Últ. compra" value={row.data_ultima_compra ?? '—'} />
                </div>
              </section>

              {row.tem_composicao_pai && (
                <section>
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-3">
                    Desmontagem possível
                  </h3>
                  {detalhe.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Esta unidade pertence a composições, mas não há saldo nos pais nesta empresa.
                    </p>
                  ) : (
                    <div className="rounded border divide-y">
                      <div className="grid grid-cols-12 px-3 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground bg-muted/50">
                        <div className="col-span-6">Pai</div>
                        <div className="col-span-2 text-right">Saldo pai</div>
                        <div className="col-span-2 text-right">Fator</div>
                        <div className="col-span-2 text-right">Contrib.</div>
                      </div>
                      {detalhe.map((d, i) => (
                        <div key={i} className="grid grid-cols-12 px-3 py-1.5 text-xs items-center">
                          <div className="col-span-6 truncate">
                            <span className="font-mono text-[10px] text-muted-foreground mr-1.5">{d.cod_pai}</span>
                            {d.nome_pai ?? '—'}
                          </div>
                          <div className="col-span-2 text-right tabular-nums">{fmtN(d.saldo_pai)}</div>
                          <div className="col-span-2 text-right tabular-nums">×{Number(d.fator).toLocaleString('pt-BR')}</div>
                          <div className="col-span-2 text-right tabular-nums font-medium text-primary">
                            {fmtN(d.contribuicao)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {row.cod_produto != null && (
                <section>
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-3">Campanhas</h3>
                  <EstoqueEtiquetaPopover codProduto={row.cod_produto} />
                </section>
              )}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
