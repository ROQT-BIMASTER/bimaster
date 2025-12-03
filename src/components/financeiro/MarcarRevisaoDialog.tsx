import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Ban, TrendingDown, RefreshCw, Eye, Flag, Building2, FileText, Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";

interface MarcarRevisaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contaId?: string;
  planoContasId?: string;
  departamentoId?: string;
  categoriaNome?: string;
  valorAtual: number;
  nomeItem: string;
  // Novos campos para detalhamento
  fornecedorNome?: string;
  fornecedorCodigo?: string;
  numeroDocumento?: string;
  dataVencimento?: string;
  empresaNome?: string;
  tipoDocumento?: string;
  onSuccess?: () => void;
}

const tiposRevisao = [
  { value: 'eliminar', label: 'Eliminar', icon: Ban, color: 'text-red-500', description: 'Remover completamente este gasto' },
  { value: 'reduzir', label: 'Reduzir', icon: TrendingDown, color: 'text-orange-500', description: 'Diminuir o valor deste gasto' },
  { value: 'renegociar', label: 'Renegociar', icon: RefreshCw, color: 'text-blue-500', description: 'Renegociar condições com fornecedor' },
  { value: 'monitorar', label: 'Monitorar', icon: Eye, color: 'text-purple-500', description: 'Acompanhar evolução' },
];

const prioridades = [
  { value: 'alta', label: 'Alta', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  { value: 'media', label: 'Média', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  { value: 'baixa', label: 'Baixa', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
];

export function MarcarRevisaoDialog({
  open,
  onOpenChange,
  contaId,
  planoContasId,
  departamentoId,
  categoriaNome,
  valorAtual,
  nomeItem,
  fornecedorNome,
  fornecedorCodigo,
  numeroDocumento,
  dataVencimento,
  empresaNome,
  tipoDocumento,
  onSuccess
}: MarcarRevisaoDialogProps) {
  const [tipoRevisao, setTipoRevisao] = useState<string>('reduzir');
  const [prioridade, setPrioridade] = useState<string>('media');
  const [metaReducaoPercentual, setMetaReducaoPercentual] = useState<string>('');
  const [metaReducaoValor, setMetaReducaoValor] = useState<string>('');
  const [responsavelId, setResponsavelId] = useState<string>('');
  const [prazoRevisao, setPrazoRevisao] = useState<string>('');
  const [observacoes, setObservacoes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: usuarios } = useQuery({
    queryKey: ['usuarios-revisao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome, email');
      if (error) throw error;
      return data;
    }
  });

  const handleMetaPercentualChange = (value: string) => {
    setMetaReducaoPercentual(value);
    if (value && valorAtual > 0) {
      const valorMeta = (valorAtual * parseFloat(value)) / 100;
      setMetaReducaoValor(valorMeta.toFixed(2));
    }
  };

  const handleMetaValorChange = (value: string) => {
    setMetaReducaoValor(value);
    if (value && valorAtual > 0) {
      const percentualMeta = (parseFloat(value) / valorAtual) * 100;
      setMetaReducaoPercentual(percentualMeta.toFixed(1));
    }
  };

  const handleSubmit = async () => {
    if (!tipoRevisao) {
      toast.error("Selecione o tipo de revisão");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('contas_pagar_revisao')
        .insert({
          conta_id: contaId || null,
          plano_contas_id: planoContasId || null,
          departamento_id: departamentoId || null,
          categoria_nome: categoriaNome || null,
          tipo_revisao: tipoRevisao,
          prioridade,
          meta_reducao_percentual: metaReducaoPercentual ? parseFloat(metaReducaoPercentual) : null,
          meta_reducao_valor: metaReducaoValor ? parseFloat(metaReducaoValor) : null,
          valor_atual: valorAtual,
          responsavel_id: responsavelId || null,
          prazo_revisao: prazoRevisao || null,
          observacoes: observacoes || null,
          criado_por: user?.id || null,
          status: 'pendente',
          // Novos campos de detalhamento
          fornecedor_nome: fornecedorNome || null,
          fornecedor_codigo: fornecedorCodigo || null,
          numero_documento: numeroDocumento || null,
          data_vencimento: dataVencimento || null,
          empresa_nome: empresaNome || null,
          tipo_documento: tipoDocumento || null,
        });

      if (error) throw error;

      toast.success("Item marcado para revisão!");
      onOpenChange(false);
      onSuccess?.();
      
      // Reset form
      setTipoRevisao('reduzir');
      setPrioridade('media');
      setMetaReducaoPercentual('');
      setMetaReducaoValor('');
      setResponsavelId('');
      setPrazoRevisao('');
      setObservacoes('');
    } catch (error: any) {
      toast.error("Erro ao marcar para revisão: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const tipoSelecionado = tiposRevisao.find(t => t.value === tipoRevisao);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-amber-500" />
            Marcar para Revisão
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Item sendo marcado */}
          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <p className="text-sm text-muted-foreground">Item selecionado:</p>
            <p className="font-medium">{nomeItem}</p>
            <p className="text-lg font-bold text-primary">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorAtual)}
            </p>
            
            {/* Detalhes do lançamento */}
            {(fornecedorNome || numeroDocumento || dataVencimento || empresaNome) && (
              <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                {fornecedorNome && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Fornecedor:</span>
                    <span className="font-medium">{fornecedorNome}</span>
                    {fornecedorCodigo && <span className="text-xs text-muted-foreground">({fornecedorCodigo})</span>}
                  </div>
                )}
                {numeroDocumento && (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Documento:</span>
                    <span className="font-medium">{numeroDocumento}</span>
                    {tipoDocumento && <span className="text-xs text-muted-foreground">({tipoDocumento})</span>}
                  </div>
                )}
                {dataVencimento && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Vencimento:</span>
                    <span className="font-medium">{format(parseISO(dataVencimento), 'dd/MM/yyyy')}</span>
                  </div>
                )}
                {empresaNome && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Empresa:</span>
                    <span className="font-medium">{empresaNome}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tipo de Revisão */}
          <div className="space-y-2">
            <Label>Tipo de Ação *</Label>
            <div className="grid grid-cols-2 gap-2">
              {tiposRevisao.map((tipo) => {
                const Icon = tipo.icon;
                const isSelected = tipoRevisao === tipo.value;
                return (
                  <button
                    key={tipo.value}
                    type="button"
                    onClick={() => setTipoRevisao(tipo.value)}
                    className={`p-3 rounded-lg border-2 transition-all text-left ${
                      isSelected 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${tipo.color}`} />
                      <span className="font-medium text-sm">{tipo.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{tipo.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Prioridade */}
          <div className="space-y-2">
            <Label>Prioridade</Label>
            <Select value={prioridade} onValueChange={setPrioridade}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {prioridades.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${p.color}`}>
                      {p.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Meta de Redução */}
          {(tipoRevisao === 'reduzir' || tipoRevisao === 'renegociar') && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Meta de Redução (%)</Label>
                <Input
                  type="number"
                  placeholder="Ex: 20"
                  value={metaReducaoPercentual}
                  onChange={(e) => handleMetaPercentualChange(e.target.value)}
                  min="0"
                  max="100"
                />
              </div>
              <div className="space-y-2">
                <Label>Meta de Redução (R$)</Label>
                <Input
                  type="number"
                  placeholder="Ex: 5000"
                  value={metaReducaoValor}
                  onChange={(e) => handleMetaValorChange(e.target.value)}
                  min="0"
                />
              </div>
            </div>
          )}

          {/* Responsável */}
          <div className="space-y-2">
            <Label>Responsável</Label>
            <Select value={responsavelId} onValueChange={setResponsavelId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um responsável" />
              </SelectTrigger>
              <SelectContent>
                {usuarios?.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nome || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Prazo */}
          <div className="space-y-2">
            <Label>Prazo para Revisão</Label>
            <Input
              type="date"
              value={prazoRevisao}
              onChange={(e) => setPrazoRevisao(e.target.value)}
            />
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              placeholder="Descreva o motivo da revisão e ações planejadas..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Salvando..." : "Marcar para Revisão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}