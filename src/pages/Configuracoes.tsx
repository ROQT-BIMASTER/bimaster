import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { MunicipioAtribuicao } from "@/components/admin/MunicipioAtribuicao";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EditarPerfil } from "@/components/configuracoes/EditarPerfil";
import { GerenciamentoUsuarios } from "@/components/configuracoes/GerenciamentoUsuarios";
import { ConfiguracoesNotificacoes } from "@/components/configuracoes/ConfiguracoesNotificacoes";

interface Profile {
  id: string;
  nome: string;
  email: string;
  tipo_usuario: string;
  status: string;
  telefone?: string;
  cargo?: string;
  departamento?: string;
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
        description: "Não foi possível carregar o perfil",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    try {
      if (!profile?.email) return;

      const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) throw error;

      toast({
        title: "Email enviado",
        description: "Verifique seu email para redefinir sua senha",
      });
    } catch (error) {
      console.error("Erro ao enviar email:", error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar o email de redefinição",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-8">Carregando...</div>
      </DashboardLayout>
    );
  }

  const handleUpdateProfile = (updatedProfile: Profile) => {
    setProfile(updatedProfile);
  };

  const isAdmin = profile?.tipo_usuario === 'admin';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Configurações</h2>
          <p className="text-muted-foreground">
            {isAdmin ? "Gerencie o sistema e suas informações" : "Gerencie suas informações pessoais"}
          </p>
        </div>

        {isAdmin ? (
          <Tabs defaultValue="perfil" className="space-y-4">
            <TabsList>
              <TabsTrigger value="perfil">Meu Perfil</TabsTrigger>
              <TabsTrigger value="usuarios">Gerenciar Usuários</TabsTrigger>
              <TabsTrigger value="notificacoes">Notificações</TabsTrigger>
              <TabsTrigger value="municipios">Atribuir Municípios</TabsTrigger>
            </TabsList>

            <TabsContent value="perfil" className="space-y-4">
              <EditarPerfil profile={profile!} onUpdate={handleUpdateProfile} />

              <Card>
                <CardHeader>
                  <CardTitle>Segurança</CardTitle>
                  <CardDescription>Gerencie sua senha e segurança da conta</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={handleResetPassword}>
                    Redefinir Senha
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="usuarios">
              <GerenciamentoUsuarios />
            </TabsContent>

            <TabsContent value="notificacoes">
              <ConfiguracoesNotificacoes />
            </TabsContent>

            <TabsContent value="municipios">
              <MunicipioAtribuicao />
            </TabsContent>
          </Tabs>
        ) : (
          <Tabs defaultValue="perfil" className="space-y-4">
            <TabsList>
              <TabsTrigger value="perfil">Meu Perfil</TabsTrigger>
              <TabsTrigger value="notificacoes">Notificações</TabsTrigger>
            </TabsList>

            <TabsContent value="perfil" className="space-y-4">
              <EditarPerfil profile={profile!} onUpdate={handleUpdateProfile} />

              <Card>
                <CardHeader>
                  <CardTitle>Segurança</CardTitle>
                  <CardDescription>Gerencie sua senha e segurança da conta</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={handleResetPassword}>
                    Redefinir Senha
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notificacoes">
              <ConfiguracoesNotificacoes />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Configuracoes;
