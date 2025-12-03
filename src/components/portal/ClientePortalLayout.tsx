import { ReactNode, useEffect } from "react";
import { ClienteHeader } from "./ClienteHeader";
import { supabase } from "@/integrations/supabase/client";

interface ClientePortalLayoutProps {
  children: ReactNode;
}

export const ClientePortalLayout = ({ children }: ClientePortalLayoutProps) => {
  useEffect(() => {
    // Registrar acesso ao portal
    const registrarAcesso = async () => {
      try {
        await supabase.rpc("registrar_acesso_portal", {
          p_acao: "acesso_portal",
          p_detalhes: { pagina: window.location.pathname }
        });
      } catch (error) {
        console.error("Erro ao registrar acesso:", error);
      }
    };

    registrarAcesso();
  }, []);

  return (
    <div className="min-h-screen bg-muted/30">
      <ClienteHeader />
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
      <footer className="border-t py-4 mt-auto">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Union. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
};
