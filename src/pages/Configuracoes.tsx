import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, UserCog, User, CheckCircle, Lock, Activity, Loader2 } from "lucide-react";
import { lazy, Suspense } from "react";

// Lazy load all configuration components
const MunicipioAtribuicao = lazy(() => import("@/components/admin/MunicipioAtribuicao").then(m => ({ default: m.MunicipioAtribuicao })));
const EditarPerfil = lazy(() => import("@/components/configuracoes/EditarPerfil").then(m => ({ default: m.EditarPerfil })));
const GerenciamentoUsuarios = lazy(() => import("@/components/configuracoes/GerenciamentoUsuarios").then(m => ({ default: m.GerenciamentoUsuarios })));
const ConfiguracoesNotificacoes = lazy(() => import("@/components/configuracoes/ConfiguracoesNotificacoes").then(m => ({ default: m.ConfiguracoesNotificacoes })));
const PermissoesDeAcesso = lazy(() => import("@/components/configuracoes/PermissoesDeAcesso").then(m => ({ default: m.PermissoesDeAcesso })));
const GerenciamentoPermissoesTelas = lazy(() => import("@/components/configuracoes/GerenciamentoPermissoesTelas").then(m => ({ default: m.GerenciamentoPermissoesTelas })));
const GerenciamentoPermissoesModulos = lazy(() => import("@/components/configuracoes/GerenciamentoPermissoesModulos").then(m => ({ default: m.GerenciamentoPermissoesModulos })));
const GerenciadorOrdemModulos = lazy(() => import("@/components/configuracoes/GerenciadorOrdemModulos").then(m => ({ default: m.GerenciadorOrdemModulos })));
const VinculacaoUsuarioProspects = lazy(() => import("@/components/configuracoes/VinculacaoUsuarioProspects").then(m => ({ default: m.VinculacaoUsuarioProspects })));
const GerenciamentoIntegracoes = lazy(() => import("@/components/configuracoes/GerenciamentoIntegracoes").then(m => ({ default: m.GerenciamentoIntegracoes })));
const DocumentacaoAPI = lazy(() => import("@/components/configuracoes/DocumentacaoAPI").then(m => ({ default: m.DocumentacaoAPI })));
const AtribuirVendedorSupervisor = lazy(() => import("@/components/configuracoes/AtribuirVendedorSupervisor").then(m => ({ default: m.AtribuirVendedorSupervisor })));
const HierarquiaUsuarios = lazy(() => import("@/components/configuracoes/HierarquiaUsuarios").then(m => ({ default: m.HierarquiaUsuarios })));
const GerenciamentoPontuacao = lazy(() => import("@/components/configuracoes/GerenciamentoPontuacao").then(m => ({ default: m.GerenciamentoPontuacao })));
const GerenciamentoPremiacoes = lazy(() => import("@/components/configuracoes/GerenciamentoPremiacoes").then(m => ({ default: m.GerenciamentoPremiacoes })));
const VincularWhatsApp = lazy(() => import("@/components/configuracoes/VincularWhatsApp").then(m => ({ default: m.VincularWhatsApp })));
const PersonalizarCores = lazy(() => import("@/components/configuracoes/PersonalizarCores").then(m => ({ default: m.PersonalizarCores })));
const AdminPasswordDialog = lazy(() => import("@/components/configuracoes/AdminPasswordDialog").then(m => ({ default: m.AdminPasswordDialog })));
const GerenciamentoCNPJ = lazy(() => import("@/components/configuracoes/GerenciamentoCNPJ").then(m => ({ default: m.GerenciamentoCNPJ })));
const GerenciamentoDepartamentos = lazy(() => import("@/components/configuracoes/GerenciamentoDepartamentos").then(m => ({ default: m.GerenciamentoDepartamentos })));
const GerenciamentoPermissoesDepartamentos = lazy(() => import("@/components/configuracoes/GerenciamentoPermissoesDepartamentos").then(m => ({ default: m.GerenciamentoPermissoesDepartamentos })));
const AtribuirDepartamentoUsuario = lazy(() => import("@/components/configuracoes/AtribuirDepartamentoUsuario").then(m => ({ default: m.AtribuirDepartamentoUsuario })));
const ConfiguracoesCobrancaAutomatica = lazy(() => import("@/components/configuracoes/ConfiguracoesCobrancaAutomatica").then(m => ({ default: m.ConfiguracoesCobrancaAutomatica })));

const LoadingFallback = () => (
  <div className="flex items-center justify-center py-8">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

interface Profile {
  id: string;
  nome: string;
  email: string;
  status: string;
  telefone?: string;
  cargo?: string;
  departamento?: string;
}

const Configuracoes = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [outrasOpcoesUnlocked, setOutrasOpcoesUnlocked] = useState(false);
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

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      setUserRole(roleData?.role || null);
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

  const handleOutrasOpcoesClick = () => {
    if (userRole === "admin") {
      setShowPasswordDialog(true);
    } else {
      toast({
        title: "Acesso negado",
        description: "Apenas administradores podem acessar esta seção",
        variant: "destructive",
      });
    }
  };

  const handleUpdateProfile = (updatedProfile: Profile) => {
    setProfile(updatedProfile);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  const isAdmin = userRole === 'admin';
  const isSupervisor = userRole === 'supervisor';

  const getTipoUsuarioLabel = () => {
    switch (userRole) {
      case 'admin': return 'Administrador';
      case 'supervisor': return 'Supervisor';
      case 'vendedor': return 'Vendedor';
      default: return 'Usuário';
    }
  };

  const getTipoUsuarioIcon = () => {
    switch (userRole) {
      case 'admin': return <Shield className="w-4 h-4" />;
      case 'supervisor': return <UserCog className="w-4 h-4" />;
      default: return <User className="w-4 h-4" />;
    }
  };

  const getTipoUsuarioVariant = (): "default" | "secondary" | "outline" => {
    switch (userRole) {
      case 'admin': return 'default';
      case 'supervisor': return 'secondary';
      default: return 'outline';
    }
  };

  const getPermissoes = () => {
    if (isAdmin) {
      return [
        'Gerenciar todos os usuários',
        'Atribuir municípios aos vendedores',
        'Visualizar todas as atividades',
        'Gerenciar prospects de todos os vendedores',
        'Acesso total ao sistema'
      ];
    } else if (isSupervisor) {
      return [
        'Visualizar atividades da equipe',
        'Gerenciar prospects da equipe',
        'Visualizar relatórios de vendas',
        'Acompanhar métricas de desempenho'
      ];
    }
    return [
      'Gerenciar seus próprios prospects',
      'Registrar suas atividades',
      'Visualizar seus relatórios',
      'Atualizar seu perfil'
    ];
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Configurações</h2>
            <p className="text-muted-foreground">
              {isAdmin ? "Gerencie o sistema e suas informações" : "Gerencie suas informações pessoais"}
            </p>
          </div>
          <Badge variant={getTipoUsuarioVariant()} className="flex items-center gap-2 px-4 py-2">
            {getTipoUsuarioIcon()}
            <span className="font-semibold">{getTipoUsuarioLabel()}</span>
          </Badge>
        </div>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Informações da Conta
            </CardTitle>
            <CardDescription>Detalhes sobre seu perfil e permissões no sistema</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tipo de Usuário</p>
                <p className="text-lg font-semibold">{getTipoUsuarioLabel()}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge variant={profile?.status === 'ativo' ? 'default' : 'secondary'}>
                  {profile?.status === 'ativo' ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
            </div>
            
            <div className="pt-4 border-t">
              <p className="text-sm font-medium mb-3">Permissões do seu perfil:</p>
              <div className="space-y-2">
                {getPermissoes().map((permissao, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 mt-0.5 text-primary" />
                    <span className="text-sm text-muted-foreground">{permissao}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {isAdmin || isSupervisor ? (
          <Tabs defaultValue="perfil" className="space-y-4">
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="perfil">Meu Perfil</TabsTrigger>
              {isAdmin && <TabsTrigger value="usuarios">Gerenciar Usuários</TabsTrigger>}
              {isAdmin && <TabsTrigger value="hierarquia">Hierarquia</TabsTrigger>}
              {isAdmin && <TabsTrigger value="vendedores">Vendedores/Supervisores</TabsTrigger>}
              <TabsTrigger value="notificacoes">Notificações</TabsTrigger>
              <TabsTrigger value="personalizacao">Personalização</TabsTrigger>
              {isAdmin && <TabsTrigger value="permissoes">Permissões</TabsTrigger>}
              {isAdmin && <TabsTrigger value="cnpj">Gerenciar CNPJs</TabsTrigger>}
              {isAdmin && <TabsTrigger value="pontuacao">Pontuação</TabsTrigger>}
              {isAdmin && <TabsTrigger value="premiacoes">Premiações</TabsTrigger>}
              {isAdmin && <TabsTrigger value="departamentos">Departamentos</TabsTrigger>}
              {isAdmin && <TabsTrigger value="cobranca">Cobrança Auto</TabsTrigger>}
              {isAdmin && <TabsTrigger value="municipios">Atribuir Municípios</TabsTrigger>}
              {isAdmin && (
                <TabsTrigger 
                  value="outras-opcoes" 
                  className="flex items-center gap-2"
                  disabled={!outrasOpcoesUnlocked}
                  onClick={(e) => {
                    if (!outrasOpcoesUnlocked) {
                      e.preventDefault();
                      handleOutrasOpcoesClick();
                    }
                  }}
                >
                  <Lock className="h-4 w-4" />
                  Outras opções
                  {outrasOpcoesUnlocked && <CheckCircle className="h-3 w-3 text-green-500" />}
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="perfil" className="space-y-4">
              <Suspense fallback={<LoadingFallback />}>
                <EditarPerfil profile={profile!} onUpdate={handleUpdateProfile} />
              </Suspense>
              <Card>
                <CardHeader>
                  <CardTitle>Segurança</CardTitle>
                  <CardDescription>Gerencie sua senha e segurança da conta</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={handleResetPassword}>Redefinir Senha</Button>
                </CardContent>
              </Card>
            </TabsContent>

            {isAdmin && (
              <TabsContent value="usuarios">
                <Suspense fallback={<LoadingFallback />}>
                  <GerenciamentoUsuarios />
                </Suspense>
              </TabsContent>
            )}

            {isAdmin && (
              <TabsContent value="hierarquia">
                <Suspense fallback={<LoadingFallback />}>
                  <HierarquiaUsuarios />
                </Suspense>
              </TabsContent>
            )}

            {isAdmin && (
              <TabsContent value="vendedores">
                <Suspense fallback={<LoadingFallback />}>
                  <AtribuirVendedorSupervisor />
                </Suspense>
              </TabsContent>
            )}

            <TabsContent value="notificacoes" className="space-y-4">
              <Suspense fallback={<LoadingFallback />}>
                <ConfiguracoesNotificacoes />
                <VincularWhatsApp />
              </Suspense>
            </TabsContent>

            <TabsContent value="personalizacao">
              <Suspense fallback={<LoadingFallback />}>
                <PersonalizarCores />
              </Suspense>
            </TabsContent>

            {isAdmin && (
              <TabsContent value="permissoes" className="space-y-6">
                <Suspense fallback={<LoadingFallback />}>
                  <PermissoesDeAcesso />
                  <GerenciadorOrdemModulos />
                  <GerenciamentoPermissoesModulos />
                  <GerenciamentoPermissoesTelas />
                  <VinculacaoUsuarioProspects />
                </Suspense>
              </TabsContent>
            )}

            {isAdmin && (
              <TabsContent value="cnpj">
                <Suspense fallback={<LoadingFallback />}>
                  <GerenciamentoCNPJ />
                </Suspense>
              </TabsContent>
            )}

            {isAdmin && (
              <TabsContent value="pontuacao">
                <Suspense fallback={<LoadingFallback />}>
                  <GerenciamentoPontuacao />
                </Suspense>
              </TabsContent>
            )}

            {isAdmin && (
              <TabsContent value="premiacoes">
                <Suspense fallback={<LoadingFallback />}>
                  <GerenciamentoPremiacoes />
                </Suspense>
              </TabsContent>
            )}

            {isAdmin && (
              <TabsContent value="departamentos" className="space-y-6">
                <Suspense fallback={<LoadingFallback />}>
                  <GerenciamentoDepartamentos />
                  <GerenciamentoPermissoesDepartamentos />
                  <AtribuirDepartamentoUsuario />
                </Suspense>
              </TabsContent>
            )}

            {isAdmin && (
              <TabsContent value="cobranca">
                <Suspense fallback={<LoadingFallback />}>
                  <ConfiguracoesCobrancaAutomatica />
                </Suspense>
              </TabsContent>
            )}

            {isAdmin && (
              <TabsContent value="municipios">
                <Suspense fallback={<LoadingFallback />}>
                  <MunicipioAtribuicao />
                </Suspense>
              </TabsContent>
            )}

            {isAdmin && outrasOpcoesUnlocked && (
              <>
                <TabsContent value="outras-opcoes" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Configurações Avançadas
                      </CardTitle>
                      <CardDescription>
                        Área restrita para configurações avançadas do sistema
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </TabsContent>

                <TabsContent value="integracoes">
                  <Suspense fallback={<LoadingFallback />}>
                    <GerenciamentoIntegracoes />
                  </Suspense>
                </TabsContent>
                
                <TabsContent value="api">
                  <Suspense fallback={<LoadingFallback />}>
                    <DocumentacaoAPI />
                  </Suspense>
                </TabsContent>
                
                <TabsContent value="api-health">
                  <div>
                    <p className="text-muted-foreground mb-4">
                      Acesse a página de verificação de APIs para ver o status completo do sistema.
                    </p>
                    <Button 
                      onClick={() => window.location.href = '/dashboard/configuracoes/api-health'}
                      className="flex items-center gap-2"
                    >
                      <Activity className="h-4 w-4" />
                      Abrir Verificação de APIs
                    </Button>
                  </div>
                </TabsContent>
              </>
            )}
          </Tabs>
        ) : (
          <Tabs defaultValue="perfil" className="space-y-4">
            <TabsList>
              <TabsTrigger value="perfil">Meu Perfil</TabsTrigger>
              <TabsTrigger value="notificacoes">Notificações</TabsTrigger>
              <TabsTrigger value="personalizacao">Personalização</TabsTrigger>
            </TabsList>

            <TabsContent value="perfil" className="space-y-4">
              <Suspense fallback={<LoadingFallback />}>
                <EditarPerfil profile={profile!} onUpdate={handleUpdateProfile} />
              </Suspense>
              <Card>
                <CardHeader>
                  <CardTitle>Segurança</CardTitle>
                  <CardDescription>Gerencie sua senha e segurança da conta</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={handleResetPassword}>Redefinir Senha</Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notificacoes" className="space-y-4">
              <Suspense fallback={<LoadingFallback />}>
                <ConfiguracoesNotificacoes />
                <VincularWhatsApp />
              </Suspense>
            </TabsContent>

            <TabsContent value="personalizacao">
              <Suspense fallback={<LoadingFallback />}>
                <PersonalizarCores />
              </Suspense>
            </TabsContent>
          </Tabs>
        )}
      </div>

      <Suspense fallback={null}>
        <AdminPasswordDialog
          open={showPasswordDialog}
          onOpenChange={setShowPasswordDialog}
          onSuccess={() => setOutrasOpcoesUnlocked(true)}
        />
      </Suspense>
    </DashboardLayout>
  );
};

export default Configuracoes;
