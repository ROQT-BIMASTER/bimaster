import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, User, ArrowRight, Sparkles, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface TransferirFornecedorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fornecedorNome: string;
  lancamentosIds: string[];
  onSuccess: () => void;
}

const CATEGORIAS_DRE = [
  { value: 'custo_vendas', label: 'Custo de Vendas' },
  { value: 'despesas_variaveis', label: 'Custo Variável' },
  { value: 'despesas_fixas', label: 'Despesas Fixas' },
  { value: 'impostos_lucro', label: 'Impostos s/ Lucro' },
];

interface PlanoContasItem {
  id: string;
  code: string;
  name: string;
  categoria_dre: string | null;
}

export function TransferirFornecedorDialog({
  open,
  onOpenChange,
  fornecedorNome,
  lancamentosIds,
  onSuccess,
}: TransferirFornecedorDialogProps) {
  const queryClient = useQueryClient();
  const [novaContaId, setNovaContaId] = useState<string>("");
  const [novoDepartamentoId, setNovoDepartamentoId] = useState<string>("");
  const [justificativa, setJustificativa] = useState("");
  const [criarRegra, setCriarRegra] = useState(true);
  const [bloquearIA, setBloquearIA] = useState(true);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (open) {
      setNovaContaId("");
      setNovoDepartamentoId("");
      setJustificativa("");
      setCriarRegra(true);
      setBloquearIA(true);
      setSearchQuery("");
    }
  }, [open]);

  const { data: contasDisponiveis, isLoading: loadingContas } = useQuery({
    queryKey: ['plano-contas-transferir'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trade_chart_of_accounts')
        .select('id, code, name, categoria_dre')
        .eq('is_active', true)
        .eq('permite_lancamento', true)
        .order('code');

      if (error) throw error;
      return (data || []) as PlanoContasItem[];
    },
    enabled: open
  });

  const { data: departamentos, isLoading: loadingDepartamentos } = useQuery({
    queryKey: ['departamentos-transferir'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departamentos')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      return data || [];
    },
    enabled: open
  });

  const contasAgrupadas = useMemo(() => {
    if (!contasDisponiveis) return {};
    const grupos: Record<string, PlanoContasItem[]> = {};
    CATEGORIAS_DRE.forEach(cat => {
      const contasCat = contasDisponiveis.filter(c => c.categoria_dre === cat.value);
      if (contasCat.length > 0) {
        grupos[cat.value] = contasCat;
      }
    });
    // Include uncategorized
    const semCategoria = contasDisponiveis.filter(c => !CATEGORIAS_DRE.some(cat => cat.value === c.categoria_dre));
    if (semCategoria.length > 0) {
      grupos['outros'] = semCategoria;
    }
    return grupos;
  }, [contasDisponiveis]);

  const getCategoriaLabel = (value: string) => {
    if (value === 'outros') return 'Outras';
    const cat = CATEGORIAS_DRE.find(c => c.value === value);
    return cat?.label || value;
  };

  const selectedConta = contasDisponiveis?.find(c => c.id === novaContaId);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!novaContaId) throw new Error("Selecione uma conta destino");
      const novaConta = contasDisponiveis?.find(c => c.id === novaContaId);
      if (!novaConta) throw new Error("Conta destino não encontrada");
      const novoDept = departamentos?.find(d => d.id === novoDepartamentoId);

      const updateData: Record<string, any> = {
        plano_contas_id: novaContaId,
        plano_contas_codigo: novaConta.code,
        plano_contas_nome: novaConta.name,
        classificacao_manual: bloquearIA,
        classificacao_corrigida_em: new Date().toISOString(),
        classificacao_justificativa: justificativa || `Transferência de fornecedor ${fornecedorNome}`,
      };

      if (novoDepartamentoId) {
        updateData.departamento_id = novoDepartamentoId;
        updateData.departamento_nome = novoDept?.nome || null;
      }

      const { error } = await supabase
        .from('contas_pagar')
        .update(updateData)
        .in('id', lancamentosIds);

      if (error) throw error;

      if (criarRegra) {
        const { error: ruleError } = await supabase
          .from('account_classification_rules')
          .upsert({
            fornecedor_nome: fornecedorNome,
            plano_contas_id: novaContaId,
            departamento_id: novoDepartamentoId || null,
            categoria_nome: novaConta.name,
            confidence_score: 1.0,
            times_used: lancamentosIds.length,
            last_used_at: new Date().toISOString(),
          }, {
            onConflict: 'fornecedor_nome',
            ignoreDuplicates: false
          });
        if (ruleError) console.error('Erro ao criar regra:', ruleError);
      }

      return { novaConta, count: lancamentosIds.length };
    },
    onSuccess: (result) => {
      toast.success(`${result.count} lançamento(s) de "${fornecedorNome}" transferidos para ${result.novaConta.code} - ${result.novaConta.name}`);
      queryClient.invalidateQueries({ queryKey: ['contas-pagar-dre-view'] });
      queryClient.invalidateQueries({ queryKey: ['contas-pagar-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['contas-pagar-table'] });
      onSuccess();
    },
    onError: (error) => {
      console.error('Erro ao transferir:', error);
      toast.error("Erro ao transferir lançamentos");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-amber-500" />
            Transferir Fornecedor
          </DialogTitle>
          <DialogDescription>
            Mova todos os lançamentos deste fornecedor para uma nova conta contábil.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 bg-muted/50 rounded-lg border">
            <Label className="text-xs text-muted-foreground">Fornecedor</Label>
            <div className="font-medium mt-1 flex items-center gap-2">
              <User className="h-4 w-4 text-amber-600" />
              {fornecedorNome}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {lancamentosIds.length} lançamento(s) serão transferidos
            </p>
          </div>

          <div className="flex justify-center">
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>

          {/* Conta Destino - Combobox com busca */}
          <div className="space-y-2">
            <Label>Nova Conta Contábil *</Label>
            <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={comboboxOpen}
                  className="w-full justify-between font-normal"
                >
                  {selectedConta ? (
                    <span className="truncate">
                      <span className="font-mono text-xs mr-2">{selectedConta.code}</span>
                      {selectedConta.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Buscar conta destino...</span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[450px] p-0" align="start">
                <Command>
                  <CommandInput 
                    placeholder="Buscar por código ou nome..." 
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                  />
                  <CommandList className="max-h-[300px]">
                    <CommandEmpty>Nenhuma conta encontrada.</CommandEmpty>
                    {Object.entries(contasAgrupadas).map(([categoria, contas]) => (
                      <CommandGroup key={categoria} heading={getCategoriaLabel(categoria)}>
                        {contas.map((conta) => (
                          <CommandItem
                            key={conta.id}
                            value={`${conta.code} ${conta.name}`}
                            onSelect={() => {
                              setNovaContaId(conta.id);
                              setComboboxOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", novaContaId === conta.id ? "opacity-100" : "opacity-0")} />
                            <span className="font-mono text-xs mr-2">{conta.code}</span>
                            <span className="truncate">{conta.name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Departamento */}
          <div className="space-y-2">
            <Label>Novo Departamento (opcional)</Label>
            <Select value={novoDepartamentoId} onValueChange={setNovoDepartamentoId}>
              <SelectTrigger>
                <SelectValue placeholder="Manter departamento atual..." />
              </SelectTrigger>
              <SelectContent>
                {loadingDepartamentos ? (
                  <div className="p-2 text-center text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  </div>
                ) : (
                  departamentos?.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.nome}
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
              placeholder="Motivo da reclassificação..."
              rows={2}
            />
          </div>

          {/* Options */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="criar-regra"
                checked={criarRegra}
                onCheckedChange={(checked) => setCriarRegra(checked as boolean)}
              />
              <Label htmlFor="criar-regra" className="text-sm cursor-pointer flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                Criar regra para classificar automaticamente este fornecedor
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="bloquear-ia"
                checked={bloquearIA}
                onCheckedChange={(checked) => setBloquearIA(checked as boolean)}
              />
              <Label htmlFor="bloquear-ia" className="text-sm cursor-pointer">
                Bloquear reclassificação automática por IA
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={() => mutation.mutate()} 
            disabled={mutation.isPending || !novaContaId}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Transferindo...
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4 mr-2" />
                Transferir {lancamentosIds.length} lançamento(s)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
