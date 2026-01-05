import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, AlertTriangle, ArrowRight } from "lucide-react";

interface ContaOrigem {
  id: string;
  codigo: string;
  nome: string;
  valor: number;
  lancamentosIds: string[];
}

interface PlanoContasItem {
  id: string;
  code: string;
  name: string;
  account_type: string | null;
}

interface ReclassificarContaDREDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contaOrigem: ContaOrigem | null;
  onSuccess: () => void;
}

export function ReclassificarContaDREDialog({
  open,
  onOpenChange,
  contaOrigem,
  onSuccess,
}: ReclassificarContaDREDialogProps) {
  const queryClient = useQueryClient();
  const [novaContaId, setNovaContaId] = useState<string>("");
  const [justificativa, setJustificativa] = useState("");
  const [bloquearIA, setBloquearIA] = useState(true);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setNovaContaId("");
      setJustificativa("");
      setBloquearIA(true);
    }
  }, [open]);

  // State for available accounts
  const [contasDisponiveis, setContasDisponiveis] = useState<PlanoContasItem[]>([]);
  const [loadingContas, setLoadingContas] = useState(false);

  // Fetch available accounts when dialog opens
  useEffect(() => {
    if (!open) return;
    
    const fetchContas = async () => {
      setLoadingContas(true);
      try {
        const { data, error } = await supabase
          .from('trade_chart_of_accounts')
          .select('id, code, name, account_type')
          .eq('is_active', true)
          .eq('is_group', false)
          .order('code');
        
        if (error) throw error;
        
        const contas = (data || []).map(c => ({
          id: c.id,
          code: c.code,
          name: c.name,
          account_type: c.account_type
        }));
        setContasDisponiveis(contas);
      } catch (err) {
        console.error('Erro ao buscar contas:', err);
      } finally {
        setLoadingContas(false);
      }
    };
    
    fetchContas();
  }, [open]);

  // Mutation to update accounts
  const mutation = useMutation({
    mutationFn: async () => {
      if (!contaOrigem || !novaContaId) {
        throw new Error("Dados incompletos para reclassificação");
      }

      const novaConta = contasDisponiveis.find(c => c.id === novaContaId);
      if (!novaConta) {
        throw new Error("Conta destino não encontrada");
      }

      // Update all lancamentos
      const { error } = await supabase
        .from('contas_pagar')
        .update({
          plano_contas_id: novaContaId,
          plano_contas_codigo: novaConta.code,
          plano_contas_nome: novaConta.name,
          classificacao_manual: bloquearIA,
          classificacao_corrigida_em: new Date().toISOString(),
          classificacao_justificativa: justificativa || null,
        })
        .in('id', contaOrigem.lancamentosIds);

      if (error) throw error;

      // Register in history for each lancamento
      const historico = contaOrigem.lancamentosIds.map(contaId => ({
        conta_id: contaId,
        campo_alterado: 'plano_contas',
        valor_anterior: `${contaOrigem.codigo} - ${contaOrigem.nome}`,
        valor_novo: `${novaConta.code} - ${novaConta.name}`,
        tipo_alteracao: 'reclassificacao_dre',
        justificativa: justificativa || 'Reclassificação via DRE Analítico',
      }));

      const { error: histError } = await supabase
        .from('contas_pagar_historico')
        .insert(historico);

      if (histError) {
        console.error('Erro ao registrar histórico:', histError);
      }

      return { count: contaOrigem.lancamentosIds.length, novaConta };
    },
    onSuccess: (result) => {
      toast.success(`${result.count} lançamento(s) reclassificado(s) para ${result.novaConta.code} - ${result.novaConta.name}`);
      queryClient.invalidateQueries({ queryKey: ['lancamentos-dre'] });
      onSuccess();
    },
    onError: (error) => {
      console.error('Erro ao reclassificar:', error);
      toast.error("Erro ao reclassificar lançamentos");
    },
  });

  if (!contaOrigem) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(Math.abs(value));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Reclassificar Conta
          </DialogTitle>
          <DialogDescription>
            Mova todos os lançamentos desta conta para outra conta do plano de contas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Conta Origem */}
          <div className="p-3 bg-muted/50 rounded-lg border">
            <Label className="text-xs text-muted-foreground">Conta Origem</Label>
            <div className="font-medium mt-1">
              <Badge variant="outline" className="mr-2">{contaOrigem.codigo}</Badge>
              {contaOrigem.nome}
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span>{contaOrigem.lancamentosIds.length} lançamento(s)</span>
              <span>•</span>
              <span className="font-medium text-foreground">{formatCurrency(contaOrigem.valor)}</span>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>

          {/* Conta Destino */}
          <div className="space-y-2">
            <Label>Nova Conta (Destino)</Label>
            <Select value={novaContaId} onValueChange={setNovaContaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a conta destino..." />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {loadingContas ? (
                  <div className="p-2 text-center text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  </div>
                ) : (
                  contasDisponiveis.map((conta) => (
                    <SelectItem 
                      key={conta.id} 
                      value={conta.id}
                      disabled={conta.code === contaOrigem.codigo}
                    >
                      <span className="font-mono text-xs mr-2">{conta.code}</span>
                      {conta.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Justificativa */}
          <div className="space-y-2">
            <Label>Justificativa (opcional)</Label>
            <Textarea
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Ex: Conta estava classificada incorretamente..."
              rows={2}
            />
          </div>

          {/* Bloquear IA */}
          <div className="flex items-center space-x-2 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <Checkbox 
              id="bloquear-ia" 
              checked={bloquearIA}
              onCheckedChange={(checked) => setBloquearIA(checked as boolean)}
            />
            <div className="flex-1">
              <Label htmlFor="bloquear-ia" className="text-sm font-medium cursor-pointer">
                Bloquear reclassificação automática
              </Label>
              <p className="text-xs text-muted-foreground">
                Impede que a IA reclassifique estes lançamentos futuramente
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={() => mutation.mutate()}
            disabled={!novaContaId || mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Reclassificando...
              </>
            ) : (
              `Reclassificar ${contaOrigem.lancamentosIds.length} lançamento(s)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
