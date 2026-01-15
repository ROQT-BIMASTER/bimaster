import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldX, LogOut, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export default function UsuarioBloqueado() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    // Clear all caches
    localStorage.removeItem("user_approved_cache");
    localStorage.removeItem("user_active_cache");
    localStorage.removeItem("user_role_cache");
    
    await supabase.auth.signOut();
    navigate("/auth/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-4 bg-destructive/10 rounded-full w-fit">
            <ShieldX className="h-12 w-12 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Acesso Bloqueado</CardTitle>
          <CardDescription className="text-base">
            Seu acesso ao sistema foi temporariamente suspenso
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <p className="text-sm text-muted-foreground">
              Isso pode ter ocorrido por diversos motivos:
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>Sua conta foi desativada por um administrador</li>
              <li>Período de acesso expirado</li>
              <li>Violação dos termos de uso</li>
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <Button variant="outline" className="w-full" asChild>
              <a href="mailto:suporte@empresa.com">
                <Phone className="h-4 w-4 mr-2" />
                Entrar em Contato com Suporte
              </a>
            </Button>
            
            <Button 
              variant="ghost" 
              className="w-full text-muted-foreground"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair da Conta
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}