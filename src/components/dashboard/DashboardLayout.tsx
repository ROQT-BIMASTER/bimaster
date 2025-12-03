import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import logoUnion from "@/assets/logo-union.png";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { offlineManager } from "@/lib/utils/offline-manager";
import { useSyncOfflineData } from "@/hooks/useSyncOfflineData";
import { WifiOff, Wifi } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";

interface DashboardLayoutProps {
  children: ReactNode;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const { session, approved, loading, isOnline } = useAuth();
  useSyncOfflineData(); // Sincronização automática quando online
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'poor' | 'offline'>('good');

  // Monitorar qualidade da conexão
  useEffect(() => {
    const checkQuality = () => {
      setConnectionQuality(offlineManager.getConnectionQuality());
    };

    checkQuality();
    const interval = setInterval(checkQuality, 5000); // Verificar a cada 5 segundos

    return () => clearInterval(interval);
  }, [isOnline]);

  // Redirecionar se necessário
  useEffect(() => {
    if (loading) return;

    if (!session) {
      // Se offline e há cache, não redirecionar
      if (!isOnline && offlineManager.hasCachedSession()) {
        return;
      }
      navigate("/auth/login");
      return;
    }

    if (!approved) {
      navigate("/aguardando-aprovacao");
    }
  }, [session, approved, loading, isOnline, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Carregando...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <main className="flex-1">
          <header className="h-14 border-b flex items-center justify-between px-4 bg-card">
            <div className="flex items-center gap-4">
              <SidebarTrigger aria-label="Alternar menu lateral" />
              <h1 className="text-lg font-semibold">CRM - Gestão de Prospects</h1>
            </div>
            <div className="flex items-center gap-4">
              <NotificationBell />
              <img src={logoUnion} alt="Logo Union - Sistema de Gestão BiMaster" className="h-10" />
            </div>
          </header>
          {connectionQuality === 'offline' && (
            <Alert className="m-4 border-destructive bg-destructive/10">
              <WifiOff className="h-4 w-4" />
              <AlertDescription>
                Você está offline. Algumas funcionalidades podem estar limitadas. Os dados serão sincronizados quando você voltar online.
              </AlertDescription>
            </Alert>
          )}
          {connectionQuality === 'poor' && (
            <Alert className="m-4 border-warning bg-warning/10">
              <Wifi className="h-4 w-4" />
              <AlertDescription>
                Conexão instável detectada. O aplicativo tentará reconectar automaticamente se houver falhas.
              </AlertDescription>
            </Alert>
          )}
          <div className="p-6">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
};
