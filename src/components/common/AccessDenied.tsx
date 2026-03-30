import { Lock, ShieldAlert, ArrowLeft, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useImpersonation } from "@/contexts/ImpersonationContext";

interface AccessDeniedProps {
  message?: string;
  showWatermark?: boolean;
}

/**
 * Componente de Acesso Negado com marca d'água do sistema
 * Exibido quando o usuário não tem permissão para acessar uma tela
 */
export const AccessDenied = ({ 
  message = "Você não tem permissão para acessar esta área.",
  showWatermark = true 
}: AccessDeniedProps) => {
  const navigate = useNavigate();
  const { isImpersonating, stopImpersonation } = useImpersonation();

  const handleGoBack = () => {
    // Tenta voltar no histórico, se não houver histórico, vai para o dashboard
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center overflow-hidden bg-background">
      {/* Marca d'água de fundo */}
      {showWatermark && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <div className="text-center opacity-[0.03]">
            <h1 className="text-[12vw] font-black leading-none tracking-tighter text-foreground">
              Sistema de Gestão
            </h1>
            <h2 className="text-[18vw] font-black leading-none tracking-tighter text-primary">
              Huggs
            </h2>
          </div>
        </div>
      )}

      {/* Conteúdo central */}
      <div className="relative z-10 text-center p-8 max-w-md">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-destructive/10 mb-6">
          <ShieldAlert className="h-10 w-10 text-destructive" />
        </div>
        
        <h2 className="text-2xl font-bold text-foreground mb-3">
          Acesso Restrito
        </h2>
        
        <p className="text-muted-foreground mb-6">
          {message}
        </p>

        <Button
          variant="outline"
          onClick={handleGoBack}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        {isImpersonating && (
          <Button
            variant="destructive"
            onClick={() => {
              stopImpersonation();
              navigate("/dashboard");
            }}
            className="mb-6 ml-2"
          >
            <UserX className="h-4 w-4 mr-2" />
            Sair da Impersonação
          </Button>
        )}
        
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground/60">
          <Lock className="h-4 w-4" />
          <span>Entre em contato com o administrador para solicitar acesso</span>
        </div>
      </div>
    </div>
  );
};