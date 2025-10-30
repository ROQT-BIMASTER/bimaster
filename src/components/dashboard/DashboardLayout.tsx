import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Session } from "@supabase/supabase-js";
import logoUnion from "@/assets/logo-union.png";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { offlineManager } from "@/lib/utils/offline-manager";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { WifiOff } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DashboardLayoutProps {
  children: ReactNode;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const isOnline = useOnlineStatus();

  useEffect(() => {
    const checkUserStatus = async (session: Session | null) => {
      if (!session) {
        // Se offline e há cache, não redirecionar
        if (!isOnline && offlineManager.hasCachedSession()) {
          return;
        }
        navigate("/auth/login");
        return;
      }

      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("aprovado")
          .eq("id", session.user.id)
          .maybeSingle();

        if (profile && !profile.aprovado) {
          navigate("/aguardando-aprovacao");
        } else if (profile?.aprovado) {
          localStorage.setItem('user_approved_cache', 'true');
        }
      } catch (error) {
        // Se offline, usar cache de aprovação
        if (!isOnline && localStorage.getItem('user_approved_cache') !== 'true') {
          navigate("/aguardando-aprovacao");
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      if (session) {
        await checkUserStatus(session);
      } else {
        navigate("/auth/login");
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session) {
        await checkUserStatus(session);
      } else {
        // Se offline e há cache, não redirecionar
        if (!isOnline && offlineManager.hasCachedSession()) {
          // Criar sessão mock para modo offline
          setSession({ user: { id: 'offline' } } as Session);
        } else {
          navigate("/auth/login");
        }
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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
              <SidebarTrigger />
              <h1 className="text-lg font-semibold">CRM - Gestão de Prospects</h1>
            </div>
            <div className="flex items-center gap-4">
              <NotificationBell />
              <img src={logoUnion} alt="Union Logo" className="h-10" />
            </div>
          </header>
          {!isOnline && (
            <Alert className="m-4 border-warning bg-warning/10">
              <WifiOff className="h-4 w-4" />
              <AlertDescription>
                Você está offline. Algumas funcionalidades podem estar limitadas. Os dados serão sincronizados quando você voltar online.
              </AlertDescription>
            </Alert>
          )}
          <div className="p-6">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
};
