import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription 
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertCircle, 
  Clock, CheckCircle, Receipt, X
} from "lucide-react";
import { 
  format, startOfMonth, endOfMonth, eachDayOfInterval, 
  isToday, addMonths, subMonths, getDay
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { getDateKey, getToday } from "@/utils/dateUtils";

interface CalendarioRecebimentosAggregatedProps {
  filterEmpresas: number[];
  filterAno: string;
  filterConta: string;
  filterPortador: string;
}

interface ContaReceber {
  id: string;
  numero_documento: string;
  parcela: number;
  cliente_nome: string;
  empresa_nome: string;
  valor_original: number;
  valor_aberto: number;
  status: string;
  data_vencimento: string;
}

const formatCurrency = (value: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatCompact = (value: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(value);

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface DiaCalendario {
  data: string;
  qtd: number;
  valor_total: number;
  qtd_recebido: number;
  valor_recebido: number;
  qtd_pendente: number;
  valor_pendente: number;
  qtd_vencido: number;
  valor_vencido: number;
}

export function CalendarioRecebimentosAggregated({ 
  filterEmpresas, 
  filterAno, 
  filterConta, 
  filterPortador 
}: CalendarioRecebimentosAggregatedProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Query para buscar detalhes do dia selecionado
  const { data: detalheDia, isLoading: isLoadingDetalhe } = useQuery({
    queryKey: ['contas-receber-dia', selectedDate?.toISOString(), filterEmpresas.sort().join(','), filterConta, filterPortador],
    queryFn: async () => {
      if (!selectedDate) return [];
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      let query = supabase
        .from('contas_receber')
        .select('id, numero_documento, parcela, cliente_nome, empresa_nome, valor_original, valor_aberto, status, data_vencimento')
        .eq('data_vencimento', dateStr)
        .order('cliente_nome');
      
      if (filterEmpresas.length > 0) {
        query = query.in('empresa_id', filterEmpresas);
      }
      if (filterConta !== 'all') {
        query = query.eq('conta', filterConta);
      }
      if (filterPortador !== 'all') {
        query = query.eq('portador', filterPortador);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as ContaReceber[]) || [];
    },
    enabled: !!selectedDate && isDialogOpen,
  });

  const handleDayClick = (date: Date, hasData: boolean) => {
    if (hasData) {
      setSelectedDate(date);
      setIsDialogOpen(true);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusLower = (status || '').toLowerCase();
    if (statusLower === 'recebido') return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Recebido</Badge>;
    if (statusLower === 'vencido') return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Vencido</Badge>;
    if (statusLower === 'parcial') return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Parcial</Badge>;
    return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Pendente</Badge>;
  };

  // Query calendário agregado
  const { data: calendarioData, isLoading } = useQuery({
    queryKey: ['contas-receber-calendario-agg', filterEmpresas.sort().join(','), filterAno, filterConta, filterPortador],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_contas_receber_calendario', {
        p_empresas: filterEmpresas.length > 0 ? filterEmpresas : null,
        p_ano: filterAno !== 'all' ? parseInt(filterAno) : null,
        p_conta: filterConta !== 'all' ? filterConta : null,
        p_portador: filterPortador !== 'all' ? filterPortador : null,
      });
      if (error) throw error;
      return (data as unknown as DiaCalendario[]) || [];
    }
  });

  // Gerar dias do mês
  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Primeiro dia da semana do mês
  const firstDayOfWeek = getDay(startOfMonth(currentDate));

  // Mapa de dados por dia
  const dadosPorDia = useMemo(() => {
    const map = new Map<string, DiaCalendario>();
    (calendarioData || []).forEach(d => {
      map.set(d.data, d);
    });
    return map;
  }, [calendarioData]);

  // Resumo do mês
  const resumoMes = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const startKey = format(start, 'yyyy-MM-dd');
    const endKey = format(end, 'yyyy-MM-dd');

    let total = 0, pendente = 0, vencido = 0, recebido = 0, qtdTitulos = 0;

    (calendarioData || []).forEach(d => {
      if (d.data >= startKey && d.data <= endKey) {
        qtdTitulos += d.qtd;
        total += d.valor_total || 0;
        recebido += d.valor_recebido || 0;
        pendente += d.valor_pendente || 0;
        vencido += d.valor_vencido || 0;
      }
    });

    return { total, pendente, vencido, recebido, qtdTitulos };
  }, [calendarioData, currentDate]);

  // Obter info do dia
  const getDayInfo = (date: Date) => {
    const key = getDateKey(date);
    const dados = dadosPorDia.get(key);
    const hoje = getToday();
    
    if (!dados) {
      return { 
        valorTotal: 0, 
        qtdPendente: 0, 
        qtdRecebido: 0, 
        qtdVencido: 0, 
        status: 'empty' as const 
      };
    }

    const qtdPendente = dados.qtd_pendente || 0;
    const qtdRecebido = dados.qtd_recebido || 0;
    const qtdVencido = dados.qtd_vencido || 0;
    
    let status: 'empty' | 'success' | 'warning' | 'danger' = 'empty';
    if (qtdVencido > 0) status = 'danger';
    else if (qtdPendente > 0) status = 'warning';
    else if (qtdRecebido > 0) status = 'success';

    return {
      valorTotal: dados.valor_total || 0,
      qtdPendente,
      qtdRecebido,
      qtdVencido,
      status,
    };
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span>Carregando calendário...</span>
            </div>
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-muted rounded w-1/3 mx-auto"></div>
              <div className="grid grid-cols-7 gap-2">
                {[...Array(35)].map((_, i) => (
                  <div key={i} className="h-20 bg-muted rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Calendário de Recebimentos
              </CardTitle>
              <CardDescription>Visão agregada por dia de vencimento</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-medium min-w-[140px] text-center">
                {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Resumo do Mês */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className="text-sm text-muted-foreground">Total</div>
              <div className="font-bold">{formatCompact(resumoMes.total)}</div>
              <div className="text-xs text-muted-foreground">{resumoMes.qtdTitulos} títulos</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
              <div className="text-sm text-green-600">Recebido</div>
              <div className="font-bold text-green-600">{formatCompact(resumoMes.recebido)}</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
              <div className="text-sm text-yellow-600">Pendente</div>
              <div className="font-bold text-yellow-600">{formatCompact(resumoMes.pendente)}</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950/20">
              <div className="text-sm text-red-600">Vencido</div>
              <div className="font-bold text-red-600">{formatCompact(resumoMes.vencido)}</div>
            </div>
          </div>

          {/* Cabeçalho dos dias */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAYS.map(day => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Dias do mês */}
          <div className="grid grid-cols-7 gap-1">
            {/* Espaços vazios antes do primeiro dia */}
            {[...Array(firstDayOfWeek)].map((_, i) => (
              <div key={`empty-${i}`} className="h-20 rounded-lg" />
            ))}

            {/* Dias do mês */}
            {daysInMonth.map(date => {
              const info = getDayInfo(date);
              const isHoje = isToday(date);

              return (
                <div
                  key={date.toISOString()}
                  onClick={() => handleDayClick(date, info.valorTotal > 0)}
                  className={`
                    h-20 p-1 rounded-lg border transition-colors
                    ${info.valorTotal > 0 ? 'cursor-pointer hover:shadow-md hover:scale-[1.02]' : ''}
                    ${isHoje ? 'ring-2 ring-primary' : ''}
                    ${info.status === 'danger' ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800' : ''}
                    ${info.status === 'warning' ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800' : ''}
                    ${info.status === 'success' ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' : ''}
                    ${info.status === 'empty' ? 'bg-background border-border' : ''}
                  `}
                >
                  <div className="flex flex-col h-full">
                    <div className={`text-sm font-medium ${isHoje ? 'text-primary' : ''}`}>
                      {format(date, 'd')}
                    </div>
                    {info.valorTotal > 0 && (
                      <div className="flex-1 flex flex-col justify-center items-center text-center">
                        <div className="text-xs font-bold">
                          {formatCompact(info.valorTotal)}
                        </div>
                        <div className="flex gap-1 mt-1">
                          {info.qtdRecebido > 0 && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 bg-green-100 text-green-700">
                              {info.qtdRecebido}
                            </Badge>
                          )}
                          {info.qtdPendente > 0 && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 bg-yellow-100 text-yellow-700">
                              {info.qtdPendente}
                            </Badge>
                          )}
                          {info.qtdVencido > 0 && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 bg-red-100 text-red-700">
                              {info.qtdVencido}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legenda */}
          <div className="flex gap-4 mt-4 justify-center text-sm">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-green-200"></div>
              <span className="text-muted-foreground">Recebido</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-yellow-200"></div>
              <span className="text-muted-foreground">Pendente</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-red-200"></div>
              <span className="text-muted-foreground">Vencido</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog com detalhes do dia */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Títulos do dia {selectedDate ? format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : ''}
            </DialogTitle>
            <DialogDescription>
              {detalheDia?.length || 0} títulos encontrados
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[60vh]">
            {isLoadingDetalhe ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="ml-2 text-muted-foreground">Carregando...</span>
              </div>
            ) : detalheDia && detalheDia.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Documento</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead className="text-right">Valor Original</TableHead>
                    <TableHead className="text-right">Valor Aberto</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detalheDia.map((conta) => (
                    <TableRow key={conta.id}>
                      <TableCell className="font-medium">
                        {conta.numero_documento}/{conta.parcela}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={conta.cliente_nome}>
                        {conta.cliente_nome}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate" title={conta.empresa_nome}>
                        {conta.empresa_nome}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(conta.valor_original || 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(conta.valor_aberto || 0)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(conta.status)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Receipt className="h-12 w-12 mb-2 opacity-50" />
                <span>Nenhum título encontrado para este dia</span>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
