import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  AlertCircle,
  CheckCircle2,
  Target,
  Lightbulb,
  RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CompetitiveAnalysis {
  id: string;
  created_at: string;
  competitive_score: number;
  price_competitiveness: string;
  shelf_share_impact: string;
  analysis_data: {
    shelf_share_percentage: number;
    strengths: string[];
    weaknesses: string[];
    immediate_actions: string[];
  };
  gondola_audits: {
    preco_praticado: number;
    quantidade_frentes: number;
    produto_ean: string;
    produto_descricao: string;
    estoque_loja: number;
    concorrentes_detalhes: any[];
    products: {
      name: string;
      sku: string;
    };
    stores: {
      name: string;
      code: string;
    };
  };
}

export default function TradeRelatorioCompetitivo() {
  const [analyses, setAnalyses] = useState<CompetitiveAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchAnalyses();
  }, []);

  const fetchAnalyses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("gondola_competitive_analysis")
        .select(`
          *,
          gondola_audits (
            preco_praticado,
            quantidade_frentes,
            produto_ean,
            produto_descricao,
            estoque_loja,
            concorrentes_detalhes,
            products (name, sku),
            stores (name, code)
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAnalyses((data as any) || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return "text-green-600";
    if (score >= 50) return "text-yellow-600";
    return "text-destructive";
  };

  const getPriceLabel = (level: string) => {
    const labels: Record<string, { text: string; variant: any }> = {
      excelente: { text: "Excelente", variant: "default" },
      boa: { text: "Boa", variant: "secondary" },
      regular: { text: "Regular", variant: "outline" },
      ruim: { text: "Ruim", variant: "destructive" }
    };
    return labels[level] || labels.regular;
  };

  const getImpactLabel = (impact: string) => {
    const labels: Record<string, { text: string; variant: any }> = {
      alto: { text: "Alto Impacto", variant: "default" },
      medio: { text: "Médio Impacto", variant: "secondary" },
      baixo: { text: "Baixo Impacto", variant: "outline" }
    };
    return labels[impact] || labels.medio;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Análise Competitiva de Gôndola</h1>
            <p className="text-muted-foreground">
              Relatório inteligente com insights de IA sobre competitividade
            </p>
          </div>
          <Button onClick={fetchAnalyses} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-8">Carregando análises...</div>
        ) : analyses.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">
                Nenhuma análise disponível. Crie auditorias com concorrentes para gerar análises automáticas.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {analyses.map((analysis) => {
              const priceLabel = getPriceLabel(analysis.price_competitiveness);
              const impactLabel = getImpactLabel(analysis.shelf_share_impact);
              
              return (
                <Card key={analysis.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-xl">
                          {analysis.gondola_audits?.products?.name}
                          {analysis.gondola_audits?.products?.sku && (
                            <Badge variant="outline" className="ml-2">
                              {analysis.gondola_audits.products.sku}
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {analysis.gondola_audits?.stores?.name} ({analysis.gondola_audits?.stores?.code})
                        </CardDescription>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(analysis.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className={`text-4xl font-bold ${getScoreColor(analysis.competitive_score)}`}>
                          {analysis.competitive_score}
                        </div>
                        <p className="text-xs text-muted-foreground">Score Competitivo</p>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-6">
                    {/* Métricas Principais */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Preço Praticado</p>
                        <p className="text-lg font-semibold">
                          R$ {analysis.gondola_audits?.preco_praticado?.toFixed(2)}
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Competitividade</p>
                        <Badge variant={priceLabel.variant}>{priceLabel.text}</Badge>
                      </div>
                      
                      <div>
                        <p className="text-sm text-muted-foreground">Share de Gôndola</p>
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-semibold">
                            {analysis.analysis_data.shelf_share_percentage.toFixed(1)}%
                          </p>
                          <Badge variant={impactLabel.variant} className="text-xs">
                            {impactLabel.text}
                          </Badge>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm text-muted-foreground">Estoque</p>
                        <p className="text-lg font-semibold">
                          {analysis.gondola_audits?.estoque_loja || 'N/A'}
                        </p>
                      </div>
                    </div>

                    {/* Concorrentes */}
                    {analysis.gondola_audits?.concorrentes_detalhes?.length > 0 && (
                      <div>
                        <h4 className="font-semibold flex items-center gap-2 mb-3">
                          <BarChart3 className="h-4 w-4" />
                          Concorrentes Identificados
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {analysis.gondola_audits.concorrentes_detalhes.map((conc: any, idx: number) => (
                            <div key={idx} className="border rounded-lg p-3 space-y-1">
                              <div className="flex justify-between items-start">
                                <p className="font-medium">{conc.nome}</p>
                                <Badge variant="outline">{conc.quantidade_frentes} frentes</Badge>
                              </div>
                              {conc.produto_nome && (
                                <p className="text-sm text-muted-foreground">{conc.produto_nome}</p>
                              )}
                              {conc.preco_praticado && (
                                <p className="text-sm font-semibold">
                                  R$ {conc.preco_praticado.toFixed(2)}
                                  {analysis.gondola_audits?.preco_praticado && (
                                    <span className={conc.preco_praticado > analysis.gondola_audits.preco_praticado ? 
                                      "text-green-600 ml-2" : "text-destructive ml-2"}>
                                      {conc.preco_praticado > analysis.gondola_audits.preco_praticado ?
                                        <TrendingUp className="inline h-3 w-3" /> :
                                        <TrendingDown className="inline h-3 w-3" />
                                      }
                                    </span>
                                  )}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Pontos Fortes */}
                    {analysis.analysis_data.strengths?.length > 0 && (
                      <div>
                        <h4 className="font-semibold flex items-center gap-2 mb-2 text-green-600">
                          <CheckCircle2 className="h-4 w-4" />
                          Pontos Fortes
                        </h4>
                        <ul className="space-y-1">
                          {analysis.analysis_data.strengths.map((strength, idx) => (
                            <li key={idx} className="text-sm flex items-start gap-2">
                              <span className="text-green-600 mt-1">•</span>
                              <span>{strength}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Pontos Fracos */}
                    {analysis.analysis_data.weaknesses?.length > 0 && (
                      <div>
                        <h4 className="font-semibold flex items-center gap-2 mb-2 text-yellow-600">
                          <AlertCircle className="h-4 w-4" />
                          Pontos de Atenção
                        </h4>
                        <ul className="space-y-1">
                          {analysis.analysis_data.weaknesses.map((weakness, idx) => (
                            <li key={idx} className="text-sm flex items-start gap-2">
                              <span className="text-yellow-600 mt-1">•</span>
                              <span>{weakness}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Recomendações */}
                    {analysis.analysis_data.immediate_actions?.length > 0 && (
                      <div className="bg-primary/5 border-l-4 border-primary p-4 rounded">
                        <h4 className="font-semibold flex items-center gap-2 mb-2">
                          <Lightbulb className="h-4 w-4" />
                          Ações Recomendadas
                        </h4>
                        <ul className="space-y-2">
                          {analysis.analysis_data.immediate_actions.map((action, idx) => (
                            <li key={idx} className="text-sm flex items-start gap-2">
                              <Target className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                              <span>{action}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
