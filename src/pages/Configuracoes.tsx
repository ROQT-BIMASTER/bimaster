import { useEffect, useState, lazy, Suspense } from "react";
import { usePermissions } from "@/contexts/PermissionsContext";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Shield, UserCog, User, CheckCircle, Lock, Loader2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Eager imports — lightweight / always needed
import { EditarPerfil } from "@/components/configuracoes/EditarPerfil";
import { AdminPasswordDialog } from "@/components/configuracoes/AdminPasswordDialog";
import { MFASettings } from "@/components/configuracoes/MFASettings";

// Lazy imports — heavy components loaded on demand
const GerenciamentoUsuarios = lazy(() => import("@/components/configuracoes/GerenciamentoUsuarios").then(m => ({ default: m.GerenciamentoUsuarios })));
const HierarquiaUsuarios = lazy(() => import("@/components/configuracoes/HierarquiaUsuarios").then(m => ({ default: m.HierarquiaUsuarios })));
const AtribuirVendedorSupervisor = lazy(() => import("@/components/configuracoes/AtribuirVendedorSupervisor").then(m => ({ default: m.AtribuirVendedorSupervisor })));
const ConfiguracoesNotificacoes = lazy(() => import("@/components/configuracoes/ConfiguracoesNotificacoes").then(m => ({ default: m.ConfiguracoesNotificacoes })));
const VincularWhatsApp = lazy(() => import("@/components/configuracoes/VincularWhatsApp").then(m => ({ default: m.VincularWhatsApp })));
const ThemeSelector = lazy(() => import("@/components/theme/ThemeSelector").then(m => ({ default: m.ThemeSelector })));
const PersonalizarCores = lazy(() => import("@/components/configuracoes/PersonalizarCores").then(m => ({ default: m.PersonalizarCores })));
const PermissoesDeAcesso = lazy(() => import("@/components/configuracoes/PermissoesDeAcesso").then(m => ({ default: m.PermissoesDeAcesso })));
const GerenciamentoPermissoesTelas = lazy(() => import("@/components/configuracoes/GerenciamentoPermissoesTelas").then(m => ({ default: m.GerenciamentoPermissoesTelas })));
const GerenciamentoPermissoesModulos = lazy(() => import("@/components/configuracoes/GerenciamentoPermissoesModulos").then(m => ({ default: m.GerenciamentoPermissoesModulos })));
const GerenciadorOrdemModulos = lazy(() => import("@/components/configuracoes/GerenciadorOrdemModulos").then(m => ({ default: m.GerenciadorOrdemModulos })));
const VinculacaoUsuarioProspects = lazy(() => import("@/components/configuracoes/VinculacaoUsuarioProspects").then(m => ({ default: m.VinculacaoUsuarioProspects })));
const GerenciamentoIntegracoes = lazy(() => import("@/components/configuracoes/GerenciamentoIntegracoes").then(m => ({ default: m.GerenciamentoIntegracoes })));
const DocumentacaoAPI = lazy(() => import("@/components/configuracoes/DocumentacaoAPI").then(m => ({ default: m.DocumentacaoAPI })));
const GerenciamentoCNPJ = lazy(() => import("@/components/configuracoes/GerenciamentoCNPJ").then(m => ({ default: m.GerenciamentoCNPJ })));
const GerenciamentoEmpresas = lazy(() => import("@/components/configuracoes/GerenciamentoEmpresas").then(m => ({ default: m.GerenciamentoEmpresas })));
const GerenciamentoDepartamentos = lazy(() => import("@/components/configuracoes/GerenciamentoDepartamentos").then(m => ({ default: m.GerenciamentoDepartamentos })));
const GerenciamentoPermissoesDepartamentos = lazy(() => import("@/components/configuracoes/GerenciamentoPermissoesDepartamentos").then(m => ({ default: m.GerenciamentoPermissoesDepartamentos })));
const AtribuirDepartamentoUsuario = lazy(() => import("@/components/configuracoes/AtribuirDepartamentoUsuario").then(m => ({ default: m.AtribuirDepartamentoUsuario })));
const GerenciamentoPontuacao = lazy(() => import("@/components/configuracoes/GerenciamentoPontuacao").then(m => ({ default: m.GerenciamentoPontuacao })));
const GerenciamentoPremiacoes = lazy(() => import("@/components/configuracoes/GerenciamentoPremiacoes").then(m => ({ default: m.GerenciamentoPremiacoes })));
const ConfigurarCategoriasDRE = lazy(() => import("@/components/configuracoes/ConfigurarCategoriasDRE"));
const ConfiguracoesCobrancaAutomatica = lazy(() => import("@/components/configuracoes/ConfiguracoesCobrancaAutomatica").then(m => ({ default: m.ConfiguracoesCobrancaAutomatica })));
const CofreProdutoConfig = lazy(() => import("@/components/configuracoes/CofreProdutoConfig").then(m => ({ default: m.CofreProdutoConfig })));
const DocumentacaoIntegracaoERP = lazy(() => import("@/components/configuracoes/DocumentacaoIntegracaoERP").then(m => ({ default: m.DocumentacaoIntegracaoERP })));
const MonitoramentoAcessos = lazy(() => import("@/components/configuracoes/MonitoramentoAcessos").then(m => ({ default: m.MonitoramentoAcessos })));
const MunicipioAtribuicao = lazy(() => import("@/components/admin/MunicipioAtribuicao").then(m => ({ default: m.MunicipioAtribuicao })));
const GerenciamentoAPIKeys = lazy(() => import("@/components/configuracoes/GerenciamentoAPIKeys").then(m => ({ default: m.GerenciamentoAPIKeys })));
const MonitoramentoAPIs = lazy(() => import("@/components/configuracoes/MonitoramentoAPIs").then(m => ({ default: m.MonitoramentoAPIs })));
const StorageManagementPanel = lazy(() => import("@/components/admin/StorageManagementPanel"));
const DeptVisibilityControlPanel = lazy(() => import("@/components/admin/DeptVisibilityControlPanel"));
const GestaoPermissoesUnificada = lazy(() => import("@/components/admin/GestaoPermissoesUnificada"));

interface Profile {
  id: string;
  nome: string;
  email: string;
  status: string;
  telefone?: string;
  cargo?: string;
  departamento?: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
  adminOnly?: boolean;
  requiresUnlock?: boolean;
}

interface NavItem {
  key: string;
  label: string;
  adminOnly?: boolean;
}

const LazyFallback = () => (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

function Configuracoes() {
  const { role: permRole } = usePermissions();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("perfil");
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
      toast({ title: "Email enviado", description: "Verifique seu email para redefinir sua senha" });
    } catch (error) {
      console.error("Erro ao enviar email:", error);
      toast({ title: "Erro", description: "Não foi possível enviar o email de redefinição", variant: "destructive" });
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
      case 'gerente': return 'Gerente';
      case 'supervisor': return 'Supervisor';
      case 'vendedor': return 'Vendedor';
      default: return 'Usuário';
    }
  };

  const getTipoUsuarioIcon = () => {
    switch (userRole) {
      case 'admin': return <Shield className="w-4 h-4" />;
      case 'supervisor': case 'gerente': return <UserCog className="w-4 h-4" />;
      default: return <User className="w-4 h-4" />;
    }
  };

  const getTipoUsuarioVariant = (): "default" | "secondary" | "outline" => {
    switch (userRole) {
      case 'admin': return 'default';
      case 'supervisor': case 'gerente': return 'secondary';
      default: return 'outline';
    }
  };

  const navSections: NavSection[] = [
    {
      label: "Perfil",
      items: [
        { key: "perfil", label: "Meu Perfil" },
        { key: "notificacoes", label: "Notificações" },
        { key: "personalizacao", label: "Personalização" },
      ],
    },
    {
      label: "Usuários",
      adminOnly: true,
      items: [
        { key: "usuarios", label: "Gerenciar Usuários" },
        { key: "hierarquia", label: "Hierarquia" },
        { key: "vendedores", label: "Vendedores / Supervisores" },
        { key: "municipios", label: "Atribuir Municípios" },
      ],
    },
    {
      label: "Permissões",
      adminOnly: true,
      items: [
        { key: "permissoes-role", label: "Permissões por Role" },
        { key: "permissoes-modulos", label: "Permissões de Módulos" },
        { key: "permissoes-telas", label: "Permissões de Telas" },
        { key: "ordem-modulos", label: "Ordem dos Módulos" },
        { key: "prospects-vinculos", label: "Vínculos Prospects" },
      ],
    },
    {
      label: "Empresa",
      adminOnly: true,
      items: [
        { key: "cnpj", label: "Gerenciar CNPJs" },
        { key: "empresas", label: "Empresas / Filiais" },
        { key: "departamentos", label: "Departamentos" },
        { key: "categorias-dre", label: "Categorias DRE" },
      ],
    },
    {
      label: "Gamificação",
      adminOnly: true,
      items: [
        { key: "pontuacao", label: "Pontuação" },
        { key: "premiacoes", label: "Premiações" },
      ],
    },
    {
      label: "Financeiro",
      adminOnly: true,
      items: [
        { key: "cobranca", label: "Cobrança Automática" },
        { key: "cofre-produto", label: "Cofre do Produto" },
        { key: "integracao-erp", label: "Integração ERP" },
      ],
    },
    {
      label: "Avançado",
      adminOnly: true,
      requiresUnlock: true,
      items: [
        { key: "acessos", label: "Monitoramento Acessos" },
        { key: "api-keys", label: "API Keys" },
        { key: "integracoes", label: "Integrações" },
        { key: "api-docs", label: "Documentação API" },
        { key: "api-monitoring", label: "Monitoramento APIs" },
        { key: "storage", label: "Storage" },
        { key: "visibilidade", label: "Visibilidade Dept." },
        { key: "permissoes-ui", label: "Permissões UI" },
      ],
    },
  ];

  const visibleSections = navSections.filter(section => {
    if (section.adminOnly && !isAdmin) return false;
    if (section.requiresUnlock && !outrasOpcoesUnlocked) return false;
    return true;
  });

  const handleNavClick = (key: string, section: NavSection) => {
    if (section.requiresUnlock && !outrasOpcoesUnlocked) {
      setShowPasswordDialog(true);
      return;
    }
    setActiveSection(key);
  };

  const renderContent = () => {
    switch (activeSection) {
      case "perfil":
        return (
          <div className="space-y-4">
            <EditarPerfil profile={profile!} userRole={userRole} onUpdate={handleUpdateProfile} />
            <Card>
              <CardHeader>
                <CardTitle>Segurança</CardTitle>
                <CardDescription>Gerencie sua senha e segurança da conta</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleResetPassword}>Redefinir Senha</Button>
              </CardContent>
            </Card>
            <MFASettings />
          </div>
        );
      case "notificacoes":
        return <Suspense fallback={<LazyFallback />}><ConfiguracoesNotificacoes /><VincularWhatsApp /></Suspense>;
      case "personalizacao":
        return <Suspense fallback={<LazyFallback />}><ThemeSelector /><PersonalizarCores /></Suspense>;
      case "usuarios":
        return <Suspense fallback={<LazyFallback />}><GerenciamentoUsuarios /></Suspense>;
      case "hierarquia":
        return <Suspense fallback={<LazyFallback />}><HierarquiaUsuarios /></Suspense>;
      case "vendedores":
        return <Suspense fallback={<LazyFallback />}><AtribuirVendedorSupervisor /></Suspense>;
      case "municipios":
        return <Suspense fallback={<LazyFallback />}><MunicipioAtribuicao /></Suspense>;
      case "permissoes-role":
        return <Suspense fallback={<LazyFallback />}><PermissoesDeAcesso /></Suspense>;
      case "permissoes-modulos":
        return <Suspense fallback={<LazyFallback />}><GerenciamentoPermissoesModulos /></Suspense>;
      case "permissoes-telas":
        return <Suspense fallback={<LazyFallback />}><GerenciamentoPermissoesTelas /></Suspense>;
      case "ordem-modulos":
        return <Suspense fallback={<LazyFallback />}><GerenciadorOrdemModulos /></Suspense>;
      case "prospects-vinculos":
        return <Suspense fallback={<LazyFallback />}><VinculacaoUsuarioProspects /></Suspense>;
      case "cnpj":
        return <Suspense fallback={<LazyFallback />}><GerenciamentoCNPJ /></Suspense>;
      case "empresas":
        return <Suspense fallback={<LazyFallback />}><GerenciamentoEmpresas /></Suspense>;
      case "departamentos":
        return <Suspense fallback={<LazyFallback />}><GerenciamentoDepartamentos /><GerenciamentoPermissoesDepartamentos /><AtribuirDepartamentoUsuario /></Suspense>;
      case "categorias-dre":
        return <Suspense fallback={<LazyFallback />}><ConfigurarCategoriasDRE /></Suspense>;
      case "pontuacao":
        return <Suspense fallback={<LazyFallback />}><GerenciamentoPontuacao /></Suspense>;
      case "premiacoes":
        return <Suspense fallback={<LazyFallback />}><GerenciamentoPremiacoes /></Suspense>;
      case "cobranca":
        return <Suspense fallback={<LazyFallback />}><ConfiguracoesCobrancaAutomatica /></Suspense>;
      case "cofre-produto":
        return <Suspense fallback={<LazyFallback />}><CofreProdutoConfig /></Suspense>;
      case "integracao-erp":
        return <Suspense fallback={<LazyFallback />}><DocumentacaoIntegracaoERP /></Suspense>;
      case "acessos":
        return <Suspense fallback={<LazyFallback />}><MonitoramentoAcessos /></Suspense>;
      case "api-keys":
        return <Suspense fallback={<LazyFallback />}><GerenciamentoAPIKeys /></Suspense>;
      case "integracoes":
        return <Suspense fallback={<LazyFallback />}><GerenciamentoIntegracoes /></Suspense>;
      case "api-docs":
        return <Suspense fallback={<LazyFallback />}><DocumentacaoAPI /></Suspense>;
      case "api-monitoring":
        return <Suspense fallback={<LazyFallback />}><MonitoramentoAPIs /></Suspense>;
      case "storage":
        return <Suspense fallback={<LazyFallback />}><StorageManagementPanel /></Suspense>;
      case "visibilidade":
        return <Suspense fallback={<LazyFallback />}><DeptVisibilityControlPanel /></Suspense>;
      case "permissoes-ui":
        return <Suspense fallback={<LazyFallback />}><GestaoPermissoesUnificada /></Suspense>;
      default:
        return null;
    }
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

        <div className="flex gap-6">
          {/* Sidebar Navigation */}
          <nav className="w-64 shrink-0 space-y-1">
            {visibleSections.map((section) => (
              <div key={section.label} className="mb-4">
                <div className="flex items-center gap-2 px-3 py-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {section.label}
                  </h3>
                  {section.requiresUnlock && (
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-0.5">
                  {section.items.map((item) => (
                    <button
                      key={item.key}
                      onClick={() => handleNavClick(item.key, section)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
                        activeSection === item.key
                          ? "bg-primary text-primary-foreground font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <span>{item.label}</span>
                      {activeSection === item.key && <ChevronRight className="h-4 w-4" />}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {isAdmin && !outrasOpcoesUnlocked && (
              <button
                onClick={() => setShowPasswordDialog(true)}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Lock className="h-4 w-4" />
                Desbloquear Avançado
              </button>
            )}
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {renderContent()}
          </div>
        </div>
      </div>

      <AdminPasswordDialog
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
        onSuccess={() => setOutrasOpcoesUnlocked(true)}
      />
    </DashboardLayout>
  );
}

export { Configuracoes };
export default Configuracoes;
