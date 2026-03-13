import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RotateCcw, AlertTriangle } from "lucide-react";
import { auditSensitiveAction } from "@/lib/utils/sensitive-audit";

export interface EtapaOption {
  key: string;
  label: string;
}

export interface DevolucaoResult {
  etapaDestino: string;
  justificativa: string;
  userInfo: { id: string; email: string; nome: string };
}

interface DevolucaoEtapaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (result: DevolucaoResult) => Promise<void>;
  etapasAnteriores: EtapaOption[];
  entityType: string;
  entityId?: string;
  title?: string;
  description?: string;
}

export function DevolucaoEtapaDialog({
  open,
  onOpenChange,
  onConfirm,
  etapasAnteriores,
  entityType,
  entityId,
  title = "Devolver para Etapa Anterior",
  description = "Esta ação requer autenticação. Selecione a etapa destino e justifique a devolução.",
}: DevolucaoEtapaDialogProps) {
  const [etapaDestino, setEtapaDestino] = useState("");
  const [password, setPassword] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleConfirm = async () => {
    if (!etapaDestino) { setError("Selecione a etapa destino"); return; }
    if (!password) { setError("Digite sua senha"); return; }
    if (!justificativa.trim()) { setError("Justificativa é obrigatória"); return; }

    setIsLoading(true);
    setError("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Usuário não autenticado"); return; }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password,
      });
      if (signInError) { setError("Senha incorreta"); setIsLoading(false); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("nome, email")
        .eq("id", user.id)
        .single();

      const userInfo = {
        id: user.id,
        email: user.email || "",
        nome: profile?.nome || user.email || "Desconhecido",
      };

      // Audit log
      auditSensitiveAction({
        action: "devolucao_etapa",
        category: "ACCESS",
        entityType,
        entityId,
        metadata: {
          etapa_destino: etapaDestino,
          justificativa,
          responsavel_nome: userInfo.nome,
        },
      });

      await onConfirm({ etapaDestino, justificativa, userInfo });

      // Reset & close
      setEtapaDestino("");
      setPassword("");
      setJustificativa("");
      onOpenChange(false);
    } catch (err: any) {
      console.error("Devolução error:", err);
      setError(err.message || "Erro ao processar devolução");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEtapaDestino("");
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
            <RotateCcw className="h-5 w-5 text-amber-500" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="etapa-destino">Etapa Destino</Label>
            <Select value={etapaDestino} onValueChange={setEtapaDestino}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a etapa..." />
              </SelectTrigger>
              <SelectContent>
                {etapasAnteriores.map(e => (
                  <SelectItem key={e.key} value={e.key}>{e.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="devolucao-justificativa">Justificativa da Devolução *</Label>
            <Textarea
              id="devolucao-justificativa"
              placeholder="Descreva o motivo da devolução..."
              value={justificativa}
              onChange={e => setJustificativa(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="devolucao-password">Sua Senha *</Label>
            <Input
              id="devolucao-password"
              type="password"
              placeholder="Confirme com sua senha..."
              value={password}
              onChange={e => setPassword(e.target.value)}
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
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isLoading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verificando...</>
            ) : (
              <><RotateCcw className="h-4 w-4 mr-2" />Devolver</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
