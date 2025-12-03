import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Bot, User, Lock, Save } from "lucide-react";

interface ContaPagar {
  id: string;
  fornecedor_nome: string;
  categoria_nome: string;
  valor_original: number;
  departamento_id: string | null;
  departamento_nome: string | null;
  plano_contas_id: string | null;
  plano_contas_codigo: string | null;
  plano_contas_nome: string | null;
  confianca_classificacao: number | null;
  classificado_automaticamente: boolean | null;
  classificacao_manual: boolean | null;
}

interface EditarClassificacaoRapidaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conta: ContaPagar | null;
  onSuccess: () => void;
}

export function EditarClassificacaoRapidaDialog({
  open,
  onOpenChange,
  conta,
  onSuccess
}: EditarClassificacaoRapidaDialogProps) {
  const [departamentoId, setDepartamentoId] = useState<string>("");
  const [planoContasId, setPlanoContasId] = useState<string>("");
  const [bloquearReclassificacao, setBloquearReclassificacao] = useState(false);

  // Carregar departamentos
  const { data: departamentos } = useQuery({
    queryKey: ['departamentos-dialog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departamentos')
        .select('*')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data;
    }
  });

  // Carregar planos de contas
  const { data: planosContas } = useQuery({
    queryKey: ['planos-contas-dialog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trade_chart_of_accounts')
        .select('*')
        .eq('is_active', true)
        .eq('permite_lancamento', true)
        .order('code');
      if (error) throw error;
      return data;
    }
  });

  // Resetar campos quando a conta mudar
  useEffect(() => {
    if (conta) {
      setDepartamentoId(conta.departamento_id || "");
      setPlanoContasId(conta.plano_contas_id || "");
      setBloquearReclassificacao(conta.classificacao_manual || false);
    }
  }, [conta]);

  // Mutation para salvar
  const mutation = useMutation({
    mutationFn: async () => {
      if (!conta) return;

      const { data: { user } } = await supabase.auth.getUser();
      
      const dept = departamentos?.find(d => d.id === departamentoId);
      const plano = planosContas?.find(p => p.id === planoContasId);

      const { error } = await supabase
        .from('contas_pagar')
        .update({
          departamento_id: departamentoId || null,
          departamento_nome: dept?.nome || null,
          plano_contas_id: planoContasId || null,
          plano_contas_codigo: plano?.code || null,
          plano_contas_nome: plano?.name || null,
          classificacao_manual: bloquearReclassificacao,
          classificacao_corrigida_por: user?.id || null,
          classificacao_corrigida_em: new Date().toISOString()
        })
        .eq('id', conta.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Classificação atualizada com sucesso!');
      onSuccess();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar classificação');
    }
  });

  if (!conta) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Editar Classificação
            {conta.classificado_automaticamente && !conta.classificacao_manual && (
              <Badge variant="secondary" className="gap-1">
                <Bot className="h-3 w-3" />
                IA {conta.confianca_classificacao ? `${(conta.confianca_classificacao * 100).toFixed(0)}%` : ''}
              </Badge>
            )}
            {conta.classificacao_manual && (
              <Badge variant="default" className="gap-1">
                <User className="h-3 w-3" />
                Manual
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Info da conta */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-1">
            <p className="text-sm font-medium">{conta.fornecedor_nome || 'Fornecedor não informado'}</p>
            <p className="text-xs text-muted-foreground">{conta.categoria_nome || 'Categoria não informada'}</p>
            <p className="text-sm font-semibold text-primary">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(conta.valor_original || 0)}
            </p>
          </div>

          {/* Departamento */}
          <div className="space-y-2">
            <Label>Departamento</Label>
            <Select value={departamentoId} onValueChange={setDepartamentoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o departamento..." />
              </SelectTrigger>
              <SelectContent>
                {departamentos?.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Plano de Contas */}
          <div className="space-y-2">
            <Label>Plano de Contas</Label>
            <Select value={planoContasId} onValueChange={setPlanoContasId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a conta..." />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {planosContas?.map((plano) => (
                  <SelectItem key={plano.id} value={plano.id}>
                    <div className="flex flex-col">
                      <span className="font-mono text-xs">{plano.code}</span>
                      <span className="text-xs text-muted-foreground">{plano.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Checkbox bloquear reclassificação */}
          <div className="flex items-center space-x-2 pt-2 border-t">
            <Checkbox
              id="bloquear"
              checked={bloquearReclassificacao}
              onCheckedChange={(checked) => setBloquearReclassificacao(checked as boolean)}
            />
            <Label htmlFor="bloquear" className="flex items-center gap-2 cursor-pointer text-sm">
              <Lock className="h-4 w-4 text-muted-foreground" />
              Não reclassificar automaticamente pela IA
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {mutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
