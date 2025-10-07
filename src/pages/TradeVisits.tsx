import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Calendar as CalendarIcon, Link as LinkIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Navigate } from "react-router-dom";
import { VincularStoreDialog } from "@/components/trade/VincularStoreDialog";
import { NovaVisitaDialog } from "@/components/trade/NovaVisitaDialog";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import { TradeFilters } from "@/components/trade/TradeFilters";

interface Visit {
  id: string;
  visit_code: string;
  scheduled_date: string;
  scheduled_time: string | null;
  status: string;
  visit_type: string | null;
  stores: {
    name: string;
    city: string | null;
  } | null;
}

const TradeVisits = () => {
  const { hasPermission, loading: permissionsLoading } = useScreenPermissions();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [allVisits, setAllVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  const [showVincularDialog, setShowVincularDialog] = useState(false);
  const [showNovaVisita, setShowNovaVisita] = useState(false);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [aiCriteria, setAiCriteria] = useState<any>(null);

  if (!permissionsLoading && !hasPermission("trade_visits")) {
    return <Navigate to="/dashboard" replace />;
  }

  useEffect(() => {
    fetchVisits();
  }, []);

  const fetchVisits = async () => {
    try {
      const { data, error } = await supabase
        .from("visits")
        .select(`
          *,
          stores:store_id (name, city)
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

  const handleVincularLoja = (visitId: string) => {
    setSelectedVisitId(visitId);
    setShowVincularDialog(true);
  };

  const handleStoreLinked = async () => {
    await fetchVisits();
    toast.success("Loja vinculada com sucesso!");
  };

  const applyFilters = () => {
    let filtered = [...allVisits];

    if (selectedStore) {
      filtered = filtered.filter(v => v.stores && (v.stores as any).id === selectedStore);
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Visitas de Campo</h1>
            <p className="text-muted-foreground">
              Agende e acompanhe visitas aos PDVs
            </p>
          </div>
          <Button onClick={() => setShowNovaVisita(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Visita
          </Button>
        </div>

        <TradeFilters
          selectedStore={selectedStore}
          onStoreChange={setSelectedStore}
          onAIFilter={setAiCriteria}
        />

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Hoje</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {visits.filter(v => v.scheduled_date === format(new Date(), "yyyy-MM-dd")).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Esta Semana</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {visits.filter(v => v.status === "scheduled").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {visits.filter(v => v.status === "in_progress").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {visits.filter(v => v.status === "completed").length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Visits List */}
        <div className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="p-6 text-center">
                Carregando visitas...
              </CardContent>
            </Card>
          ) : visits.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                Nenhuma visita agendada
              </CardContent>
            </Card>
          ) : (
            visits.map((visit) => (
              <Card key={visit.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">
                          {visit.stores?.name || "Loja não especificada"}
                        </h3>
                        <Badge variant={getStatusColor(visit.status)}>
                          {getStatusLabel(visit.status)}
                        </Badge>
                        {visit.visit_type && (
                          <Badge variant="outline">{visit.visit_type}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <CalendarIcon className="h-4 w-4" />
                          {format(new Date(visit.scheduled_date), "dd/MM/yyyy", {
                            locale: ptBR,
                          })}
                          {visit.scheduled_time && ` às ${visit.scheduled_time}`}
                        </div>
                        {visit.stores?.city && (
                          <span>• {visit.stores.city}</span>
                        )}
                        <span>• Código: {visit.visit_code}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!visit.stores && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleVincularLoja(visit.id)}
                        >
                          <LinkIcon className="mr-2 h-4 w-4" />
                          Vincular Loja
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          toast.info(`Visualizando detalhes da visita ${visit.visit_code}`);
                        }}
                      >
                        Ver Detalhes
                      </Button>
                      {visit.status === "scheduled" && (
                        <Button 
                          size="sm"
                          onClick={async () => {
                            try {
                              const { error } = await supabase
                                .from("visits")
                                .update({ 
                                  status: "in_progress",
                                  check_in_time: new Date().toISOString()
                                })
                                .eq("id", visit.id);

                              if (error) throw error;
                              
                              toast.success("Visita iniciada!");
                              fetchVisits();
                            } catch (error: any) {
                              console.error("Erro ao iniciar visita:", error);
                              toast.error("Erro ao iniciar visita");
                            }
                          }}
                        >
                          Iniciar
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <VincularStoreDialog
          open={showVincularDialog}
          onOpenChange={setShowVincularDialog}
          visitId={selectedVisitId || undefined}
          onStoreLinked={handleStoreLinked}
        />

        <NovaVisitaDialog
          open={showNovaVisita}
          onOpenChange={setShowNovaVisita}
          onSuccess={fetchVisits}
        />
      </div>
    </DashboardLayout>
  );
};

export default TradeVisits;
