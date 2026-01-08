import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Lock, AlertTriangle } from "lucide-react";

interface PasswordConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (justificativa: string, userInfo: { id: string; email: string; nome: string }) => Promise<void>;
  title?: string;
  description?: string;
  actionLabel?: string;
}

export function PasswordConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title = "Confirmar Alteração",
  description = "Para prosseguir com esta alteração, confirme sua senha e forneça uma justificativa.",
  actionLabel = "Confirmar"
}: PasswordConfirmDialogProps) {
  const [password, setPassword] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleConfirm = async () => {
    if (!password) {
      setError("Digite sua senha");
      return;
    }

    if (!justificativa.trim()) {
      setError("Forneça uma justificativa para a alteração");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("Usuário não autenticado");
        return;
      }

      // Verify password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: password,
      });

      if (signInError) {
        setError("Senha incorreta");
        return;
      }

      // Get user profile for name
      const { data: profile } = await supabase
        .from('profiles')
        .select('nome, email')
        .eq('id', user.id)
        .single();

      // Execute the confirmation callback
      await onConfirm(justificativa, {
        id: user.id,
        email: user.email || '',
        nome: profile?.nome || user.email || 'Desconhecido'
      });

      // Reset form and close
      setPassword("");
      setJustificativa("");
      onOpenChange(false);
    } catch (err: any) {
      console.error('Error confirming action:', err);
      setError(err.message || "Erro ao confirmar ação");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setPassword("");
    setJustificativa("");
    setError("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-500" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="password">Sua Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="Digite sua senha..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="justificativa">Justificativa da Alteração</Label>
            <Textarea
              id="justificativa"
              placeholder="Descreva o motivo desta alteração..."
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              rows={3}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Verificando...
              </>
            ) : (
              actionLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
