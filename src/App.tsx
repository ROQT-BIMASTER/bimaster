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
import Planos from "./pages/Planos";
import AguardandoAprovacao from "./pages/AguardandoAprovacao";
import NotFound from "./pages/NotFound";

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
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/prospects" element={<Prospects />} />
          <Route path="/dashboard/municipios" element={<Municipios />} />
          <Route path="/dashboard/atividades" element={<Atividades />} />
          <Route path="/dashboard/kanban" element={<Kanban />} />
          <Route path="/dashboard/tarefas" element={<Tarefas />} />
          <Route path="/dashboard/mapa" element={<Mapa />} />
          <Route path="/dashboard/chat" element={<Chat />} />
          <Route path="/dashboard/planos" element={<Planos />} />
          <Route path="/dashboard/configuracoes" element={<Configuracoes />} />
          <Route path="/dashboard/importar" element={<ImportarClientes />} />
          <Route path="/dashboard/auditoria" element={<Auditoria />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
