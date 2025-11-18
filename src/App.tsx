import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import ErrorPage from "@/pages/ErrorPage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { memoryManager } from "@/lib/utils/memory-manager";
import { useSyncOfflineData } from "@/hooks/useSyncOfflineData";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { lazy, Suspense } from "react";

// Lazy load das páginas para otimizar bundle
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ProspectsModule = lazy(() => import("./pages/modules/ProspectsModule"));
const MarketingModule = lazy(() => import("./pages/modules/MarketingModule"));
const Prospects = lazy(() => import("./pages/Prospects"));
const Municipios = lazy(() => import("./pages/Municipios"));
const Atividades = lazy(() => import("./pages/Atividades"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const ImportarClientes = lazy(() => import("./pages/ImportarClientes"));
const Auditoria = lazy(() => import("./pages/Auditoria"));
const Kanban = lazy(() => import("./pages/Kanban"));
const Tarefas = lazy(() => import("./pages/Tarefas"));
const Mapa = lazy(() => import("./pages/Mapa"));
const Chat = lazy(() => import("./pages/Chat"));
const AguardandoAprovacao = lazy(() => import("./pages/AguardandoAprovacao"));
const NotFound = lazy(() => import("./pages/NotFound"));
const TradeModule = lazy(() => import("./pages/modules/TradeModule"));
const TradeStores = lazy(() => import("./pages/TradeStores"));
const TradeVisits = lazy(() => import("./pages/TradeVisits"));
const TradePhotos = lazy(() => import("./pages/TradePhotos"));
const TradeInsights = lazy(() => import("./pages/TradeInsights"));
const TradeCompetitors = lazy(() => import("./pages/TradeCompetitors"));
const TradePromotions = lazy(() => import("./pages/TradePromotions"));
const TradeImportStores = lazy(() => import("./pages/TradeImportStores"));
const TradeCalendar = lazy(() => import("./pages/TradeCalendar"));
const TradeIdealPhotos = lazy(() => import("./pages/TradeIdealPhotos"));
const TradeAuditorias = lazy(() => import("./pages/TradeAuditorias"));
const TradeRelatorioCompetitivo = lazy(() => import("./pages/TradeRelatorioCompetitivo"));
const TradeComparacaoProdutos = lazy(() => import("./pages/TradeComparacaoProdutos"));
const TradeSellOut = lazy(() => import("./pages/TradeSellOut"));
const TradeShelfMeasurements = lazy(() => import("./pages/TradeShelfMeasurements"));
const TradeMeasurementGuide = lazy(() => import("./pages/TradeMeasurementGuide"));
const TradeOurBrands = lazy(() => import("./pages/TradeOurBrands"));
const Ranking = lazy(() => import("./pages/Ranking"));
const TradeFinanceiro = lazy(() => import("./pages/TradeFinanceiro"));
const TradeContasCorrentes = lazy(() => import("./pages/TradeContasCorrentes"));
const TradeExtratoBancario = lazy(() => import("./pages/TradeExtratoBancario"));
const TradeVerbasSemestrais = lazy(() => import("./pages/TradeVerbasSemestrais"));
const TradeLancamentos = lazy(() => import("./pages/TradeLancamentos"));
const TradeAprovacoes = lazy(() => import("./pages/TradeAprovacoes"));
const TradeExtratosPessoais = lazy(() => import("./pages/TradeExtratosPessoais"));
const TradeCampaigns = lazy(() => import("./pages/TradeCampaigns"));
const TradePerformance = lazy(() => import("./pages/TradePerformance"));
const TradeTeamPerformance = lazy(() => import("./pages/TradeTeamPerformance"));
const TradeRewards = lazy(() => import("./pages/TradeRewards"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const InstalarApp = lazy(() => import("./pages/InstalarApp"));
const WhatsAppMonitoring = lazy(() => import("./pages/WhatsAppMonitoring"));
const Marketing = lazy(() => import("./pages/Marketing"));

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos
      gcTime: 10 * 60 * 1000, // 10 minutos (antigo cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => {
  // Inicializar gerenciador de memória primeiro
  useEffect(() => {
    console.log('🚀 Memory Manager inicializado');
    
    return () => {
      memoryManager.destroy();
    };
  }, []);

  // Hook para sincronizar dados offline quando voltar online
  useSyncOfflineData();

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Error route */}
              <Route path="*" element={<ErrorPage />} />
        <Route path="/" element={<Index />} />
        <Route path="/auth/login" element={<Auth />} />
        <Route path="/auth/signup" element={<Auth />} />
        <Route path="/aguardando-aprovacao" element={<AguardandoAprovacao />} />
        
        {/* Protected Routes */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/dashboard/relatorios" element={<ProtectedRoute><Relatorios /></ProtectedRoute>} />
        
        {/* Módulo de Marketing */}
        <Route path="/dashboard/marketing" element={<ProtectedRoute><MarketingModule /></ProtectedRoute>} />
        <Route path="/dashboard/marketing/dashboards" element={<ProtectedRoute><Marketing /></ProtectedRoute>} />
        <Route path="/dashboard/marketing/whatsapp" element={<ProtectedRoute><WhatsAppMonitoring /></ProtectedRoute>} />
        
        <Route path="/dashboard/instalar-app" element={<ProtectedRoute><InstalarApp /></ProtectedRoute>} />
        
        {/* Módulo de Prospects */}
        <Route path="/dashboard/prospects" element={<ProtectedRoute><ProspectsModule /></ProtectedRoute>} />
        <Route path="/dashboard/prospects/list" element={<ProtectedRoute><Prospects /></ProtectedRoute>} />
        <Route path="/dashboard/prospects/kanban" element={<ProtectedRoute><Kanban /></ProtectedRoute>} />
        <Route path="/dashboard/prospects/atividades" element={<ProtectedRoute><Atividades /></ProtectedRoute>} />
        <Route path="/dashboard/prospects/mapa" element={<ProtectedRoute><Mapa /></ProtectedRoute>} />
        
        {/* Outras funcionalidades */}
        <Route path="/dashboard/municipios" element={<ProtectedRoute><Municipios /></ProtectedRoute>} />
        <Route path="/dashboard/ranking" element={<ProtectedRoute><Ranking /></ProtectedRoute>} />
        <Route path="/dashboard/tarefas" element={<ProtectedRoute><Tarefas /></ProtectedRoute>} />
        <Route path="/dashboard/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
        <Route path="/dashboard/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
        <Route path="/dashboard/whatsapp" element={<ProtectedRoute><WhatsAppMonitoring /></ProtectedRoute>} />
        <Route path="/dashboard/importar-clientes" element={<ProtectedRoute><ImportarClientes /></ProtectedRoute>} />
        <Route path="/dashboard/auditoria" element={<ProtectedRoute><Auditoria /></ProtectedRoute>} />
        
        {/* Módulo de Trade Marketing */}
        <Route path="/dashboard/trade" element={<ProtectedRoute><TradeModule /></ProtectedRoute>} />
        <Route path="/dashboard/trade/stores" element={<ProtectedRoute><TradeStores /></ProtectedRoute>} />
        <Route path="/dashboard/trade/visits" element={<ProtectedRoute><TradeVisits /></ProtectedRoute>} />
        <Route path="/dashboard/trade/photos" element={<ProtectedRoute><TradePhotos /></ProtectedRoute>} />
        <Route path="/dashboard/trade/competitors" element={<ProtectedRoute><TradeCompetitors /></ProtectedRoute>} />
        <Route path="/dashboard/trade/promotions" element={<ProtectedRoute><TradePromotions /></ProtectedRoute>} />
        <Route path="/dashboard/trade/insights" element={<ProtectedRoute><TradeInsights /></ProtectedRoute>} />
        <Route path="/dashboard/trade/import-stores" element={<ProtectedRoute><TradeImportStores /></ProtectedRoute>} />
        <Route path="/dashboard/trade/calendar" element={<ProtectedRoute><TradeCalendar /></ProtectedRoute>} />
        <Route path="/dashboard/trade/ideal-photos" element={<ProtectedRoute><TradeIdealPhotos /></ProtectedRoute>} />
        <Route path="/dashboard/trade/financeiro" element={<ProtectedRoute><TradeFinanceiro /></ProtectedRoute>} />
        <Route path="/dashboard/trade/financeiro/campanhas" element={<ProtectedRoute><TradeCampaigns /></ProtectedRoute>} />
        <Route path="/dashboard/trade/financeiro/contas" element={<ProtectedRoute><TradeContasCorrentes /></ProtectedRoute>} />
        <Route path="/dashboard/trade/financeiro/extrato/:accountId" element={<ProtectedRoute><TradeExtratoBancario /></ProtectedRoute>} />
        <Route path="/dashboard/trade/financeiro/verbas" element={<ProtectedRoute><TradeVerbasSemestrais /></ProtectedRoute>} />
        <Route path="/dashboard/trade/financeiro/lancamentos" element={<ProtectedRoute><TradeLancamentos /></ProtectedRoute>} />
        <Route path="/dashboard/trade/financeiro/aprovacoes" element={<ProtectedRoute><TradeAprovacoes /></ProtectedRoute>} />
        <Route path="/dashboard/trade/financeiro/extrato" element={<ProtectedRoute><TradeExtratosPessoais /></ProtectedRoute>} />
        <Route path="/dashboard/trade/auditorias" element={<ProtectedRoute><TradeAuditorias /></ProtectedRoute>} />
        <Route path="/dashboard/trade/sellout" element={<ProtectedRoute><TradeSellOut /></ProtectedRoute>} />
        <Route path="/dashboard/trade/shelf-measurements" element={<ProtectedRoute><TradeShelfMeasurements /></ProtectedRoute>} />
        <Route path="/dashboard/trade/measurement-guide" element={<ProtectedRoute><TradeMeasurementGuide /></ProtectedRoute>} />
        <Route path="/dashboard/trade/our-brands" element={<ProtectedRoute><TradeOurBrands /></ProtectedRoute>} />
        <Route path="/dashboard/trade/relatorio-competitivo" element={<ProtectedRoute><TradeRelatorioCompetitivo /></ProtectedRoute>} />
        <Route path="/dashboard/trade/comparacao-produtos" element={<ProtectedRoute><TradeComparacaoProdutos /></ProtectedRoute>} />
        <Route path="/dashboard/trade/performance" element={<ProtectedRoute><TradePerformance /></ProtectedRoute>} />
        <Route path="/dashboard/trade/team-performance" element={<ProtectedRoute><TradeTeamPerformance /></ProtectedRoute>} />
        <Route path="/dashboard/trade/rewards" element={<ProtectedRoute><TradeRewards /></ProtectedRoute>} />
        
            </Routes>
          </Suspense>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
