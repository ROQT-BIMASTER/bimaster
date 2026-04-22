import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription 
} from "@/components/ui/dialog";
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertCircle, 
  Clock, CheckCircle, Receipt, ChevronsLeft, ChevronsRight
} from "lucide-react";
import { 
  format, startOfMonth, endOfMonth, eachDayOfInterval, 
  isToday, addMonths, subMonths, getDay, addYears, subYears
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { calculateFinancialStatus } from "@/hooks/useFinancialStatus";
import { parseLocalDate, getDateKey, formatLocalDate } from "@/utils/dateUtils";
import type { ContaPagarCalendario } from "@/types/financeiro/contas-pagar";

interface CalendarioVencimentosProps {
  contas: ContaPagarCalendario[] | undefined;
  isLoading: boolean;
}

const formatCurrency = (value: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function CalendarioVencimentos({ contas, isLoading }: CalendarioVencimentosProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Filtrar contas por status
  const contasFiltradas = useMemo(() => {
    if (!contas) return [];
    if (filterStatus === "all") return contas;
    return contas.filter(c => (c.status || '').toLowerCase() === filterStatus.toLowerCase());
  }, [contas, filterStatus]);

  // Gerar dias do mês
  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Primeiro dia da semana do mês
  const firstDayOfWeek = getDay(startOfMonth(currentDate));

  // Agrupar contas por data de vencimento usando getDateKey para consistência
  const contasPorDia = useMemo(() => {
    if (!contasFiltradas) return new Map<string, ContaPagarCalendario[]>();
    
    const map = new Map<string, ContaPagarCalendario[]>();
    
    contasFiltradas.forEach(conta => {
      if (!conta.data_vencimento) return;
      // Usa getDateKey para garantir formato consistente YYYY-MM-DD
      const key = getDateKey(conta.data_vencimento);
      const existing = map.get(key) || [];
      existing.push(conta);
      map.set(key, existing);
    });
    
    return map;
  }, [contasFiltradas]);

  // Resumo do mês com status calculado
  const resumoMes = useMemo(() => {
    if (!contasFiltradas) return { total: 0, pendente: 0, vencido: 0, pago: 0, qtdTitulos: 0 };
    
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    
    const contasDoMes = contasFiltradas.filter(c => {
      if (!c.data_vencimento) return false;
      // Usa parseLocalDate para evitar timezone shift
      const venc = parseLocalDate(c.data_vencimento);
      if (!venc) return false;
      return venc >= start && venc <= end;
    });

    return {
      total: contasDoMes.reduce((sum, c) => sum + (c.valor_original || 0), 0),
      pendente: contasDoMes.filter(c => {
        const status = calculateFinancialStatus(c.data_vencimento, null, c.status);
        return status === 'pendente';
      }).reduce((sum, c) => sum + (c.valor_aberto || 0), 0),
      vencido: contasDoMes.filter(c => {
        const status = calculateFinancialStatus(c.data_vencimento, null, c.status);
        return status === 'vencido';
      }).reduce((sum, c) => sum + (c.valor_aberto || 0), 0),
      pago: contasDoMes.filter(c => c.status === StatusTitulo.PAGO).reduce((sum, c) => sum + (c.valor_original || 0), 0),
      qtdTitulos: contasDoMes.length,
    };
  }, [contasFiltradas, currentDate]);

  // Obter info do dia com status calculado
  const getDayInfo = (date: Date) => {
    // Usa getDateKey para garantir formato consistente
    const key = getDateKey(date);
    const contasDoDia = contasPorDia.get(key) || [];
    
    const valorTotal = contasDoDia.reduce((sum, c) => sum + (c.valor_aberto || c.valor_original || 0), 0);
    const hasVencido = contasDoDia.some(c => {
      const status = calculateFinancialStatus(c.data_vencimento, null, c.status);
      return status === 'vencido';
    });
    const hasPendente = contasDoDia.some(c => {
      const status = calculateFinancialStatus(c.data_vencimento, null, c.status);
      return status === 'pendente';
    });
    const allPago = contasDoDia.length > 0 && contasDoDia.every(c => c.status === StatusTitulo.PAGO);
    
    return { contasDoDia, valorTotal, hasVencido, hasPendente, allPago };
  };

  // Contas do dia selecionado
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
      pago: { variant: "default", label: "Pago" },
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
                Calendário de Vencimentos
              </CardTitle>
              <CardDescription>Clique em um dia para ver os títulos • Filtrar por status abaixo</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="parcial">Parcial</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentDate(subYears(currentDate, 1))}
                  title="Ano anterior"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                  title="Mês anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  className="font-medium min-w-[140px] text-center"
                  onClick={() => setCurrentDate(new Date())}
                  title="Ir para hoje"
                >
                  {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                  title="Próximo mês"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentDate(addYears(currentDate, 1))}
                  title="Próximo ano"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
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
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(resumoMes.pago)}
              </p>
              <p className="text-xs text-muted-foreground">Pago</p>
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
                    ${info.allPago ? 'border-green-500 bg-green-50/50 dark:bg-green-900/10' : ''}
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
                          {info.allPago && <CheckCircle className="h-3 w-3 text-green-600" />}
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
              <span className="text-sm text-muted-foreground">Pago</span>
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
              Vencimentos - {selectedDate ? format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : ''}
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
                        <span className="font-semibold">{conta.fornecedor_nome}</span>
                        {getStatusBadge(conta.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Doc: {conta.numero_documento}/{conta.parcela}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {conta.empresa_nome}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {conta.departamento_nome && (
                          <Badge variant="outline" className="text-xs">
                            {conta.departamento_nome}
                          </Badge>
                        )}
                        {conta.portador && (
                          <Badge variant="secondary" className="text-xs">
                            Portador: {conta.portador}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">
                        {formatCurrency(conta.valor_aberto || conta.valor_original)}
                      </p>
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
