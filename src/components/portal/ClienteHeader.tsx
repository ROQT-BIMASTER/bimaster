import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { LogOut, User, FileText, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoUnion from "@/assets/logo-union.png";
import { useLanguage } from "@/contexts/LanguageContext";

export const ClienteHeader = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    const fetchUserInfo = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
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
      await supabase.rpc("registrar_acesso_portal", {
        p_acao: "logout",
        p_detalhes: {}
      });

      await supabase.auth.signOut();
      toast.success(t("portal.logout_success"));
      navigate("/auth/login");
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      toast.error(t("portal.logout_error"));
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
              <h1 className="text-lg font-semibold text-foreground">{t("portal.title")}</h1>
            </div>
          </Link>
          
          <nav className="hidden md:flex items-center gap-4">
            <Link to="/portal/precos">
              <Button variant="ghost" size="sm" className="gap-2">
                <FileText className="h-4 w-4" />
                {t("portal.price_tables")}
              </Button>
            </Link>
            <Link to="/portal/perfil">
              <Button variant="ghost" size="sm" className="gap-2">
                <UserCircle className="h-4 w-4" />
                {t("portal.my_profile")}
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
            <span className="hidden sm:inline">{t("portal.exit")}</span>
          </Button>
        </div>
      </div>
    </header>
  );
};
