import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Ban, TrendingDown, RefreshCw, Eye, Clock, CheckCircle2,
  Trash2, Edit, Check, X, Calendar, User, Building2, FileText, Briefcase,
  History, Plus, Bell, MessageSquare, Phone, CreditCard, AlertCircle
} from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RevisaoGastosCardProps {
  revisao: any;
  onUpdateStatus: (id: string, status: string, resultadoObtido?: number) => void;
  onDelete: (id: string) => void;
  compact?: boolean;
}

const statusConfig = {
  pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock },
  em_andamento: { label: 'Em Andamento', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: RefreshCw },
  em_analise: { label: 'Em Análise', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', icon: Eye },
  concluido: { label: 'Concluído', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  cancelado: { label: 'Cancelado', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400', icon: Ban },
};

const tipoConfig = {
  eliminar: { label: 'Eliminar', color: 'text-red-500 bg-red-50 dark:bg-red-900/20', icon: Ban },
  reduzir: { label: 'Reduzir', color: 'text-orange-500 bg-orange-50 dark:bg-orange-900/20', icon: TrendingDown },
  renegociar: { label: 'Renegociar', color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20', icon: RefreshCw },
  monitorar: { label: 'Monitorar', color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20', icon: Eye },
};

const prioridadeConfig = {
  alta: { label: 'Alta', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', dot: 'bg-red-500' },
  media: { label: 'Média', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', dot: 'bg-yellow-500' },
  baixa: { label: 'Baixa', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', dot: 'bg-green-500' },
};

const tipoEventoConfig = {
  observacao: { label: 'Observação', icon: MessageSquare, color: 'text-gray-500' },
  lembrete: { label: 'Lembrete', icon: Bell, color: 'text-amber-500' },
  renegociacao: { label: 'Renegociação', icon: RefreshCw, color: 'text-blue-500' },
  contato: { label: 'Contato', icon: Phone, color: 'text-green-500' },
  vencimento: { label: 'Vencimento', icon: CreditCard, color: 'text-red-500' },
};

export function RevisaoGastosCard({ revisao, onUpdateStatus, onDelete, compact = false }: RevisaoGastosCardProps) {
  const queryClient = useQueryClient();
  const [isEditingResult, setIsEditingResult] = useState(false);
  const [resultadoObtido, setResultadoObtido] = useState(revisao.resultado_obtido?.toString() || '');
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isHistoricoOpen, setIsHistoricoOpen] = useState(false);
  const [isEventosOpen, setIsEventosOpen] = useState(false);
  const [novoEventoDialogOpen, setNovoEventoDialogOpen] = useState(false);
  const [novoEvento, setNovoEvento] = useState({
    tipo_evento: 'observacao',
    titulo: '',
    descricao: '',
    data_lembrete: '',
    valor_referencia: ''
  });

  const tipo = tipoConfig[revisao.tipo_revisao as keyof typeof tipoConfig] || tipoConfig.monitorar;
  const status = statusConfig[revisao.status as keyof typeof statusConfig] || statusConfig.pendente;
  const prioridade = prioridadeConfig[revisao.prioridade as keyof typeof prioridadeConfig] || prioridadeConfig.media;
  const TipoIcon = tipo.icon;
  const StatusIcon = status.icon;

  const nome = revisao.plano_contas?.name || revisao.categoria_nome || 'Item não identificado';
  const departamento = revisao.departamento?.nome;
  const responsavel = revisao.responsavel?.nome || revisao.responsavel?.email;
  
  const fornecedor = revisao.fornecedor_nome;
  const fornecedorCodigo = revisao.fornecedor_codigo;
  const documento = revisao.numero_documento;
  const dataVencimento = revisao.data_vencimento;
  const empresa = revisao.empresa_nome;
  const tipoDocumento = revisao.tipo_documento;
  
  const temDetalhes = fornecedor || documento || dataVencimento || empresa;
  const isMonitoramento = revisao.tipo_revisao === 'monitorar';
  
  const diasRestantes = revisao.prazo_revisao 
    ? differenceInDays(new Date(revisao.prazo_revisao), new Date())
    : null;

  // Buscar histórico do fornecedor
  const { data: historicoFornecedor, isLoading: loadingHistorico } = useQuery({
    queryKey: ['historico-fornecedor', fornecedor, fornecedorCodigo],
    queryFn: async () => {
      if (!fornecedor && !fornecedorCodigo) return [];
      
      let query = supabase
        .from('contas_pagar')
        .select('id, fornecedor_nome, numero_documento, data_vencimento, valor_original, valor_pago, status, categoria_nome, empresa_nome')
        .order('data_vencimento', { ascending: false })
        .limit(20);
      
      if (fornecedorCodigo) {
        query = query.eq('fornecedor_codigo', fornecedorCodigo);
      } else if (fornecedor) {
        query = query.ilike('fornecedor_nome', `%${fornecedor}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: isHistoricoOpen && (!!fornecedor || !!fornecedorCodigo)
  });

  // Buscar eventos da revisão
  const { data: eventos, isLoading: loadingEventos } = useQuery({
    queryKey: ['revisao-eventos', revisao.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('revisao_eventos')
        .select('*')
        .eq('revisao_id', revisao.id)
        .order('data_evento', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: isEventosOpen || isMonitoramento
  });

  // Mutation para criar evento
  const criarEventoMutation = useMutation({
    mutationFn: async (evento: typeof novoEvento) => {
      const { data, error } = await supabase
        .from('revisao_eventos')
        .insert({
          revisao_id: revisao.id,
          tipo_evento: evento.tipo_evento,
          titulo: evento.titulo,
          descricao: evento.descricao || null,
          data_lembrete: evento.data_lembrete || null,
          valor_referencia: evento.valor_referencia ? parseFloat(evento.valor_referencia) : null
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revisao-eventos', revisao.id] });
      setNovoEventoDialogOpen(false);
      setNovoEvento({ tipo_evento: 'observacao', titulo: '', descricao: '', data_lembrete: '', valor_referencia: '' });
      toast.success('Evento registrado com sucesso');
    },
    onError: () => {
      toast.error('Erro ao registrar evento');
    }
  });

  // Mutation para marcar evento como concluído
  const concluirEventoMutation = useMutation({
    mutationFn: async (eventoId: string) => {
      const { error } = await supabase
        .from('revisao_eventos')
        .update({ concluido: true })
        .eq('id', eventoId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revisao-eventos', revisao.id] });
      toast.success('Evento concluído');
    }
  });

  const handleConcluir = () => {
    if (resultadoObtido) {
      onUpdateStatus(revisao.id, 'concluido', parseFloat(resultadoObtido));
      setIsEditingResult(false);
    }
  };

  const handleCriarEvento = () => {
    if (!novoEvento.titulo.trim()) {
      toast.error('Preencha o título do evento');
      return;
    }
    criarEventoMutation.mutate(novoEvento);
  };

  // Cálculo de totais do histórico
  const totalHistorico = historicoFornecedor?.reduce((acc, item) => acc + (item.valor_original || 0), 0) || 0;
  const eventosPendentes = eventos?.filter(e => !e.concluido && e.data_lembrete) || [];

  if (compact) {
    return (
      <Card className="border-l-4" style={{ borderLeftColor: tipo.color.includes('red') ? '#ef4444' : tipo.color.includes('orange') ? '#f97316' : tipo.color.includes('blue') ? '#3b82f6' : '#a855f7' }}>
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <TipoIcon className={`h-4 w-4 flex-shrink-0 ${tipo.color.split(' ')[0]}`} />
              <div className="min-w-0">
                <p className="font-medium truncate text-sm">{nome}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {fornecedor && <span className="font-medium text-foreground">{fornecedor}</span>}
                  {departamento && <span>• {departamento}</span>}
                  {responsavel && <span>• {responsavel}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="font-mono font-semibold text-sm">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(revisao.valor_atual || 0)}
              </span>
              <Badge className={status.color} variant="secondary">
                {status.label}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-l-4 hover:shadow-md transition-shadow" style={{ borderLeftColor: tipo.color.includes('red') ? '#ef4444' : tipo.color.includes('orange') ? '#f97316' : tipo.color.includes('blue') ? '#3b82f6' : '#a855f7' }}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            {/* Lado esquerdo - Info principal */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${tipo.color}`}>
                  <TipoIcon className="h-3.5 w-3.5" />
                  {tipo.label}
                </div>
                <Badge className={prioridade.color} variant="secondary">
                  <span className={`w-1.5 h-1.5 rounded-full ${prioridade.dot} mr-1.5`} />
                  {prioridade.label}
                </Badge>
                <Badge className={status.color} variant="secondary">
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {status.label}
                </Badge>
                {eventosPendentes.length > 0 && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                    <Bell className="h-3 w-3 mr-1" />
                    {eventosPendentes.length} lembrete{eventosPendentes.length > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>

              <div>
                <h4 className="font-semibold text-base">{nome}</h4>
                
                {fornecedor && (
                  <div className="flex items-center gap-2 mt-1">
                    <Building2 className="h-4 w-4 text-primary" />
                    <span className="font-medium text-primary">{fornecedor}</span>
                    {fornecedorCodigo && <span className="text-xs text-muted-foreground">({fornecedorCodigo})</span>}
                  </div>
                )}
                
                <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 flex-wrap">
                  {departamento && (
                    <span className="flex items-center gap-1">
                      <Briefcase className="h-3.5 w-3.5" />
                      {departamento}
                    </span>
                  )}
                  {responsavel && (
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      {responsavel}
                    </span>
                  )}
                  {revisao.prazo_revisao && (
                    <span className={`flex items-center gap-1 ${diasRestantes !== null && diasRestantes < 0 ? 'text-red-500' : diasRestantes !== null && diasRestantes <= 7 ? 'text-yellow-600' : ''}`}>
                      <Calendar className="h-3.5 w-3.5" />
                      {format(parseISO(revisao.prazo_revisao), "dd/MM/yyyy", { locale: ptBR })}
                      {diasRestantes !== null && (
                        <span className="text-xs">
                          ({diasRestantes < 0 ? `${Math.abs(diasRestantes)}d atrás` : diasRestantes === 0 ? 'hoje' : `${diasRestantes}d`})
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </div>

              {/* Detalhes expandíveis */}
              {temDetalhes && (
                <Collapsible open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                      {isDetailsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {isDetailsOpen ? 'Ocultar detalhes' : 'Ver detalhes'}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 p-3 bg-muted/50 rounded-md space-y-1.5 text-sm">
                      {documento && (
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">Documento:</span>
                          <span className="font-medium">{documento}</span>
                          {tipoDocumento && <span className="text-xs text-muted-foreground">({tipoDocumento})</span>}
                        </div>
                      )}
                      {dataVencimento && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">Vencimento:</span>
                          <span className="font-medium">{format(parseISO(dataVencimento), 'dd/MM/yyyy')}</span>
                        </div>
                      )}
                      {empresa && (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">Empresa:</span>
                          <span className="font-medium">{empresa}</span>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Histórico do Fornecedor */}
              {fornecedor && (
                <Collapsible open={isHistoricoOpen} onOpenChange={setIsHistoricoOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                      <History className="h-3 w-3" />
                      {isHistoricoOpen ? 'Ocultar histórico' : 'Ver histórico do fornecedor'}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-md border border-blue-200/50">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-sm font-semibold flex items-center gap-1">
                          <History className="h-4 w-4 text-blue-500" />
                          Histórico de Pagamentos
                        </h5>
                        {historicoFornecedor && historicoFornecedor.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            Total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalHistorico)}
                          </span>
                        )}
                      </div>
                      
                      {loadingHistorico ? (
                        <p className="text-xs text-muted-foreground">Carregando...</p>
                      ) : historicoFornecedor && historicoFornecedor.length > 0 ? (
                        <ScrollArea className="max-h-48">
                          <div className="space-y-1.5">
                            {historicoFornecedor.map((item) => (
                              <div key={item.id} className="flex items-center justify-between text-xs p-2 bg-background/80 rounded">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-muted-foreground">
                                    {item.data_vencimento ? format(parseISO(item.data_vencimento), 'dd/MM/yy') : '-'}
                                  </span>
                                  <span className="truncate max-w-[150px]" title={item.numero_documento || ''}>
                                    {item.numero_documento || item.categoria_nome || 'S/N'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-medium">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor_original || 0)}
                                  </span>
                                  <Badge variant="outline" className={`text-[10px] h-4 ${item.status === 'pago' ? 'text-green-600' : item.status === 'vencido' ? 'text-red-600' : 'text-yellow-600'}`}>
                                    {item.status || 'pendente'}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      ) : (
                        <p className="text-xs text-muted-foreground">Nenhum histórico encontrado</p>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Eventos de Monitoramento */}
              {isMonitoramento && (
                <Collapsible open={isEventosOpen} onOpenChange={setIsEventosOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                      <Bell className="h-3 w-3" />
                      {isEventosOpen ? 'Ocultar eventos' : `Eventos de monitoramento ${eventos?.length ? `(${eventos.length})` : ''}`}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 p-3 bg-purple-50/50 dark:bg-purple-900/10 rounded-md border border-purple-200/50">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-sm font-semibold flex items-center gap-1">
                          <Bell className="h-4 w-4 text-purple-500" />
                          Eventos & Lembretes
                        </h5>
                        <Button size="sm" variant="outline" className="h-6 text-xs gap-1" onClick={() => setNovoEventoDialogOpen(true)}>
                          <Plus className="h-3 w-3" />
                          Novo Evento
                        </Button>
                      </div>
                      
                      {loadingEventos ? (
                        <p className="text-xs text-muted-foreground">Carregando...</p>
                      ) : eventos && eventos.length > 0 ? (
                        <ScrollArea className="max-h-48">
                          <div className="space-y-2">
                            {eventos.map((evento) => {
                              const eventoTipo = tipoEventoConfig[evento.tipo_evento as keyof typeof tipoEventoConfig] || tipoEventoConfig.observacao;
                              const EventoIcon = eventoTipo.icon;
                              const isPast = evento.data_lembrete && new Date(evento.data_lembrete) < new Date();
                              
                              return (
                                <div key={evento.id} className={`flex items-start gap-2 text-xs p-2 bg-background/80 rounded ${evento.concluido ? 'opacity-50' : ''}`}>
                                  <EventoIcon className={`h-3.5 w-3.5 mt-0.5 ${eventoTipo.color}`} />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{evento.titulo}</span>
                                      {evento.concluido && <Badge variant="outline" className="text-[9px] h-4">Concluído</Badge>}
                                      {!evento.concluido && isPast && evento.data_lembrete && (
                                        <Badge variant="destructive" className="text-[9px] h-4">
                                          <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
                                          Atrasado
                                        </Badge>
                                      )}
                                    </div>
                                    {evento.descricao && (
                                      <p className="text-muted-foreground mt-0.5">{evento.descricao}</p>
                                    )}
                                    <div className="flex items-center gap-3 mt-1 text-muted-foreground">
                                      <span>{format(parseISO(evento.data_evento), 'dd/MM/yy HH:mm')}</span>
                                      {evento.data_lembrete && (
                                        <span className="flex items-center gap-1">
                                          <Bell className="h-3 w-3" />
                                          {format(parseISO(evento.data_lembrete), 'dd/MM/yy')}
                                        </span>
                                      )}
                                      {evento.valor_referencia && (
                                        <span className="font-mono">
                                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(evento.valor_referencia)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {!evento.concluido && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6"
                                      onClick={() => concluirEventoMutation.mutate(evento.id)}
                                    >
                                      <Check className="h-3 w-3 text-green-500" />
                                    </Button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      ) : (
                        <div className="text-center py-3">
                          <p className="text-xs text-muted-foreground mb-2">Nenhum evento registrado</p>
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setNovoEventoDialogOpen(true)}>
                            <Plus className="h-3 w-3" />
                            Adicionar primeiro evento
                          </Button>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {revisao.observacoes && (
                <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded-md">
                  {revisao.observacoes}
                </p>
              )}
            </div>

            {/* Lado direito - Valores e ações */}
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Valor Atual</p>
                <p className="font-mono font-bold text-lg">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(revisao.valor_atual || 0)}
                </p>
              </div>

              {(revisao.meta_reducao_valor || revisao.meta_reducao_percentual) && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Meta de Redução</p>
                  <p className="font-mono text-sm text-orange-600">
                    {revisao.meta_reducao_percentual && `${revisao.meta_reducao_percentual}%`}
                    {revisao.meta_reducao_percentual && revisao.meta_reducao_valor && ' / '}
                    {revisao.meta_reducao_valor && new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(revisao.meta_reducao_valor)}
                  </p>
                </div>
              )}

              {revisao.status === 'concluido' && revisao.resultado_obtido && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Economia Obtida</p>
                  <p className="font-mono text-sm text-green-600 font-semibold">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(revisao.resultado_obtido)}
                  </p>
                </div>
              )}

              {/* Ações */}
              <div className="flex items-center gap-1 mt-2">
                {revisao.status === 'pendente' && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => onUpdateStatus(revisao.id, 'em_andamento')}
                  >
                    Iniciar
                  </Button>
                )}

                {revisao.status === 'em_andamento' && (
                  <>
                    {isEditingResult ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          placeholder="Valor economizado"
                          value={resultadoObtido}
                          onChange={(e) => setResultadoObtido(e.target.value)}
                          className="w-28 h-8 text-sm"
                        />
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleConcluir}>
                          <Check className="h-4 w-4 text-green-500" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsEditingResult(false)}>
                          <X className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="default"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => setIsEditingResult(true)}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Concluir
                      </Button>
                    )}
                  </>
                )}

                {/* Botão rápido para adicionar evento em monitoramento */}
                {isMonitoramento && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-purple-500 hover:text-purple-600"
                    onClick={() => setNovoEventoDialogOpen(true)}
                    title="Adicionar evento"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-8 w-8">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {revisao.status !== 'pendente' && (
                      <DropdownMenuItem onClick={() => onUpdateStatus(revisao.id, 'pendente')}>
                        <Clock className="h-4 w-4 mr-2" />
                        Marcar como Pendente
                      </DropdownMenuItem>
                    )}
                    {revisao.status !== 'em_andamento' && (
                      <DropdownMenuItem onClick={() => onUpdateStatus(revisao.id, 'em_andamento')}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Em Andamento
                      </DropdownMenuItem>
                    )}
                    {revisao.status !== 'em_analise' && (
                      <DropdownMenuItem onClick={() => onUpdateStatus(revisao.id, 'em_analise')}>
                        <Eye className="h-4 w-4 mr-2" />
                        Em Análise
                      </DropdownMenuItem>
                    )}
                    {revisao.status !== 'cancelado' && (
                      <DropdownMenuItem onClick={() => onUpdateStatus(revisao.id, 'cancelado')}>
                        <Ban className="h-4 w-4 mr-2" />
                        Cancelar
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-8 w-8 text-red-500 hover:text-red-600"
                  onClick={() => onDelete(revisao.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog para novo evento */}
      <Dialog open={novoEventoDialogOpen} onOpenChange={setNovoEventoDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Novo Evento de Monitoramento
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Evento</Label>
              <Select value={novoEvento.tipo_evento} onValueChange={(v) => setNovoEvento(prev => ({ ...prev, tipo_evento: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(tipoEventoConfig).map(([key, config]) => {
                    const Icon = config.icon;
                    return (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${config.color}`} />
                          {config.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                placeholder="Ex: Ligação agendada, Proposta enviada..."
                value={novoEvento.titulo}
                onChange={(e) => setNovoEvento(prev => ({ ...prev, titulo: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                placeholder="Detalhes adicionais..."
                value={novoEvento.descricao}
                onChange={(e) => setNovoEvento(prev => ({ ...prev, descricao: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data do Lembrete</Label>
                <Input
                  type="date"
                  value={novoEvento.data_lembrete}
                  onChange={(e) => setNovoEvento(prev => ({ ...prev, data_lembrete: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Valor Referência</Label>
                <Input
                  type="number"
                  placeholder="0,00"
                  value={novoEvento.valor_referencia}
                  onChange={(e) => setNovoEvento(prev => ({ ...prev, valor_referencia: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoEventoDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCriarEvento} disabled={criarEventoMutation.isPending}>
              {criarEventoMutation.isPending ? 'Salvando...' : 'Salvar Evento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}