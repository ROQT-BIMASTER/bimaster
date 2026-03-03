import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  isToday,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  CalendarDays,
  CalendarRange,
  MapPin,
  Clock,
  User,
  X,
  CheckCircle2,
  AlertCircle,
  Timer,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface Visit {
  id: string;
  scheduled_date: string;
  scheduled_time: string | null;
  status: string;
  visit_type: string | null;
  stores: {
    name: string;
  } | null;
  profiles: {
    nome: string;
  } | null;
  user_id: string;
}

interface VisitsCalendarProps {
  userId?: string;
  onVisitClick?: (visitId: string) => void;
}

type ViewMode = "month" | "week";

const STATUS_CONFIG: Record<string, { label: string; color: string; dotColor: string; icon: React.ElementType }> = {
  scheduled: { label: "Agendada", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300", dotColor: "bg-blue-500", icon: CalendarDays },
  in_progress: { label: "Em Andamento", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300", dotColor: "bg-amber-500", icon: Timer },
  completed: { label: "Concluída", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300", dotColor: "bg-emerald-500", icon: CheckCircle2 },
  cancelled: { label: "Cancelada", color: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300", dotColor: "bg-red-500", icon: XCircle },
};

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export const VisitsCalendar = ({ userId, onVisitClick }: VisitsCalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    fetchVisits();
  }, [userId]);

  const fetchVisits = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("visits")
        .select(`
          *,
          stores:store_id (name),
          profiles:user_id (nome)
        `);

      if (userId) {
        query = query.eq("user_id", userId);
      }

      const { data, error } = await query.order("scheduled_date", { ascending: true });
      if (error) throw error;
      setVisits((data as any) || []);
    } catch (error) {
      console.error("Erro ao buscar visitas:", error);
      toast.error("Erro ao carregar visitas");
    } finally {
      setLoading(false);
    }
  };

  // Calendar grid days
  const calendarDays = useMemo(() => {
    if (viewMode === "month") {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const start = startOfWeek(monthStart, { locale: ptBR });
      const end = endOfWeek(monthEnd, { locale: ptBR });
      return eachDayOfInterval({ start, end });
    } else {
      const weekStart = startOfWeek(currentDate, { locale: ptBR });
      const weekEnd = endOfWeek(currentDate, { locale: ptBR });
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    }
  }, [currentDate, viewMode]);

  // Visits grouped by date string
  const visitsByDate = useMemo(() => {
    const map: Record<string, Visit[]> = {};
    visits.forEach((v) => {
      const key = v.scheduled_date;
      if (!map[key]) map[key] = [];
      map[key].push(v);
    });
    return map;
  }, [visits]);

  const getVisitsForDay = (day: Date): Visit[] => {
    const key = format(day, "yyyy-MM-dd");
    return visitsByDate[key] || [];
  };

  // KPI stats for displayed period
  const kpis = useMemo(() => {
    const periodStart = viewMode === "month" ? startOfMonth(currentDate) : startOfWeek(currentDate, { locale: ptBR });
    const periodEnd = viewMode === "month" ? endOfMonth(currentDate) : endOfWeek(currentDate, { locale: ptBR });
    const periodVisits = visits.filter((v) => {
      const d = new Date(v.scheduled_date);
      return d >= periodStart && d <= periodEnd;
    });
    const total = periodVisits.length;
    const scheduled = periodVisits.filter((v) => v.status === "scheduled").length;
    const completed = periodVisits.filter((v) => v.status === "completed").length;
    const inProgress = periodVisits.filter((v) => v.status === "in_progress").length;
    const cancelled = periodVisits.filter((v) => v.status === "cancelled").length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, scheduled, completed, inProgress, cancelled, completionRate };
  }, [visits, currentDate, viewMode]);

  const selectedDayVisits = selectedDay ? getVisitsForDay(selectedDay) : [];

  const navigate = (direction: "prev" | "next") => {
    if (viewMode === "month") {
      setCurrentDate(direction === "prev" ? subMonths(currentDate, 1) : addMonths(currentDate, 1));
    } else {
      setCurrentDate(direction === "prev" ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1));
    }
  };

  const handleDayClick = (day: Date) => {
    setSelectedDay(day);
    if (getVisitsForDay(day).length > 0) {
      setSheetOpen(true);
    }
  };

  const headerLabel = viewMode === "month"
    ? format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })
    : `Semana de ${format(startOfWeek(currentDate, { locale: ptBR }), "dd/MM")} a ${format(endOfWeek(currentDate, { locale: ptBR }), "dd/MM/yyyy")}`;

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total", value: kpis.total, icon: CalendarDays, accent: "text-foreground" },
          { label: "Agendadas", value: kpis.scheduled, icon: AlertCircle, accent: "text-blue-500" },
          { label: "Em Andamento", value: kpis.inProgress, icon: Timer, accent: "text-amber-500" },
          { label: "Concluídas", value: kpis.completed, icon: CheckCircle2, accent: "text-emerald-500" },
          { label: "Taxa Conclusão", value: `${kpis.completionRate}%`, icon: CheckCircle2, accent: "text-emerald-500" },
        ].map((kpi) => (
          <Card key={kpi.label} className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <kpi.icon className={cn("h-4 w-4", kpi.accent)} />
              <span className="text-xs text-muted-foreground">{kpi.label}</span>
            </div>
            <p className={cn("text-2xl font-bold", kpi.accent)}>{kpi.value}</p>
          </Card>
        ))}
      </div>

      {/* Calendar Header */}
      <Card>
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("prev")}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-lg font-semibold capitalize min-w-[220px] text-center">
              {headerLabel}
            </h2>
            <Button variant="ghost" size="icon" onClick={() => navigate("next")}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <Button
              variant={viewMode === "month" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("month")}
              className="gap-1"
            >
              <CalendarDays className="h-4 w-4" />
              <span className="hidden sm:inline">Mês</span>
            </Button>
            <Button
              variant={viewMode === "week" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("week")}
              className="gap-1"
            >
              <CalendarRange className="h-4 w-4" />
              <span className="hidden sm:inline">Semana</span>
            </Button>
          </div>
        </div>

        <CardContent className="p-0">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="py-2 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {label}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, idx) => {
              const dayVisits = getVisitsForDay(day);
              const inMonth = isSameMonth(day, currentDate);
              const today = isToday(day);
              const isSelected = selectedDay && isSameDay(day, selectedDay);
              const maxVisible = viewMode === "week" ? 5 : 3;

              return (
                <div
                  key={idx}
                  onClick={() => handleDayClick(day)}
                  className={cn(
                    "min-h-[90px] md:min-h-[110px] border-b border-r p-1.5 cursor-pointer transition-colors relative group",
                    !inMonth && "bg-muted/30",
                    today && "bg-primary/5",
                    isSelected && "ring-2 ring-primary ring-inset",
                    "hover:bg-accent/30"
                  )}
                >
                  {/* Day number + visit count */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={cn(
                        "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                        !inMonth && "text-muted-foreground/50",
                        today && "bg-primary text-primary-foreground font-bold",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    {dayVisits.length > 0 && (
                      <span className="text-[10px] font-semibold bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">
                        {dayVisits.length}
                      </span>
                    )}
                  </div>

                  {/* Visit pills */}
                  <div className="space-y-0.5">
                    {dayVisits.slice(0, maxVisible).map((visit) => {
                      const cfg = STATUS_CONFIG[visit.status] || STATUS_CONFIG.scheduled;
                      return (
                        <div
                          key={visit.id}
                          className={cn(
                            "flex items-center gap-1 rounded px-1 py-0.5 text-[10px] leading-tight truncate",
                            cfg.color
                          )}
                          title={`${visit.stores?.name || "Loja"} - ${cfg.label}`}
                        >
                          <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", cfg.dotColor)} />
                          <span className="truncate hidden md:inline">
                            {visit.scheduled_time ? `${visit.scheduled_time} ` : ""}
                            {visit.stores?.name || "Sem loja"}
                          </span>
                        </div>
                      );
                    })}
                    {dayVisits.length > maxVisible && (
                      <span className="text-[10px] text-muted-foreground pl-1">
                        +{dayVisits.length - maxVisible} mais
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>

        {/* Status legend */}
        <div className="flex flex-wrap items-center gap-4 px-4 py-3 border-t text-xs text-muted-foreground">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className={cn("w-2.5 h-2.5 rounded-full", cfg.dotColor)} />
              {cfg.label}
            </div>
          ))}
        </div>
      </Card>

      {/* Side panel (Sheet) for day details */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {selectedDay ? format(selectedDay, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : ""}
            </SheetTitle>
            <SheetDescription>
              {selectedDayVisits.length} visita{selectedDayVisits.length !== 1 ? "s" : ""} neste dia
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-3">
            {selectedDayVisits.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhuma visita neste dia
              </p>
            ) : (
              selectedDayVisits.map((visit) => {
                const cfg = STATUS_CONFIG[visit.status] || STATUS_CONFIG.scheduled;
                const Icon = cfg.icon;
                return (
                  <div
                    key={visit.id}
                    className="border rounded-lg p-4 space-y-2 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className={cn("h-4 w-4", cfg.dotColor.replace("bg-", "text-"))} />
                        <Badge className={cn("text-xs", cfg.color)}>
                          {cfg.label}
                        </Badge>
                      </div>
                      {onVisitClick && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onVisitClick(visit.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="space-y-1.5 text-sm">
                      <div className="flex items-center gap-2 text-foreground">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">{visit.stores?.name || "Loja não especificada"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{visit.scheduled_time || "Horário não definido"}</span>
                      </div>
                      {visit.profiles?.nome && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <User className="h-3.5 w-3.5" />
                          <span>{visit.profiles.nome}</span>
                        </div>
                      )}
                      {visit.visit_type && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Tipo: {visit.visit_type}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
