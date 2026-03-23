// Build trigger v3 - force refresh
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
import { EmpresaProvider } from "@/contexts/EmpresaContext";
import { PWAProvider, usePWA } from "@/contexts/PWAContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { PWAUpdatePrompt } from "@/components/pwa/PWAUpdatePrompt";
import { SplashScreen } from "@/components/pwa/SplashScreen";
import { TourProvider } from "@/components/tour";
import { MeetingRecordingProvider } from "@/contexts/MeetingRecordingContext";

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
const MenuConfig = lazyWithRetry(() => import("./pages/dashboard/configuracoes/MenuConfig"));
const PermissoesModulo = lazyWithRetry(() => import("./pages/dashboard/configuracoes/PermissoesModulo"));
const ConfiguracoesAcesso = lazyWithRetry(() => import("./pages/dashboard/configuracoes/ConfiguracoesAcesso"));
const PainelExecutivo = lazyWithRetry(() => import("./pages/PainelExecutivo"));
const PerformanceVendas = lazyWithRetry(() => import("./pages/PerformanceVendas"));
const AnaliseClientes = lazyWithRetry(() => import("./pages/AnaliseClientes"));
const DetalhamentoVendas = lazyWithRetry(() => import("./pages/DetalhamentoVendas"));
const AnaliseGeografico = lazyWithRetry(() => import("./pages/AnaliseGeografico"));
const AnaliseProdutos = lazyWithRetry(() => import("./pages/AnaliseProdutos"));
const MetasProjecoes = lazyWithRetry(() => import("./pages/MetasProjecoes"));
const Consolidado = lazyWithRetry(() => import("./pages/Consolidado"));
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
const MinhasSolicitacoes = lazyWithRetry(() => import("./pages/trade/MinhasSolicitacoes"));
const TradeReportCampaigns = lazyWithRetry(() => import("./pages/trade/reports/TradeReportCampaigns"));
const TradeReportClients = lazyWithRetry(() => import("./pages/trade/reports/TradeReportClients"));
const TradeReportSellers = lazyWithRetry(() => import("./pages/trade/reports/TradeReportSellers"));
const TradeExecutiveDashboard = lazyWithRetry(() => import("./pages/TradeExecutiveDashboard"));
const TradeSupervisorDashboard = lazyWithRetry(() => import("./pages/TradeSupervisorDashboard"));
const TradeBannersAdmin = lazyWithRetry(() => import("./pages/trade/TradeBannersAdmin"));
const TradeIncentivosAdmin = lazyWithRetry(() => import("./pages/trade/TradeIncentivosAdmin"));
const TradeDisplayCatalogAdmin = lazyWithRetry(() => import("./pages/trade/TradeDisplayCatalogAdmin"));
const TradeMateriaisAdmin = lazyWithRetry(() => import("./pages/trade/TradeMateriaisAdmin"));
const TradeMateriaisCatalog = lazyWithRetry(() => import("./pages/trade/TradeMateriaisCatalog"));
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
const Fornecedores = lazyWithRetry(() => import("./pages/Fornecedores"));
const Pagamentos = lazyWithRetry(() => import("./pages/Pagamentos"));
const Empresas = lazyWithRetry(() => import("./pages/Empresas"));
const CentrosCusto = lazyWithRetry(() => import("./pages/CentrosCusto"));
const ContasBancarias = lazyWithRetry(() => import("./pages/ContasBancarias"));
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
const SimulacaoDados = lazyWithRetry(() => import("./pages/SimulacaoDados"));
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
const ContaPagarDetalhe = lazyWithRetry(() => import("./pages/ContaPagarDetalhe"));
const FinanceiroConsolidadoDashboard = lazyWithRetry(() => import("./pages/FinanceiroConsolidadoDashboard"));
const ConciliacaoBancaria = lazyWithRetry(() => import("./pages/financeiro/ConciliacaoBancaria"));
const InvestimentosCorporativos = lazyWithRetry(() => import("./pages/financeiro/InvestimentosCorporativos"));
// Portal do Cliente (isolado)
const PortalPrecos = lazyWithRetry(() => import("./pages/portal/PortalPrecos"));
const PortalPerfil = lazyWithRetry(() => import("./pages/portal/PortalPerfil"));
const FormularioEquipe = lazyWithRetry(() => import("./pages/FormularioEquipe"));
const CofreSharePage = lazyWithRetry(() => import("./pages/CofreSharePage"));
const ChinaFabrica = lazyWithRetry(() => import("./pages/ChinaFabrica"));
const ChinaNovaSubmissao = lazyWithRetry(() => import("./pages/ChinaNovaSubmissao"));
const ChinaRecebimentos = lazyWithRetry(() => import("./pages/ChinaRecebimentos"));
const ChinaOrdens = lazyWithRetry(() => import("./pages/ChinaOrdens"));
const ChinaOrdemDetalhe = lazyWithRetry(() => import("./pages/ChinaOrdemDetalhe"));
const ChinaSubmissaoDetalhe = lazyWithRetry(() => import("./pages/ChinaSubmissaoDetalhe"));
const ChinaFichaProduto = lazyWithRetry(() => import("./pages/ChinaFichaProduto"));
const Projetos = lazyWithRetry(() => import("./pages/Projetos"));
const ProjetoDetalhe = lazyWithRetry(() => import("./pages/ProjetoDetalhe"));
const ProjetoInbox = lazyWithRetry(() => import("./pages/ProjetoInbox"));
const ProjetosMinhaEquipe = lazyWithRetry(() => import("./pages/ProjetosMinhaEquipe"));
const ProjetoAprovacaoCadastro = lazyWithRetry(() => import("./pages/ProjetoAprovacaoCadastro"));
const ProjetoVincularChina = lazyWithRetry(() => import("./pages/ProjetoVincularChina"));
const ProdutoBrasilCadastro = lazyWithRetry(() => import("./pages/ProdutoBrasilCadastro"));
const ProdutosBrasilListagem = lazyWithRetry(() => import("./pages/ProdutosBrasilListagem"));
const PoliticaPrivacidade = lazyWithRetry(() => import("./pages/PoliticaPrivacidade"));
const TermosDeUso = lazyWithRetry(() => import("./pages/TermosDeUso"));
const LGPDAdmin = lazyWithRetry(() => import("./pages/LGPDAdmin"));
const Reunioes = lazyWithRetry(() => import("./pages/Reunioes"));
const ReuniaoDetalhe = lazyWithRetry(() => import("./pages/ReuniaoDetalhe"));
const RelatorioSeguranca = lazyWithRetry(() => import("./pages/RelatorioSeguranca"));
const RelatorioAPIs = lazyWithRetry(() => import("./pages/RelatorioAPIs"));
const RelatorioDesenvolvimento = lazyWithRetry(() => import("./pages/RelatorioDesenvolvimento"));
const RelatorioAPModule = lazyWithRetry(() => import("./pages/RelatorioAPModule"));
const IntegracaoERP = lazyWithRetry(() => import("./pages/IntegracaoERP"));
const EstoqueModule = lazyWithRetry(() => import("./pages/modules/EstoqueModule"));
const EstoqueDistribuidoras = lazyWithRetry(() => import("./pages/EstoqueDistribuidoras"));
const EstoqueProdutosMaster = lazyWithRetry(() => import("./pages/EstoqueProdutosMaster"));
const EstoqueSaldos = lazyWithRetry(() => import("./pages/EstoqueSaldos"));
const EstoqueConsolidado = lazyWithRetry(() => import("./pages/EstoqueConsolidado"));
const EstoqueVinculacoes = lazyWithRetry(() => import("./pages/EstoqueVinculacoes"));
const FluxoAprovacaoArtes = lazyWithRetry(() => import("./pages/FluxoAprovacaoArtes"));
const FluxoAprovacaoDetalhe = lazyWithRetry(() => import("./pages/FluxoAprovacaoDetalhe"));
const FluxoAprovacaoConfig = lazyWithRetry(() => import("./pages/FluxoAprovacaoConfig"));
const ChecklistComposicao = lazyWithRetry(() => import("./pages/ChecklistComposicao"));
const RecebimentoAmostra = lazyWithRetry(() => import("./pages/RecebimentoAmostra"));
const AnaliseEmbalagem = lazyWithRetry(() => import("./pages/AnaliseEmbalagem"));
const ChecklistEtiquetaBula = lazyWithRetry(() => import("./pages/ChecklistEtiquetaBula"));
const FluxoArtesMotor = lazyWithRetry(() => import("./pages/FluxoArtesMotor"));
const FluxoArtesDetalhe = lazyWithRetry(() => import("./pages/FluxoArtesDetalhe"));
const ConsultaProcessos = lazyWithRetry(() => import("./pages/ConsultaProcessos"));
const ConfigEtapasProcesso = lazyWithRetry(() => import("./pages/ConfigEtapasProcesso"));
const ConfigDocWorkflows = lazyWithRetry(() => import("./pages/ConfigDocWorkflows"));
const ContasPagarGestao = lazyWithRetry(() => import("./pages/ContasPagarGestao"));
const FilaExportacaoERP = lazyWithRetry(() => import("./pages/financeiro/FilaExportacaoERP"));
const PainelCentralAP = lazyWithRetry(() => import("./pages/financeiro/PainelCentralAP"));
const CadastroTituloAP = lazyWithRetry(() => import("./pages/financeiro/CadastroTituloAP"));
const SyncCadastrosAP = lazyWithRetry(() => import("./pages/financeiro/SyncCadastrosAP"));
const ConciliacaoManualAP = lazyWithRetry(() => import("./pages/financeiro/ConciliacaoManualAP"));
const RelatorioAPxERP = lazyWithRetry(() => import("./pages/financeiro/RelatorioAPxERP"));

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

  // Helpers reutilizáveis para rotas protegidas — garantem segurança por padrão
  const ModuleRoute = ({ moduleCode, children }: { moduleCode: string; children: React.ReactNode }) => (
    <ProtectedRoute>
      <ModuleProtectedRoute moduleCode={moduleCode}>
        {children}
      </ModuleProtectedRoute>
    </ProtectedRoute>
  );

  const ScreenRoute = ({ screenCode, children, redirectTo }: { screenCode: string; children: React.ReactNode; redirectTo?: string }) => (
    <ProtectedRoute>
      <ScreenProtectedRoute screenCode={screenCode} redirectTo={redirectTo}>
        {children}
      </ScreenProtectedRoute>
    </ProtectedRoute>
  );

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
      
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth/login" element={<Auth />} />
            <Route path="/auth/signup" element={<Navigate to="/auth/login" replace />} />
            <Route path="/aguardando-aprovacao" element={<AguardandoAprovacao />} />
            <Route path="/usuario-bloqueado" element={<UsuarioBloqueado />} />
            
            {/* Protected Routes */}
            <Route path="/dashboard" element={<ProtectedRoute><DashboardRedirect /></ProtectedRoute>} />
            <Route path="/dashboard/ai-analytics" element={<ScreenRoute screenCode="ai_analytics"><AIAnalytics /></ScreenRoute>} />
            <Route path="/dashboard/qa-agent" element={<ScreenRoute screenCode="ai_analytics"><QAAgent /></ScreenRoute>} />
            <Route path="/dashboard/agente-huggs" element={<ScreenRoute screenCode="ai_analytics"><AgenteHuggs /></ScreenRoute>} />
            <Route path="/dashboard/relatorios" element={<ScreenRoute screenCode="relatorios"><Relatorios /></ScreenRoute>} />
            
            {/* Módulo de Marketing */}
            <Route path="/dashboard/marketing" element={<ModuleRoute moduleCode="marketing"><MarketingModule /></ModuleRoute>} />
            <Route path="/dashboard/marketing/social" element={<ModuleRoute moduleCode="marketing"><Marketing /></ModuleRoute>} />
            <Route path="/dashboard/marketing/whatsapp" element={<ModuleRoute moduleCode="marketing"><WhatsAppMonitoring /></ModuleRoute>} />
            <Route path="/dashboard/marketing/elevenlabs" element={<ModuleRoute moduleCode="marketing"><ElevenLabsStudioPage /></ModuleRoute>} />
            
            <Route path="/dashboard/instalar-app" element={<ProtectedRoute><InstalarApp /></ProtectedRoute>} />
            
            {/* Módulo de Prospects */}
            <Route path="/dashboard/prospects" element={<ModuleRoute moduleCode="prospects"><ProspectsModule /></ModuleRoute>} />
            <Route path="/dashboard/prospects/lista" element={<ModuleRoute moduleCode="prospects"><Prospects /></ModuleRoute>} />
            <Route path="/dashboard/prospects/list" element={<ModuleRoute moduleCode="prospects"><Prospects /></ModuleRoute>} />
            <Route path="/dashboard/prospects/kanban" element={<ModuleRoute moduleCode="prospects"><Kanban /></ModuleRoute>} />
            <Route path="/dashboard/prospects/atividades" element={<ModuleRoute moduleCode="prospects"><Atividades /></ModuleRoute>} />
            <Route path="/dashboard/prospects/mapa" element={<ModuleRoute moduleCode="prospects"><Mapa /></ModuleRoute>} />
            <Route path="/dashboard/prospects/municipios" element={<ModuleRoute moduleCode="prospects"><Municipios /></ModuleRoute>} />
            <Route path="/dashboard/demandas" element={<ScreenRoute screenCode="admin"><InternalTicketsPage /></ScreenRoute>} />
            
            {/* Outras funcionalidades */}
            <Route path="/dashboard/ranking" element={<ModuleRoute moduleCode="trade"><Ranking /></ModuleRoute>} />
            <Route path="/dashboard/tarefas" element={<ProtectedRoute><Tarefas /></ProtectedRoute>} />
            <Route path="/dashboard/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="/dashboard/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
            <Route path="/dashboard/importar-clientes" element={<ModuleRoute moduleCode="comercial"><ImportarClientes /></ModuleRoute>} />
            <Route path="/dashboard/auditoria" element={<ScreenRoute screenCode="auditoria"><Auditoria /></ScreenRoute>} />
            
            {/* Módulo de Trade Marketing */}
            <Route path="/dashboard/trade" element={<ModuleRoute moduleCode="trade"><TradeModule /></ModuleRoute>} />
            <Route path="/dashboard/trade/admin" element={<ScreenRoute screenCode="trade_admin"><TradeAdminModule /></ScreenRoute>} />
            <Route path="/dashboard/trade/admin/users" element={<ScreenRoute screenCode="trade_admin"><TradeAdminUsers /></ScreenRoute>} />
            <Route path="/dashboard/trade/admin/approval-levels" element={<ScreenRoute screenCode="trade_admin"><TradeAdminApprovalLevels /></ScreenRoute>} />
            <Route path="/dashboard/trade/admin/reports/campaigns" element={<ScreenRoute screenCode="trade_admin"><TradeReportCampaigns /></ScreenRoute>} />
            <Route path="/dashboard/trade/admin/reports/clients" element={<ScreenRoute screenCode="trade_admin"><TradeReportClients /></ScreenRoute>} />
            <Route path="/dashboard/trade/admin/reports/sellers" element={<ScreenRoute screenCode="trade_admin"><TradeReportSellers /></ScreenRoute>} />
            <Route path="/dashboard/trade/admin/executivo" element={<ScreenRoute screenCode="trade_admin"><TradeExecutiveDashboard /></ScreenRoute>} />
            <Route path="/dashboard/trade/admin/banners" element={<ScreenRoute screenCode="trade_admin"><TradeBannersAdmin /></ScreenRoute>} />
            <Route path="/dashboard/trade/admin/incentivos" element={<ScreenRoute screenCode="trade_admin"><TradeIncentivosAdmin /></ScreenRoute>} />
            <Route path="/dashboard/trade/admin/displays" element={<ScreenRoute screenCode="trade_admin"><TradeDisplayCatalogAdmin /></ScreenRoute>} />
            <Route path="/dashboard/trade/admin/materiais" element={<ScreenRoute screenCode="trade_admin"><TradeMateriaisAdmin /></ScreenRoute>} />
            <Route path="/dashboard/trade/materiais" element={<ModuleRoute moduleCode="trade"><TradeMateriaisCatalog /></ModuleRoute>} />
            <Route path="/dashboard/trade/minha-equipe" element={<ModuleRoute moduleCode="trade"><TradeSupervisorDashboard /></ModuleRoute>} />
            <Route path="/dashboard/trade/store-chains" element={<ModuleRoute moduleCode="trade"><TradeStoreChains /></ModuleRoute>} />
            <Route path="/dashboard/trade/stores" element={<ModuleRoute moduleCode="trade"><TradeStores /></ModuleRoute>} />
            <Route path="/dashboard/trade/visits" element={<ModuleRoute moduleCode="trade"><TradeVisits /></ModuleRoute>} />
            <Route path="/dashboard/trade/photos" element={<ModuleRoute moduleCode="trade"><TradePhotos /></ModuleRoute>} />
            <Route path="/dashboard/trade/competitors" element={<ModuleRoute moduleCode="trade"><TradeCompetitors /></ModuleRoute>} />
            <Route path="/dashboard/trade/promotions" element={<ModuleRoute moduleCode="trade"><TradePromotions /></ModuleRoute>} />
            <Route path="/dashboard/trade/insights" element={<ModuleRoute moduleCode="trade"><TradeInsights /></ModuleRoute>} />
            <Route path="/dashboard/trade/whatsapp" element={<ModuleRoute moduleCode="trade"><WhatsAppMonitoring /></ModuleRoute>} />
            <Route path="/dashboard/trade/import-stores" element={<ModuleRoute moduleCode="trade"><TradeImportStores /></ModuleRoute>} />
            <Route path="/dashboard/trade/calendar" element={<ModuleRoute moduleCode="trade"><TradeCalendar /></ModuleRoute>} />
            <Route path="/dashboard/trade/ideal-photos" element={<ModuleRoute moduleCode="trade"><TradeIdealPhotos /></ModuleRoute>} />
            <Route path="/dashboard/trade/financeiro" element={<ScreenRoute screenCode="trade_admin"><TradeFinanceiro /></ScreenRoute>} />
            <Route path="/dashboard/trade/financeiro/dashboard" element={<ScreenRoute screenCode="trade_admin"><TradeFinanceiroDashboard /></ScreenRoute>} />
            <Route path="/dashboard/trade/financeiro/campanhas" element={<ScreenRoute screenCode="trade_admin"><TradeCampaigns /></ScreenRoute>} />
            <Route path="/dashboard/trade/financeiro/campanhas/:id" element={<ScreenRoute screenCode="trade_admin"><TradeCampaignDetail /></ScreenRoute>} />
            <Route path="/dashboard/trade/financeiro/lancamentos-campanhas" element={<ScreenRoute screenCode="trade_admin"><TradeLancamentosCampanhas /></ScreenRoute>} />
            <Route path="/dashboard/trade/financeiro/contas" element={<ScreenRoute screenCode="trade_admin"><TradeContasCorrentes /></ScreenRoute>} />
            <Route path="/dashboard/trade/financeiro/extrato/:accountId" element={<ScreenRoute screenCode="trade_admin"><TradeExtratoBancario /></ScreenRoute>} />
            <Route path="/dashboard/trade/financeiro/verbas" element={<ScreenRoute screenCode="trade_admin"><TradeVerbasSemestrais /></ScreenRoute>} />
            <Route path="/dashboard/trade/financeiro/lancamentos" element={<ScreenRoute screenCode="trade_admin"><TradeLancamentos /></ScreenRoute>} />
            <Route path="/dashboard/trade/financeiro/aprovacoes" element={<ScreenRoute screenCode="trade_admin"><TradeAprovacoes /></ScreenRoute>} />
            <Route path="/dashboard/trade/financeiro/extrato" element={<ScreenRoute screenCode="trade_admin"><TradeExtratosPessoais /></ScreenRoute>} />
            <Route path="/dashboard/trade/campanhas/aprovacoes" element={<ScreenRoute screenCode="trade_admin"><TradeAprovarCampanhas /></ScreenRoute>} />
            <Route path="/dashboard/trade/aprovacoes" element={<ScreenRoute screenCode="trade_admin"><TradeApprovalHub /></ScreenRoute>} />
            <Route path="/dashboard/trade/auditorias" element={<ModuleRoute moduleCode="trade"><TradeAuditorias /></ModuleRoute>} />
            <Route path="/dashboard/trade/sellout" element={<ModuleRoute moduleCode="trade"><TradeSellOut /></ModuleRoute>} />
            <Route path="/dashboard/trade/shelf-measurements" element={<ModuleRoute moduleCode="trade"><TradeShelfMeasurements /></ModuleRoute>} />
            <Route path="/dashboard/trade/measurement-guide" element={<ModuleRoute moduleCode="trade"><TradeMeasurementGuide /></ModuleRoute>} />
            <Route path="/dashboard/trade/our-brands" element={<ModuleRoute moduleCode="trade"><TradeOurBrands /></ModuleRoute>} />
            <Route path="/dashboard/trade/brand-share" element={<ModuleRoute moduleCode="trade"><TradeBrandShareDashboard /></ModuleRoute>} />
            <Route path="/dashboard/trade/relatorio-competitivo" element={<ModuleRoute moduleCode="trade"><TradeRelatorioCompetitivo /></ModuleRoute>} />
            <Route path="/dashboard/trade/comparacao-produtos" element={<ModuleRoute moduleCode="trade"><TradeComparacaoProdutos /></ModuleRoute>} />
            <Route path="/dashboard/trade/performance" element={<ModuleRoute moduleCode="trade"><TradePerformance /></ModuleRoute>} />
            <Route path="/dashboard/trade/team-performance" element={<ModuleRoute moduleCode="trade"><TradeTeamPerformance /></ModuleRoute>} />
            <Route path="/dashboard/trade/rewards" element={<ModuleRoute moduleCode="trade"><TradeRewards /></ModuleRoute>} />
            <Route path="/dashboard/trade/minhas-solicitacoes" element={<ModuleRoute moduleCode="trade"><MinhasSolicitacoes /></ModuleRoute>} />

            {/* Módulo de Eventos Corporativos */}
            <Route path="/dashboard/eventos" element={<ModuleRoute moduleCode="eventos"><CorporateEvents /></ModuleRoute>} />
            <Route path="/dashboard/eventos/aprovacoes" element={<ModuleRoute moduleCode="eventos"><EventsApprovalHub /></ModuleRoute>} />
            <Route path="/dashboard/eventos/:id" element={<ModuleRoute moduleCode="eventos"><CorporateEventDetail /></ModuleRoute>} />
            <Route path="/dashboard/eventos/dashboard" element={<ModuleRoute moduleCode="eventos"><CorporateEventsDashboard /></ModuleRoute>} />

            {/* Módulo de Departamentos */}
            <Route path="/dashboard/departamentos" element={<ModuleRoute moduleCode="departamentos"><DepartmentHub /></ModuleRoute>} />
            <Route path="/dashboard/departamentos/:id" element={<ModuleRoute moduleCode="departamentos"><DepartmentDetail /></ModuleRoute>} />
            <Route path="/dashboard/departamentos/:id/dashboard" element={<ModuleRoute moduleCode="departamentos"><DepartmentDashboard /></ModuleRoute>} />
            <Route path="/dashboard/departamentos/:id/aprovacoes" element={<ModuleRoute moduleCode="departamentos"><DepartmentApprovalHub /></ModuleRoute>} />
            <Route path="/dashboard/departamentos/aprovacoes" element={<ModuleRoute moduleCode="departamentos"><DepartmentsApprovalHub /></ModuleRoute>} />

            {/* Módulo de Fábrica */}
            <Route path="/dashboard/fabrica" element={<ModuleRoute moduleCode="fabrica"><FabricaModule /></ModuleRoute>} />
            <Route path="/dashboard/fabrica/recebimentos" element={<ScreenRoute screenCode="fabrica_recebimentos"><FabricaRecebimentos /></ScreenRoute>} />
            <Route path="/dashboard/fabrica/materias-primas" element={<ScreenRoute screenCode="fabrica_mps"><FabricaMateriasPrimas /></ScreenRoute>} />
            <Route path="/dashboard/fabrica/formulas" element={<ScreenRoute screenCode="fabrica_formulas"><FabricaFormulas /></ScreenRoute>} />
            <Route path="/dashboard/fabrica/formulas/nova" element={<ScreenRoute screenCode="fabrica_formulas"><FabricaFormulaEditor /></ScreenRoute>} />
            <Route path="/dashboard/fabrica/formulas/:id" element={<ScreenRoute screenCode="fabrica_formulas"><FabricaFormulaEditor /></ScreenRoute>} />
            <Route path="/dashboard/fabrica/planejamento" element={<ScreenRoute screenCode="fabrica_planejamento"><FabricaPlanejamento /></ScreenRoute>} />
            <Route path="/dashboard/fabrica/fiscal" element={<ScreenRoute screenCode="fabrica_fiscal"><FabricaFiscal /></ScreenRoute>} />
            <Route path="/dashboard/fabrica/tabela-impostos" element={<ScreenRoute screenCode="fabrica_fiscal"><FabricaTabelaImpostos /></ScreenRoute>} />
            <Route path="/dashboard/fabrica/ordens-producao" element={<ScreenRoute screenCode="fabrica_ordens"><FabricaOrdensProducao /></ScreenRoute>} />
            <Route path="/dashboard/fabrica/apontamentos" element={<ScreenRoute screenCode="fabrica_apontamentos"><FabricaApontamentos /></ScreenRoute>} />
            <Route path="/dashboard/fabrica/qualidade" element={<ScreenRoute screenCode="fabrica_qualidade"><FabricaQualidade /></ScreenRoute>} />
            <Route path="/dashboard/fabrica/paradas" element={<ScreenRoute screenCode="fabrica_paradas"><FabricaParadas /></ScreenRoute>} />
            <Route path="/dashboard/fabrica/maquinas" element={<ScreenRoute screenCode="fabrica_maquinas"><FabricaMaquinas /></ScreenRoute>} />
            <Route path="/dashboard/fabrica/operadores" element={<ScreenRoute screenCode="fabrica_operadores"><FabricaOperadores /></ScreenRoute>} />
            <Route path="/dashboard/fabrica/produtos-acabados" element={<ScreenRoute screenCode="fabrica_produtos"><FabricaProdutosAcabados /></ScreenRoute>} />
            <Route path="/dashboard/fabrica/produtos/:id/custos" element={<ScreenRoute screenCode="fabrica_produtos"><FichaCustoProduto /></ScreenRoute>} />
            <Route path="/dashboard/fabrica/produtos/importar" element={<ScreenRoute screenCode="fabrica_produtos"><ImportarProdutosAcabados /></ScreenRoute>} />
            <Route path="/dashboard/fabrica/revisao-fichas" element={<ScreenRoute screenCode="fabrica_revisao_fichas"><FichaRevisaoDiretoria /></ScreenRoute>} />
            <Route path="/dashboard/fabrica/comunicacao-revisoes" element={<ScreenRoute screenCode="fabrica_produtos"><FabricaComunicacaoRevisoes /></ScreenRoute>} />
            <Route path="/dashboard/fabrica/executivo" element={<ScreenRoute screenCode="fabrica_dashboard"><FabricaExecutiveDashboard /></ScreenRoute>} />
            <Route path="/dashboard/fabrica/manual" element={<ModuleRoute moduleCode="fabrica"><FabricaManualPage /></ModuleRoute>} />

            {/* Módulo Fábrica China */}
            <Route path="/dashboard/fabrica-china" element={<ModuleRoute moduleCode="china"><ChinaFabrica /></ModuleRoute>} />
            <Route path="/dashboard/fabrica-china/nova" element={<ModuleRoute moduleCode="china"><ChinaNovaSubmissao /></ModuleRoute>} />
            <Route path="/dashboard/fabrica-china/nova/:submissaoId" element={<ModuleRoute moduleCode="china"><ChinaNovaSubmissao /></ModuleRoute>} />
            <Route path="/dashboard/fabrica-china/recebimentos" element={<ModuleRoute moduleCode="china"><ChinaRecebimentos /></ModuleRoute>} />
            <Route path="/dashboard/fabrica-china/ordens" element={<ModuleRoute moduleCode="china"><ChinaOrdens /></ModuleRoute>} />
            <Route path="/dashboard/fabrica-china/ordens/:id" element={<ModuleRoute moduleCode="china"><ChinaOrdemDetalhe /></ModuleRoute>} />
            <Route path="/dashboard/fabrica-china/submissao/:id" element={<ModuleRoute moduleCode="china"><ChinaSubmissaoDetalhe /></ModuleRoute>} />
            <Route path="/dashboard/fabrica-china/produto/:id" element={<ModuleRoute moduleCode="china"><ChinaFichaProduto /></ModuleRoute>} />

            {/* Painel Executivo — protegido por módulo central_inteligencia */}
            <Route path="/dashboard/painel-executivo" element={<ModuleRoute moduleCode="central_inteligencia"><PainelExecutivo /></ModuleRoute>} />
            <Route path="/dashboard/performance-vendas" element={<ModuleRoute moduleCode="central_inteligencia"><PerformanceVendas /></ModuleRoute>} />
            <Route path="/dashboard/clientes" element={<ModuleRoute moduleCode="central_inteligencia"><AnaliseClientes /></ModuleRoute>} />
            <Route path="/dashboard/detalhamento" element={<ModuleRoute moduleCode="central_inteligencia"><DetalhamentoVendas /></ModuleRoute>} />
            <Route path="/dashboard/geografico" element={<ModuleRoute moduleCode="central_inteligencia"><AnaliseGeografico /></ModuleRoute>} />
            <Route path="/dashboard/produtos" element={<ModuleRoute moduleCode="central_inteligencia"><AnaliseProdutos /></ModuleRoute>} />
            <Route path="/dashboard/metas" element={<ModuleRoute moduleCode="central_inteligencia"><MetasProjecoes /></ModuleRoute>} />
            <Route path="/dashboard/consolidado" element={<ModuleRoute moduleCode="central_inteligencia"><Consolidado /></ModuleRoute>} />

            {/* Módulo Comercial */}
            <Route path="/dashboard/comercial" element={<ModuleRoute moduleCode="comercial"><ComercialModule /></ModuleRoute>} />
            <Route path="/dashboard/comercial/lancamentos" element={<ScreenRoute screenCode="comercial_lancamentos"><FabricaLancamentos /></ScreenRoute>} />
            <Route path="/dashboard/comercial/ibge" element={<ModuleRoute moduleCode="comercial"><IBGEData /></ModuleRoute>} />
            <Route path="/dashboard/comercial/mineracao" element={<ModuleRoute moduleCode="comercial"><LeadMining /></ModuleRoute>} />
            <Route path="/dashboard/comercial/inteligencia" element={<ModuleRoute moduleCode="comercial"><MarketIntelligence /></ModuleRoute>} />
            <Route path="/dashboard/comercial/reativacao" element={<ModuleRoute moduleCode="comercial"><ClientReactivation /></ModuleRoute>} />
            <Route path="/dashboard/comercial/mapa" element={<ModuleRoute moduleCode="comercial"><ComercialMapa /></ModuleRoute>} />
            <Route path="/dashboard/comercial/municipios-inteligencia" element={<ModuleRoute moduleCode="comercial"><MunicipiosIntelligence /></ModuleRoute>} />
            <Route path="/dashboard/comercial/whitespace" element={<ModuleRoute moduleCode="comercial"><WhitespaceAnalysis /></ModuleRoute>} />

            {/* Módulo de Tabelas de Preços */}
            <Route path="/dashboard/precos" element={<ModuleRoute moduleCode="precos"><TabelasPrecosModule /></ModuleRoute>} />
            <Route path="/dashboard/precos/matriz" element={<ScreenRoute screenCode="precos_matriz"><PrecosMatrizComparativa /></ScreenRoute>} />
            <Route path="/dashboard/precos/tabelas" element={<ScreenRoute screenCode="precos_tabelas"><FabricaTabelasPreco /></ScreenRoute>} />
            <Route path="/dashboard/precos/aprovacao" element={<ScreenRoute screenCode="precos_tabelas"><FabricaAprovacaoPrecos /></ScreenRoute>} />
            <Route path="/dashboard/precos/portal-cliente" element={<ModuleRoute moduleCode="precos"><PortalCliente /></ModuleRoute>} />
            <Route path="/dashboard/precos/acesso" element={<ScreenRoute screenCode="precos_tabelas"><GerenciamentoAcessoPrecos /></ScreenRoute>} />
            <Route path="/dashboard/precos/simulador" element={<ScreenRoute screenCode="precos_simulador"><SimuladorCenariosPrecos /></ScreenRoute>} />
            
            {/* Módulo de Estoque */}
            <Route path="/dashboard/estoque" element={<ModuleRoute moduleCode="estoque"><EstoqueModule /></ModuleRoute>} />
            <Route path="/dashboard/estoque/distribuidoras" element={<ModuleRoute moduleCode="estoque"><EstoqueDistribuidoras /></ModuleRoute>} />
            <Route path="/dashboard/estoque/produtos-master" element={<ModuleRoute moduleCode="estoque"><EstoqueProdutosMaster /></ModuleRoute>} />
            <Route path="/dashboard/estoque/saldos" element={<ModuleRoute moduleCode="estoque"><EstoqueSaldos /></ModuleRoute>} />
            <Route path="/dashboard/estoque/consolidado" element={<ModuleRoute moduleCode="estoque"><EstoqueConsolidado /></ModuleRoute>} />
            <Route path="/dashboard/estoque/vinculacoes" element={<ModuleRoute moduleCode="estoque"><EstoqueVinculacoes /></ModuleRoute>} />

            {/* Módulo de Aprovação de Artes */}
            <Route path="/dashboard/aprovacao-artes" element={<ModuleRoute moduleCode="aprovacao_artes"><FluxoAprovacaoArtes /></ModuleRoute>} />
            <Route path="/dashboard/aprovacao-artes/:id" element={<ModuleRoute moduleCode="aprovacao_artes"><FluxoAprovacaoDetalhe /></ModuleRoute>} />
            <Route path="/dashboard/aprovacao-artes/configuracao" element={<ModuleRoute moduleCode="aprovacao_artes"><FluxoAprovacaoConfig /></ModuleRoute>} />

            {/* Módulo Checklist Composição */}
            <Route path="/dashboard/composicao" element={<ModuleRoute moduleCode="composicao"><ChecklistComposicao /></ModuleRoute>} />

            {/* Módulo Recebimento de Amostra */}
            <Route path="/dashboard/amostras" element={<ModuleRoute moduleCode="amostras"><RecebimentoAmostra /></ModuleRoute>} />

            {/* Módulo Análise de Embalagem */}
            <Route path="/dashboard/analise-embalagem" element={<ModuleRoute moduleCode="analise_embalagem"><AnaliseEmbalagem /></ModuleRoute>} />

            {/* Módulo Checklist Etiqueta/Bula */}
            <Route path="/dashboard/etiqueta-bula" element={<ModuleRoute moduleCode="etiqueta_bula"><ChecklistEtiquetaBula /></ModuleRoute>} />

            {/* Motor Genérico de Aprovação de Artes */}
            <Route path="/dashboard/fluxo-artes" element={<ModuleRoute moduleCode="aprovacao_artes"><FluxoArtesMotor /></ModuleRoute>} />
            <Route path="/dashboard/fluxo-artes/:id" element={<ModuleRoute moduleCode="aprovacao_artes"><FluxoArtesDetalhe /></ModuleRoute>} />

            {/* Simulação de Dados */}
            <Route path="/dashboard/simulacao" element={<ScreenRoute screenCode="admin"><SimulacaoDados /></ScreenRoute>} />

            {/* Módulo Financeiro - Protegido por módulo */}
            <Route path="/dashboard/financeiro" element={<ModuleRoute moduleCode="financeiro"><Financeiro /></ModuleRoute>} />
            <Route path="/dashboard/financeiro/visao-departamentos" element={<ModuleRoute moduleCode="financeiro"><VisaoDepartamentos /></ModuleRoute>} />
            <Route path="/dashboard/financeiro/dre-analitico" element={<ModuleRoute moduleCode="financeiro"><DREAnalitico /></ModuleRoute>} />
            <Route path="/dashboard/financeiro/trade" element={<ModuleRoute moduleCode="financeiro"><TradeFinanceiro /></ModuleRoute>} />
            <Route path="/dashboard/financeiro/contas-a-pagar" element={<ScreenRoute screenCode="financeiro_contas_pagar"><ContasAPagar /></ScreenRoute>} />
            <Route path="/dashboard/financeiro/contas-a-pagar/sync" element={<ScreenRoute screenCode="financeiro_contas_pagar"><ContasPagarSyncPage /></ScreenRoute>} />
            <Route path="/dashboard/financeiro/contas-a-pagar/:id" element={<ScreenRoute screenCode="financeiro_contas_pagar"><ContaPagarDetalhe /></ScreenRoute>} />
            <Route path="/dashboard/financeiro/contas-a-pagar/auditoria" element={<ScreenRoute screenCode="financeiro_contas_pagar"><ContasPagarAuditoria /></ScreenRoute>} />
            <Route path="/dashboard/financeiro/ap-central" element={<ScreenRoute screenCode="financeiro_contas_pagar"><PainelCentralAP /></ScreenRoute>} />
            <Route path="/dashboard/financeiro/contas-a-pagar/novo" element={<ScreenRoute screenCode="financeiro_contas_pagar"><CadastroTituloAP /></ScreenRoute>} />
            <Route path="/dashboard/financeiro/contas-a-pagar/:id/editar" element={<ScreenRoute screenCode="financeiro_contas_pagar"><CadastroTituloAP /></ScreenRoute>} />
            <Route path="/dashboard/financeiro/contas-a-pagar/exportacao-erp" element={<ScreenRoute screenCode="financeiro_contas_pagar"><FilaExportacaoERP /></ScreenRoute>} />
            <Route path="/dashboard/financeiro/contas-a-pagar/sync-cadastros" element={<ScreenRoute screenCode="financeiro_contas_pagar"><SyncCadastrosAP /></ScreenRoute>} />
            <Route path="/dashboard/financeiro/contas-a-pagar/conciliacao" element={<ScreenRoute screenCode="financeiro_contas_pagar"><ConciliacaoManualAP /></ScreenRoute>} />
            <Route path="/configuracoes/admin/relatorio-ap-erp" element={<ScreenRoute screenCode="admin"><RelatorioAPxERP /></ScreenRoute>} />
            <Route path="/dashboard/financeiro/contas-a-receber" element={<ModuleRoute moduleCode="financeiro"><ContasAReceber /></ModuleRoute>} />
            <Route path="/dashboard/financeiro/contas-a-receber/auditoria" element={<ModuleRoute moduleCode="financeiro"><ContasReceberAuditoria /></ModuleRoute>} />
            <Route path="/dashboard/financeiro/contas-a-receber/sync" element={<ModuleRoute moduleCode="financeiro"><ContasReceberSyncPage /></ModuleRoute>} />
            <Route path="/dashboard/financeiro/cobranca" element={<ModuleRoute moduleCode="financeiro"><CobrancaInadimplentes /></ModuleRoute>} />
            <Route path="/dashboard/financeiro/fluxo-de-caixa" element={<ModuleRoute moduleCode="financeiro"><FluxoDeCaixa /></ModuleRoute>} />
            <Route path="/dashboard/financeiro/plano-contas" element={<ModuleRoute moduleCode="financeiro"><PlanoContas /></ModuleRoute>} />
            <Route path="/dashboard/financeiro/saldos-bancarios" element={<ModuleRoute moduleCode="financeiro"><SaldosBancarios /></ModuleRoute>} />
            <Route path="/dashboard/financeiro/classificar-banco" element={<ModuleRoute moduleCode="financeiro"><ClassificarTodoBanco /></ModuleRoute>} />
            <Route path="/dashboard/financeiro/central-pagamentos" element={<ModuleRoute moduleCode="financeiro"><FinancialPaymentCentral /></ModuleRoute>} />
            <Route path="/dashboard/financeiro/consolidado" element={<ModuleRoute moduleCode="financeiro"><FinanceiroConsolidadoDashboard /></ModuleRoute>} />
            <Route path="/dashboard/financeiro/conciliacao-bancaria" element={<ModuleRoute moduleCode="financeiro"><ConciliacaoBancaria /></ModuleRoute>} />
            <Route path="/dashboard/financeiro/investimentos" element={<ModuleRoute moduleCode="financeiro"><InvestimentosCorporativos /></ModuleRoute>} />
            
            {/* Marketing Mission Control */}
            <Route path="/dashboard/marketing/mission-control" element={<ModuleRoute moduleCode="marketing"><MarketingMissionControlPage /></ModuleRoute>} />

            {/* Módulo de Projetos */}
             <Route path="/dashboard/projetos" element={<ModuleRoute moduleCode="projetos"><Projetos /></ModuleRoute>} />
             <Route path="/dashboard/projetos/inbox" element={<ModuleRoute moduleCode="projetos"><ProjetoInbox /></ModuleRoute>} />
             <Route path="/dashboard/projetos/aprovacoes" element={<ModuleRoute moduleCode="projetos"><ProjetoAprovacaoCadastro /></ModuleRoute>} />
             <Route path="/dashboard/projetos/minha-equipe" element={<ModuleRoute moduleCode="projetos"><ProjetosMinhaEquipe /></ModuleRoute>} />
             <Route path="/dashboard/projetos/vincular-china" element={<ModuleRoute moduleCode="projetos"><ProjetoVincularChina /></ModuleRoute>} />
             <Route path="/dashboard/projetos/produto-brasil" element={<ModuleRoute moduleCode="projetos"><ProdutosBrasilListagem /></ModuleRoute>} />
             <Route path="/dashboard/projetos/produto-brasil/:id" element={<ModuleRoute moduleCode="projetos"><ProdutoBrasilCadastro /></ModuleRoute>} />
             <Route path="/dashboard/projetos/:id" element={<ModuleRoute moduleCode="projetos"><ProjetoDetalhe /></ModuleRoute>} />

            {/* Módulo de Reuniões */}
            <Route path="/dashboard/reunioes" element={<ModuleRoute moduleCode="reunioes"><Reunioes /></ModuleRoute>} />
            <Route path="/dashboard/reunioes/:id" element={<ModuleRoute moduleCode="reunioes"><ReuniaoDetalhe /></ModuleRoute>} />
            
            {/* Rotas antigas mantidas para compatibilidade */}
            <Route path="/dashboard/contas-a-pagar" element={
              <ScreenRoute screenCode="financeiro_contas_pagar" redirectTo="/dashboard/financeiro/contas-a-pagar">
                <ContasAPagar />
              </ScreenRoute>
            } />
            <Route path="/dashboard/plano-contas" element={
              <ScreenRoute screenCode="financeiro_plano_contas" redirectTo="/dashboard/financeiro/contas-a-pagar">
                <PlanoContas />
              </ScreenRoute>
            } />
            <Route path="/dashboard/configuracoes/api-health" element={<ScreenRoute screenCode="admin"><APIHealthCheck /></ScreenRoute>} />
            <Route path="/dashboard/configuracoes/menu" element={<ScreenRoute screenCode="admin"><MenuConfig /></ScreenRoute>} />
            <Route path="/dashboard/configuracoes/permissoes-modulo" element={<ScreenRoute screenCode="admin"><PermissoesModulo /></ScreenRoute>} />
            <Route path="/dashboard/configuracoes/permissoes-modulo/:moduleCode" element={<ScreenRoute screenCode="admin"><PermissoesModulo /></ScreenRoute>} />
            <Route path="/dashboard/configuracoes/lgpd" element={<ScreenRoute screenCode="admin"><LGPDAdmin /></ScreenRoute>} />
            <Route path="/dashboard/configuracoes/acesso" element={<ScreenRoute screenCode="admin"><ConfiguracoesAcesso /></ScreenRoute>} />
            <Route path="/dashboard/relatorio-seguranca" element={<ScreenRoute screenCode="admin"><RelatorioSeguranca /></ScreenRoute>} />
            <Route path="/dashboard/relatorio-apis" element={<ScreenRoute screenCode="admin"><RelatorioAPIs /></ScreenRoute>} />
            <Route path="/dashboard/relatorio-desenvolvimento" element={<ScreenRoute screenCode="admin"><RelatorioDesenvolvimento /></ScreenRoute>} />
            <Route path="/dashboard/relatorio-ap-module" element={<ScreenRoute screenCode="admin"><RelatorioAPModule /></ScreenRoute>} />
            <Route path="/dashboard/integracao-erp" element={<ModuleRoute moduleCode="integracao_erp"><ScreenRoute screenCode="admin"><IntegracaoERP /></ScreenRoute></ModuleRoute>} />
            <Route path="/dashboard/fornecedores" element={<ScreenRoute screenCode="financeiro_fornecedores"><Fornecedores /></ScreenRoute>} />
            <Route path="/dashboard/pagamentos" element={<ScreenRoute screenCode="financeiro_pagamentos"><Pagamentos /></ScreenRoute>} />
            <Route path="/dashboard/empresas" element={<ScreenRoute screenCode="financeiro_empresas"><Empresas /></ScreenRoute>} />
            <Route path="/dashboard/centros-custo" element={<ScreenRoute screenCode="financeiro_centros_custo"><CentrosCusto /></ScreenRoute>} />
            <Route path="/dashboard/contas-pagar" element={<ScreenRoute screenCode="financeiro_contas_pagar_gestao"><ContasPagarGestao /></ScreenRoute>} />
            <Route path="/dashboard/bancos" element={<ScreenRoute screenCode="financeiro_contas_bancarias"><ContasBancarias /></ScreenRoute>} />
            
            {/* Portal do Cliente - Rotas isoladas */}
            <Route path="/portal" element={<ClienteProtectedRoute><PortalPrecos /></ClienteProtectedRoute>} />
            <Route path="/portal/precos" element={<ClienteProtectedRoute><PortalPrecos /></ClienteProtectedRoute>} />
            <Route path="/portal/perfil" element={<ClienteProtectedRoute><PortalPerfil /></ClienteProtectedRoute>} />

             {/* Consulta de Processos — protegido por módulo */}
             <Route path="/dashboard/processos/consulta" element={<ModuleRoute moduleCode="processos"><ConsultaProcessos /></ModuleRoute>} />
             <Route path="/dashboard/processos/etapas" element={<ModuleRoute moduleCode="processos"><ConfigEtapasProcesso /></ModuleRoute>} />
             <Route path="/dashboard/processos/workflows" element={<ModuleRoute moduleCode="processos"><ConfigDocWorkflows /></ModuleRoute>} />


            {/* Formulário público - sem autenticação */}
            <Route path="/formulario-equipe" element={<FormularioEquipe />} />
            <Route path="/cofre-share" element={<CofreSharePage />} />
            <Route path="/politica-privacidade" element={<PoliticaPrivacidade />} />
            <Route path="/termos-de-uso" element={<TermosDeUso />} />
            {/* Rotas públicas de relatório REMOVIDAS por segurança — usar /dashboard/relatorio-* */}

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
            <ThemeProvider>
            <PermissionsProvider>
              <ImpersonationProvider>
                <EmpresaProvider>
                <MeetingRecordingProvider>
                <TourProvider>
                  <TooltipProvider delayDuration={0}>
                    <Toaster />
                    <Sonner />
                    <AppContent />
                  </TooltipProvider>
                </TourProvider>
                </MeetingRecordingProvider>
                </EmpresaProvider>
              </ImpersonationProvider>
            </PermissionsProvider>
            </ThemeProvider>
          </AuthProvider>
          </LanguageProvider>
        </PWAProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
