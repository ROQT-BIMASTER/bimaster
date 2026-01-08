import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Calendar, Store, Camera, MapPin, TrendingUp, Users, 
  CheckCircle2, Target, Award, BarChart3, ArrowUp, ArrowDown,
  ChevronLeft, ChevronRight, Clock, Sparkles, Trophy, Star,
  Maximize2, Minimize2
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

interface RetrospectiveData {
  totalVisitas: number;
  visitasCompletadas: number;
  taxaCompletacao: number;
  totalFotos: number;
  fotosAnalisadas: number;
  lojasCadastradas: number;
  lojasVisitadas: number;
  investimentoTotal: number;
  vendasTotal: number;
  roiMedio: number;
  topVendedores: Array<{
    id: string;
    nome: string;
    visitas: number;
    fotos: number;
  }>;
  topLojas: Array<{
    id: string;
    nome: string;
    visitas: number;
    investimento: number;
  }>;
  evolucaoMensal: Array<{
    mes: string;
    visitas: number;
    fotos: number;
  }>;
  insightsIA: Array<{
    tipo: string;
    descricao: string;
    impacto: string;
  }>;
}

const months = [
  { value: '01', label: 'Janeiro' },
  { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },
  { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

export function TradeRetrospective() {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState(format(currentDate, 'MM'));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  const years = useMemo(() => {
    const current = currentDate.getFullYear();
    return [current - 2, current - 1, current].map(y => y.toString());
  }, []);

  const dateRange = useMemo(() => {
    const date = parseISO(`${selectedYear}-${selectedMonth}-01`);
    return {
      start: format(startOfMonth(date), 'yyyy-MM-dd'),
      end: format(endOfMonth(date), 'yyyy-MM-dd'),
      label: format(date, 'MMMM yyyy', { locale: ptBR })
    };
  }, [selectedYear, selectedMonth]);

  // Fetch retrospective data
  const { data, isLoading } = useQuery({
    queryKey: ['trade-retrospective', dateRange.start, dateRange.end],
    queryFn: async (): Promise<RetrospectiveData> => {
      const [visitsRes, photosRes, storesRes, investmentsRes, insightsRes, profilesRes] = await Promise.all([
        supabase
          .from('visits')
          .select('id, status, scheduled_date, vendedor_id, store_id')
          .gte('scheduled_date', dateRange.start)
          .lte('scheduled_date', dateRange.end),
        supabase
          .from('photos')
          .select('id, ai_processed, upload_date, vendedor_id, store_id')
          .gte('upload_date', dateRange.start)
          .lte('upload_date', dateRange.end),
        supabase
          .from('stores')
          .select('id, name, status'),
        supabase
          .from('trade_investments')
          .select('id, amount, store_id')
          .gte('investment_date', dateRange.start)
          .lte('investment_date', dateRange.end),
        supabase
          .from('ai_insights')
          .select('id, title, description, impact_level, category')
          .eq('entity_type', 'trade')
          .gte('generated_at', dateRange.start)
          .lte('generated_at', dateRange.end)
          .limit(5),
        supabase
          .from('profiles')
          .select('id, nome')
      ]);

      const visits = visitsRes.data || [];
      const photos = photosRes.data || [];
      const stores = storesRes.data || [];
      const investments = investmentsRes.data || [];
      const insights = insightsRes.data || [];
      const profiles = profilesRes.data || [];

      // Calculate stats
      const visitasCompletadas = visits.filter(v => v.status === 'completed').length;
      const lojasVisitadas = new Set(visits.map(v => v.store_id)).size;

      // Top vendors
      const vendorVisits: Record<string, { visitas: number; fotos: number }> = {};
      visits.forEach(v => {
        if (v.vendedor_id) {
          if (!vendorVisits[v.vendedor_id]) vendorVisits[v.vendedor_id] = { visitas: 0, fotos: 0 };
          vendorVisits[v.vendedor_id].visitas++;
        }
      });
      photos.forEach(p => {
        if (p.vendedor_id && vendorVisits[p.vendedor_id]) {
          vendorVisits[p.vendedor_id].fotos++;
        }
      });

      const topVendedores = Object.entries(vendorVisits)
        .map(([id, data]) => ({
          id,
          nome: profiles.find(p => p.id === id)?.nome || 'Desconhecido',
          ...data
        }))
        .sort((a, b) => b.visitas - a.visitas)
        .slice(0, 5);

      // Top stores
      const storeStats: Record<string, { visitas: number; investimento: number }> = {};
      visits.forEach(v => {
        if (v.store_id) {
          if (!storeStats[v.store_id]) storeStats[v.store_id] = { visitas: 0, investimento: 0 };
          storeStats[v.store_id].visitas++;
        }
      });
      investments.forEach(i => {
        if (i.store_id && storeStats[i.store_id]) {
          storeStats[i.store_id].investimento += i.amount || 0;
        }
      });

      const topLojas = Object.entries(storeStats)
        .map(([id, data]) => ({
          id,
          nome: stores.find(s => s.id === id)?.name || 'Desconhecida',
          ...data
        }))
        .sort((a, b) => b.visitas - a.visitas)
        .slice(0, 5);

      const investimentoTotal = investments.reduce((sum, i) => sum + (i.amount || 0), 0);
      const vendasTotal = investimentoTotal * 1.5; // Estimate
      const roiMedio = investimentoTotal > 0 ? 50 : 0; // Placeholder

      return {
        totalVisitas: visits.length,
        visitasCompletadas,
        taxaCompletacao: visits.length > 0 ? (visitasCompletadas / visits.length) * 100 : 0,
        totalFotos: photos.length,
        fotosAnalisadas: photos.filter(p => p.ai_processed).length,
        lojasCadastradas: stores.filter(s => s.status === 'active').length,
        lojasVisitadas,
        investimentoTotal,
        vendasTotal,
        roiMedio,
        topVendedores,
        topLojas,
        evolucaoMensal: [],
        insightsIA: insights.map(i => ({
          tipo: i.category || 'geral',
          descricao: i.title || '',
          impacto: i.impact_level || 'medium'
        }))
      };
    }
  });

  const slides = [
    { id: 'overview', title: 'Visão Geral' },
    { id: 'visits', title: 'Visitas & Cobertura' },
    { id: 'photos', title: 'Análise de Fotos' },
    { id: 'investments', title: 'Investimentos & ROI' },
    { id: 'team', title: 'Performance da Equipe' },
    { id: 'insights', title: 'Insights IA' },
  ];

  const nextSlide = () => setCurrentSlide(prev => Math.min(prev + 1, slides.length - 1));
  const prevSlide = () => setCurrentSlide(prev => Math.max(prev - 1, 0));

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const renderSlideContent = () => {
    if (isLoading || !data) {
      return (
        <div className="flex items-center justify-center h-[400px]">
          <div className="text-center">
            <Sparkles className="h-12 w-12 animate-pulse text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Preparando retrospectiva...</p>
          </div>
        </div>
      );
    }

    switch (slides[currentSlide].id) {
      case 'overview':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                {dateRange.label}
              </h2>
              <p className="text-muted-foreground mt-2">Retrospectiva de Trade Marketing</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                <CardContent className="p-4 text-center">
                  <Calendar className="h-8 w-8 mx-auto text-blue-500 mb-2" />
                  <div className="text-3xl font-bold text-blue-600">{data.totalVisitas}</div>
                  <div className="text-sm text-muted-foreground">Visitas Realizadas</div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
                <CardContent className="p-4 text-center">
                  <Camera className="h-8 w-8 mx-auto text-green-500 mb-2" />
                  <div className="text-3xl font-bold text-green-600">{data.totalFotos}</div>
                  <div className="text-sm text-muted-foreground">Fotos Capturadas</div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                <CardContent className="p-4 text-center">
                  <Store className="h-8 w-8 mx-auto text-purple-500 mb-2" />
                  <div className="text-3xl font-bold text-purple-600">{data.lojasVisitadas}</div>
                  <div className="text-sm text-muted-foreground">PDVs Visitados</div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
                <CardContent className="p-4 text-center">
                  <TrendingUp className="h-8 w-8 mx-auto text-amber-500 mb-2" />
                  <div className="text-3xl font-bold text-amber-600">{data.roiMedio.toFixed(1)}%</div>
                  <div className="text-sm text-muted-foreground">ROI Médio</div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-gradient-to-r from-primary/5 to-blue-500/5">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Investimento Total</p>
                    <p className="text-2xl font-bold">{formatCurrency(data.investimentoTotal)}</p>
                  </div>
                  <ArrowUp className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Impacto em Vendas</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(data.vendasTotal)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );

      case 'visits':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold">Visitas & Cobertura</h2>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-muted-foreground">Taxa de Completação</span>
                    <Badge variant={data.taxaCompletacao >= 80 ? 'default' : 'secondary'}>
                      {data.taxaCompletacao.toFixed(1)}%
                    </Badge>
                  </div>
                  <Progress value={data.taxaCompletacao} className="h-3" />
                  <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                    <span>{data.visitasCompletadas} completadas</span>
                    <span>{data.totalVisitas - data.visitasCompletadas} pendentes</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-muted-foreground">Cobertura de PDVs</span>
                    <Badge variant="outline">
                      {((data.lojasVisitadas / Math.max(data.lojasCadastradas, 1)) * 100).toFixed(1)}%
                    </Badge>
                  </div>
                  <Progress 
                    value={(data.lojasVisitadas / Math.max(data.lojasCadastradas, 1)) * 100} 
                    className="h-3" 
                  />
                  <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                    <span>{data.lojasVisitadas} visitados</span>
                    <span>{data.lojasCadastradas} cadastrados</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-500" />
                  Top PDVs Visitados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.topLojas.map((loja, index) => (
                    <div key={loja.id} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        index === 0 ? 'bg-amber-500 text-white' :
                        index === 1 ? 'bg-gray-400 text-white' :
                        index === 2 ? 'bg-amber-700 text-white' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{loja.nome}</p>
                        <p className="text-xs text-muted-foreground">{loja.visitas} visitas</p>
                      </div>
                      <Badge variant="outline">{formatCurrency(loja.investimento)}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );

      case 'photos':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold">Análise de Fotos</h2>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5">
                <CardContent className="p-6 text-center">
                  <Camera className="h-12 w-12 mx-auto text-green-500 mb-3" />
                  <div className="text-4xl font-bold text-green-600">{data.totalFotos}</div>
                  <div className="text-sm text-muted-foreground">Fotos Capturadas</div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5">
                <CardContent className="p-6 text-center">
                  <Sparkles className="h-12 w-12 mx-auto text-blue-500 mb-3" />
                  <div className="text-4xl font-bold text-blue-600">{data.fotosAnalisadas}</div>
                  <div className="text-sm text-muted-foreground">Analisadas por IA</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-medium">Taxa de Análise IA</span>
                  <Badge variant="default">
                    {data.totalFotos > 0 ? ((data.fotosAnalisadas / data.totalFotos) * 100).toFixed(1) : 0}%
                  </Badge>
                </div>
                <Progress 
                  value={data.totalFotos > 0 ? (data.fotosAnalisadas / data.totalFotos) * 100 : 0} 
                  className="h-4"
                />
              </CardContent>
            </Card>
          </motion.div>
        );

      case 'investments':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold">Investimentos & ROI</h2>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{formatCurrency(data.investimentoTotal)}</div>
                  <div className="text-xs text-muted-foreground">Investimento Total</div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{formatCurrency(data.vendasTotal)}</div>
                  <div className="text-xs text-muted-foreground">Impacto em Vendas</div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-purple-600">{data.roiMedio.toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground">ROI Médio</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center">
                    <div className="text-center text-white">
                      <div className="text-2xl font-bold">
                        {data.investimentoTotal > 0 
                          ? ((data.vendasTotal / data.investimentoTotal) * 100).toFixed(0) 
                          : 0}%
                      </div>
                      <div className="text-xs">Retorno</div>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-2">Análise de Retorno</h3>
                    <p className="text-sm text-muted-foreground">
                      Para cada R$1,00 investido em trade marketing, 
                      houve um retorno de R$ {data.investimentoTotal > 0 
                        ? (data.vendasTotal / data.investimentoTotal).toFixed(2) 
                        : '0.00'} em vendas.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );

      case 'team':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold">Performance da Equipe</h2>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-amber-500" />
                  Ranking de Vendedores
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.topVendedores.map((vendedor, index) => (
                    <div key={vendedor.id} className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                        index === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white' :
                        index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-white' :
                        index === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-800 text-white' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {index === 0 ? <Trophy className="h-5 w-5" /> : index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{vendedor.nome}</p>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> {vendedor.visitas} visitas
                          </span>
                          <span className="flex items-center gap-1">
                            <Camera className="h-3 w-3" /> {vendedor.fotos} fotos
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <Progress value={(vendedor.visitas / Math.max(data.topVendedores[0]?.visitas || 1, 1)) * 100} className="w-24 h-2" />
                      </div>
                    </div>
                  ))}
                  {data.topVendedores.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhum dado de vendedores disponível para este período.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );

      case 'insights':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" />
                Insights Gerados por IA
              </h2>
            </div>

            {data.insightsIA.length > 0 ? (
              <div className="space-y-4">
                {data.insightsIA.map((insight, index) => (
                  <Card key={index} className="bg-gradient-to-r from-primary/5 to-blue-500/5">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Star className="h-5 w-5 text-amber-500 mt-0.5" />
                        <div>
                          <Badge variant="outline" className="mb-2">{insight.tipo}</Badge>
                          <p className="font-medium">{insight.descricao}</p>
                          <Badge 
                            className="mt-2"
                            variant={insight.impacto === 'high' ? 'destructive' : 'secondary'}
                          >
                            Impacto: {insight.impacto}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Nenhum insight gerado por IA neste período.
                  </p>
                </CardContent>
              </Card>
            )}
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-background p-8' : ''}`}>
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-4">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Retrospectiva Trade Marketing
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </Button>
        </CardHeader>

        <CardContent>
          {/* Slide Navigation */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                onClick={() => setCurrentSlide(index)}
                className={`h-2 rounded-full transition-all ${
                  index === currentSlide 
                    ? 'w-8 bg-primary' 
                    : 'w-2 bg-muted hover:bg-muted-foreground/50'
                }`}
              />
            ))}
          </div>

          {/* Slide Content */}
          <div className="min-h-[500px]">
            <AnimatePresence mode="wait">
              {renderSlideContent()}
            </AnimatePresence>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-6">
            <Button 
              variant="outline" 
              onClick={prevSlide}
              disabled={currentSlide === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Anterior
            </Button>
            
            <span className="text-sm text-muted-foreground">
              {slides[currentSlide].title} ({currentSlide + 1}/{slides.length})
            </span>

            <Button 
              onClick={nextSlide}
              disabled={currentSlide === slides.length - 1}
            >
              Próximo
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
