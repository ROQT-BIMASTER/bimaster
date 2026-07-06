import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { Bot, User, Lock, Save, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";

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
  const [planoOpen, setPlanoOpen] = useState(false);
  const [planoSearch, setPlanoSearch] = useState("");

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
      logger.error('Erro ao salvar:', error);
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
            <Popover open={planoOpen} onOpenChange={setPlanoOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={planoOpen}
                  className="w-full justify-between font-normal h-auto min-h-10 py-2"
                >
                  {planoContasId ? (
                    (() => {
                      const p = planosContas?.find((pl) => pl.id === planoContasId);
                      return p ? (
                        <div className="flex flex-col items-start text-left">
                          <span className="font-mono text-xs">{p.code}</span>
                          <span className="text-xs text-muted-foreground truncate">{p.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Selecione a conta...</span>
                      );
                    })()
                  ) : (
                    <span className="text-muted-foreground">Selecione a conta...</span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command
                  filter={(value, search) => {
                    const s = search.toLowerCase();
                    return value.toLowerCase().includes(s) ? 1 : 0;
                  }}
                >
                  <CommandInput
                    placeholder="Buscar por código ou nome..."
                    className="h-9"
                    value={planoSearch}
                    onValueChange={setPlanoSearch}
                  />
                  <CommandList className="max-h-[300px]">
                    <CommandEmpty>Nenhuma conta encontrada.</CommandEmpty>
                    <CommandGroup>
                      {planosContas?.map((plano) => (
                        <CommandItem
                          key={plano.id}
                          value={`${plano.code} ${plano.name}`}
                          onSelect={() => {
                            setPlanoContasId(plano.id);
                            setPlanoOpen(false);
                          }}
                          className="flex items-center gap-2"
                        >
                          <Check
                            className={cn(
                              "h-4 w-4 shrink-0",
                              planoContasId === plano.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="font-mono text-xs">{highlightMatch(plano.code, planoSearch)}</span>
                            <span className="text-xs text-muted-foreground truncate">{highlightMatch(plano.name, planoSearch)}</span>
                          </div>
                        </CommandItem>
                      ))}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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
