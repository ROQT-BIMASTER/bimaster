import { useState, useEffect, useMemo } from "react";
import { formatCurrency } from "@/lib/formatters";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, AlertTriangle, ArrowDown } from "lucide-react";
import { PasswordConfirmDialog } from "@/components/dre/PasswordConfirmDialog";

interface ContaOrigem {
  id: string;
  codigo: string;
  nome: string;
  valor: number;
  lancamentosIds: string[];
  categoriaDre?: string | null;
  tipoDre?: 'conta' | 'grupo' | 'fornecedor' | 'departamento';
}

interface PlanoContasItem {
  id: string;
  code: string;
  name: string;
  account_type: string | null;
  categoria_dre: string | null;
  is_group?: boolean;
}

interface ReclassificarContaDREDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contaOrigem: ContaOrigem | null;
  onSuccess: () => void;
}

const CATEGORIAS_DRE = [
  { value: 'receita_bruta', label: 'Receita Bruta' },
  { value: 'deducoes', label: 'Deduções e Abatimentos' },
  { value: 'custo_vendas', label: 'Custo de Vendas' },
  { value: 'despesas_variaveis', label: 'Custo Variável' },
  { value: 'despesas_fixas', label: 'Despesas Fixas' },
  { value: 'impostos_lucro', label: 'Impostos s/ Lucro' },
];

const CATEGORIA_COLORS: Record<string, string> = {
  'receita_bruta': 'bg-emerald-500/20 text-emerald-700 border-emerald-500/30',
  'deducoes': 'bg-orange-500/20 text-orange-700 border-orange-500/30',
  'custo_vendas': 'bg-red-500/20 text-red-700 border-red-500/30',
  'despesas_variaveis': 'bg-amber-500/20 text-amber-700 border-amber-500/30',
  'despesas_fixas': 'bg-blue-500/20 text-blue-700 border-blue-500/30',
  'impostos_lucro': 'bg-purple-500/20 text-purple-700 border-purple-500/30',
};

export function ReclassificarContaDREDialog({
  open,
  onOpenChange,
  contaOrigem,
  onSuccess,
}: ReclassificarContaDREDialogProps) {
  const queryClient = useQueryClient();
  const [novaCategoriaDre, setNovaCategoriaDre] = useState<string>("");
  const [novaContaId, setNovaContaId] = useState<string>("");
  const [justificativa, setJustificativa] = useState("");
  const [bloquearIA, setBloquearIA] = useState(true);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setNovaCategoriaDre("");
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
          .select('id, code, name, account_type, categoria_dre, is_group')
          .eq('is_active', true)
          .order('code');
        
        if (error) throw error;
        
        const contas = (data || []).map(c => ({
          id: c.id,
          code: c.code,
          name: c.name,
          account_type: c.account_type,
          categoria_dre: c.categoria_dre,
          is_group: c.is_group,
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

  // Filter accounts by selected category
  const contasFiltradas = useMemo(() => {
    if (!novaCategoriaDre) return [];
    return contasDisponiveis.filter(c => c.categoria_dre === novaCategoriaDre);
  }, [contasDisponiveis, novaCategoriaDre]);

  // Group accounts by category for display
  const contasAgrupadas = useMemo(() => {
    const grupos: Record<string, PlanoContasItem[]> = {};
    
    CATEGORIAS_DRE.forEach(cat => {
      const contasCat = contasDisponiveis.filter(c => c.categoria_dre === cat.value);
      if (contasCat.length > 0) {
        grupos[cat.value] = contasCat;
      }
    });
    
    // Add uncategorized accounts
    const semCategoria = contasDisponiveis.filter(c => !c.categoria_dre);
    if (semCategoria.length > 0) {
      grupos['sem_categoria'] = semCategoria;
    }
    
    return grupos;
  }, [contasDisponiveis]);

  const getCategoriaLabel = (value: string | null | undefined) => {
    if (!value) return 'Não definida';
    const cat = CATEGORIAS_DRE.find(c => c.value === value);
    return cat?.label || value;
  };

  // Store user info from password confirmation
  const [userInfo, setUserInfo] = useState<{ id: string; email: string; nome: string } | null>(null);

  // Mutation to update accounts
  const mutation = useMutation({
    mutationFn: async () => {
      if (!contaOrigem) {
        throw new Error("Dados incompletos para reclassificação");
      }
      
      if (!userInfo) {
        throw new Error("Usuário não autenticado");
      }

      const isFornecedorOuDept = contaOrigem.tipoDre === 'fornecedor' || contaOrigem.tipoDre === 'departamento';

      // For fornecedor/departamento, always move to a new account
      if (isFornecedorOuDept) {
        if (!novaContaId) {
          throw new Error("Selecione uma conta destino");
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

        // Register in history for each lancamento with user info
        const historico = contaOrigem.lancamentosIds.map(contaId => ({
          conta_id: contaId,
          campo_alterado: 'plano_contas',
          valor_anterior: `${contaOrigem.tipoDre}: ${contaOrigem.nome}`,
          valor_novo: `${novaConta.code} - ${novaConta.name}`,
          tipo_alteracao: 'reclassificacao_dre',
          justificativa: justificativa || `Reclassificação de ${contaOrigem.tipoDre} via DRE Analítico`,
          usuario_id: userInfo.id,
          usuario_nome: userInfo.nome,
          usuario_email: userInfo.email,
        }));

        const { error: histError } = await supabase
          .from('contas_pagar_historico')
          .insert(historico);

        if (histError) {
          console.error('Erro ao registrar histórico:', histError);
        }

        return { 
          type: 'conta' as const, 
          novaConta, 
          count: contaOrigem.lancamentosIds.length 
        };
      }

      // For conta/grupo: If just changing category (no new account selected)
      if (novaCategoriaDre && (!novaContaId || novaContaId === 'mesma')) {
        // Find the original account and update its category
        const { error } = await supabase
          .from('trade_chart_of_accounts')
          .update({ categoria_dre: novaCategoriaDre })
          .eq('code', contaOrigem.codigo);

        if (error) throw error;

        return { 
          type: 'categoria' as const, 
          novaCategoria: getCategoriaLabel(novaCategoriaDre),
          count: contaOrigem.lancamentosIds.length 
        };
      }

      // Moving to a different account
      if (!novaContaId) {
        throw new Error("Selecione uma conta destino");
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

      // Register in history for each lancamento with user info
      const historico = contaOrigem.lancamentosIds.map(contaId => ({
        conta_id: contaId,
        campo_alterado: 'plano_contas',
        valor_anterior: `${contaOrigem.codigo} - ${contaOrigem.nome}`,
        valor_novo: `${novaConta.code} - ${novaConta.name}`,
        tipo_alteracao: 'reclassificacao_dre',
        justificativa: justificativa || 'Reclassificação via DRE Analítico',
        usuario_id: userInfo.id,
        usuario_nome: userInfo.nome,
        usuario_email: userInfo.email,
      }));

      const { error: histError } = await supabase
        .from('contas_pagar_historico')
        .insert(historico);

      if (histError) {
        console.error('Erro ao registrar histórico:', histError);
      }

      return { 
        type: 'conta' as const, 
        novaConta, 
        count: contaOrigem.lancamentosIds.length 
      };
    },
    onSuccess: (result) => {
      if (result.type === 'categoria') {
        toast.success(`Categoria da conta alterada para "${result.novaCategoria}"`);
      } else {
        toast.success(`${result.count} lançamento(s) reclassificado(s) para ${result.novaConta.code} - ${result.novaConta.name}`);
      }
      queryClient.invalidateQueries({ queryKey: ['lancamentos-dre'] });
      queryClient.invalidateQueries({ queryKey: ['plano-contas-dre'] });
      setUserInfo(null);
      onSuccess();
    },
    onError: (error) => {
      console.error('Erro ao reclassificar:', error);
      toast.error("Erro ao reclassificar lançamentos");
      setUserInfo(null);
    },
  });

  // Handle password confirmation success
  const handlePasswordConfirm = async (confirmedJustificativa: string, info: { id: string; email: string; nome: string }) => {
    // Update justificativa if provided in password dialog
    if (confirmedJustificativa && !justificativa) {
      setJustificativa(confirmedJustificativa);
    }
    setUserInfo(info);
    // Trigger mutation after state update
    setTimeout(() => mutation.mutate(), 0);
  };

  // Request password confirmation before reclassification
  const handleReclassificar = () => {
    setShowPasswordDialog(true);
  };

  if (!contaOrigem) return null;

  const formatCurrencyAbs = (value: number) => formatCurrency(Math.abs(value));

  const categoriaAtual = contaOrigem.categoriaDre;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {contaOrigem.tipoDre === 'fornecedor' 
              ? 'Reclassificar Fornecedor' 
              : contaOrigem.tipoDre === 'departamento'
                ? 'Reclassificar Departamento'
                : 'Reclassificar Conta'}
          </DialogTitle>
          <DialogDescription>
            {contaOrigem.tipoDre === 'fornecedor' 
              ? 'Mova os lançamentos deste fornecedor para outra conta.'
              : contaOrigem.tipoDre === 'departamento'
                ? 'Mova os lançamentos deste departamento para outra conta.'
                : 'Altere a categoria DRE ou mova os lançamentos para outra conta.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Origem */}
          <div className="p-3 bg-muted/50 rounded-lg border">
            <Label className="text-xs text-muted-foreground">
              {contaOrigem.tipoDre === 'fornecedor' 
                ? 'Fornecedor' 
                : contaOrigem.tipoDre === 'departamento'
                  ? 'Departamento'
                  : 'Conta Origem'}
            </Label>
            <div className="font-medium mt-1">
              {contaOrigem.codigo && (
                <Badge variant="outline" className="mr-2 font-mono">{contaOrigem.codigo}</Badge>
              )}
              {contaOrigem.nome}
            </div>
            <div className="flex items-center gap-2 mt-2">
              {categoriaAtual && (
                <>
                  <Badge 
                    variant="outline" 
                    className={CATEGORIA_COLORS[categoriaAtual] || 'bg-muted text-muted-foreground'}
                  >
                    {getCategoriaLabel(categoriaAtual)}
                  </Badge>
                  <span className="text-sm text-muted-foreground">•</span>
                </>
              )}
              <span className="text-sm text-muted-foreground">{contaOrigem.lancamentosIds.length} lançamento(s)</span>
              <span className="text-sm text-muted-foreground">•</span>
              <span className="text-sm font-medium">{formatCurrency(contaOrigem.valor)}</span>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <ArrowDown className="h-5 w-5 text-muted-foreground" />
          </div>

          {/* Para conta/grupo: mostra seletor de categoria primeiro */}
          {(contaOrigem.tipoDre === 'conta' || contaOrigem.tipoDre === 'grupo') && (
            <>
              {/* Nova Categoria DRE */}
              <div className="space-y-2">
                <Label>Nova Categoria DRE</Label>
                <Select value={novaCategoriaDre} onValueChange={(val) => {
                  setNovaCategoriaDre(val);
                  setNovaContaId(""); // Reset account selection when category changes
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS_DRE.map((cat) => (
                      <SelectItem 
                        key={cat.value} 
                        value={cat.value}
                        disabled={cat.value === categoriaAtual}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${CATEGORIA_COLORS[cat.value]?.split(' ')[0] || 'bg-muted'}`} />
                          {cat.label}
                          {cat.value === categoriaAtual && <span className="text-xs text-muted-foreground">(atual)</span>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Nova Conta (opcional) */}
              {novaCategoriaDre && (
                <div className="space-y-2">
                  <Label>Mover para outra conta (opcional)</Label>
                  <Select value={novaContaId} onValueChange={setNovaContaId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Manter na mesma conta..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {loadingContas ? (
                        <div className="p-2 text-center text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                        </div>
                      ) : (
                        <>
                          <SelectItem value="mesma">
                            <span className="text-muted-foreground">Manter na conta atual</span>
                          </SelectItem>
                          
                          {/* Show accounts in the selected category */}
                          {contasFiltradas.length > 0 && (
                            <SelectGroup>
                              <SelectLabel className="text-xs font-semibold text-muted-foreground">
                                {getCategoriaLabel(novaCategoriaDre)}
                              </SelectLabel>
                              {contasFiltradas.map((conta) => (
                                <SelectItem 
                                  key={conta.id} 
                                  value={conta.id}
                                  disabled={conta.code === contaOrigem.codigo}
                                >
                                  <div className="flex items-center gap-1">
                                    <span className="font-mono text-xs mr-2">{conta.code}</span>
                                    {conta.is_group && <span className="text-muted-foreground">[Grupo]</span>}
                                    {conta.name}
                                    {conta.code === contaOrigem.codigo && (
                                      <span className="text-xs text-muted-foreground ml-1">(atual)</span>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          )}

                          {/* Also show other categories for flexibility */}
                          {Object.entries(contasAgrupadas)
                            .filter(([cat]) => cat !== novaCategoriaDre && cat !== 'sem_categoria')
                            .map(([categoria, contas]) => (
                              <SelectGroup key={categoria}>
                                <SelectLabel className="text-xs font-semibold text-muted-foreground">
                                  {getCategoriaLabel(categoria)}
                                </SelectLabel>
                                {contas.slice(0, 5).map((conta) => (
                                  <SelectItem 
                                    key={conta.id} 
                                    value={conta.id}
                                    disabled={conta.code === contaOrigem.codigo}
                                  >
                                    <div className="flex items-center gap-1">
                                      <span className="font-mono text-xs mr-2">{conta.code}</span>
                                      {conta.is_group && <span className="text-muted-foreground">[Grupo]</span>}
                                      {conta.name}
                                    </div>
                                  </SelectItem>
                                ))}
                                {contas.length > 5 && (
                                  <div className="px-2 py-1 text-xs text-muted-foreground">
                                    +{contas.length - 5} contas...
                                  </div>
                                )}
                              </SelectGroup>
                            ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Se não selecionar, apenas a categoria da conta será alterada.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Para fornecedor/departamento: mostra todas as contas */}
          {(contaOrigem.tipoDre === 'fornecedor' || contaOrigem.tipoDre === 'departamento') && (
            <div className="space-y-2">
              <Label>Mover lançamentos para a conta:</Label>
              <Select value={novaContaId} onValueChange={setNovaContaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta destino..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {loadingContas ? (
                    <div className="p-2 text-center text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    </div>
                  ) : contasDisponiveis.length === 0 ? (
                    <div className="p-2 text-center text-muted-foreground text-sm">
                      Nenhuma conta disponível
                    </div>
                  ) : (
                    <>
                      {/* Show accounts grouped by category */}
                      {Object.entries(contasAgrupadas).map(([categoria, contas]) => (
                        <SelectGroup key={categoria}>
                          <SelectLabel className="text-xs font-semibold text-muted-foreground py-2 flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${CATEGORIA_COLORS[categoria]?.split(' ')[0] || 'bg-muted'}`} />
                            {categoria === 'sem_categoria' ? 'Sem Categoria' : getCategoriaLabel(categoria)}
                          </SelectLabel>
                          {contas.map((conta) => (
                            <SelectItem 
                              key={conta.id} 
                              value={conta.id}
                            >
                              <div className="flex items-center gap-1">
                                <span className="font-mono text-xs mr-2">{conta.code}</span>
                                {conta.is_group && <span className="text-muted-foreground text-xs">[Grupo]</span>}
                                <span className={conta.is_group ? 'font-medium' : ''}>{conta.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Todos os {contaOrigem.lancamentosIds.length} lançamentos serão movidos para a conta selecionada.
              </p>
            </div>
          )}

          {/* Justificativa */}
          <div className="space-y-2">
            <Label>Justificativa (opcional)</Label>
            <Textarea
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Ex: Serviços jurídicos são despesas fixas, não custo de vendas..."
              rows={2}
            />
          </div>

          {/* Bloquear IA - only show when moving to another account */}
          {novaContaId && novaContaId !== 'mesma' && (
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
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleReclassificar}
            disabled={
              (contaOrigem.tipoDre === 'fornecedor' || contaOrigem.tipoDre === 'departamento') 
                ? !novaContaId || mutation.isPending
                : !novaCategoriaDre || mutation.isPending
            }
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : novaContaId && novaContaId !== 'mesma' ? (
              `Mover ${contaOrigem.lancamentosIds.length} lançamento(s)`
            ) : (
              `Alterar Categoria`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Password Confirmation Dialog */}
      <PasswordConfirmDialog
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
        onConfirm={handlePasswordConfirm}
        title="Confirmar Reclassificação"
        description="Para reclassificar esta conta, confirme sua senha. Esta ação será registrada no histórico."
        actionLabel="Confirmar Reclassificação"
      />
    </Dialog>
  );
}
