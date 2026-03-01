import { lazy, Suspense, useEffect, useState, useRef, ComponentType } from "react";
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
import { DashboardRedirect } from "@/components/auth/DashboardRedirect";
import { AuthProvider } from "@/contexts/AuthContext";
import { PermissionsProvider } from "@/contexts/PermissionsContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { PWAProvider, usePWA } from "@/contexts/PWAContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { PWAUpdatePrompt } from "@/components/pwa/PWAUpdatePrompt";
import { SplashScreen } from "@/components/pwa/SplashScreen";
import { TourProvider } from "@/components/tour";

// Retry automático para lazy imports - resolve erros de chunk após deploys
function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  retries = 3,
  interval = 1500
) {
  return lazy(async () => {
    for (let i = 0; i < retries; i++) {
      try {
        return await importFn();
      } catch (error) {
        console.warn(`[lazyWithRetry] Attempt ${i + 1}/${retries} failed:`, error);
        if (i === retries - 1) {
          // Última tentativa falhou - forçar reload completo para buscar novo manifest
          // Usar timestamp para evitar que sessionStorage bloqueie reloads legítimos
          const lastReload = sessionStorage.getItem('chunk-reload-ts');
          const now = Date.now();
          // Permite reload se nunca fez ou se faz mais de 10s desde o último
          if (!lastReload || (now - parseInt(lastReload, 10)) > 10000) {
            sessionStorage.setItem('chunk-reload-ts', now.toString());
            window.location.reload();
          }
          throw error;
        }
        await new Promise((r) => setTimeout(r, interval));
      }
    }
    return importFn(); // fallback final
  });
}

// Lazy load das páginas com retry automático
const Index = lazyWithRetry(() => import("./pages/Index"));
const Auth = lazyWithRetry(() => import("./pages/Auth"));
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const ProspectsModule = lazyWithRetry(() => import("./pages/modules/ProspectsModule"));
const MarketingModule = lazyWithRetry(() => import("./pages/modules/MarketingModule"));
const Prospects = lazyWithRetry(() => import("./pages/Prospects"));
const Municipios = lazyWithRetry(() => import("./pages/Municipios"));
const Atividades = lazyWithRetry(() => import("./pages/Atividades"));
const Configuracoes = lazyWithRetry(() => import("./pages/Configuracoes"));
const ImportarClientes = lazyWithRetry(() => import("./pages/ImportarClientes"));
const Auditoria = lazyWithRetry(() => import("./pages/Auditoria"));
const Kanban = lazyWithRetry(() => import("./pages/Kanban"));
const Tarefas = lazyWithRetry(() => import("./pages/Tarefas"));
const Mapa = lazyWithRetry(() => import("./pages/Mapa"));
const Chat = lazyWithRetry(() => import("./pages/Chat"));
const AguardandoAprovacao = lazyWithRetry(() => import("./pages/AguardandoAprovacao"));
const UsuarioBloqueado = lazyWithRetry(() => import("./pages/UsuarioBloqueado"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const TradeModule = lazyWithRetry(() => import("./pages/modules/TradeModule"));
const TradeAdminModule = lazyWithRetry(() => import("./pages/modules/TradeAdminModule"));
const TradeStores = lazyWithRetry(() => import("./pages/TradeStores"));
const TradeStoreChains = lazyWithRetry(() => import("./pages/TradeStoreChains"));
const TradeVisits = lazyWithRetry(() => import("./pages/TradeVisits"));
const TradePhotos = lazyWithRetry(() => import("./pages/TradePhotos"));
const TradeInsights = lazyWithRetry(() => import("./pages/TradeInsights"));
const TradeCompetitors = lazyWithRetry(() => import("./pages/TradeCompetitors"));
const TradePromotions = lazyWithRetry(() => import("./pages/TradePromotions"));
const TradeImportStores = lazyWithRetry(() => import("./pages/TradeImportStores"));
const TradeCalendar = lazyWithRetry(() => import("./pages/TradeCalendar"));
const TradeIdealPhotos = lazyWithRetry(() => import("./pages/TradeIdealPhotos"));
const TradeAuditorias = lazyWithRetry(() => import("./pages/TradeAuditorias"));
const TradeRelatorioCompetitivo = lazyWithRetry(() => import("./pages/TradeRelatorioCompetitivo"));
const TradeComparacaoProdutos = lazyWithRetry(() => import("./pages/TradeComparacaoProdutos"));
const TradeSellOut = lazyWithRetry(() => import("./pages/TradeSellOut"));
const TradeShelfMeasurements = lazyWithRetry(() => import("./pages/TradeShelfMeasurements"));
const TradeBrandShareDashboard = lazyWithRetry(() => import("./pages/TradeBrandShareDashboard"));
const TradeMeasurementGuide = lazyWithRetry(() => import("./pages/TradeMeasurementGuide"));
const TradeOurBrands = lazyWithRetry(() => import("./pages/TradeOurBrands"));
const Ranking = lazyWithRetry(() => import("./pages/Ranking"));
const InternalTicketsPage = lazyWithRetry(() => import("./pages/InternalTicketsPage"));
const TradeFinanceiro = lazyWithRetry(() => import("./pages/TradeFinanceiro"));
const TradeFinanceiroDashboard = lazyWithRetry(() => import("./pages/TradeFinanceiroDashboard"));
const TradeContasCorrentes = lazyWithRetry(() => import("./pages/TradeContasCorrentes"));
const TradeExtratoBancario = lazyWithRetry(() => import("./pages/TradeExtratoBancario"));
const TradeVerbasSemestrais = lazyWithRetry(() => import("./pages/TradeVerbasSemestrais"));
const TradeLancamentos = lazyWithRetry(() => import("./pages/TradeLancamentos"));
const TradeAprovacoes = lazyWithRetry(() => import("./pages/TradeAprovacoes"));
const TradeExtratosPessoais = lazyWithRetry(() => import("./pages/TradeExtratosPessoais"));
const TradeCampaigns = lazyWithRetry(() => import("./pages/TradeCampaigns"));
const TradeAprovarCampanhas = lazyWithRetry(() => import("./pages/TradeAprovarCampanhas"));
const TradeApprovalHub = lazyWithRetry(() => import("./pages/TradeApprovalHub"));
const TradeCampaignDetail = lazyWithRetry(() => import("./pages/TradeCampaignDetail"));
const TradeLancamentosCampanhas = lazyWithRetry(() => import("./pages/TradeLancamentosCampanhas"));
const TradeAdminUsers = lazyWithRetry(() => import("./pages/TradeAdminUsers"));
const TradeAdminApprovalLevels = lazyWithRetry(() => import("./pages/TradeAdminApprovalLevels"));
const TradePerformance = lazyWithRetry(() => import("./pages/TradePerformance"));
const TradeTeamPerformance = lazyWithRetry(() => import("./pages/TradeTeamPerformance"));
const TradeRewards = lazyWithRetry(() => import("./pages/TradeRewards"));
const TradeReportCampaigns = lazyWithRetry(() => import("./pages/trade/reports/TradeReportCampaigns"));
const TradeReportClients = lazyWithRetry(() => import("./pages/trade/reports/TradeReportClients"));
const TradeReportSellers = lazyWithRetry(() => import("./pages/trade/reports/TradeReportSellers"));
const TradeExecutiveDashboard = lazyWithRetry(() => import("./pages/TradeExecutiveDashboard"));
const TradeSupervisorDashboard = lazyWithRetry(() => import("./pages/TradeSupervisorDashboard"));
const CorporateEvents = lazyWithRetry(() => import("./pages/CorporateEvents"));
const CorporateEventDetail = lazyWithRetry(() => import("./pages/CorporateEventDetail"));
const CorporateEventsDashboard = lazyWithRetry(() => import("./pages/CorporateEventsDashboard"));
const EventsApprovalHub = lazyWithRetry(() => import("./pages/EventsApprovalHub"));
const DepartmentHub = lazyWithRetry(() => import("./pages/DepartmentHub"));
const DepartmentDetail = lazyWithRetry(() => import("./pages/DepartmentDetail"));
const DepartmentDashboard = lazyWithRetry(() => import("./pages/DepartmentDashboard"));
const DepartmentApprovalHub = lazyWithRetry(() => import("./pages/DepartmentApprovalHub"));
const DepartmentsApprovalHub = lazyWithRetry(() => import("./pages/DepartmentsApprovalHub"));
const Relatorios = lazyWithRetry(() => import("./pages/Relatorios"));
const InstalarApp = lazyWithRetry(() => import("./pages/InstalarApp"));
const WhatsAppMonitoring = lazyWithRetry(() => import("./pages/WhatsAppMonitoring"));
const Marketing = lazyWithRetry(() => import("./pages/Marketing"));
const MarketingMissionControlPage = lazyWithRetry(() => import("./pages/MarketingMissionControlPage"));
const ElevenLabsStudioPage = lazyWithRetry(() => import("./pages/ElevenLabsStudioPage"));
const AIAnalytics = lazyWithRetry(() => import("./pages/AIAnalytics"));
const QAAgent = lazyWithRetry(() => import("./pages/QAAgent"));
const AgenteHuggs = lazyWithRetry(() => import("./pages/AgenteHuggs"));
const FabricaModule = lazyWithRetry(() => import("./pages/modules/FabricaModule"));
const FabricaMateriasPrimas = lazyWithRetry(() => import("./pages/FabricaMateriasPrimas"));
const FabricaFormulas = lazyWithRetry(() => import("./pages/FabricaFormulas"));
const FabricaFormulaEditor = lazyWithRetry(() => import("./pages/FabricaFormulaEditor"));
const FabricaPlanejamento = lazyWithRetry(() => import("./pages/FabricaPlanejamento"));
const FabricaOrdensProducao = lazyWithRetry(() => import("./pages/FabricaOrdensProducao"));
const FabricaRecebimentos = lazyWithRetry(() => import("./pages/FabricaRecebimentos"));
const FabricaFiscal = lazyWithRetry(() => import("./pages/FabricaFiscal"));
const FabricaTabelaImpostos = lazyWithRetry(() => import("./pages/FabricaTabelaImpostos"));
const FabricaApontamentos = lazyWithRetry(() => import("./pages/FabricaApontamentos"));
const FabricaQualidade = lazyWithRetry(() => import("./pages/FabricaQualidade"));
const FabricaParadas = lazyWithRetry(() => import("./pages/FabricaParadas"));
const FabricaMaquinas = lazyWithRetry(() => import("./pages/FabricaMaquinas"));
const FabricaOperadores = lazyWithRetry(() => import("./pages/FabricaOperadores"));
const FabricaProdutosAcabados = lazyWithRetry(() => import("./pages/FabricaProdutosAcabados"));
const FichaCustoProduto = lazyWithRetry(() => import("./pages/FichaCustoProduto"));
const ImportarProdutosAcabados = lazyWithRetry(() => import("./pages/ImportarProdutosAcabados"));
const FichaRevisaoDiretoria = lazyWithRetry(() => import("./pages/FichaRevisaoDiretoria"));
const FabricaComunicacaoRevisoes = lazyWithRetry(() => import("./pages/FabricaComunicacaoRevisoes"));
const TabelasPrecosModule = lazyWithRetry(() => import("./pages/modules/TabelasPrecosModule"));
const FabricaTabelasPreco = lazyWithRetry(() => import("./pages/FabricaTabelasPreco"));
const FabricaAprovacaoPrecos = lazyWithRetry(() => import("./pages/FabricaAprovacaoPrecos"));
const FabricaLancamentos = lazyWithRetry(() => import("./pages/FabricaLancamentos"));
const FabricaExecutiveDashboard = lazyWithRetry(() => import("./pages/FabricaExecutiveDashboard"));
const FabricaManualPage = lazyWithRetry(() => import("./pages/FabricaManualPage"));
const ComercialModule = lazyWithRetry(() => import("./pages/modules/ComercialModule"));
const WhitespaceAnalysis = lazyWithRetry(() => import("./pages/WhitespaceAnalysis"));
const MunicipiosIntelligence = lazyWithRetry(() => import("./pages/MunicipiosIntelligence"));
const IBGEData = lazyWithRetry(() => import("./pages/IBGEData"));
const LeadMining = lazyWithRetry(() => import("./pages/LeadMining"));
const MarketIntelligence = lazyWithRetry(() => import("./pages/MarketIntelligence"));
const ClientReactivation = lazyWithRetry(() => import("./pages/ClientReactivation"));
const ComercialMapa = lazyWithRetry(() => import("./pages/ComercialMapa"));
const GerenciamentoAcessoPrecos = lazyWithRetry(() => import("./pages/GerenciamentoAcessoPrecos"));
const PrecosMatrizComparativa = lazyWithRetry(() => import("./pages/PrecosMatrizComparativa"));
const SimuladorCenariosPrecos = lazyWithRetry(() => import("./pages/SimuladorCenariosPrecos"));
const PortalCliente = lazyWithRetry(() => import("./pages/PortalCliente"));
const APIHealthCheck = lazyWithRetry(() => import("./pages/APIHealthCheck"));
const ContasAPagar = lazyWithRetry(() => import("./pages/ContasAPagar"));
const PlanoContas = lazyWithRetry(() => import("./pages/PlanoContas"));
const Financeiro = lazyWithRetry(() => import("./pages/Financeiro"));
const VisaoDepartamentos = lazyWithRetry(() => import("./pages/VisaoDepartamentos"));
const DREAnalitico = lazyWithRetry(() => import("./pages/DREAnalitico"));
const ClassificarTodoBanco = lazyWithRetry(() => import("./pages/ClassificarTodoBanco"));
const ContasAReceber = lazyWithRetry(() => import("./pages/ContasAReceber"));
const ContasReceberAuditoria = lazyWithRetry(() => import("./pages/ContasReceberAuditoria"));
const ContasPagarAuditoria = lazyWithRetry(() => import("./pages/ContasPagarAuditoria"));
const CobrancaInadimplentes = lazyWithRetry(() => import("./pages/CobrancaInadimplentes"));
const FluxoDeCaixa = lazyWithRetry(() => import("./pages/FluxoDeCaixa"));
const SaldosBancarios = lazyWithRetry(() => import("./pages/SaldosBancarios"));
const ContasReceberSyncPage = lazyWithRetry(() => import("./pages/financeiro/ContasReceberSyncPage"));
const ContasPagarSyncPage = lazyWithRetry(() => import("./pages/financeiro/ContasPagarSyncPage"));
const FinancialPaymentCentral = lazyWithRetry(() => import("./pages/FinancialPaymentCentral"));
const FinanceiroConsolidadoDashboard = lazyWithRetry(() => import("./pages/FinanceiroConsolidadoDashboard"));
// Portal do Cliente (isolado)
const PortalPrecos = lazyWithRetry(() => import("./pages/portal/PortalPrecos"));
const PortalPerfil = lazyWithRetry(() => import("./pages/portal/PortalPerfil"));
const FormularioEquipe = lazyWithRetry(() => import("./pages/FormularioEquipe"));
const CofreSharePage = lazyWithRetry(() => import("./pages/CofreSharePage"));

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
            <Route path="/" element={<Index />} />
            <Route path="/auth/login" element={<Auth />} />
            <Route path="/auth/signup" element={<Navigate to="/auth/login" replace />} />
            <Route path="/aguardando-aprovacao" element={<AguardandoAprovacao />} />
            <Route path="/usuario-bloqueado" element={<UsuarioBloqueado />} />
            
            {/* Protected Routes */}
            <Route path="/dashboard" element={<ProtectedRoute><DashboardRedirect /></ProtectedRoute>} />
            <Route path="/dashboard/ai-analytics" element={<ProtectedRoute><ScreenProtectedRoute screenCode="ai_analytics"><AIAnalytics /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/qa-agent" element={<ProtectedRoute><ScreenProtectedRoute screenCode="ai_analytics"><QAAgent /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/agente-huggs" element={<ProtectedRoute><ScreenProtectedRoute screenCode="ai_analytics"><AgenteHuggs /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/relatorios" element={<ProtectedRoute><ScreenProtectedRoute screenCode="relatorios"><Relatorios /></ScreenProtectedRoute></ProtectedRoute>} />
            
            {/* Módulo de Marketing */}
            <Route path="/dashboard/marketing" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="marketing"><MarketingModule /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/marketing/social" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="marketing"><Marketing /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/marketing/whatsapp" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="marketing"><WhatsAppMonitoring /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/marketing/elevenlabs" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="marketing"><ElevenLabsStudioPage /></ModuleProtectedRoute></ProtectedRoute>} />
            
            <Route path="/dashboard/instalar-app" element={<ProtectedRoute><InstalarApp /></ProtectedRoute>} />
            
            {/* Módulo de Prospects */}
            <Route path="/dashboard/prospects" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="prospects"><ProspectsModule /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/prospects/lista" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="prospects"><Prospects /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/prospects/list" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="prospects"><Prospects /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/prospects/kanban" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="prospects"><Kanban /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/prospects/atividades" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="prospects"><Atividades /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/prospects/mapa" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="prospects"><Mapa /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/prospects/municipios" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="prospects"><Municipios /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/demandas" element={<ProtectedRoute><InternalTicketsPage /></ProtectedRoute>} />
            
            {/* Outras funcionalidades */}
            <Route path="/dashboard/ranking" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="trade"><Ranking /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/tarefas" element={<ProtectedRoute><Tarefas /></ProtectedRoute>} />
            <Route path="/dashboard/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="/dashboard/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
            <Route path="/dashboard/importar-clientes" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="comercial"><ImportarClientes /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/auditoria" element={<ProtectedRoute><ScreenProtectedRoute screenCode="auditoria"><Auditoria /></ScreenProtectedRoute></ProtectedRoute>} />
            
            {/* Módulo de Trade Marketing */}
            <Route path="/dashboard/trade" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="trade"><TradeModule /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/admin" element={<ProtectedRoute><ScreenProtectedRoute screenCode="trade_admin"><TradeAdminModule /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/admin/users" element={<ProtectedRoute><ScreenProtectedRoute screenCode="trade_admin"><TradeAdminUsers /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/admin/approval-levels" element={<ProtectedRoute><ScreenProtectedRoute screenCode="trade_admin"><TradeAdminApprovalLevels /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/admin/reports/campaigns" element={<ProtectedRoute><ScreenProtectedRoute screenCode="trade_admin"><TradeReportCampaigns /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/admin/reports/clients" element={<ProtectedRoute><ScreenProtectedRoute screenCode="trade_admin"><TradeReportClients /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/admin/reports/sellers" element={<ProtectedRoute><ScreenProtectedRoute screenCode="trade_admin"><TradeReportSellers /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/admin/executivo" element={<ProtectedRoute><ScreenProtectedRoute screenCode="trade_admin"><TradeExecutiveDashboard /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/minha-equipe" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="trade"><TradeSupervisorDashboard /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/store-chains" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="trade"><TradeStoreChains /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/stores" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="trade"><TradeStores /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/visits" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="trade"><TradeVisits /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/photos" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="trade"><TradePhotos /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/competitors" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="trade"><TradeCompetitors /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/promotions" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="trade"><TradePromotions /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/insights" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="trade"><TradeInsights /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/whatsapp" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="trade"><WhatsAppMonitoring /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/import-stores" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="trade"><TradeImportStores /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/calendar" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="trade"><TradeCalendar /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/ideal-photos" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="trade"><TradeIdealPhotos /></ModuleProtectedRoute></ProtectedRoute>} />
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
            <Route path="/dashboard/trade/auditorias" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="trade"><TradeAuditorias /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/sellout" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="trade"><TradeSellOut /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/shelf-measurements" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="trade"><TradeShelfMeasurements /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/measurement-guide" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="trade"><TradeMeasurementGuide /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/our-brands" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="trade"><TradeOurBrands /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/brand-share" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="trade"><TradeBrandShareDashboard /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/relatorio-competitivo" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="trade"><TradeRelatorioCompetitivo /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/comparacao-produtos" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="trade"><TradeComparacaoProdutos /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/performance" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="trade"><TradePerformance /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/team-performance" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="trade"><TradeTeamPerformance /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/trade/rewards" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="trade"><TradeRewards /></ModuleProtectedRoute></ProtectedRoute>} />

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
            <Route path="/dashboard/fabrica/recebimentos" element={<ProtectedRoute><ScreenProtectedRoute screenCode="fabrica_recebimentos"><FabricaRecebimentos /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/materias-primas" element={<ProtectedRoute><ScreenProtectedRoute screenCode="fabrica_mps"><FabricaMateriasPrimas /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/formulas" element={<ProtectedRoute><ScreenProtectedRoute screenCode="fabrica_formulas"><FabricaFormulas /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/formulas/nova" element={<ProtectedRoute><ScreenProtectedRoute screenCode="fabrica_formulas"><FabricaFormulaEditor /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/formulas/:id" element={<ProtectedRoute><ScreenProtectedRoute screenCode="fabrica_formulas"><FabricaFormulaEditor /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/planejamento" element={<ProtectedRoute><ScreenProtectedRoute screenCode="fabrica_planejamento"><FabricaPlanejamento /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/fiscal" element={<ProtectedRoute><ScreenProtectedRoute screenCode="fabrica_fiscal"><FabricaFiscal /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/tabela-impostos" element={<ProtectedRoute><ScreenProtectedRoute screenCode="fabrica_fiscal"><FabricaTabelaImpostos /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/ordens-producao" element={<ProtectedRoute><ScreenProtectedRoute screenCode="fabrica_ordens"><FabricaOrdensProducao /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/apontamentos" element={<ProtectedRoute><ScreenProtectedRoute screenCode="fabrica_apontamentos"><FabricaApontamentos /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/qualidade" element={<ProtectedRoute><ScreenProtectedRoute screenCode="fabrica_qualidade"><FabricaQualidade /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/paradas" element={<ProtectedRoute><ScreenProtectedRoute screenCode="fabrica_paradas"><FabricaParadas /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/maquinas" element={<ProtectedRoute><ScreenProtectedRoute screenCode="fabrica_maquinas"><FabricaMaquinas /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/operadores" element={<ProtectedRoute><ScreenProtectedRoute screenCode="fabrica_operadores"><FabricaOperadores /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/produtos-acabados" element={<ProtectedRoute><ScreenProtectedRoute screenCode="fabrica_produtos"><FabricaProdutosAcabados /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/produtos/:id/custos" element={<ProtectedRoute><ScreenProtectedRoute screenCode="fabrica_produtos"><FichaCustoProduto /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/produtos/importar" element={<ProtectedRoute><ScreenProtectedRoute screenCode="fabrica_produtos"><ImportarProdutosAcabados /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/revisao-fichas" element={<ProtectedRoute><ScreenProtectedRoute screenCode="fabrica_revisao_fichas"><FichaRevisaoDiretoria /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/comunicacao-revisoes" element={<ProtectedRoute><ScreenProtectedRoute screenCode="fabrica_produtos"><FabricaComunicacaoRevisoes /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/executivo" element={<ProtectedRoute><ScreenProtectedRoute screenCode="fabrica_dashboard"><FabricaExecutiveDashboard /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/fabrica/manual" element={<ProtectedRoute><FabricaManualPage /></ProtectedRoute>} />

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
            <Route path="/dashboard/precos/tabelas" element={<ProtectedRoute><ScreenProtectedRoute screenCode="precos_tabelas"><FabricaTabelasPreco /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/precos/aprovacao" element={<ProtectedRoute><ScreenProtectedRoute screenCode="precos_tabelas"><FabricaAprovacaoPrecos /></ScreenProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/precos/portal-cliente" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="precos"><PortalCliente /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard/precos/acesso" element={<ProtectedRoute><ScreenProtectedRoute screenCode="precos_tabelas"><GerenciamentoAcessoPrecos /></ScreenProtectedRoute></ProtectedRoute>} />
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
            <Route path="/dashboard/marketing/mission-control" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="marketing"><MarketingMissionControlPage /></ModuleProtectedRoute></ProtectedRoute>} />
            
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
            <Route path="/dashboard/configuracoes/api-health" element={<ProtectedRoute><ScreenProtectedRoute screenCode="admin"><APIHealthCheck /></ScreenProtectedRoute></ProtectedRoute>} />
            
            {/* Portal do Cliente - Rotas isoladas */}
            <Route path="/portal" element={<ClienteProtectedRoute><PortalPrecos /></ClienteProtectedRoute>} />
            <Route path="/portal/precos" element={<ClienteProtectedRoute><PortalPrecos /></ClienteProtectedRoute>} />
            <Route path="/portal/perfil" element={<ClienteProtectedRoute><PortalPerfil /></ClienteProtectedRoute>} />
            

            {/* Formulário público - sem autenticação */}
            <Route path="/formulario-equipe" element={<FormularioEquipe />} />
            <Route path="/cofre-share" element={<CofreSharePage />} />

            <Route path="/not-found" element={<NotFound />} />
            {/* Catch-all route - must be last */}
            <Route path="*" element={<ErrorPage />} />
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
    
    // Limpar apenas queries inativas a cada 5 minutos (preserva queries ativas na tela)
    const cacheCleanupInterval = setInterval(() => {
      queryClient.removeQueries({ type: 'inactive' });
    }, 5 * 60 * 1000);
    
    // Listener para forçar limpeza quando necessário
    const handleForceCleanup = () => {
      queryClient.removeQueries({ type: 'inactive' });
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
          <LanguageProvider>
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
          </LanguageProvider>
        </PWAProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
