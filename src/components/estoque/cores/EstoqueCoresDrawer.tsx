import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { EstoqueCorRow } from '@/hooks/estoque/useEstoqueCoresQuery';
import { EstoqueEtiquetaPopover } from './EstoqueEtiquetaPopover';
import { EstoqueCoresMemoryBlock } from './EstoqueCoresMemoryBlock';
import type { DetalheDesmontagemItem } from '@/hooks/estoque/useEstoqueCoresConsolidadoQuery';

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
  const detalhe = (row?.detalhe_desmontagem ?? []) as DetalheDesmontagemItem[];
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
                    value={<span className="text-primary">{fmtN(Math.max(0, Number(row.saldo_total_disponivel ?? 0) - Number(row.estoque_bloqueado_produto ?? 0)))}</span>}
                  />
                  <Field label="Pedido pendente" value={fmtN(row.pedido_pendente)} />
                  <Field label="Bloqueado produto" value={fmtN(row.estoque_bloqueado_produto)} />
                  <Field label="Bloqueado endereço" value={fmtN(row.estoque_bloqueado_endereco)} />
                  <Field label="Em endereço" value={fmtN(row.estoque_endereco)} />
                  <Field label="Unidade" value={row.unidade_medida ?? '—'} />
                  <Field label="Lote" value={row.lote ?? '—'} />
                </div>
              </section>

              {row.tem_composicao_pai && (
                <section>
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-1">
                    Memória de cálculo da explosão
                  </h3>
                  <p className="text-[11px] text-muted-foreground mb-3">
                    Fator = quantas unidades-folha cada caixa/box do pai gera (de <code>erp_composicao_produto</code>). O
                    saldo do pai é o saldo da própria filial. Confira contra o relatório de explosão do ERP.
                  </p>
                  <EstoqueCoresMemoryBlock
                    saldoProprio={Number(row.saldo_proprio ?? 0)}
                    saldoPotencial={Number(row.saldo_potencial_desmontagem ?? 0)}
                    detalhe={detalhe}
                    unidade={row.unidade_medida}
                  />
                </section>
              )}

              <section>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-3">Classificação</h3>
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Curva física" value={row.curva_fisica ?? '—'} />
                  <Field label="Curva monetária" value={row.curva_monetaria ?? '—'} />
                  <Field label="Últ. compra" value={row.data_ultima_compra ?? '—'} />
                </div>
              </section>

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
