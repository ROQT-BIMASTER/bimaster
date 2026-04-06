import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  Bot, User, Lock, Save, History, FileText, Sparkles, 
  Building2, Calendar, DollarSign, Tag, Clock, AlertCircle,
  ChevronRight, Loader2, EyeOff, Eye
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Lancamento {
  id: string;
  fornecedor_nome: string | null;
  fornecedor_codigo: string | null;
  categoria_nome: string | null;
  categoria_codigo: string | null;
  valor_original: number | null;
  valor_pago: number | null;
  valor_aberto: number | null;
  data_vencimento: string | null;
  data_emissao: string | null;
  data_pagamento: string | null;
  numero_documento: string | null;
  tipo_documento: string | null;
  empresa_nome: string | null;
  departamento_id: string | null;
  departamento_nome: string | null;
  plano_contas_id: string | null;
  plano_contas_codigo: string | null;
  plano_contas_nome: string | null;
  confianca_classificacao: number | null;
  classificado_automaticamente: boolean | null;
  classificacao_manual: boolean | null;
  classificacao_justificativa: string | null;
  status: string | null;
  ativo_dre: boolean | null;
}

interface HistoricoItem {
  id: string;
  campo_alterado: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  tipo_alteracao: string;
  justificativa: string | null;
  usuario_nome: string | null;
  created_at: string;
}

interface DetalheLancamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lancamento: Lancamento | null;
  onSuccess: () => void;
}

export function DetalheLancamentoDialog({
  open,
  onOpenChange,
  lancamento,
  onSuccess
}: DetalheLancamentoDialogProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("detalhes");
  const [departamentoId, setDepartamentoId] = useState<string>("");
  const [planoContasId, setPlanoContasId] = useState<string>("");
  const [justificativa, setJustificativa] = useState("");
  const [bloquearReclassificacao, setBloquearReclassificacao] = useState(false);
  const [ativoDRE, setAtivoDRE] = useState(true);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [sugestaoIA, setSugestaoIA] = useState<{departamento?: string; planoContas?: string; confianca?: number} | null>(null);
  const [comentarioIA, setComentarioIA] = useState("");

  // Carregar departamentos
  const { data: departamentos } = useQuery({
    queryKey: ['departamentos-detalhe'],
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
    queryKey: ['planos-contas-detalhe'],
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

  // Carregar histórico de alterações
  const { data: historico, refetch: refetchHistorico } = useQuery({
    queryKey: ['historico-lancamento', lancamento?.id],
    queryFn: async () => {
      if (!lancamento?.id) return [];
      const { data, error } = await supabase
        .from('contas_pagar_historico')
        .select('*')
        .eq('conta_id', lancamento.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as HistoricoItem[];
    },
    enabled: !!lancamento?.id
  });

  // Resetar campos quando o lançamento mudar
  useEffect(() => {
    if (lancamento) {
      setDepartamentoId(lancamento.departamento_id || "");
      setPlanoContasId(lancamento.plano_contas_id || "");
      setBloquearReclassificacao(lancamento.classificacao_manual || false);
      setAtivoDRE(lancamento.ativo_dre !== false);
      setJustificativa("");
      setSugestaoIA(null);
      setComentarioIA("");
    }
  }, [lancamento]);

  // Registrar alteração no histórico
  const registrarHistorico = async (
    contaId: string,
    campo: string,
    valorAnterior: string | null,
    valorNovo: string | null,
    tipoAlteracao: 'manual' | 'ia' | 'sistema',
    justificativaTexto?: string
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from('profiles')
      .select('nome')
      .eq('id', user?.id)
      .single();

    try {
      await supabase.from('contas_pagar_historico').insert({
        conta_id: contaId,
        campo_alterado: campo,
        valor_anterior: valorAnterior,
        valor_novo: valorNovo,
        tipo_alteracao: tipoAlteracao,
        justificativa: justificativaTexto || null,
        usuario_id: user?.id,
        usuario_nome: profile?.nome || user?.email
      });
    } catch (e) {
      console.warn('Falha ao registrar histórico (trigger cobre):', e);
    }
  };

  // Mutation para salvar (manual)
  const salvarManual = useMutation({
    mutationFn: async () => {
      if (!lancamento) return;

      const { data: { user } } = await supabase.auth.getUser();
      
      const dept = departamentos?.find(d => d.id === departamentoId);
      const plano = planosContas?.find(p => p.id === planoContasId);

      // Registrar alterações no histórico
      if (departamentoId !== (lancamento.departamento_id || "")) {
        await registrarHistorico(
          lancamento.id,
          'departamento',
          lancamento.departamento_nome || null,
          dept?.nome || null,
          'manual',
          justificativa
        );
      }

      if (planoContasId !== (lancamento.plano_contas_id || "")) {
        await registrarHistorico(
          lancamento.id,
          'plano_contas',
          lancamento.plano_contas_nome || null,
          plano?.name || null,
          'manual',
          justificativa
        );
      }

      if (ativoDRE !== (lancamento.ativo_dre !== false)) {
        await registrarHistorico(
          lancamento.id,
          'ativo_dre',
          lancamento.ativo_dre !== false ? 'Ativo' : 'Inativo',
          ativoDRE ? 'Ativo' : 'Inativo',
          'manual',
          justificativa || (ativoDRE ? 'Lançamento reativado no DRE' : 'Lançamento inativado no DRE')
        );
      }

      // Atualizar a conta
      const { error } = await supabase
        .from('contas_pagar')
        .update({
          departamento_id: departamentoId || null,
          departamento_nome: dept?.nome || null,
          plano_contas_id: planoContasId || null,
          plano_contas_codigo: plano?.code || null,
          plano_contas_nome: plano?.name || null,
          classificacao_manual: bloquearReclassificacao,
          ativo_dre: ativoDRE,
          classificacao_corrigida_por: user?.id || null,
          classificacao_corrigida_em: new Date().toISOString(),
          classificacao_justificativa: justificativa || null
        })
        .eq('id', lancamento.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Classificação salva com sucesso!');
      refetchHistorico();
      queryClient.invalidateQueries({ queryKey: ['lancamentos-dre'] });
      onSuccess();
    },
    onError: (error) => {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar classificação');
    }
  });

  // Solicitar sugestão da IA
  const solicitarSugestaoIA = async () => {
    if (!lancamento) return;
    
    setIsLoadingAI(true);
    setSugestaoIA(null);

    try {
      const { data, error } = await supabase.functions.invoke('classificar-conta-departamento', {
        body: {
          fornecedor: lancamento.fornecedor_nome,
          categoria: lancamento.categoria_nome,
          valor: lancamento.valor_original,
          documento: lancamento.tipo_documento,
          comentario: comentarioIA || undefined
        }
      });

      if (error) throw error;

      if (data?.sugestao) {
        setSugestaoIA({
          departamento: data.sugestao.departamento_id,
          planoContas: data.sugestao.plano_contas_id,
          confianca: data.sugestao.confianca
        });
        toast.success('Sugestão da IA recebida!');
      } else {
        toast.info('IA não conseguiu gerar sugestão para este lançamento');
      }
    } catch (error) {
      console.error('Erro ao solicitar IA:', error);
      toast.error('Erro ao solicitar sugestão da IA');
    } finally {
      setIsLoadingAI(false);
    }
  };

  // Aplicar sugestão da IA
  const aplicarSugestaoIA = useMutation({
    mutationFn: async () => {
      if (!lancamento || !sugestaoIA) return;

      const { data: { user } } = await supabase.auth.getUser();
      
      const dept = departamentos?.find(d => d.id === sugestaoIA.departamento);
      const plano = planosContas?.find(p => p.id === sugestaoIA.planoContas);

      // Registrar no histórico como alteração por IA
      if (sugestaoIA.departamento && sugestaoIA.departamento !== lancamento.departamento_id) {
        await registrarHistorico(
          lancamento.id,
          'departamento',
          lancamento.departamento_nome || null,
          dept?.nome || null,
          'ia',
          `Sugestão IA aplicada com ${((sugestaoIA.confianca || 0) * 100).toFixed(0)}% de confiança`
        );
      }

      if (sugestaoIA.planoContas && sugestaoIA.planoContas !== lancamento.plano_contas_id) {
        await registrarHistorico(
          lancamento.id,
          'plano_contas',
          lancamento.plano_contas_nome || null,
          plano?.name || null,
          'ia',
          `Sugestão IA aplicada com ${((sugestaoIA.confianca || 0) * 100).toFixed(0)}% de confiança`
        );
      }

      const { error } = await supabase
        .from('contas_pagar')
        .update({
          departamento_id: sugestaoIA.departamento || lancamento.departamento_id,
          departamento_nome: dept?.nome || lancamento.departamento_nome,
          plano_contas_id: sugestaoIA.planoContas || lancamento.plano_contas_id,
          plano_contas_codigo: plano?.code || lancamento.plano_contas_codigo,
          plano_contas_nome: plano?.name || lancamento.plano_contas_nome,
          classificacao_corrigida_por: user?.id || null,
          classificacao_corrigida_em: new Date().toISOString(),
          confianca_classificacao: sugestaoIA.confianca
        })
        .eq('id', lancamento.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Sugestão da IA aplicada!');
      refetchHistorico();
      queryClient.invalidateQueries({ queryKey: ['lancamentos-dre'] });
      setSugestaoIA(null);
      onSuccess();
    },
    onError: (error) => {
      console.error('Erro ao aplicar sugestão:', error);
      toast.error('Erro ao aplicar sugestão');
    }
  });

  const formatarCampo = (campo: string): string => {
    const mapa: Record<string, string> = {
      'departamento': 'Departamento',
      'plano_contas': 'Plano de Contas',
      'categoria': 'Categoria',
      'fornecedor': 'Fornecedor',
      'ativo_dre': 'Status DRE'
    };
    return mapa[campo] || campo;
  };

  const formatarTipoAlteracao = (tipo: string): { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'outline' } => {
    switch (tipo) {
      case 'ia':
        return { label: 'IA', icon: <Bot className="h-3 w-3" />, variant: 'secondary' };
      case 'manual':
        return { label: 'Manual', icon: <User className="h-3 w-3" />, variant: 'default' };
      default:
        return { label: 'Sistema', icon: <AlertCircle className="h-3 w-3" />, variant: 'outline' };
    }
  };

  if (!lancamento) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Detalhes do Lançamento
            {lancamento.classificacao_manual && (
              <Badge variant="default" className="gap-1 ml-2">
                <Lock className="h-3 w-3" />
                Bloqueado
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="detalhes" className="gap-1">
              <FileText className="h-4 w-4" />
              Detalhes
            </TabsTrigger>
            <TabsTrigger value="classificacao" className="gap-1">
              <Tag className="h-4 w-4" />
              Classificação
            </TabsTrigger>
            <TabsTrigger value="historico" className="gap-1">
              <History className="h-4 w-4" />
              Histórico
              {historico && historico.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                  {historico.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Tab Detalhes */}
          <TabsContent value="detalhes" className="mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Fornecedor</p>
                    <p className="text-sm font-medium">{lancamento.fornecedor_nome || 'Não informado'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Tag className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Categoria</p>
                    <p className="text-sm font-medium">{lancamento.categoria_nome || 'Não informada'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Documento</p>
                    <p className="text-sm font-medium">{lancamento.numero_documento || '-'} ({lancamento.tipo_documento || 'N/A'})</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Empresa</p>
                    <p className="text-sm font-medium">{lancamento.empresa_nome || 'Não informada'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <DollarSign className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Valor Original</p>
                    <p className="text-sm font-bold text-primary">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lancamento.valor_original || 0)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Vencimento</p>
                    <p className="text-sm font-medium">
                      {lancamento.data_vencimento ? format(new Date(lancamento.data_vencimento), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Badge variant={lancamento.status === 'pago' ? 'default' : lancamento.status === 'vencido' ? 'destructive' : 'secondary'}>
                      {lancamento.status || 'pendente'}
                    </Badge>
                  </div>
                </div>

                {lancamento.classificado_automaticamente && !lancamento.classificacao_manual && (
                  <div className="flex items-start gap-2">
                    <Bot className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Classificação IA</p>
                      <Badge variant="secondary" className="gap-1">
                        <Bot className="h-3 w-3" />
                        {lancamento.confianca_classificacao ? `${(lancamento.confianca_classificacao * 100).toFixed(0)}%` : 'N/A'}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Tab Classificação */}
          <TabsContent value="classificacao" className="mt-4 space-y-4">
            {/* Sugestão IA */}
            <div className="bg-muted/30 rounded-lg p-4 border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Sugestão com IA</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={solicitarSugestaoIA}
                  disabled={isLoadingAI}
                >
                  {isLoadingAI ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analisando...
                    </>
                  ) : (
                    <>
                      <Bot className="h-4 w-4 mr-2" />
                      Sugerir com IA
                    </>
                  )}
                </Button>
              </div>

              {/* Campo de comentário para ajudar a IA */}
              <div className="space-y-2 mb-3">
                <Label className="text-xs text-muted-foreground">Comentário para ajudar a IA (opcional)</Label>
                <Textarea
                  placeholder="Ex: Esta despesa é referente a serviços de TI para o setor comercial..."
                  value={comentarioIA}
                  onChange={(e) => setComentarioIA(e.target.value)}
                  rows={2}
                  className="text-sm"
                />
              </div>

              {sugestaoIA && (
                <div className="space-y-2 mt-3 pt-3 border-t">
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Departamento: </span>
                      <span className="font-medium">
                        {departamentos?.find(d => d.id === sugestaoIA.departamento)?.nome || 'N/A'}
                      </span>
                    </div>
                    <Badge variant="secondary">
                      {((sugestaoIA.confianca || 0) * 100).toFixed(0)}% confiança
                    </Badge>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Plano de Contas: </span>
                    <span className="font-medium">
                      {planosContas?.find(p => p.id === sugestaoIA.planoContas)?.name || 'N/A'}
                    </span>
                  </div>
                  <Button 
                    size="sm" 
                    className="w-full mt-2"
                    onClick={() => aplicarSugestaoIA.mutate()}
                    disabled={aplicarSugestaoIA.isPending}
                  >
                    <Bot className="h-4 w-4 mr-2" />
                    Aplicar Sugestão
                  </Button>
                </div>
              )}
            </div>

            <Separator />

            {/* Edição Manual */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Edição Manual</span>
              </div>

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

              <div className="space-y-2">
                <Label>Plano de Contas</Label>
                <Select value={planoContasId} onValueChange={setPlanoContasId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a conta..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[250px]">
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

              <div className="space-y-2">
                <Label>Justificativa da Alteração</Label>
                <Textarea
                  placeholder="Descreva o motivo da alteração..."
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="bloquear-detalhe"
                    checked={bloquearReclassificacao}
                    onCheckedChange={(checked) => setBloquearReclassificacao(checked as boolean)}
                  />
                  <Label htmlFor="bloquear-detalhe" className="flex items-center gap-2 cursor-pointer text-sm">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    Bloquear reclassificação
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="ativo-dre"
                    checked={ativoDRE}
                    onCheckedChange={setAtivoDRE}
                  />
                  <Label htmlFor="ativo-dre" className="flex items-center gap-2 cursor-pointer text-sm">
                    {ativoDRE ? (
                      <>
                        <Eye className="h-4 w-4 text-emerald-600" />
                        <span className="text-emerald-600">Ativo no DRE</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Inativo no DRE</span>
                      </>
                    )}
                  </Label>
                </div>
              </div>

              <Button 
                className="w-full" 
                onClick={() => salvarManual.mutate()}
                disabled={salvarManual.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                {salvarManual.isPending ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </TabsContent>

          {/* Tab Histórico */}
          <TabsContent value="historico" className="mt-4">
            <ScrollArea className="h-[350px] pr-4">
              {historico && historico.length > 0 ? (
                <div className="space-y-3">
                  {historico.map((item, index) => {
                    const tipoInfo = formatarTipoAlteracao(item.tipo_alteracao);
                    return (
                      <div key={item.id} className="relative pl-6 pb-3">
                        {/* Linha vertical */}
                        {index < historico.length - 1 && (
                          <div className="absolute left-2 top-6 bottom-0 w-px bg-border" />
                        )}
                        
                        {/* Ponto na timeline */}
                        <div className="absolute left-0 top-1 w-4 h-4 rounded-full bg-muted flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        </div>

                        <div className="bg-muted/30 rounded-lg p-3 border">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant={tipoInfo.variant} className="gap-1 text-[10px]">
                                {tipoInfo.icon}
                                {tipoInfo.label}
                              </Badge>
                              <span className="text-xs font-medium">{formatarCampo(item.campo_alterado)}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground line-through">{item.valor_anterior || 'Vazio'}</span>
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium">{item.valor_novo || 'Vazio'}</span>
                          </div>

                          {item.justificativa && (
                            <p className="text-[10px] text-muted-foreground mt-2 italic">
                              "{item.justificativa}"
                            </p>
                          )}

                          {item.usuario_nome && (
                            <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground">
                              <User className="h-3 w-3" />
                              {item.usuario_nome}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <History className="h-12 w-12 mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma alteração registrada</p>
                  <p className="text-xs">As alterações feitas aparecerão aqui</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}