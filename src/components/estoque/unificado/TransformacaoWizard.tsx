import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { Loader2, ArrowDownToLine, ArrowUpToLine } from 'lucide-react';
import { useExecutarTransformacao } from '@/hooks/estoque/useEstoqueMovimentos';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresa: number;
  paiCod: number;
  paiNome?: string | null;
}

export function TransformacaoWizard({ open, onOpenChange, empresa, paiCod, paiNome }: Props) {
  const [tipo, setTipo] = useState<'desmontagem' | 'remontagem'>('desmontagem');
  const [quantidade, setQuantidade] = useState<string>('1');
  const [motivo, setMotivo] = useState('');
  const [loteOrigem, setLoteOrigem] = useState('');

  const mut = useExecutarTransformacao();

  const reset = () => {
    setTipo('desmontagem');
    setQuantidade('1');
    setMotivo('');
    setLoteOrigem('');
  };

  const submit = async () => {
    const qtd = Number(quantidade);
    if (!qtd || qtd <= 0) {
      toast.error('Informe uma quantidade maior que zero.');
      return;
    }
    try {
      const res: any = await mut.mutateAsync({
        tipo, empresa, pai_cod: paiCod, quantidade: qtd,
        motivo: motivo || undefined,
        lote_origem: loteOrigem || null,
      });
      toast.success(
        tipo === 'desmontagem'
          ? `Desmontagem concluída · ${res?.unidades_equivalentes_total ?? 0} unidades equivalentes geradas`
          : `Remontagem concluída · ${qtd} caixa(s) remontada(s)`,
      );
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Falha: ' + (e?.message ?? 'erro desconhecido'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transformar estoque</DialogTitle>
          <DialogDescription className="text-xs">
            Produto: <strong>{paiNome ?? `#${paiCod}`}</strong> · Empresa {empresa}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Operação</Label>
            <RadioGroup value={tipo} onValueChange={(v) => setTipo(v as any)} className="grid grid-cols-2 gap-2">
              <Label
                htmlFor="op-desm"
                className={`cursor-pointer flex items-center gap-2 rounded-md border p-3 text-sm ${tipo==='desmontagem' ? 'border-primary bg-primary/5' : ''}`}
              >
                <RadioGroupItem id="op-desm" value="desmontagem" />
                <ArrowDownToLine className="h-4 w-4" /> Desmontar
              </Label>
              <Label
                htmlFor="op-remon"
                className={`cursor-pointer flex items-center gap-2 rounded-md border p-3 text-sm ${tipo==='remontagem' ? 'border-primary bg-primary/5' : ''}`}
              >
                <RadioGroupItem id="op-remon" value="remontagem" />
                <ArrowUpToLine className="h-4 w-4" /> Remontar
              </Label>
            </RadioGroup>
            <p className="text-[11px] text-muted-foreground">
              {tipo === 'desmontagem'
                ? 'Reduz o saldo do produto-pai e cria saldo dos componentes (filhos da BOM) pelo fator de explosão.'
                : 'Consome componentes disponíveis e gera saldo do produto-pai. Bloqueia se não houver componentes suficientes.'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="qtd">Quantidade do pai</Label>
            <Input id="qtd" type="number" min="0.0001" step="0.0001" value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)} />
          </div>

          {tipo === 'desmontagem' && (
            <div className="space-y-2">
              <Label htmlFor="lote">Lote de origem (opcional)</Label>
              <Input id="lote" placeholder="Ex: lote da CX" value={loteOrigem}
                onChange={(e) => setLoteOrigem(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">Permite rastrear de qual lote da caixa master saíram os componentes.</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo / observação</Label>
            <Textarea id="motivo" rows={2} placeholder="Ex: ajuste de demanda, picking de pedido, etc."
              value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mut.isPending}>Cancelar</Button>
          <Button onClick={submit} disabled={mut.isPending}>
            {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Executar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
