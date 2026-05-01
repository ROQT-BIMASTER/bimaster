import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import logoHuugs from "@/assets/logo-huugs.jpg";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { offlineManager } from "@/lib/utils/offline-manager";
import { useSyncOfflineData } from "@/hooks/useSyncOfflineData";
import { WifiOff, Wifi, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { OfflineIndicator } from "@/components/pwa/OfflineIndicator";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";
import { MfaGate } from "@/components/security/MfaGate";
import { ImpersonationSelector } from "@/components/admin/ImpersonationSelector";
import { EmpresaSelector } from "@/components/shared/EmpresaSelector";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { LanguageSelector } from "./LanguageSelector";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { CommandPalette, useCommandPalette } from "@/components/navigation/CommandPalette";
import { Search } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useInactivityTimeout } from "@/hooks/useInactivityTimeout";
import { InactivityModal } from "@/components/auth/InactivityModal";
import { usePageTracking } from "@/hooks/usePageTracking";
import { TermsAcceptanceModal } from "@/components/auth/TermsAcceptanceModal";
import { FloatingRecordingBar } from "@/components/meetings/FloatingRecordingBar";
import { useInboxDrawer } from "@/contexts/InboxDrawerContext";

/** Atalho global "i" para abrir a Caixa de Entrada */
function InboxKeyboardShortcut() {
  const { toggleDrawer } = useInboxDrawer();
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === "i" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        toggleDrawer();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleDrawer]);
  return null;
}

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
  const { open: cmdOpen, setOpen: setCmdOpen } = useCommandPalette();
  const queryClient = useQueryClient();
  const [refreshingMenu, setRefreshingMenu] = useState(false);

  const handleRefreshMenu = async () => {
    setRefreshingMenu(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sidebar-menu-items"] }),
        queryClient.invalidateQueries({ queryKey: ["sidebar-config"] }),
      ]);
      toast.success(t("menu.refreshed") || "Menu atualizado");
    } catch {
      toast.error("Falha ao atualizar o menu");
    } finally {
      setTimeout(() => setRefreshingMenu(false), 600);
    }
  };

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
      <InboxKeyboardShortcut />
      {/* Banner de impersonação - sempre visível no topo */}
      <ImpersonationBanner />
      <MfaGate />
      
      <div className={cn("min-h-screen flex w-full", isImpersonating && "pt-12")} dir={dir}>
        <AppSidebar side={isRTL ? "right" : "left"} />
        <main
          className="flex-1 min-w-0"
          style={{ ["--app-header-height" as any]: "52px" }}
        >
          <header className="sticky top-0 z-30 h-[var(--app-header-height)] border-b border-border flex items-center justify-between px-2 sm:px-4 bg-card">
            <div className="flex items-center gap-2 sm:gap-4">
              <SidebarTrigger aria-label="Alternar menu lateral" />
              <h1 className="hidden sm:block text-[20px] font-bold text-foreground">{t("system.title")}</h1>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-3">
              <button
                onClick={() => setCmdOpen(true)}
                className="inline-flex items-center justify-center rounded-md border border-border bg-muted/50 p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Busca global (⌘K)"
                title="Busca global (⌘K)"
              >
                <Search className="h-4 w-4" />
              </button>
              <button
                onClick={handleRefreshMenu}
                disabled={refreshingMenu}
                className="inline-flex items-center justify-center rounded-md border border-border bg-muted/50 p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-60"
                aria-label="Atualizar menu"
                title="Atualizar menu"
              >
                <RefreshCw className={cn("h-4 w-4", refreshingMenu && "animate-spin")} />
              </button>
              <EmpresaSelector compact />
              <span className="hidden sm:inline-flex"><LanguageSelector /></span>
              <span className="hidden sm:inline-flex"><ImpersonationSelector /></span>
              <NotificationBell />
              <img src={logoHuugs} alt="Huugs MakeUp" className="h-8 sm:h-10" />
            </div>
          </header>
          <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
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
