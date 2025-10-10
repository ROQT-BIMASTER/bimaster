import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import TradeFinanceiro from "./pages/TradeFinanceiro";
import TradeIdealPhotos from "./pages/TradeIdealPhotos";
import TradeAuditorias from "./pages/TradeAuditorias";
import Ranking from "./pages/Ranking";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth/login" element={<Auth />} />
        <Route path="/auth/signup" element={<Auth />} />
        <Route path="/aguardando-aprovacao" element={<AguardandoAprovacao />} />
        <Route path="/dashboard/aguardando-aprovacao" element={<AguardandoAprovacao />} />
        <Route path="/dashboard" element={<Dashboard />} />
        
        {/* Módulo de Prospects */}
        <Route path="/dashboard/prospects" element={<ProspectsModule />} />
        <Route path="/dashboard/prospects/list" element={<Prospects />} />
        <Route path="/dashboard/prospects/kanban" element={<Kanban />} />
        <Route path="/dashboard/prospects/atividades" element={<Atividades />} />
        <Route path="/dashboard/prospects/mapa" element={<Mapa />} />
        
        {/* Outras funcionalidades */}
        <Route path="/dashboard/municipios" element={<Municipios />} />
        <Route path="/dashboard/ranking" element={<Ranking />} />
        <Route path="/dashboard/tarefas" element={<Tarefas />} />
        <Route path="/dashboard/chat" element={<Chat />} />
        <Route path="/dashboard/configuracoes" element={<Configuracoes />} />
        <Route path="/dashboard/importar-clientes" element={<ImportarClientes />} />
        <Route path="/dashboard/auditoria" element={<Auditoria />} />
        
        {/* Módulo de Trade Marketing */}
        <Route path="/dashboard/trade" element={<TradeModule />} />
        <Route path="/dashboard/trade/stores" element={<TradeStores />} />
        <Route path="/dashboard/trade/visits" element={<TradeVisits />} />
        <Route path="/dashboard/trade/photos" element={<TradePhotos />} />
        <Route path="/dashboard/trade/competitors" element={<TradeCompetitors />} />
        <Route path="/dashboard/trade/promotions" element={<TradePromotions />} />
        <Route path="/dashboard/trade/insights" element={<TradeInsights />} />
        <Route path="/dashboard/trade/import-stores" element={<TradeImportStores />} />
        <Route path="/dashboard/trade/calendar" element={<TradeCalendar />} />
        <Route path="/dashboard/trade/financeiro" element={<TradeFinanceiro />} />
        <Route path="/dashboard/trade/ideal-photos" element={<TradeIdealPhotos />} />
        <Route path="/dashboard/trade/auditorias" element={<TradeAuditorias />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
