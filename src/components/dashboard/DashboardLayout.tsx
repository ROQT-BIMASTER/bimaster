import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Session } from "@supabase/supabase-js";
import logoUnion from "@/assets/logo-union.png";
import { NotificationBell } from "@/components/notifications/NotificationBell";

interface DashboardLayoutProps {
  children: ReactNode;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUserStatus = async (session: Session | null) => {
      if (!session) {
        navigate("/auth/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("aprovado")
        .eq("id", session.user.id)
        .maybeSingle();

      if (profile && !profile.aprovado) {
        navigate("/aguardando-aprovacao");
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
        navigate("/auth/login");
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
          <div className="p-6">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
};
