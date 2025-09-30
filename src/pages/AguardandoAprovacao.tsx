import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, LogOut } from "lucide-react";
import logoUnion from "@/assets/logo-union.png";

const AguardandoAprovacao = () => {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string>("");

  useEffect(() => {
    const checkApprovalStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth/login");
        return;
      }

      setUserEmail(user.email || "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("aprovado")
        .eq("id", user.id)
        .single();

      if (profile?.aprovado) {
        navigate("/dashboard");
      }
    };

    checkApprovalStatus();

    // Verificar status a cada 5 segundos
    const interval = setInterval(checkApprovalStatus, 5000);

    return () => clearInterval(interval);
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <img src={logoUnion} alt="Union Logo" className="h-16 mx-auto" />
          <div className="space-y-2">
            <CardTitle className="text-2xl">Aguardando Aprovação</CardTitle>
            <CardDescription>
              Seu cadastro foi realizado com sucesso!
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center justify-center space-y-4 py-8">
            <div className="relative">
              <Clock className="h-16 w-16 text-primary animate-pulse" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Sua conta está em análise pelo administrador.
              </p>
              <p className="text-sm font-medium">
                {userEmail}
              </p>
              <p className="text-xs text-muted-foreground">
                Você receberá acesso assim que sua conta for aprovada.
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AguardandoAprovacao;
