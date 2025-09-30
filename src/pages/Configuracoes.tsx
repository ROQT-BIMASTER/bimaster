import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface Profile {
  nome: string;
  email: string;
  tipo_usuario: string;
  status: string;
}

const Configuracoes = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error("Erro ao carregar perfil:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar seus dados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getTipoUsuarioBadge = (tipo: string) => {
    const tipoMap: { [key: string]: { label: string; variant: "default" | "secondary" | "outline" } } = {
      vendedor: { label: "Vendedor", variant: "default" },
      supervisor: { label: "Supervisor", variant: "secondary" },
      admin: { label: "Administrador", variant: "outline" },
    };

    const tipoInfo = tipoMap[tipo] || { label: tipo, variant: "outline" as const };
    return <Badge variant={tipoInfo.variant}>{tipoInfo.label}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Configurações</h2>
          <p className="text-muted-foreground">Gerencie suas informações de perfil</p>
        </div>

        {loading ? (
          <div className="text-center py-8">Carregando...</div>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Informações do Perfil</CardTitle>
                <CardDescription>Seus dados cadastrais no sistema</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={profile?.nome || ""} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={profile?.email || ""} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Usuário</Label>
                  <div className="pt-2">
                    {profile?.tipo_usuario && getTipoUsuarioBadge(profile.tipo_usuario)}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="pt-2">
                    <Badge variant={profile?.status === "ativo" ? "default" : "destructive"}>
                      {profile?.status === "ativo" ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Alterar Senha</CardTitle>
                <CardDescription>
                  Para alterar sua senha, você será redirecionado para o fluxo de recuperação
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  onClick={async () => {
                    const { error } = await supabase.auth.resetPasswordForEmail(profile?.email || "", {
                      redirectTo: `${window.location.origin}/dashboard`,
                    });
                    if (error) {
                      toast({
                        title: "Erro",
                        description: error.message,
                        variant: "destructive",
                      });
                    } else {
                      toast({
                        title: "Email enviado",
                        description: "Verifique seu email para redefinir a senha",
                      });
                    }
                  }}
                >
                  Solicitar alteração de senha
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Configuracoes;
