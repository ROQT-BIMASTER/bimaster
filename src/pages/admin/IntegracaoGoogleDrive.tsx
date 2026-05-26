// src/pages/admin/IntegracaoGoogleDrive.tsx
import { useState } from "react";
import { Cloud, CheckCircle2, AlertCircle, RefreshCw, Lock, ExternalLink, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useUserRole } from "@/hooks/useUserRole";
import {
  useGoogleDriveConfig, useSalvarDriveConfig, useVerificarDriveConexao,
} from "@/hooks/useGoogleDriveSync";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";

export default function IntegracaoGoogleDrive() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { data: cfg, isLoading } = useGoogleDriveConfig();
  const salvar = useSalvarDriveConfig();
  const verificar = useVerificarDriveConexao();

  const [rootName, setRootName] = useState(cfg?.root_folder_name ?? "");
  const [sharedDriveId, setSharedDriveId] = useState(cfg?.shared_drive_id ?? "");
  const [autoSync, setAutoSync] = useState(cfg?.auto_sync_enabled ?? false);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [stepUpLoading, setStepUpLoading] = useState(false);
  const [pendingPatch, setPendingPatch] = useState<Record<string, unknown> | null>(null);

  // Sincronizar form quando carregar
  if (cfg && rootName === "" && !pendingPatch) {
    setRootName(cfg.root_folder_name);
    setSharedDriveId(cfg.shared_drive_id ?? "");
    setAutoSync(cfg.auto_sync_enabled);
  }

  if (roleLoading || isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;
  }
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const handleSalvarClick = () => {
    setPendingPatch({
      root_folder_name: rootName.trim() || "Bimaster — Briefings",
      shared_drive_id: sharedDriveId.trim() || null,
      auto_sync_enabled: autoSync,
    });
    setStepUpOpen(true);
  };

  const confirmarComSenha = async () => {
    if (!password) return toast.error("Informe sua senha");
    setStepUpLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const email = u.user?.email;
      if (!email) throw new Error("Sessão expirada");

      // Re-autentica para validar a senha
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email, password,
      });
      if (authErr) throw new Error("Senha incorreta");

      await salvar.mutateAsync(pendingPatch!);
      setStepUpOpen(false);
      setPassword("");
      setPendingPatch(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
    } finally {
      setStepUpLoading(false);
    }
  };

  const statusBadge = () => {
    switch (cfg?.connection_status) {
      case "conectado":
        return <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 gap-1">
          <CheckCircle2 className="h-3 w-3" /> Conectado
        </Badge>;
      case "erro":
        return <Badge variant="destructive" className="gap-1">
          <AlertCircle className="h-3 w-3" /> Erro
        </Badge>;
      case "desconectado":
        return <Badge variant="secondary" className="gap-1">Desconectado</Badge>;
      default:
        return <Badge variant="outline" className="gap-1 text-muted-foreground">
          Não configurado
        </Badge>;
    }
  };

  return (
    <div className="container mx-auto py-6 max-w-3xl space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Cloud className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Integração Google Drive</h1>
          <p className="text-sm text-muted-foreground">
            Conta da agência usada como cofre espelho dos documentos de briefings.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Status da conexão</CardTitle>
            {statusBadge()}
          </div>
          <CardDescription>
            {cfg?.last_verified_at
              ? `Última verificação: ${new Date(cfg.last_verified_at).toLocaleString("pt-BR")}`
              : "Conexão ainda não foi verificada."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {cfg?.connection_status !== "conectado" && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Vinculação da conta da agência</AlertTitle>
              <AlertDescription className="space-y-2 text-xs mt-1">
                <p>
                  A autorização inicial da conta Google da agência é realizada
                  pelo <strong>administrador do sistema</strong> nos bastidores,
                  via fluxo OAuth oficial do Google (sem necessidade de compartilhar
                  senha ou credenciais).
                </p>
                <p>
                  Solicite ao administrador a vinculação e, em seguida, clique em
                  <strong> Verificar conexão</strong> abaixo. O status mudará para
                  "Conectado" assim que a conta estiver disponível.
                </p>
              </AlertDescription>
            </Alert>
          )}
          <Button
            size="sm" variant="outline"
            onClick={() => verificar.mutate()}
            disabled={verificar.isPending}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-2 ${verificar.isPending ? "animate-spin" : ""}`} />
            Verificar conexão
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuração de pastas</CardTitle>
          <CardDescription>
            Define onde os arquivos são armazenados dentro do Drive da agência.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rootName">Nome da pasta raiz</Label>
            <Input
              id="rootName"
              value={rootName}
              onChange={(e) => setRootName(e.target.value)}
              placeholder="Bimaster — Briefings"
            />
            <p className="text-[11px] text-muted-foreground">
              Estrutura criada: <code>{rootName || "Bimaster — Briefings"}/Tipo/Briefing/Categoria</code>
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sharedDrive">ID do Shared Drive (opcional)</Label>
            <Input
              id="sharedDrive"
              value={sharedDriveId}
              onChange={(e) => setSharedDriveId(e.target.value)}
              placeholder="Vazio = My Drive da conta"
            />
            <p className="text-[11px] text-muted-foreground">
              Recomendado usar um Shared Drive para garantir continuidade caso a conta titular saia.
            </p>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="autoSync" className="text-sm font-medium">
                Espelhamento automático
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Envia cada upload do cofre para o Drive automaticamente.
              </p>
            </div>
            <Switch id="autoSync" checked={autoSync} onCheckedChange={setAutoSync} />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button onClick={handleSalvarClick} disabled={salvar.isPending}>
          <Lock className="h-3.5 w-3.5 mr-2" />
          Salvar (requer confirmação de senha)
        </Button>
      </div>

      <Dialog open={stepUpOpen} onOpenChange={(o) => { if (!stepUpLoading) setStepUpOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirme sua senha</DialogTitle>
            <DialogDescription>
              Por segurança, configurações de integrações exigem reconfirmação da senha do administrador.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="pwd">Senha</Label>
            <Input
              id="pwd"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") confirmarComSenha(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStepUpOpen(false)} disabled={stepUpLoading}>
              Cancelar
            </Button>
            <Button onClick={confirmarComSenha} disabled={stepUpLoading}>
              {stepUpLoading ? "Confirmando..." : "Confirmar e salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
