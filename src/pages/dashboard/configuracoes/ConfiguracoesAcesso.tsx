import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, UserCheck, Building2 } from "lucide-react";
import VincularVendedor from "@/components/configuracoes-acesso/VincularVendedor";
import VincularSupervisor from "@/components/configuracoes-acesso/VincularSupervisor";
import AcessoEmpresa from "@/components/configuracoes-acesso/AcessoEmpresa";

const ConfiguracoesAcesso = () => {
  const { isAdmin, loading } = useUserRole();

  if (loading) return <div className="flex items-center justify-center h-64"><span className="text-muted-foreground">Carregando...</span></div>;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações de Acesso</h1>
        <p className="text-muted-foreground">Vincule usuários do sistema a vendedores, supervisores e empresas para controlar o acesso aos dados.</p>
      </div>

      <Tabs defaultValue="vendedores" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="vendedores" className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Vendedores
          </TabsTrigger>
          <TabsTrigger value="supervisores" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Supervisores
          </TabsTrigger>
          <TabsTrigger value="empresas" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Empresas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vendedores" className="mt-6">
          <VincularVendedor />
        </TabsContent>
        <TabsContent value="supervisores" className="mt-6">
          <VincularSupervisor />
        </TabsContent>
        <TabsContent value="empresas" className="mt-6">
          <AcessoEmpresa />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ConfiguracoesAcesso;
