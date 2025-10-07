import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
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
import TradeMarketing from "./pages/TradeMarketing";
import TradeStores from "./pages/TradeStores";
import TradeVisits from "./pages/TradeVisits";
import TradePhotos from "./pages/TradePhotos";
import TradeInsights from "./pages/TradeInsights";
import TradeCompetitors from "./pages/TradeCompetitors";
import TradePromotions from "./pages/TradePromotions";
import TradeImportStores from "./pages/TradeImportStores";

const queryClient = new QueryClient();

const App = () => {
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
          <Route path="/dashboard/aguardando-aprovacao" element={<AguardandoAprovacao />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/prospects" element={<Prospects />} />
          <Route path="/dashboard/municipios" element={<Municipios />} />
          <Route path="/dashboard/atividades" element={<Atividades />} />
          <Route path="/dashboard/kanban" element={<Kanban />} />
          <Route path="/dashboard/tarefas" element={<Tarefas />} />
          <Route path="/dashboard/mapa" element={<Mapa />} />
          <Route path="/dashboard/chat" element={<Chat />} />
          
          <Route path="/dashboard/configuracoes" element={<Configuracoes />} />
          <Route path="/dashboard/importar-clientes" element={<ImportarClientes />} />
          <Route path="/dashboard/auditoria" element={<Auditoria />} />
          <Route path="/dashboard/trade-marketing" element={<TradeMarketing />} />
          <Route path="/dashboard/trade-marketing/stores" element={<TradeStores />} />
          <Route path="/dashboard/trade-marketing/visits" element={<TradeVisits />} />
          <Route path="/dashboard/trade-marketing/photos" element={<TradePhotos />} />
          <Route path="/dashboard/trade-marketing/competitors" element={<TradeCompetitors />} />
          <Route path="/dashboard/trade-marketing/promotions" element={<TradePromotions />} />
          <Route path="/dashboard/trade-marketing/insights" element={<TradeInsights />} />
          <Route path="/dashboard/trade-marketing/import-stores" element={<TradeImportStores />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
