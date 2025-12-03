import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { LogOut, User, FileText, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoUnion from "@/assets/logo-union.png";

export const ClienteHeader = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    const fetchUserInfo = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Buscar informações do profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("nome, email")
          .eq("id", user.id)
          .single();

        if (profile) {
          setUserName(profile.nome || profile.email || user.email || "");
        } else {
          setUserName(user.email || "");
        }
      }
    };

    fetchUserInfo();
  }, []);

  const handleLogout = async () => {
    try {
      // Registrar log de saída
      await supabase.rpc("registrar_acesso_portal", {
        p_acao: "logout",
        p_detalhes: {}
      });

      await supabase.auth.signOut();
      toast.success("Logout realizado com sucesso");
      navigate("/auth/login");
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      toast.error("Erro ao fazer logout");
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link to="/portal/precos" className="flex items-center gap-4">
            <img 
              src={logoUnion} 
              alt="Logo" 
              className="h-10 w-auto"
            />
            <div className="hidden md:block">
              <h1 className="text-lg font-semibold text-foreground">Portal do Cliente</h1>
            </div>
          </Link>
          
          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-4">
            <Link to="/portal/precos">
              <Button variant="ghost" size="sm" className="gap-2">
                <FileText className="h-4 w-4" />
                Tabelas de Preço
              </Button>
            </Link>
            <Link to="/portal/perfil">
              <Button variant="ghost" size="sm" className="gap-2">
                <UserCircle className="h-4 w-4" />
                Meu Perfil
              </Button>
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            <span>{userName}</span>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </div>
    </header>
  );
};
