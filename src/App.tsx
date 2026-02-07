import { lazy, Suspense, useEffect, useState, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import ErrorPage from "@/pages/ErrorPage";
import { memoryManager } from "@/lib/utils/memory-manager";
import { memoryMonitor } from "@/lib/utils/memory-monitor";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ClienteProtectedRoute } from "@/components/auth/ClienteProtectedRoute";
import { ModuleProtectedRoute } from "@/components/auth/ModuleProtectedRoute";
import { ScreenProtectedRoute } from "@/components/auth/ScreenProtectedRoute";
import { AuthProvider } from "@/contexts/AuthContext";
import { PermissionsProvider } from "@/contexts/PermissionsContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { PWAProvider, usePWA } from "@/contexts/PWAContext";
import { PWAUpdatePrompt } from "@/components/pwa/PWAUpdatePrompt";
import { SplashScreen } from "@/components/pwa/SplashScreen";
import { TourProvider } from "@/components/tour";

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
const UsuarioBloqueado = lazy(() => import("./pages/UsuarioBloqueado"));
const NotFound = lazy(() => import("./pages/NotFound"));
const TradeModule = lazy(() => import("./pages/modules/TradeModule"));
const TradeAdminModule = lazy(() => import("./pages/modules/TradeAdminModule"));
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
const TradeBrandShareDashboard = lazy(() => import("./pages/TradeBrandShareDashboard"));
const TradeMeasurementGuide = lazy(() => import("./pages/TradeMeasurementGuide"));
const TradeOurBrands = lazy(() => import("./pages/TradeOurBrands"));
const Ranking = lazy(() => import("./pages/Ranking"));
const TradeFinanceiro = lazy(() => import("./pages/TradeFinanceiro"));
const TradeFinanceiroDashboard = lazy(() => import("./pages/TradeFinanceiroDashboard"));
const TradeContasCorrentes = lazy(() => import("./pages/TradeContasCorrentes"));
const TradeExtratoBancario = lazy(() => import("./pages/TradeExtratoBancario"));
const TradeVerbasSemestrais = lazy(() => import("./pages/TradeVerbasSemestrais"));
const TradeLancamentos = lazy(() => import("./pages/TradeLancamentos"));
const TradeAprovacoes = lazy(() => import("./pages/TradeAprovacoes"));
const TradeExtratosPessoais = lazy(() => import("./pages/TradeExtratosPessoais"));
const TradeCampaigns = lazy(() => import("./pages/TradeCampaigns"));
const TradeAprovarCampanhas = lazy(() => import("./pages/TradeAprovarCampanhas"));
const TradeApprovalHub = lazy(() => import("./pages/TradeApprovalHub"));
const TradeCampaignDetail = lazy(() => import("./pages/TradeCampaignDetail"));
const TradeLancamentosCampanhas = lazy(() => import("./pages/TradeLancamentosCampanhas"));
const TradeAdminUsers = lazy(() => import("./pages/TradeAdminUsers"));
const TradeAdminApprovalLevels = lazy(() => import("./pages/TradeAdminApprovalLevels"));
const TradePerformance = lazy(() => import("./pages/TradePerformance"));
const TradeTeamPerformance = lazy(() => import("./pages/TradeTeamPerformance"));
const TradeRewards = lazy(() => import("./pages/TradeRewards"));
const TradeReportCampaigns = lazy(() => import("./pages/trade/reports/TradeReportCampaigns"));
const TradeReportClients = lazy(() => import("./pages/trade/reports/TradeReportClients"));
const TradeReportSellers = lazy(() => import("./pages/trade/reports/TradeReportSellers"));
const TradeExecutiveDashboard = lazy(() => import("./pages/TradeExecutiveDashboard"));
const TradeSupervisorDashboard = lazy(() => import("./pages/TradeSupervisorDashboard"));
const CorporateEvents = lazy(() => import("./pages/CorporateEvents"));
const CorporateEventDetail = lazy(() => import("./pages/CorporateEventDetail"));
const CorporateEventsDashboard = lazy(() => import("./pages/CorporateEventsDashboard"));
const EventsApprovalHub = lazy(() => import("./pages/EventsApprovalHub"));
const DepartmentHub = lazy(() => import("./pages/DepartmentHub"));
const DepartmentDetail = lazy(() => import("./pages/DepartmentDetail"));
const DepartmentDashboard = lazy(() => import("./pages/DepartmentDashboard"));
const DepartmentApprovalHub = lazy(() => import("./pages/DepartmentApprovalHub"));
const DepartmentsApprovalHub = lazy(() => import("./pages/DepartmentsApprovalHub"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const InstalarApp = lazy(() => import("./pages/InstalarApp"));
const WhatsAppMonitoring = lazy(() => import("./pages/WhatsAppMonitoring"));
const Marketing = lazy(() => import("./pages/Marketing"));
const MarketingMissionControlPage = lazy(() => import("./pages/MarketingMissionControlPage"));
const ElevenLabsStudioPage = lazy(() => import("./pages/ElevenLabsStudioPage"));
const AIAnalytics = lazy(() => import("./pages/AIAnalytics"));
const QAAgent = lazy(() => import("./pages/QAAgent"));
const AgenteHuggs = lazy(() => import("./pages/AgenteHuggs"));
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
const FichaCustoProduto = lazy(() => import("./pages/FichaCustoProduto"));
const ImportarProdutosAcabados = lazy(() => import("./pages/ImportarProdutosAcabados"));
const TabelasPrecosModule = lazy(() => import("./pages/modules/TabelasPrecosModule"));
const FabricaTabelasPreco = lazy(() => import("./pages/FabricaTabelasPreco"));
const FabricaAprovacaoPrecos = lazy(() => import("./pages/FabricaAprovacaoPrecos"));
const FabricaLancamentos = lazy(() => import("./pages/FabricaLancamentos"));
const FabricaExecutiveDashboard = lazy(() => import("./pages/FabricaExecutiveDashboard"));
const ComercialModule = lazy(() => import("./pages/modules/ComercialModule"));
const WhitespaceAnalysis = lazy(() => import("./pages/WhitespaceAnalysis"));
const MunicipiosIntelligence = lazy(() => import("./pages/MunicipiosIntelligence"));
const IBGEData = lazy(() => import("./pages/IBGEData"));
const LeadMining = lazy(() => import("./pages/LeadMining"));
const MarketIntelligence = lazy(() => import("./pages/MarketIntelligence"));
const ClientReactivation = lazy(() => import("./pages/ClientReactivation"));
const ComercialMapa = lazy(() => import("./pages/ComercialMapa"));
const GerenciamentoAcessoPrecos = lazy(() => import("./pages/GerenciamentoAcessoPrecos"));
const PrecosMatrizComparativa = lazy(() => import("./pages/PrecosMatrizComparativa"));
const SimuladorCenariosPrecos = lazy(() => import("./pages/SimuladorCenariosPrecos"));
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
const ContasPagarAuditoria = lazy(() => import("./pages/ContasPagarAuditoria"));
const CobrancaInadimplentes = lazy(() => import("./pages/CobrancaInadimplentes"));
const FluxoDeCaixa = lazy(() => import("./pages/FluxoDeCaixa"));
const SaldosBancarios = lazy(() => import("./pages/SaldosBancarios"));
const ContasReceberSyncPage = lazy(() => import("./pages/financeiro/ContasReceberSyncPage"));
const ContasPagarSyncPage = lazy(() => import("./pages/financeiro/ContasPagarSyncPage"));
const FinancialPaymentCentral = lazy(() => import("./pages/FinancialPaymentCentral"));
const FinanceiroConsolidadoDashboard = lazy(() => import("./pages/FinanceiroConsolidadoDashboard"));
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
      staleTime: 5 * 60 * 1000, // 5 minutos - dados ficam frescos por mais tempo
      gcTime: 10 * 60 * 1000, // 10 minutos - cache mantido por mais tempo
      refetchOnWindowFocus: false, // Não recarregar ao focar janela
      retry: 1,
      refetchOnReconnect: false, // Evitar refetch desnecessário ao reconectar
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
            <Route path="/auth/signup" element={<Navigate to="/auth/login" replace />} />
            <Route path="/aguardando-aprovacao" element={<AguardandoAprovacao />} />
            <Route path="/usuario-bloqueado" element={<UsuarioBloqueado />} />
            
            {/* Protected Routes */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/dashboard/ai-analytics" element={<ProtectedRoute><AIAnalytics /></ProtectedRoute>} />
            <Route path="/dashboard/qa-agent" element={<ProtectedRoute><QAAgent /></ProtectedRoute>} />
            <Route path="/dashboard/agente-huggs" element={<ProtectedRoute><AgenteHuggs /></ProtectedRoute>} />
            <Route path="/dashboard/relatorios" element={<ProtectedRoute><Relatorios /></ProtectedRoute>} />
            <Route path="/dashboard/relatorios" element={<ProtectedRoute><Relatorios /></ProtectedRoute>} />
            
            {/* Módulo de Marketing */}
            <Route path="/dashboard/marketing" element={<ProtectedRoute><MarketingModule /></ProtectedRoute>} />
            <Route path="/dashboard/marketing/social" element={<ProtectedRoute><Marketing /></ProtectedRoute>} />
            <Route path="/dashboard/marketing/whatsapp" element={<ProtectedRoute><WhatsAppMonitoring /></ProtectedRoute>} />
            <Route path="/dashboard/marketing/elevenlabs" element={<ProtectedRoute><ElevenLabsStudioPage /></ProtectedRoute>} />
            
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
            <Route path="/dashboard/trade/admin" element={<ProtectedRoute><ScreenProtectedRoute screenCode="trade_admin"><TradeAdminModule /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/admin/users" element={<ProtectedRoute><ScreenProtectedRoute screenCode="trade_admin"><TradeAdminUsers /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/admin/approval-levels" element={<ProtectedRoute><ScreenProtectedRoute screenCode="trade_admin"><TradeAdminApprovalLevels /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/admin/reports/campaigns" element={<ProtectedRoute><ScreenProtectedRoute screenCode="trade_admin"><TradeReportCampaigns /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/admin/reports/clients" element={<ProtectedRoute><ScreenProtectedRoute screenCode="trade_admin"><TradeReportClients /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/admin/reports/sellers" element={<ProtectedRoute><ScreenProtectedRoute screenCode="trade_admin"><TradeReportSellers /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/admin/executivo" element={<ProtectedRoute><ScreenProtectedRoute screenCode="trade_admin"><TradeExecutiveDashboard /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/minha-equipe" element={<ProtectedRoute><TradeSupervisorDashboard /></ProtectedRoute>} />
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
            <Route path="/dashboard/trade/financeiro" element={<ProtectedRoute><ScreenProtectedRoute screenCode="trade_admin"><TradeFinanceiro /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/financeiro/dashboard" element={<ProtectedRoute><ScreenProtectedRoute screenCode="trade_admin"><TradeFinanceiroDashboard /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/financeiro/campanhas" element={<ProtectedRoute><ScreenProtectedRoute screenCode="trade_admin"><TradeCampaigns /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/financeiro/campanhas/:id" element={<ProtectedRoute><ScreenProtectedRoute screenCode="trade_admin"><TradeCampaignDetail /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/financeiro/lancamentos-campanhas" element={<ProtectedRoute><ScreenProtectedRoute screenCode="trade_admin"><TradeLancamentosCampanhas /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/financeiro/contas" element={<ProtectedRoute><ScreenProtectedRoute screenCode="trade_admin"><TradeContasCorrentes /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/financeiro/extrato/:accountId" element={<ProtectedRoute><ScreenProtectedRoute screenCode="trade_admin"><TradeExtratoBancario /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/financeiro/verbas" element={<ProtectedRoute><ScreenProtectedRoute screenCode="trade_admin"><TradeVerbasSemestrais /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/financeiro/lancamentos" element={<ProtectedRoute><ScreenProtectedRoute screenCode="trade_admin"><TradeLancamentos /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/financeiro/aprovacoes" element={<ProtectedRoute><ScreenProtectedRoute screenCode="trade_admin"><TradeAprovacoes /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/financeiro/extrato" element={<ProtectedRoute><ScreenProtectedRoute screenCode="trade_admin"><TradeExtratosPessoais /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/campanhas/aprovacoes" element={<ProtectedRoute><ScreenProtectedRoute screenCode="trade_admin"><TradeAprovarCampanhas /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/aprovacoes" element={<ProtectedRoute><ScreenProtectedRoute screenCode="trade_admin"><TradeApprovalHub /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/auditorias" element={<ProtectedRoute><TradeAuditorias /></ProtectedRoute>} />
            <Route path="/dashboard/trade/sellout" element={<ProtectedRoute><TradeSellOut /></ProtectedRoute>} />
            <Route path="/dashboard/trade/shelf-measurements" element={<ProtectedRoute><TradeShelfMeasurements /></ProtectedRoute>} />
            <Route path="/dashboard/trade/measurement-guide" element={<ProtectedRoute><TradeMeasurementGuide /></ProtectedRoute>} />
            <Route path="/dashboard/trade/our-brands" element={<ProtectedRoute><TradeOurBrands /></ProtectedRoute>} />
            <Route path="/dashboard/trade/brand-share" element={<ProtectedRoute><TradeBrandShareDashboard /></ProtectedRoute>} />
            <Route path="/dashboard/trade/relatorio-competitivo" element={<ProtectedRoute><TradeRelatorioCompetitivo /></ProtectedRoute>} />
            <Route path="/dashboard/trade/comparacao-produtos" element={<ProtectedRoute><TradeComparacaoProdutos /></ProtectedRoute>} />
            <Route path="/dashboard/trade/performance" element={<ProtectedRoute><TradePerformance /></ProtectedRoute>} />
            <Route path="/dashboard/trade/team-performance" element={<ProtectedRoute><TradeTeamPerformance /></ProtectedRoute>} />
            <Route path="/dashboard/trade/rewards" element={<ProtectedRoute><TradeRewards /></ProtectedRoute>} />

            {/* Módulo de Eventos Corporativos */}
            <Route path="/dashboard/eventos" element={<ProtectedRoute><CorporateEvents /></ProtectedRoute>} />
            <Route path="/dashboard/eventos/aprovacoes" element={<ProtectedRoute><EventsApprovalHub /></ProtectedRoute>} />
            <Route path="/dashboard/eventos/:id" element={<ProtectedRoute><CorporateEventDetail /></ProtectedRoute>} />
            <Route path="/dashboard/eventos/dashboard" element={<ProtectedRoute><CorporateEventsDashboard /></ProtectedRoute>} />

            {/* Módulo de Departamentos */}
            <Route path="/dashboard/departamentos" element={<ProtectedRoute><DepartmentHub /></ProtectedRoute>} />
            <Route path="/dashboard/departamentos/:id" element={<ProtectedRoute><DepartmentDetail /></ProtectedRoute>} />
            <Route path="/dashboard/departamentos/:id/dashboard" element={<ProtectedRoute><DepartmentDashboard /></ProtectedRoute>} />
            <Route path="/dashboard/departamentos/:id/aprovacoes" element={<ProtectedRoute><DepartmentApprovalHub /></ProtectedRoute>} />
            <Route path="/dashboard/departamentos/aprovacoes" element={<ProtectedRoute><DepartmentsApprovalHub /></ProtectedRoute>} />

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
            <Route path="/dashboard/fabrica/produtos/:id/custos" element={<ProtectedRoute><FichaCustoProduto /></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/produtos/importar" element={<ProtectedRoute><ImportarProdutosAcabados /></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/executivo" element={<ProtectedRoute><ScreenProtectedRoute screenCode="fabrica_dashboard"><FabricaExecutiveDashboard /></ScreenProtectedRoute></ProtectedRoute>} />

            {/* Módulo Comercial */}
            <Route path="/dashboard/comercial" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="comercial"><ComercialModule /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/comercial/lancamentos" element={<ProtectedRoute><ScreenProtectedRoute screenCode="comercial_lancamentos"><FabricaLancamentos /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/comercial/ibge" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="comercial"><IBGEData /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/comercial/mineracao" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="comercial"><LeadMining /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/comercial/inteligencia" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="comercial"><MarketIntelligence /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/comercial/reativacao" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="comercial"><ClientReactivation /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/comercial/mapa" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="comercial"><ComercialMapa /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/comercial/municipios-inteligencia" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="comercial"><MunicipiosIntelligence /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/comercial/whitespace" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="comercial"><WhitespaceAnalysis /></ModuleProtectedRoute></ProtectedRoute>} />

            {/* Módulo de Tabelas de Preços */}
            <Route path="/dashboard/precos" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="precos"><TabelasPrecosModule /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/precos/matriz" element={<ProtectedRoute><ScreenProtectedRoute screenCode="precos_matriz"><PrecosMatrizComparativa /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/precos/tabelas" element={<ProtectedRoute><FabricaTabelasPreco /></ProtectedRoute>} />
            <Route path="/dashboard/precos/aprovacao" element={<ProtectedRoute><FabricaAprovacaoPrecos /></ProtectedRoute>} />
            <Route path="/dashboard/precos/portal-cliente" element={<ProtectedRoute><PortalCliente /></ProtectedRoute>} />
            <Route path="/dashboard/precos/acesso" element={<ProtectedRoute><GerenciamentoAcessoPrecos /></ProtectedRoute>} />
            <Route path="/dashboard/precos/simulador" element={<ProtectedRoute><ScreenProtectedRoute screenCode="precos_simulador"><SimuladorCenariosPrecos /></ScreenProtectedRoute></ProtectedRoute>} />
            
            {/* Módulo Financeiro - Protegido por módulo */}
            <Route path="/dashboard/financeiro" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="financeiro"><Financeiro /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/financeiro/visao-departamentos" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="financeiro"><VisaoDepartamentos /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/financeiro/dre-analitico" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="financeiro"><DREAnalitico /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/financeiro/trade" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="financeiro"><TradeFinanceiro /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/financeiro/contas-a-pagar" element={<ProtectedRoute><ScreenProtectedRoute screenCode="financeiro_contas_pagar"><ContasAPagar /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/financeiro/contas-a-pagar/sync" element={<ProtectedRoute><ScreenProtectedRoute screenCode="financeiro_contas_pagar"><ContasPagarSyncPage /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/financeiro/contas-a-pagar/auditoria" element={<ProtectedRoute><ScreenProtectedRoute screenCode="financeiro_contas_pagar"><ContasPagarAuditoria /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/financeiro/contas-a-receber" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="financeiro"><ContasAReceber /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/financeiro/contas-a-receber/auditoria" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="financeiro"><ContasReceberAuditoria /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/financeiro/contas-a-receber/sync" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="financeiro"><ContasReceberSyncPage /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/financeiro/cobranca" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="financeiro"><CobrancaInadimplentes /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/financeiro/fluxo-de-caixa" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="financeiro"><FluxoDeCaixa /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/financeiro/plano-contas" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="financeiro"><PlanoContas /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/financeiro/saldos-bancarios" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="financeiro"><SaldosBancarios /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/financeiro/classificar-banco" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="financeiro"><ClassificarTodoBanco /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/financeiro/central-pagamentos" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="financeiro"><FinancialPaymentCentral /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/financeiro/consolidado" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="financeiro"><FinanceiroConsolidadoDashboard /></ModuleProtectedRoute></ProtectedRoute>} />
            
            {/* Marketing Mission Control */}
            <Route path="/dashboard/marketing/mission-control" element={<ProtectedRoute><MarketingMissionControlPage /></ProtectedRoute>} />
            
            {/* Rotas antigas mantidas para compatibilidade */}
            <Route path="/dashboard/contas-a-pagar" element={
              <ProtectedRoute>
                <ScreenProtectedRoute screenCode="financeiro_contas_pagar" redirectTo="/dashboard/financeiro/contas-a-pagar">
                  <ContasAPagar />
                </ScreenProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/plano-contas" element={
              <ProtectedRoute>
                <ScreenProtectedRoute screenCode="financeiro_plano_contas" redirectTo="/dashboard/financeiro/contas-a-pagar">
                  <PlanoContas />
                </ScreenProtectedRoute>
              </ProtectedRoute>
            } />
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
              <ImpersonationProvider>
                <TourProvider>
                  <TooltipProvider delayDuration={0}>
                    <Toaster />
                    <Sonner />
                    <AppContent />
                  </TooltipProvider>
                </TourProvider>
              </ImpersonationProvider>
            </PermissionsProvider>
          </AuthProvider>
        </PWAProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
