import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import logoHuugs from "@/assets/logo-huugs.jpg";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { offlineManager } from "@/lib/utils/offline-manager";
import { useSyncOfflineData } from "@/hooks/useSyncOfflineData";
import { WifiOff, Wifi } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { OfflineIndicator } from "@/components/pwa/OfflineIndicator";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";
import { ImpersonationSelector } from "@/components/admin/ImpersonationSelector";
import { EmpresaSelector } from "@/components/shared/EmpresaSelector";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { LanguageSelector } from "./LanguageSelector";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useInactivityTimeout } from "@/hooks/useInactivityTimeout";
import { InactivityModal } from "@/components/auth/InactivityModal";
import { usePageTracking } from "@/hooks/usePageTracking";
import { TermsAcceptanceModal } from "@/components/auth/TermsAcceptanceModal";
import { FloatingRecordingBar } from "@/components/meetings/FloatingRecordingBar";

interface DashboardLayoutProps {
  children: ReactNode;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const { session, approved, loading, isOnline } = useAuth();
  const { isImpersonating } = useImpersonation();
  const { t, dir } = useLanguage();
  const isRTL = dir === "rtl";
  useSyncOfflineData();
  usePageTracking();
  const { showWarning, secondsLeft, resetTimer } = useInactivityTimeout();
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
        <div className="text-lg">{t("loading")}</div>
      </div>
    );
  }

  if (!session) {
    // Don't return null - show loading to prevent white screen flash
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">{t("loading")}</div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      {/* Banner de impersonação - sempre visível no topo */}
      <ImpersonationBanner />
      
      <div className={cn("min-h-screen flex w-full", isImpersonating && "pt-12")} dir={dir}>
        <AppSidebar side={isRTL ? "right" : "left"} />
        <main className="flex-1">
          <header className="h-[52px] border-b border-border flex items-center justify-between px-2 sm:px-4 bg-card">
            <div className="flex items-center gap-2 sm:gap-4">
              <SidebarTrigger aria-label="Alternar menu lateral" />
              <h1 className="hidden sm:block text-[20px] font-bold text-foreground">{t("system.title")}</h1>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-3">
              <EmpresaSelector compact />
              <span className="hidden sm:inline-flex"><LanguageSelector /></span>
              <span className="hidden sm:inline-flex"><ImpersonationSelector /></span>
              <NotificationBell />
              <img src={logoHuugs} alt="Huugs MakeUp" className="h-8 sm:h-10" />
            </div>
          </header>
          {connectionQuality === 'offline' && (
            <Alert className="m-4 border-destructive bg-destructive/10">
              <WifiOff className="h-4 w-4" />
              <AlertDescription>
                {t("offline.message")}
              </AlertDescription>
            </Alert>
          )}
          {connectionQuality === 'poor' && (
            <Alert className="m-4 border-warning bg-warning/10">
              <Wifi className="h-4 w-4" />
              <AlertDescription>
                {t("offline.poor")}
              </AlertDescription>
            </Alert>
          )}
          <div className="p-4 sm:p-6 relative min-h-[calc(100vh-52px)] overflow-x-auto">
            <ErrorBoundary>
              <div className="relative z-10">{children}</div>
            </ErrorBoundary>
            <TermsAcceptanceModal />
          </div>
        </main>
        
        {/* Indicador de status offline */}
        <OfflineIndicator />
        
        {/* Barra flutuante de gravação */}
        <FloatingRecordingBar />
        
        {/* Modal de inatividade */}
        <InactivityModal
          open={showWarning}
          secondsLeft={secondsLeft}
          onContinue={resetTimer}
        />
      </div>
    </SidebarProvider>
  );
};
