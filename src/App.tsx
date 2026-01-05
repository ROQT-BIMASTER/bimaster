import { lazy, Suspense, useEffect, useState, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import ErrorPage from "@/pages/ErrorPage";
import { memoryManager } from "@/lib/utils/memory-manager";
import { memoryMonitor } from "@/lib/utils/memory-monitor";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ClienteProtectedRoute } from "@/components/auth/ClienteProtectedRoute";
import { AuthProvider } from "@/contexts/AuthContext";
import { PermissionsProvider } from "@/contexts/PermissionsContext";
import { PWAProvider, usePWA } from "@/contexts/PWAContext";
import { PWAUpdatePrompt } from "@/components/pwa/PWAUpdatePrompt";
import { SplashScreen } from "@/components/pwa/SplashScreen";

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
const TradeStoreChains = lazy(() => import("./pages/TradeStoreChains"));
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
const MarketingMissionControlPage = lazy(() => import("./pages/MarketingMissionControlPage"));
const AIAnalytics = lazy(() => import("./pages/AIAnalytics"));
const QAAgent = lazy(() => import("./pages/QAAgent"));
const FabricaModule = lazy(() => import("./pages/modules/FabricaModule"));
const FabricaMateriasPrimas = lazy(() => import("./pages/FabricaMateriasPrimas"));
const FabricaFormulas = lazy(() => import("./pages/FabricaFormulas"));
const FabricaFormulaEditor = lazy(() => import("./pages/FabricaFormulaEditor"));
const FabricaPlanejamento = lazy(() => import("./pages/FabricaPlanejamento"));
const FabricaOrdensProducao = lazy(() => import("./pages/FabricaOrdensProducao"));
const FabricaRecebimentos = lazy(() => import("./pages/FabricaRecebimentos"));
const FabricaFiscal = lazy(() => import("./pages/FabricaFiscal"));
const FabricaTabelaImpostos = lazy(() => import("./pages/FabricaTabelaImpostos"));
const FabricaApontamentos = lazy(() => import("./pages/FabricaApontamentos"));
const FabricaQualidade = lazy(() => import("./pages/FabricaQualidade"));
const FabricaParadas = lazy(() => import("./pages/FabricaParadas"));
const FabricaMaquinas = lazy(() => import("./pages/FabricaMaquinas"));
const FabricaOperadores = lazy(() => import("./pages/FabricaOperadores"));
const FabricaProdutosAcabados = lazy(() => import("./pages/FabricaProdutosAcabados"));
const ImportarProdutosAcabados = lazy(() => import("./pages/ImportarProdutosAcabados"));
const TabelasPrecosModule = lazy(() => import("./pages/modules/TabelasPrecosModule"));
const FabricaTabelasPreco = lazy(() => import("./pages/FabricaTabelasPreco"));
const FabricaAprovacaoPrecos = lazy(() => import("./pages/FabricaAprovacaoPrecos"));
const FabricaLancamentos = lazy(() => import("./pages/FabricaLancamentos"));
const PortalCliente = lazy(() => import("./pages/PortalCliente"));
const APIHealthCheck = lazy(() => import("./pages/APIHealthCheck"));
const ContasAPagar = lazy(() => import("./pages/ContasAPagar"));
const PlanoContas = lazy(() => import("./pages/PlanoContas"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const VisaoDepartamentos = lazy(() => import("./pages/VisaoDepartamentos"));
const DREAnalitico = lazy(() => import("./pages/DREAnalitico"));
const ClassificarTodoBanco = lazy(() => import("./pages/ClassificarTodoBanco"));
const ContasAReceber = lazy(() => import("./pages/ContasAReceber"));
const ContasReceberAuditoria = lazy(() => import("./pages/ContasReceberAuditoria"));
const CobrancaInadimplentes = lazy(() => import("./pages/CobrancaInadimplentes"));
const FluxoDeCaixa = lazy(() => import("./pages/FluxoDeCaixa"));
const ContasReceberSyncPage = lazy(() => import("./pages/financeiro/ContasReceberSyncPage"));
const ContasPagarSyncPage = lazy(() => import("./pages/financeiro/ContasPagarSyncPage"));
// Portal do Cliente (isolado)
const PortalPrecos = lazy(() => import("./pages/portal/PortalPrecos"));
const PortalPerfil = lazy(() => import("./pages/portal/PortalPerfil"));

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 minutos (reduzido de 5)
      gcTime: 5 * 60 * 1000, // 5 minutos (reduzido de 10)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Componente interno que usa o hook PWA
function AppContent() {
  const { installProgress, installStatus } = usePWA();
  const [showSplash, setShowSplash] = useState(() => {
    const hasShownSplash = sessionStorage.getItem('splashShown');
    return !hasShownSplash;
  });
  
  const splashTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasCompletedRef = useRef(false);

  const handleSplashComplete = () => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    setShowSplash(false);
    sessionStorage.setItem('splashShown', 'true');
    if (splashTimeoutRef.current) {
      clearTimeout(splashTimeoutRef.current);
      splashTimeoutRef.current = null;
    }
  };

  // Timeout de segurança - garante que splash sempre fecha
  useEffect(() => {
    if (showSplash && !splashTimeoutRef.current && !hasCompletedRef.current) {
      splashTimeoutRef.current = setTimeout(() => {
        handleSplashComplete();
      }, 3000);
    }
    
    return () => {
      if (splashTimeoutRef.current) {
        clearTimeout(splashTimeoutRef.current);
        splashTimeoutRef.current = null;
      }
    };
  }, [showSplash]);

  return (
    <>
      {/* Splash Screen */}
      {showSplash && (
        <SplashScreen 
          progress={installProgress} 
          status={installStatus}
          onComplete={handleSplashComplete}
        />
      )}
      
      {/* PWA Update Prompt */}
      <PWAUpdatePrompt />
      
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
            <Route path="/dashboard/ai-analytics" element={<ProtectedRoute><AIAnalytics /></ProtectedRoute>} />
            <Route path="/dashboard/qa-agent" element={<ProtectedRoute><QAAgent /></ProtectedRoute>} />
            <Route path="/dashboard/relatorios" element={<ProtectedRoute><Relatorios /></ProtectedRoute>} />
            
            {/* Módulo de Marketing */}
            <Route path="/dashboard/marketing" element={<ProtectedRoute><MarketingModule /></ProtectedRoute>} />
            <Route path="/dashboard/marketing/social" element={<ProtectedRoute><Marketing /></ProtectedRoute>} />
            <Route path="/dashboard/marketing/whatsapp" element={<ProtectedRoute><WhatsAppMonitoring /></ProtectedRoute>} />
            
            <Route path="/dashboard/instalar-app" element={<ProtectedRoute><InstalarApp /></ProtectedRoute>} />
            
            {/* Módulo de Prospects */}
            <Route path="/dashboard/prospects" element={<ProtectedRoute><ProspectsModule /></ProtectedRoute>} />
            <Route path="/dashboard/prospects/lista" element={<ProtectedRoute><Prospects /></ProtectedRoute>} />
            <Route path="/dashboard/prospects/kanban" element={<ProtectedRoute><Kanban /></ProtectedRoute>} />
            <Route path="/dashboard/prospects/atividades" element={<ProtectedRoute><Atividades /></ProtectedRoute>} />
            <Route path="/dashboard/prospects/mapa" element={<ProtectedRoute><Mapa /></ProtectedRoute>} />
            <Route path="/dashboard/prospects/municipios" element={<ProtectedRoute><Municipios /></ProtectedRoute>} />
            
            {/* Outras funcionalidades */}
            <Route path="/dashboard/ranking" element={<ProtectedRoute><Ranking /></ProtectedRoute>} />
            <Route path="/dashboard/tarefas" element={<ProtectedRoute><Tarefas /></ProtectedRoute>} />
            <Route path="/dashboard/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="/dashboard/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
            <Route path="/dashboard/importar-clientes" element={<ProtectedRoute><ImportarClientes /></ProtectedRoute>} />
            <Route path="/dashboard/auditoria" element={<ProtectedRoute><Auditoria /></ProtectedRoute>} />
            
            {/* Módulo de Trade Marketing */}
            <Route path="/dashboard/trade" element={<ProtectedRoute><TradeModule /></ProtectedRoute>} />
            <Route path="/dashboard/trade/store-chains" element={<ProtectedRoute><TradeStoreChains /></ProtectedRoute>} />
            <Route path="/dashboard/trade/stores" element={<ProtectedRoute><TradeStores /></ProtectedRoute>} />
            <Route path="/dashboard/trade/visits" element={<ProtectedRoute><TradeVisits /></ProtectedRoute>} />
            <Route path="/dashboard/trade/photos" element={<ProtectedRoute><TradePhotos /></ProtectedRoute>} />
            <Route path="/dashboard/trade/competitors" element={<ProtectedRoute><TradeCompetitors /></ProtectedRoute>} />
            <Route path="/dashboard/trade/promotions" element={<ProtectedRoute><TradePromotions /></ProtectedRoute>} />
            <Route path="/dashboard/trade/insights" element={<ProtectedRoute><TradeInsights /></ProtectedRoute>} />
            <Route path="/dashboard/trade/whatsapp" element={<ProtectedRoute><WhatsAppMonitoring /></ProtectedRoute>} />
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

            {/* Módulo de Fábrica */}
            <Route path="/dashboard/fabrica" element={<ProtectedRoute><FabricaModule /></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/recebimentos" element={<ProtectedRoute><FabricaRecebimentos /></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/materias-primas" element={<ProtectedRoute><FabricaMateriasPrimas /></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/formulas" element={<ProtectedRoute><FabricaFormulas /></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/formulas/nova" element={<ProtectedRoute><FabricaFormulaEditor /></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/formulas/:id" element={<ProtectedRoute><FabricaFormulaEditor /></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/planejamento" element={<ProtectedRoute><FabricaPlanejamento /></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/fiscal" element={<ProtectedRoute><FabricaFiscal /></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/tabela-impostos" element={<ProtectedRoute><FabricaTabelaImpostos /></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/ordens-producao" element={<ProtectedRoute><FabricaOrdensProducao /></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/ordens-producao" element={<ProtectedRoute><FabricaOrdensProducao /></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/apontamentos" element={<ProtectedRoute><FabricaApontamentos /></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/qualidade" element={<ProtectedRoute><FabricaQualidade /></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/paradas" element={<ProtectedRoute><FabricaParadas /></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/maquinas" element={<ProtectedRoute><FabricaMaquinas /></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/operadores" element={<ProtectedRoute><FabricaOperadores /></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/produtos-acabados" element={<ProtectedRoute><FabricaProdutosAcabados /></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/produtos/importar" element={<ProtectedRoute><ImportarProdutosAcabados /></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/lancamentos" element={<ProtectedRoute><FabricaLancamentos /></ProtectedRoute>} />

            {/* Módulo de Tabelas de Preços */}
            <Route path="/dashboard/precos" element={<ProtectedRoute><TabelasPrecosModule /></ProtectedRoute>} />
            <Route path="/dashboard/precos/tabelas" element={<ProtectedRoute><FabricaTabelasPreco /></ProtectedRoute>} />
            <Route path="/dashboard/precos/aprovacao" element={<ProtectedRoute><FabricaAprovacaoPrecos /></ProtectedRoute>} />
            <Route path="/dashboard/precos/portal-cliente" element={<ProtectedRoute><PortalCliente /></ProtectedRoute>} />
            
            {/* Módulo Financeiro */}
            <Route path="/dashboard/financeiro" element={<ProtectedRoute><Financeiro /></ProtectedRoute>} />
            <Route path="/dashboard/financeiro/visao-departamentos" element={<ProtectedRoute><VisaoDepartamentos /></ProtectedRoute>} />
            <Route path="/dashboard/financeiro/dre-analitico" element={<ProtectedRoute><DREAnalitico /></ProtectedRoute>} />
            <Route path="/dashboard/financeiro/trade" element={<ProtectedRoute><TradeFinanceiro /></ProtectedRoute>} />
            <Route path="/dashboard/financeiro/contas-a-pagar" element={<ProtectedRoute><ContasAPagar /></ProtectedRoute>} />
            <Route path="/dashboard/financeiro/contas-a-pagar/sync" element={<ProtectedRoute><ContasPagarSyncPage /></ProtectedRoute>} />
            <Route path="/dashboard/financeiro/contas-a-receber" element={<ProtectedRoute><ContasAReceber /></ProtectedRoute>} />
            <Route path="/dashboard/financeiro/contas-a-receber/auditoria" element={<ProtectedRoute><ContasReceberAuditoria /></ProtectedRoute>} />
            <Route path="/dashboard/financeiro/contas-a-receber/sync" element={<ProtectedRoute><ContasReceberSyncPage /></ProtectedRoute>} />
            <Route path="/dashboard/financeiro/cobranca" element={<ProtectedRoute><CobrancaInadimplentes /></ProtectedRoute>} />
            <Route path="/dashboard/financeiro/fluxo-de-caixa" element={<ProtectedRoute><FluxoDeCaixa /></ProtectedRoute>} />
            <Route path="/dashboard/financeiro/plano-contas" element={<ProtectedRoute><PlanoContas /></ProtectedRoute>} />
            <Route path="/dashboard/financeiro/classificar-banco" element={<ProtectedRoute><ClassificarTodoBanco /></ProtectedRoute>} />
            
            {/* Marketing Mission Control */}
            <Route path="/dashboard/marketing/mission-control" element={<ProtectedRoute><MarketingMissionControlPage /></ProtectedRoute>} />
            
            {/* Rotas antigas mantidas para compatibilidade */}
            <Route path="/dashboard/contas-a-pagar" element={<ProtectedRoute><ContasAPagar /></ProtectedRoute>} />
            <Route path="/dashboard/plano-contas" element={<ProtectedRoute><PlanoContas /></ProtectedRoute>} />
            <Route path="/dashboard/configuracoes/api-health" element={<ProtectedRoute><APIHealthCheck /></ProtectedRoute>} />
            
            {/* Portal do Cliente - Rotas isoladas */}
            <Route path="/portal" element={<ClienteProtectedRoute><PortalPrecos /></ClienteProtectedRoute>} />
            <Route path="/portal/precos" element={<ClienteProtectedRoute><PortalPrecos /></ClienteProtectedRoute>} />
            <Route path="/portal/perfil" element={<ClienteProtectedRoute><PortalPerfil /></ClienteProtectedRoute>} />
            

            <Route path="/not-found" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </>
  );
}

const App = () => {
  // Inicializar gerenciador de memória e monitor
  useEffect(() => {
    console.log('🚀 Memory Manager e Monitor inicializados');
    
    // Iniciar monitoramento de memória
    memoryMonitor.startMonitoring();
    
    // Limpar cache antigo a cada 5 minutos
    const cacheCleanupInterval = setInterval(() => {
      queryClient.clear(); // Limpa queries inativas
    }, 5 * 60 * 1000);
    
    // Listener para forçar limpeza quando necessário
    const handleForceCleanup = () => {
      queryClient.clear();
      memoryManager.forceCleanup();
    };
    
    window.addEventListener('force-memory-cleanup', handleForceCleanup);
    
    return () => {
      clearInterval(cacheCleanupInterval);
      window.removeEventListener('force-memory-cleanup', handleForceCleanup);
      memoryManager.destroy();
      memoryMonitor.destroy();
    };
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <PWAProvider>
          <AuthProvider>
            <PermissionsProvider>
              <TooltipProvider delayDuration={0}>
                <Toaster />
                <Sonner />
                <AppContent />
              </TooltipProvider>
            </PermissionsProvider>
          </AuthProvider>
        </PWAProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
