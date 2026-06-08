import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatCurrency } from '@/lib/formatters';
import { formatUnidadeMedida } from '@/lib/estoque/unidadeMedida';
import type { EstoqueRow } from '@/hooks/estoque/useEstoqueQuery';

interface Props {
  row: EstoqueRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value ?? '—'}</p>
    </div>
  );
}

export function EstoqueDetailDrawer({ row, open, onOpenChange }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="text-base">{row?.nome_prod ?? 'Detalhe do SKU'}</SheetTitle>
          <p className="text-xs text-muted-foreground">
            {row?.abrev_par} · Cód. {row?.cod_produto} {row?.cod_fabricante ? `· Fab. ${row.cod_fabricante}` : ''}
          </p>
        </SheetHeader>
        <ScrollArea className="flex-1">
          {row && (
            <div className="px-6 py-5 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Saldo" value={Number(row.saldo ?? 0).toLocaleString('pt-BR')} />
                <Field label="Pedido pendente" value={Number(row.pedido_pendente ?? 0).toLocaleString('pt-BR')} />
                <Field label="Custo unitário" value={formatCurrency(Number(row.custo_unitario ?? 0))} />
                <Field label="Custo total" value={formatCurrency(Number(row.custo_total ?? 0))} />
                <Field label="Valor venda" value={row.valor_venda ? formatCurrency(Number(row.valor_venda)) : null} />
                <Field label="Unidade" value={formatUnidadeMedida(row.unidade_medida)} />
                <Field label="Linha" value={row.nome_linha} />
                <Field label="Última compra" value={row.data_ultima_compra ? new Date(row.data_ultima_compra).toLocaleDateString('pt-BR') : null} />
                <Field label="Curva Física" value={row.curva_fisica && <Badge variant="secondary">{row.curva_fisica}</Badge>} />
                <Field label="Curva Monetária" value={row.curva_monetaria && <Badge variant="secondary">{row.curva_monetaria}</Badge>} />
                <Field label="Validade" value={row.validade ? new Date(row.validade).toLocaleDateString('pt-BR') : null} />
                <Field label="Lote" value={row.lote} />
                <Field label="Localização" value={row.localizacao} />
                <Field label="Estoque endereço" value={row.estoque_endereco != null ? Number(row.estoque_endereco).toLocaleString('pt-BR') : null} />
                <Field label="Bloqueado (produto)" value={row.estoque_bloqueado_produto != null ? Number(row.estoque_bloqueado_produto).toLocaleString('pt-BR') : null} />
                <Field label="Bloqueado (endereço)" value={row.estoque_bloqueado_endereco != null ? Number(row.estoque_bloqueado_endereco).toLocaleString('pt-BR') : null} />
              </div>

              <div className="pt-3 border-t">
                <p className="text-xs text-muted-foreground">
                  Sincronizado em {new Date(row.sincronizado_em).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
