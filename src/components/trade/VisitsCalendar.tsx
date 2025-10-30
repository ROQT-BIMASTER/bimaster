import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { toast } from "sonner";

interface Visit {
  id: string;
  scheduled_date: string;
  scheduled_time: string | null;
  status: string;
  visit_type: string | null;
  stores: {
    name: string;
  } | null;
  user_id: string;
}

interface VisitsCalendarProps {
  userId?: string;
  onVisitClick?: (visitId: string) => void;
}

export const VisitsCalendar = ({ userId, onVisitClick }: VisitsCalendarProps) => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [visits, setVisits] = useState<Visit[]>([]);
  const [selectedDateVisits, setSelectedDateVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVisits();
  }, [userId]);

  useEffect(() => {
    if (date) {
      const dateVisits = visits.filter(v => 
        isSameDay(new Date(v.scheduled_date), date)
      );
      setSelectedDateVisits(dateVisits);
    }
  }, [date, visits]);

  const fetchVisits = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("visits")
        .select(`
          *,
          stores:store_id (name)
        `);

      if (userId) {
        query = query.eq("user_id", userId);
      }

      const { data, error } = await query.order("scheduled_date", { ascending: true });

      if (error) throw error;
      setVisits(data || []);
    } catch (error) {
      console.error("Erro ao buscar visitas:", error);
      toast.error("Erro ao carregar visitas");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "default";
      case "in_progress":
        return "secondary";
      case "completed":
        return "outline";
      case "cancelled":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      scheduled: "Agendada",
      in_progress: "Em Andamento",
      completed: "Concluída",
      cancelled: "Cancelada",
    };
    return labels[status] || status;
  };

  const getDayVisitsCount = (day: Date) => {
    return visits.filter(v => isSameDay(new Date(v.scheduled_date), day)).length;
  };

  const modifiers = {
    hasVisits: (day: Date) => getDayVisitsCount(day) > 0,
  };

  const modifiersStyles = {
    hasVisits: {
      fontWeight: 'bold',
      textDecoration: 'underline',
    },
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Calendário de Visitas</CardTitle>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            locale={ptBR}
            className="rounded-md border"
            modifiers={modifiers}
            modifiersStyles={modifiersStyles}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {date ? format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "Selecione uma data"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : selectedDateVisits.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma visita agendada para esta data
              </p>
            ) : (
              selectedDateVisits.map((visit) => (
                <div
                  key={visit.id}
                  className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">
                        {visit.scheduled_time || "Horário não definido"}
                      </span>
                      <Badge variant={getStatusColor(visit.status)} className="text-xs">
                        {getStatusLabel(visit.status)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {visit.stores?.name || "Loja não especificada"}
                    </p>
                    {visit.visit_type && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Tipo: {visit.visit_type}
                      </p>
                    )}
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
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
