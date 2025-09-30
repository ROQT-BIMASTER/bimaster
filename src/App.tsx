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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth/login" element={<Auth />} />
          <Route path="/auth/signup" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/prospects" element={<Prospects />} />
          <Route path="/dashboard/municipios" element={<Municipios />} />
          <Route path="/dashboard/atividades" element={<Atividades />} />
          <Route path="/dashboard/configuracoes" element={<Configuracoes />} />
          <Route path="/dashboard/importar" element={<ImportarClientes />} />
          <Route path="/dashboard/auditoria" element={<Auditoria />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
