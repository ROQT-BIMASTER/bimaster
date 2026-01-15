import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription 
} from "@/components/ui/dialog";
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertCircle, 
  Clock, CheckCircle, Receipt, User
} from "lucide-react";
import { 
  format, startOfMonth, endOfMonth, eachDayOfInterval, 
  isToday, addMonths, subMonths, getDay, differenceInDays
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate, getDateKey, getToday } from "@/utils/dateUtils";

interface ContaReceber {
  id: string;
  cliente_nome: string;
  numero_documento: string;
  parcela: number;
  valor_original: number;
  valor_aberto: number;
  valor_recebido: number;
  data_vencimento: string;
  data_recebimento: string | null;
  status: string;
  empresa_nome: string;
  vendedor_nome: string | null;
  portador: string | null;
}

interface CalendarioRecebimentosProps {
  contas: ContaReceber[] | undefined;
  isLoading: boolean;
}

const formatCurrency = (value: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function CalendarioRecebimentos({ contas, isLoading }: CalendarioRecebimentosProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Gerar dias do mês
  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Primeiro dia da semana do mês
  const firstDayOfWeek = getDay(startOfMonth(currentDate));

  // Agrupar contas por data de vencimento - usando getDateKey para consistência
  const contasPorDia = useMemo(() => {
    if (!contas) return new Map<string, ContaReceber[]>();
    
    const map = new Map<string, ContaReceber[]>();
    
    contas.forEach(conta => {
      if (!conta.data_vencimento) return;
      // Usar getDateKey para normalizar a data (YYYY-MM-DD)
      const key = getDateKey(conta.data_vencimento);
      const existing = map.get(key) || [];
      existing.push(conta);
      map.set(key, existing);
    });
    
    return map;
  }, [contas]);

  // Resumo do mês
  const resumoMes = useMemo(() => {
    if (!contas) return { total: 0, pendente: 0, vencido: 0, recebido: 0, qtdTitulos: 0 };
    
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const hoje = getToday();
    
    const contasDoMes = contas.filter(c => {
      if (!c.data_vencimento) return false;
      const venc = parseLocalDate(c.data_vencimento);
      return venc && venc >= start && venc <= end;
    });

    // Calcular status dinâmico baseado na data de vencimento
    const getStatusEfetivo = (conta: ContaReceber) => {
      const status = conta.status?.toLowerCase() || 'pendente';
      if (status === 'recebido') return 'recebido';
      if (status === 'parcial') return 'parcial';
      
      // Verificar se está vencido mesmo que status não indique
      const venc = parseLocalDate(conta.data_vencimento);
      if (venc && differenceInDays(hoje, venc) > 0) return 'vencido';
      return status;
    };

    return {
      total: contasDoMes.reduce((sum, c) => sum + (c.valor_original || 0), 0),
      pendente: contasDoMes.filter(c => getStatusEfetivo(c) === 'pendente').reduce((sum, c) => sum + (c.valor_aberto || 0), 0),
      vencido: contasDoMes.filter(c => getStatusEfetivo(c) === 'vencido').reduce((sum, c) => sum + (c.valor_aberto || 0), 0),
      recebido: contasDoMes.filter(c => getStatusEfetivo(c) === 'recebido').reduce((sum, c) => sum + (c.valor_recebido || 0), 0),
      qtdTitulos: contasDoMes.length,
    };
  }, [contas, currentDate]);

  // Obter info do dia
  const getDayInfo = (date: Date) => {
    const key = getDateKey(date);
    const contasDoDia = contasPorDia.get(key) || [];
    const hoje = getToday();
    
    const valorTotal = contasDoDia.reduce((sum, c) => sum + (c.valor_aberto || c.valor_original || 0), 0);
    
    // Determinar status efetivo baseado na data
    const getStatusEfetivo = (conta: ContaReceber) => {
      const status = conta.status?.toLowerCase() || 'pendente';
      if (status === 'recebido') return 'recebido';
      if (status === 'parcial') return 'parcial';
      
      const venc = parseLocalDate(conta.data_vencimento);
      if (venc && differenceInDays(hoje, venc) > 0) return 'vencido';
      return status;
    };
    
    const hasVencido = contasDoDia.some(c => getStatusEfetivo(c) === 'vencido');
    const hasPendente = contasDoDia.some(c => getStatusEfetivo(c) === 'pendente');
    const hasParcial = contasDoDia.some(c => getStatusEfetivo(c) === 'parcial');
    const allRecebido = contasDoDia.length > 0 && contasDoDia.every(c => getStatusEfetivo(c) === 'recebido');
    
    return { contasDoDia, valorTotal, hasVencido, hasPendente, hasParcial, allRecebido };
  };

  // Contas do dia selecionado - usando getDateKey para consistência
  const contasDiaSelecionado = useMemo(() => {
    if (!selectedDate) return [];
    const key = getDateKey(selectedDate);
    return contasPorDia.get(key) || [];
  }, [selectedDate, contasPorDia]);

  const handleDayClick = (date: Date) => {
    const info = getDayInfo(date);
    if (info.contasDoDia.length > 0) {
      setSelectedDate(date);
      setDetailsOpen(true);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      recebido: { variant: "default", label: "Recebido" },
      parcial: { variant: "secondary", label: "Parcial" },
      vencido: { variant: "destructive", label: "Vencido" },
      pendente: { variant: "outline", label: "Pendente" }
    };
    const config = variants[status] || variants.pendente;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3 mx-auto"></div>
            <div className="grid grid-cols-7 gap-2">
              {[...Array(35)].map((_, i) => (
                <div key={i} className="h-20 bg-muted rounded"></div>
              ))}
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
              <CardDescription>Clique em um dia para ver os títulos</CardDescription>
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

          {/* Resumo do Mês */}
          <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t">
            <div className="text-center">
              <p className="text-2xl font-bold">{resumoMes.qtdTitulos}</p>
              <p className="text-xs text-muted-foreground">Títulos</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(resumoMes.pendente)}
              </p>
              <p className="text-xs text-muted-foreground">Pendente</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-destructive">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(resumoMes.vencido)}
              </p>
              <p className="text-xs text-muted-foreground">Vencido</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(resumoMes.recebido)}
              </p>
              <p className="text-xs text-muted-foreground">Recebido</p>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Cabeçalho dos dias da semana */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAYS.map(day => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Grid do calendário */}
          <div className="grid grid-cols-7 gap-1">
            {/* Células vazias antes do primeiro dia */}
            {[...Array(firstDayOfWeek)].map((_, i) => (
              <div key={`empty-${i}`} className="h-24 bg-muted/30 rounded-md"></div>
            ))}

            {/* Dias do mês */}
            {daysInMonth.map(date => {
              const info = getDayInfo(date);
              const today = isToday(date);
              
              return (
                <div
                  key={date.toISOString()}
                  onClick={() => handleDayClick(date)}
                  className={`
                    h-24 rounded-md border p-1 transition-all
                    ${today ? 'ring-2 ring-primary ring-offset-2' : ''}
                    ${info.contasDoDia.length > 0 ? 'cursor-pointer hover:bg-accent' : 'bg-muted/20'}
                    ${info.hasVencido ? 'border-destructive bg-destructive/5' : ''}
                    ${info.hasPendente && !info.hasVencido ? 'border-yellow-500 bg-yellow-50/50 dark:bg-yellow-900/10' : ''}
                    ${info.hasParcial && !info.hasVencido && !info.hasPendente ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : ''}
                    ${info.allRecebido ? 'border-green-500 bg-green-50/50 dark:bg-green-900/10' : ''}
                  `}
                >
                  <div className="flex flex-col h-full">
                    <span className={`text-sm font-medium ${today ? 'text-primary' : ''}`}>
                      {format(date, 'd')}
                    </span>
                    
                    {info.contasDoDia.length > 0 && (
                      <div className="flex-1 flex flex-col justify-end">
                        <div className="flex items-center gap-1 mb-1">
                          {info.hasVencido && <AlertCircle className="h-3 w-3 text-destructive" />}
                          {info.hasPendente && !info.hasVencido && <Clock className="h-3 w-3 text-yellow-600" />}
                          {info.allRecebido && <CheckCircle className="h-3 w-3 text-green-600" />}
                          <span className="text-xs text-muted-foreground">
                            {info.contasDoDia.length}
                          </span>
                        </div>
                        <span className={`text-xs font-semibold truncate ${
                          info.hasVencido ? 'text-destructive' : 
                          info.hasPendente ? 'text-yellow-600' : 
                          'text-green-600'
                        }`}>
                          {new Intl.NumberFormat('pt-BR', { 
                            style: 'currency', 
                            currency: 'BRL', 
                            notation: 'compact',
                            maximumFractionDigits: 0
                          }).format(info.valorTotal)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legenda */}
          <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-destructive border-2 bg-destructive/10"></div>
              <span className="text-sm text-muted-foreground">Vencido</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-yellow-500 border-2 bg-yellow-50 dark:bg-yellow-900/20"></div>
              <span className="text-sm text-muted-foreground">Pendente</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-green-500 border-2 bg-green-50 dark:bg-green-900/20"></div>
              <span className="text-sm text-muted-foreground">Recebido</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded ring-2 ring-primary ring-offset-1"></div>
              <span className="text-sm text-muted-foreground">Hoje</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de detalhes do dia */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Recebimentos - {selectedDate ? format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : ''}
            </DialogTitle>
            <DialogDescription>
              {contasDiaSelecionado.length} título(s) • Total: {formatCurrency(
                contasDiaSelecionado.reduce((sum, c) => sum + (c.valor_aberto || c.valor_original || 0), 0)
              )}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-3">
              {contasDiaSelecionado.map(conta => (
                <Card key={conta.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{conta.cliente_nome}</span>
                        {getStatusBadge(conta.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Doc: {conta.numero_documento}/{conta.parcela}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {conta.empresa_nome}
                      </p>
                      {conta.vendedor_nome && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          {conta.vendedor_nome}
                        </div>
                      )}
                      {conta.portador && (
                        <Badge variant="outline" className="text-xs">
                          {conta.portador}
                        </Badge>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">
                        {formatCurrency(conta.valor_aberto || conta.valor_original)}
                      </p>
                      {conta.valor_recebido > 0 && conta.valor_recebido !== conta.valor_original && (
                        <p className="text-xs text-green-600">
                          Recebido: {formatCurrency(conta.valor_recebido)}
                        </p>
                      )}
                      {conta.valor_aberto !== conta.valor_original && (
                        <p className="text-xs text-muted-foreground line-through">
                          {formatCurrency(conta.valor_original)}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
