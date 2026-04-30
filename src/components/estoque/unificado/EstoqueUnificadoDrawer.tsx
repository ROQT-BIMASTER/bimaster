import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/formatters';
import { useBomPath, useCapacidadeMontagem, type EstoqueUnificadoRow } from '@/hooks/estoque/useEstoqueUnificado';
import { useEstoqueMovimentos } from '@/hooks/estoque/useEstoqueMovimentos';
import { Boxes, Package, PackageOpen, GitBranch, Wrench, History, Wand2 } from 'lucide-react';
import { TransformacaoWizard } from './TransformacaoWizard';

interface Props {
  row: EstoqueUnificadoRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const fmt = (n: number | null | undefined) => Math.round(Number(n ?? 0)).toLocaleString('pt-BR');

export function EstoqueUnificadoDrawer({ row, open, onOpenChange }: Props) {
  const { data: paths, isLoading: loadingPath } = useBomPath(row?.empresa ?? null, row?.produto_raiz ?? null);
  const { data: capacidade } = useCapacidadeMontagem(row?.empresa ?? null, row?.produto_raiz ?? null);
  const { data: movs } = useEstoqueMovimentos(row?.empresa ?? null, row?.produto_raiz ?? null);
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="text-base truncate">{row?.raiz_nome ?? 'Produto'}</SheetTitle>
              <p className="text-xs text-muted-foreground">
                Empresa {row?.raiz_abrev ?? row?.empresa} · Cód. raiz {row?.produto_raiz}
              </p>
            </div>
            {row && (
              <Button size="sm" onClick={() => setWizardOpen(true)}>
                <Wand2 className="h-4 w-4 mr-2" /> Transformar
              </Button>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          {row && (
            <div className="px-6 py-5 space-y-6">
              {/* Saldos por nível */}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Boxes className="h-4 w-4" /> Saldos físicos por nível
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <Card className="p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground"><Boxes className="h-3 w-3" /> Caixas (CX)</div>
                    <div className="text-2xl font-bold tabular-nums">{fmt(row.saldo_em_caixas)}</div>
                  </Card>
                  <Card className="p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground"><Package className="h-3 w-3" /> Displays (BX)</div>
                    <div className="text-2xl font-bold tabular-nums">{fmt(row.saldo_em_displays)}</div>
                  </Card>
                  <Card className="p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground"><PackageOpen className="h-3 w-3" /> Unidades (UN)</div>
                    <div className="text-2xl font-bold tabular-nums">{fmt(row.saldo_em_unidades)}</div>
                  </Card>
                </div>
              </section>

              {/* Equivalência */}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Equivalência total</h3>
                <Card className="p-4 bg-muted/40">
                  <p className="text-xs text-muted-foreground">Se desmontar 100% do estoque até a unidade:</p>
                  <p className="text-3xl font-bold tabular-nums">{fmt(row.saldo_total_em_unidades)} <span className="text-sm font-normal text-muted-foreground">unidades</span></p>
                  <p className="text-xs text-muted-foreground mt-2">Custo total acumulado: {formatCurrency(Number(row.custo_total ?? 0))}</p>
                </Card>
              </section>

              {/* Capacidade de remontagem */}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Wrench className="h-4 w-4" /> Capacidade de remontagem
                </h3>
                {capacidade ? (
                  <Card className="p-4">
                    <p className="text-xs text-muted-foreground">A partir do estoque atual de componentes:</p>
                    <p className="text-2xl font-bold tabular-nums">{fmt(capacidade.caixas_remontaveis)} <span className="text-sm font-normal">caixas</span></p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline">{capacidade.componentes_necessarios} componentes</Badge>
                      {capacidade.componentes_em_falta > 0 && (
                        <Badge variant="destructive">{capacidade.componentes_em_falta} em falta</Badge>
                      )}
                    </div>
                  </Card>
                ) : (
                  <p className="text-xs text-muted-foreground">Produto sem composição BOM cadastrada.</p>
                )}
              </section>

              {/* Caminho BOM */}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <GitBranch className="h-4 w-4" /> Estrutura da composição (BOM)
                </h3>
                {loadingPath && <p className="text-xs text-muted-foreground">Carregando…</p>}
                {!loadingPath && (paths?.length ?? 0) === 0 && (
                  <p className="text-xs text-muted-foreground">Sem composição multi-nível para este produto.</p>
                )}
                {(paths ?? []).slice(0, 50).map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs font-mono p-2 rounded bg-muted/30">
                    <Badge variant="outline" className="text-[10px]">N{p.profundidade + 1}</Badge>
                    <span className="text-muted-foreground">{p.caminho.join(' → ')}</span>
                    <span className="ml-auto tabular-nums font-semibold">×{Number(p.fator_acumulado).toLocaleString('pt-BR')}</span>
                  </div>
                ))}
                {(paths?.length ?? 0) > 50 && (
                  <p className="text-[11px] text-muted-foreground italic">+ {paths!.length - 50} caminhos adicionais</p>
                )}
              </section>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
