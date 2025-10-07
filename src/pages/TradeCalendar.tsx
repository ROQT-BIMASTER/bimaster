import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import { useNavigate } from "react-router-dom";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, MapPin, Clock } from "lucide-react";
import { toast } from "sonner";
import { TradeFilters } from "@/components/trade/TradeFilters";

interface Visit {
  id: string;
  visit_code: string;
  scheduled_date: string;
  scheduled_time: string;
  status: string;
  visit_type: string;
  store: {
    name: string;
    city: string;
  } | null;
}

export default function TradeCalendar() {
  const { hasPermission } = useScreenPermissions();
  const navigate = useNavigate();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [visits, setVisits] = useState<Visit[]>([]);
  const [allVisits, setAllVisits] = useState<Visit[]>([]);
  const [selectedDateVisits, setSelectedDateVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [aiCriteria, setAiCriteria] = useState<any>(null);

  useEffect(() => {
    if (!hasPermission("trade_marketing")) {
      navigate("/dashboard");
    }
  }, [hasPermission, navigate]);

  useEffect(() => {
    fetchVisits();
  }, []);

  useEffect(() => {
    if (date) {
      filterVisitsByDate(date);
    }
  }, [date, visits]);

  const fetchVisits = async () => {
    try {
      const { data, error } = await supabase
        .from("visits")
        .select(`
          id,
          visit_code,
          scheduled_date,
          scheduled_time,
          status,
          visit_type,
          store:stores(name, city)
        `)
        .order("scheduled_date", { ascending: true });

      if (error) throw error;
      setAllVisits(data || []);
      setVisits(data || []);
    } catch (error) {
      console.error("Erro ao buscar visitas:", error);
      toast.error("Erro ao carregar visitas");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...allVisits];

    if (selectedStore) {
      filtered = filtered.filter(v => v.store && (v.store as any).id === selectedStore);
    }

    if (aiCriteria) {
      if (aiCriteria.status) {
        filtered = filtered.filter(v => aiCriteria.status.includes(v.status));
      }
      if (aiCriteria.timeframe === "hoje") {
        const today = format(new Date(), "yyyy-MM-dd");
        filtered = filtered.filter(v => v.scheduled_date === today);
      }
      if (aiCriteria.timeframe === "semana") {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        filtered = filtered.filter(v => new Date(v.scheduled_date) >= weekAgo);
      }
    }

    setVisits(filtered);
  };

  useEffect(() => {
    applyFilters();
  }, [selectedStore, aiCriteria, allVisits]);

  const filterVisitsByDate = (selectedDate: Date) => {
    const formattedDate = format(selectedDate, "yyyy-MM-dd");
    const filtered = visits.filter(
      (visit) => visit.scheduled_date === formattedDate
    );
    setSelectedDateVisits(filtered);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      scheduled: "default",
      in_progress: "secondary",
      completed: "outline",
      cancelled: "destructive",
    };
    return colors[status] || "default";
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Calendário de Visitas</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie e visualize suas visitas aos PDVs
            </p>
          </div>
          <Button onClick={() => navigate("/dashboard/trade/visits")}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            Ver Todas as Visitas
          </Button>
        </div>

        <TradeFilters
          selectedStore={selectedStore}
          onStoreChange={setSelectedStore}
          onAIFilter={setAiCriteria}
        />

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Calendário</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                locale={ptBR}
                className="rounded-md border"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                Visitas em {date ? format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">Carregando...</p>
              ) : selectedDateVisits.length === 0 ? (
                <p className="text-muted-foreground">Nenhuma visita agendada para esta data</p>
              ) : (
                <div className="space-y-4">
                  {selectedDateVisits.map((visit) => (
                    <Card key={visit.id} className="p-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold">{visit.store?.name || "PDV não vinculado"}</h3>
                          <Badge variant={getStatusColor(visit.status)}>
                            {getStatusLabel(visit.status)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {visit.scheduled_time || "Sem horário"}
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {visit.store?.city || "N/A"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{visit.visit_code}</Badge>
                          {visit.visit_type && (
                            <Badge variant="secondary">{visit.visit_type}</Badge>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate("/dashboard/trade/visits")}
                          className="w-full mt-2"
                        >
                          Ver Detalhes
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
