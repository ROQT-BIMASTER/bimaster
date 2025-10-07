import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Tag, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Navigate } from "react-router-dom";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import { TradeFilters } from "@/components/trade/TradeFilters";

interface Promotion {
  id: string;
  code: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  promotion_type: string | null;
  status: string;
  budget: number | null;
  target_value: number | null;
  store_ids: string[] | null;
}

const TradePromotions = () => {
  const { hasPermission, loading: permissionsLoading } = useScreenPermissions();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [allPromotions, setAllPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [aiCriteria, setAiCriteria] = useState<any>(null);

  if (!permissionsLoading && !hasPermission("trade_promotions")) {
    return <Navigate to="/dashboard" replace />;
  }

  useEffect(() => {
    fetchPromotions();
  }, []);

  const fetchPromotions = async () => {
    try {
      const { data, error } = await supabase
        .from("promotions")
        .select("*")
        .order("start_date", { ascending: false });

      if (error) throw error;
      setAllPromotions(data || []);
      setPromotions(data || []);
    } catch (error) {
      console.error("Erro ao buscar promoções:", error);
      toast.error("Erro ao carregar promoções");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "planned":
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
      planned: "Planejada",
      active: "Ativa",
      paused: "Pausada",
      completed: "Concluída",
      cancelled: "Cancelada",
    };
    return labels[status] || status;
  };

  const calculateProgress = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const today = new Date();
    
    if (today < startDate) return 0;
    if (today > endDate) return 100;
    
    const total = endDate.getTime() - startDate.getTime();
    const elapsed = today.getTime() - startDate.getTime();
    return Math.round((elapsed / total) * 100);
  };

  const applyFilters = () => {
    let filtered = [...allPromotions];

    // Note: Promotions don't have store_id, but can be filtered by store_ids array
    if (selectedStore) {
      filtered = filtered.filter(p => 
        Array.isArray(p.store_ids) && p.store_ids.includes(selectedStore)
      );
    }

    if (aiCriteria) {
      if (aiCriteria.status) {
        filtered = filtered.filter(p => aiCriteria.status.includes(p.status));
      }
      if (aiCriteria.type) {
        filtered = filtered.filter(p => p.promotion_type === aiCriteria.type);
      }
      if (aiCriteria.timeframe === "hoje") {
        const today = new Date().toISOString().split('T')[0];
        filtered = filtered.filter(p => p.start_date <= today && p.end_date >= today);
      }
    }

    setPromotions(filtered);
  };

  useEffect(() => {
    applyFilters();
  }, [selectedStore, aiCriteria, allPromotions]);

  const stats = {
    active: promotions.filter(p => p.status === "active").length,
    planned: promotions.filter(p => p.status === "planned").length,
    completed: promotions.filter(p => p.status === "completed").length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gestão de Promoções</h1>
            <p className="text-muted-foreground">
              Campanhas promocionais e execução em PDV
            </p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nova Promoção
          </Button>
        </div>

        <TradeFilters
          selectedStore={selectedStore}
          onStoreChange={setSelectedStore}
          onAIFilter={setAiCriteria}
        />

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Promoções Ativas</CardTitle>
              <Tag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.active}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Planejadas</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.planned}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
              <Tag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completed}</div>
            </CardContent>
          </Card>
        </div>

        {/* Promotions List */}
        <div className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="p-6 text-center">
                Carregando promoções...
              </CardContent>
            </Card>
          ) : promotions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Tag className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma promoção cadastrada</h3>
                <p className="text-muted-foreground mb-4">
                  Crie sua primeira campanha promocional
                </p>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Promoção
                </Button>
              </CardContent>
            </Card>
          ) : (
            promotions.map((promotion) => {
              const progress = calculateProgress(promotion.start_date, promotion.end_date);
              
              return (
                <Card key={promotion.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg">{promotion.name}</h3>
                          <Badge variant={getStatusColor(promotion.status)}>
                            {getStatusLabel(promotion.status)}
                          </Badge>
                          {promotion.promotion_type && (
                            <Badge variant="outline">{promotion.promotion_type}</Badge>
                          )}
                        </div>
                        {promotion.description && (
                          <p className="text-sm text-muted-foreground mb-3">
                            {promotion.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-sm">
                          <span>
                            <strong>Código:</strong> {promotion.code}
                          </span>
                          <span>•</span>
                          <span>
                            <strong>Período:</strong>{" "}
                            {format(new Date(promotion.start_date), "dd/MM/yyyy", {
                              locale: ptBR,
                            })}{" "}
                            -{" "}
                            {format(new Date(promotion.end_date), "dd/MM/yyyy", {
                              locale: ptBR,
                            })}
                          </span>
                          {promotion.budget && (
                            <>
                              <span>•</span>
                              <span>
                                <strong>Orçamento:</strong> R${" "}
                                {promotion.budget.toLocaleString("pt-BR")}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        Ver Detalhes
                      </Button>
                    </div>
                    {promotion.status === "active" && (
                      <div>
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-muted-foreground">Progresso</span>
                          <span className="font-medium">{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TradePromotions;
