import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, MapPin, Users, Building2, CheckCircle } from "lucide-react";

interface DistributionMetrics {
  totalMunicipios: number;
  municipiosCobertos: number;
  municipiosDescobertos: number;
  totalProspects: number;
  prospectsDistribuidos: number;
  prospectsNaoDistribuidos: number;
  percentualCobertura: number;
  municipiosDescobertosLista: Array<{
    id: string;
    nome: string;
    uf: string;
    total_prospects: number;
  }>;
}

export const MetricasDistribuicao = () => {
  const [metrics, setMetrics] = useState<DistributionMetrics>({
    totalMunicipios: 0,
    municipiosCobertos: 0,
    municipiosDescobertos: 0,
    totalProspects: 0,
    prospectsDistribuidos: 0,
    prospectsNaoDistribuidos: 0,
    percentualCobertura: 0,
    municipiosDescobertosLista: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      // Buscar municípios
      const { data: municipios, error: municipiosError } = await supabase
        .from("municipios")
        .select(`
          id,
          nome,
          uf,
          vendedor_id,
          prospects (count)
        `);

      if (municipiosError) throw municipiosError;

      const totalMunicipios = municipios?.length || 0;
      const municipiosCobertos = municipios?.filter(m => m.vendedor_id)?.length || 0;
      const municipiosDescobertos = totalMunicipios - municipiosCobertos;
      const percentualCobertura = totalMunicipios > 0 
        ? Math.round((municipiosCobertos / totalMunicipios) * 100) 
        : 0;

      // Municípios descobertos com prospects
      const municipiosDescobertosLista = municipios
        ?.filter(m => !m.vendedor_id && m.prospects?.[0]?.count > 0)
        ?.map(m => ({
          id: m.id,
          nome: m.nome,
          uf: m.uf,
          total_prospects: m.prospects[0].count
        })) || [];

      // Buscar prospects
      const { data: prospects, error: prospectsError } = await supabase
        .from("prospects")
        .select("id, vendedor_id");

      if (prospectsError) throw prospectsError;

      const totalProspects = prospects?.length || 0;
      const prospectsDistribuidos = prospects?.filter(p => p.vendedor_id)?.length || 0;
      const prospectsNaoDistribuidos = totalProspects - prospectsDistribuidos;

      setMetrics({
        totalMunicipios,
        municipiosCobertos,
        municipiosDescobertos,
        totalProspects,
        prospectsDistribuidos,
        prospectsNaoDistribuidos,
        percentualCobertura,
        municipiosDescobertosLista,
      });
    } catch (error) {
      console.error("Erro ao carregar métricas:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Carregando métricas...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cobertura de Municípios</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.percentualCobertura}%</div>
            <p className="text-xs text-muted-foreground">
              {metrics.municipiosCobertos} de {metrics.totalMunicipios} municípios
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Municípios Descobertos</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{metrics.municipiosDescobertos}</div>
            <p className="text-xs text-muted-foreground">
              Sem vendedor atribuído
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prospects Distribuídos</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{metrics.prospectsDistribuidos}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.totalProspects} total de prospects
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prospects Pendentes</CardTitle>
            <Users className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{metrics.prospectsNaoDistribuidos}</div>
            <p className="text-xs text-muted-foreground">
              Aguardando distribuição
            </p>
          </CardContent>
        </Card>
      </div>

      {metrics.municipiosDescobertosLista.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Municípios Descobertos com Prospects</CardTitle>
            <CardDescription>
              Municípios sem vendedor que possuem prospects cadastrados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Existem {metrics.municipiosDescobertosLista.length} municípios sem vendedor atribuído com prospects cadastrados. 
                Atribua vendedores em Configurações para distribuir automaticamente.
              </AlertDescription>
            </Alert>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {metrics.municipiosDescobertosLista.map((municipio) => (
                <div
                  key={municipio.id}
                  className="flex items-center justify-between p-3 border rounded-lg bg-destructive/5"
                >
                  <div>
                    <p className="font-medium">{municipio.nome} - {municipio.uf}</p>
                    <p className="text-sm text-muted-foreground">
                      {municipio.total_prospects} {municipio.total_prospects === 1 ? 'prospect' : 'prospects'} aguardando
                    </p>
                  </div>
                  <Badge variant="destructive">Sem vendedor</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {metrics.prospectsNaoDistribuidos > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Existem {metrics.prospectsNaoDistribuidos} prospects sem vendedor atribuído. 
            Isso pode ocorrer quando o município do prospect não tem vendedor cadastrado ou o município não foi identificado.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
