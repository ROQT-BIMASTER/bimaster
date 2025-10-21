import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Trash2, Image as ImageIcon, Plus, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import { TradeFilters } from "@/components/trade/TradeFilters";
import { CompetitorComparisonUpload } from "@/components/trade/CompetitorComparisonUpload";
import { NovoCompetitorDialog } from "@/components/trade/NovoCompetitorDialog";

interface Competitor {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  threat_level: string | null;
  market_share: number | null;
  is_direct_competitor: boolean;
  active: boolean;
}

const TradeCompetitors = () => {
  const { hasPermission, loading: permissionsLoading } = useScreenPermissions();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [allCompetitors, setAllCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [aiCriteria, setAiCriteria] = useState<any>(null);
  const [selectedCompetitor, setSelectedCompetitor] = useState<string | null>(null);
  const [showNovoCompetitor, setShowNovoCompetitor] = useState(false);

  if (!permissionsLoading && !hasPermission("trade_competitors")) {
    return <Navigate to="/dashboard" replace />;
  }

  useEffect(() => {
    fetchCompetitors();
  }, []);

  const fetchCompetitors = async () => {
    try {
      const { data, error } = await supabase
        .from("competitors")
        .select("*")
        .eq("active", true)
        .order("name");

      if (error) throw error;
      setAllCompetitors(data || []);
      setCompetitors(data || []);
    } catch (error) {
      console.error("Erro ao buscar concorrentes:", error);
      toast.error("Erro ao carregar concorrentes");
    } finally {
      setLoading(false);
    }
  };

  const getThreatColor = (level: string | null) => {
    switch (level) {
      case "alto":
        return "destructive";
      case "medio":
        return "default";
      case "baixo":
        return "secondary";
      default:
        return "outline";
    }
  };

  const applyFilters = () => {
    let filtered = [...allCompetitors];

    // Competitors table doesn't have store_id, AI filter only
    if (aiCriteria) {
      if (aiCriteria.priority === "alta") {
        filtered = filtered.filter(c => c.threat_level === "alto");
      }
      if (aiCriteria.category) {
        filtered = filtered.filter(c => c.category === aiCriteria.category);
      }
    }

    setCompetitors(filtered);
  };

  useEffect(() => {
    applyFilters();
  }, [aiCriteria, allCompetitors]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Monitoramento de Concorrentes</h1>
            <p className="text-muted-foreground">
              Análise competitiva e inteligência de mercado
            </p>
          </div>
          <Button onClick={() => setShowNovoCompetitor(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Concorrente
          </Button>
        </div>

        <TradeFilters
          selectedStore={selectedStore}
          onStoreChange={setSelectedStore}
          onAIFilter={setAiCriteria}
        />

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Concorrentes</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{competitors.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Concorrentes Diretos</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {competitors.filter(c => c.is_direct_competitor).length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ameaça Alta</CardTitle>
              <Target className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {competitors.filter(c => c.threat_level === "alto").length}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Market Share</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Nível de Ameaça</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : competitors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    Nenhum concorrente cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                competitors.map((competitor) => (
                  <TableRow key={competitor.id}>
                    <TableCell className="font-medium">{competitor.name}</TableCell>
                    <TableCell>{competitor.brand || "-"}</TableCell>
                    <TableCell>{competitor.category || "-"}</TableCell>
                    <TableCell>
                      {competitor.market_share ? `${competitor.market_share}%` : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={competitor.is_direct_competitor ? "default" : "outline"}>
                        {competitor.is_direct_competitor ? "Direto" : "Indireto"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getThreatColor(competitor.threat_level)}>
                        {competitor.threat_level || "N/A"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setSelectedCompetitor(competitor.id);
                          toast.info("Use a seção abaixo para adicionar e comparar fotos");
                        }}
                      >
                        Ver Detalhes
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Seção de Comparação de Fotos */}
        {selectedCompetitor && (
          <CompetitorComparisonUpload 
            competitorId={selectedCompetitor}
            onPhotosUploaded={() => toast.success("Fotos atualizadas!")}
          />
        )}

        <NovoCompetitorDialog
          open={showNovoCompetitor}
          onOpenChange={setShowNovoCompetitor}
          onSuccess={fetchCompetitors}
        />
      </div>
    </DashboardLayout>
  );
};

export default TradeCompetitors;
