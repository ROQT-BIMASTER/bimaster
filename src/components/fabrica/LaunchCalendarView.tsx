import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar, Rocket, Package, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import ProductThumbnail from "./ProductThumbnail";
import CountdownBadge from "./CountdownBadge";

type Lancamento = {
  id: string;
  nome_lancamento: string;
  descricao: string | null;
  data_prevista: string;
  data_efetiva: string | null;
  status: string;
  tipo: string;
  prioridade: string;
  produto_id: string | null;
  fabrica_produtos?: { nome: string; codigo: string; foto_url?: string | null } | null;
  profiles?: { nome: string } | null;
};

const statusConfig: Record<string, { label: string; color: string; bgColor: string; gradient: string; ring: string }> = {
  planejado: { 
    label: "Planejado", 
    color: "text-blue-700 dark:text-blue-300", 
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    gradient: "from-blue-500 to-blue-600",
    ring: "ring-blue-500/30"
  },
  em_preparacao: { 
    label: "Em Preparação", 
    color: "text-amber-700 dark:text-amber-300", 
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    gradient: "from-amber-500 to-yellow-500",
    ring: "ring-amber-500/30"
  },
  aprovado: { 
    label: "Aprovado", 
    color: "text-green-700 dark:text-green-300", 
    bgColor: "bg-green-100 dark:bg-green-900/30",
    gradient: "from-green-500 to-emerald-500",
    ring: "ring-green-500/30"
  },
  lancado: { 
    label: "Lançado", 
    color: "text-purple-700 dark:text-purple-300", 
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    gradient: "from-purple-500 to-violet-500",
    ring: "ring-purple-500/30"
  },
  cancelado: { 
    label: "Cancelado", 
    color: "text-red-700 dark:text-red-300", 
    bgColor: "bg-red-100 dark:bg-red-900/30",
    gradient: "from-red-500 to-red-600",
    ring: "ring-red-500/30"
  },
};

const prioridadeConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  alta: { label: "Alta", color: "bg-red-500", bgColor: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  media: { label: "Média", color: "bg-amber-500", bgColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  baixa: { label: "Baixa", color: "bg-green-500", bgColor: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
};

const tipoConfig: Record<string, { label: string; emoji: string }> = {
  novo_produto: { label: "Novo Produto", emoji: "🚀" },
  nova_linha: { label: "Nova Linha", emoji: "📦" },
  reformulacao: { label: "Reformulação", emoji: "🔄" },
  embalagem: { label: "Nova Embalagem", emoji: "🎨" },
  promocional: { label: "Promocional", emoji: "🎯" },
};

interface LaunchCalendarViewProps {
  lancamentos: Lancamento[];
  onLancamentoClick: (lancamento: Lancamento) => void;
  isLoading?: boolean;
}

export default function LaunchCalendarView({ lancamentos, onLancamentoClick, isLoading }: LaunchCalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [dayDialogOpen, setDayDialogOpen] = useState(false);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getLancamentosForDay = (day: Date) => {
    return lancamentos.filter((l) => isSameDay(new Date(l.data_prevista), day));
  };

  const selectedDayLancamentos = useMemo(() => {
    if (!selectedDay) return [];
    return getLancamentosForDay(selectedDay);
  }, [selectedDay, lancamentos]);

  // Monthly summary
  const monthSummary = useMemo(() => {
    const monthLancamentos = lancamentos.filter(l => {
      const date = new Date(l.data_prevista);
      return date >= monthStart && date <= monthEnd;
    });
    
    return {
      total: monthLancamentos.length,
      planejado: monthLancamentos.filter(l => l.status === 'planejado').length,
      em_preparacao: monthLancamentos.filter(l => l.status === 'em_preparacao').length,
      aprovado: monthLancamentos.filter(l => l.status === 'aprovado').length,
      lancado: monthLancamentos.filter(l => l.status === 'lancado').length,
    };
  }, [lancamentos, currentMonth]);

  const handleDayClick = (day: Date, dayLancamentos: Lancamento[]) => {
    if (dayLancamentos.length > 0) {
      setSelectedDay(day);
      setDayDialogOpen(true);
    }
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with navigation */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="h-9 w-9"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-xl font-bold capitalize min-w-[200px] text-center">
            {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
          </h3>
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="h-9 w-9"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={goToToday}
            className="ml-2"
          >
            Hoje
          </Button>
        </div>

        {/* Monthly Summary */}
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <Badge variant="outline" className="gap-1.5">
            <Calendar className="h-3 w-3" />
            {monthSummary.total} lançamentos
          </Badge>
          {monthSummary.planejado > 0 && (
            <Badge className={cn("text-xs", statusConfig.planejado.bgColor, statusConfig.planejado.color)}>
              {monthSummary.planejado} Planejados
            </Badge>
          )}
          {monthSummary.em_preparacao > 0 && (
            <Badge className={cn("text-xs", statusConfig.em_preparacao.bgColor, statusConfig.em_preparacao.color)}>
              {monthSummary.em_preparacao} Em Prep.
            </Badge>
          )}
          {monthSummary.lancado > 0 && (
            <Badge className={cn("text-xs", statusConfig.lancado.bgColor, statusConfig.lancado.color)}>
              {monthSummary.lancado} Lançados
            </Badge>
          )}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        {/* Week days header */}
        <div className="grid grid-cols-7 bg-muted/50">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day, i) => (
            <div 
              key={day} 
              className={cn(
                "text-center text-sm font-semibold py-3 text-muted-foreground",
                i === 0 && "text-red-500/70",
                i === 6 && "text-red-500/70"
              )}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7">
          {/* Empty cells for days before month start */}
          {Array.from({ length: monthStart.getDay() }).map((_, i) => (
            <div key={`empty-start-${i}`} className="min-h-[130px] bg-muted/10 border-t border-r last:border-r-0" />
          ))}

          {daysInMonth.map((day, index) => {
            const dayLancamentos = getLancamentosForDay(day);
            const isPast = isBefore(day, startOfDay(new Date())) && !isToday(day);
            const hasLancamentos = dayLancamentos.length > 0;
            const isLastInRow = (monthStart.getDay() + index + 1) % 7 === 0;
            
            return (
              <div
                key={day.toISOString()}
                onClick={() => handleDayClick(day, dayLancamentos)}
                className={cn(
                  "min-h-[130px] p-2 border-t transition-all relative group",
                  !isLastInRow && "border-r",
                  isToday(day) && "bg-primary/5 ring-2 ring-inset ring-primary",
                  isPast && "bg-muted/20",
                  hasLancamentos && "cursor-pointer hover:bg-accent/50"
                )}
              >
                {/* Day number */}
                <div className={cn(
                  "text-sm font-medium mb-2 h-7 w-7 rounded-full flex items-center justify-center transition-colors",
                  isToday(day) && "bg-primary text-primary-foreground",
                  isPast && !isToday(day) && "text-muted-foreground",
                  day.getDay() === 0 && "text-red-500"
                )}>
                  {format(day, "d")}
                </div>

                {/* Lançamentos */}
                <div className="space-y-1">
                  {dayLancamentos.slice(0, 3).map((l) => (
                    <div
                      key={l.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onLancamentoClick(l);
                      }}
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer transition-all",
                        "hover:scale-[1.02] hover:shadow-sm",
                        "ring-1",
                        statusConfig[l.status]?.bgColor,
                        statusConfig[l.status]?.ring
                      )}
                    >
                      <ProductThumbnail src={l.fabrica_produtos?.foto_url} size="sm" className="h-4 w-4 flex-shrink-0" />
                      <span className={cn("text-[11px] font-medium truncate flex-1", statusConfig[l.status]?.color)}>
                        {l.nome_lancamento}
                      </span>
                      <div className={cn("h-2 w-2 rounded-full flex-shrink-0", prioridadeConfig[l.prioridade]?.color)} />
                    </div>
                  ))}
                  
                  {dayLancamentos.length > 3 && (
                    <button 
                      className="w-full text-[11px] text-primary font-semibold hover:underline text-center py-0.5 bg-primary/10 rounded"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDayClick(day, dayLancamentos);
                      }}
                    >
                      +{dayLancamentos.length - 3} mais
                    </button>
                  )}
                </div>

                {/* Hover indicator */}
                {hasLancamentos && (
                  <div className="absolute inset-0 ring-2 ring-primary/0 group-hover:ring-primary/30 rounded-sm pointer-events-none transition-all" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full bg-primary" />
          <span className="text-muted-foreground">Hoje</span>
        </div>
        {Object.entries(statusConfig).map(([key, config]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={cn("h-3 w-3 rounded-sm", `bg-gradient-to-r ${config.gradient}`)} />
            <span className="text-muted-foreground">{config.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            <div className="h-2 w-2 rounded-full bg-amber-500" />
            <div className="h-2 w-2 rounded-full bg-green-500" />
          </div>
          <span className="text-muted-foreground">Prioridade (Alta/Média/Baixa)</span>
        </div>
      </div>

      {/* Day Details Dialog */}
      <Dialog open={dayDialogOpen} onOpenChange={setDayDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <span className="capitalize">
                  {selectedDay && format(selectedDay, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </span>
                <p className="text-sm font-normal text-muted-foreground">
                  {selectedDayLancamentos.length} lançamento{selectedDayLancamentos.length !== 1 && 's'}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-3 pr-4">
              {selectedDayLancamentos.map((l) => (
                <div
                  key={l.id}
                  onClick={() => {
                    setDayDialogOpen(false);
                    onLancamentoClick(l);
                  }}
                  className={cn(
                    "p-4 rounded-xl cursor-pointer transition-all",
                    "hover:scale-[1.01] hover:shadow-md",
                    "border-2",
                    statusConfig[l.status]?.bgColor,
                    "border-transparent hover:border-primary/20"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <ProductThumbnail 
                      src={l.fabrica_produtos?.foto_url} 
                      className="h-14 w-14 rounded-lg shadow-sm" 
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm truncate">{l.nome_lancamento}</h4>
                          {l.fabrica_produtos && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Package className="h-3 w-3" />
                              {l.fabrica_produtos.codigo} - {l.fabrica_produtos.nome}
                            </p>
                          )}
                        </div>
                        <CountdownBadge date={l.data_prevista} isLaunched={l.status === 'lancado'} />
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Badge className={cn("text-xs", statusConfig[l.status]?.bgColor, statusConfig[l.status]?.color)}>
                          {statusConfig[l.status]?.label}
                        </Badge>
                        <Badge variant="outline" className={cn("text-xs", prioridadeConfig[l.prioridade]?.bgColor)}>
                          {prioridadeConfig[l.prioridade]?.label}
                        </Badge>
                        {tipoConfig[l.tipo] && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <span>{tipoConfig[l.tipo]?.emoji}</span>
                            {tipoConfig[l.tipo]?.label}
                          </Badge>
                        )}
                      </div>

                      {l.profiles?.nome && (
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Responsável: {l.profiles.nome}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {selectedDayLancamentos.length === 0 && (
                <div className="text-center py-8">
                  <Rocket className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">Nenhum lançamento neste dia</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
