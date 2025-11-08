import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { memoryManager } from "@/lib/utils/memory-manager";
import { useSyncOfflineData } from "@/hooks/useSyncOfflineData";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import ProspectsModule from "./pages/modules/ProspectsModule";
import Prospects from "./pages/Prospects";
import Municipios from "./pages/Municipios";
import Atividades from "./pages/Atividades";
import Configuracoes from "./pages/Configuracoes";
import ImportarClientes from "./pages/ImportarClientes";
import Auditoria from "./pages/Auditoria";
import Kanban from "./pages/Kanban";
import Tarefas from "./pages/Tarefas";
import Mapa from "./pages/Mapa";
import Chat from "./pages/Chat";
import AguardandoAprovacao from "./pages/AguardandoAprovacao";
import NotFound from "./pages/NotFound";
import TradeModule from "./pages/modules/TradeModule";
import TradeStores from "./pages/TradeStores";
import TradeVisits from "./pages/TradeVisits";
import TradePhotos from "./pages/TradePhotos";
import TradeInsights from "./pages/TradeInsights";
import TradeCompetitors from "./pages/TradeCompetitors";
import TradePromotions from "./pages/TradePromotions";
import TradeImportStores from "./pages/TradeImportStores";
import TradeCalendar from "./pages/TradeCalendar";
import TradeIdealPhotos from "./pages/TradeIdealPhotos";
import TradeAuditorias from "./pages/TradeAuditorias";
import TradeRelatorioCompetitivo from "./pages/TradeRelatorioCompetitivo";
import TradeComparacaoProdutos from "./pages/TradeComparacaoProdutos";
import TradeSellOut from "./pages/TradeSellOut";
import TradeShelfMeasurements from "./pages/TradeShelfMeasurements";
import TradeMeasurementGuide from "./pages/TradeMeasurementGuide";
import TradeOurBrands from "./pages/TradeOurBrands";
import Ranking from "./pages/Ranking";
import TradeFinanceiro from "./pages/TradeFinanceiro";
import TradeContasCorrentes from "./pages/TradeContasCorrentes";
import TradeExtratoBancario from "./pages/TradeExtratoBancario";
import TradeVerbasSemestrais from "./pages/TradeVerbasSemestrais";
import TradeLancamentos from "./pages/TradeLancamentos";
import TradeAprovacoes from "./pages/TradeAprovacoes";
import TradeExtratosPessoais from "./pages/TradeExtratosPessoais";
import TradeCampaigns from "./pages/TradeCampaigns";
import TradePerformance from "./pages/TradePerformance";
import TradeTeamPerformance from "./pages/TradeTeamPerformance";
import TradeRewards from "./pages/TradeRewards";
import Relatorios from "./pages/Relatorios";
import InstalarApp from "./pages/InstalarApp";

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
  // Hook para sincronizar dados offline quando voltar online
  useSyncOfflineData();

  useEffect(() => {
    // Inicializar gerenciador de memória
    console.log('🚀 Memory Manager inicializado');
    
    return () => {
      memoryManager.destroy();
    };
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth/login" element={<Auth />} />
        <Route path="/auth/signup" element={<Auth />} />
        <Route path="/aguardando-aprovacao" element={<AguardandoAprovacao />} />
        
        {/* Protected Routes */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/dashboard/relatorios" element={<ProtectedRoute><Relatorios /></ProtectedRoute>} />
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
        
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </QueryClientProvider>
  );
};

export default App;
