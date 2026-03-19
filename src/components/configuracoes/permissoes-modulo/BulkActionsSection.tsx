import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldCheck, ShieldOff, Loader2, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface BulkActionsSectionProps {
  selectedUserIds: string[];
  onGrantFullAccess: (userIds: string[]) => Promise<void>;
  onRevokeFullAccess: (userIds: string[]) => Promise<void>;
  moduleName: string;
}

export function BulkActionsSection({
  selectedUserIds,
  onGrantFullAccess,
  onRevokeFullAccess,
  moduleName,
}: BulkActionsSectionProps) {
  const [granting, setGranting] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const handleGrant = async () => {
    setGranting(true);
    try {
      await onGrantFullAccess(selectedUserIds);
    } finally {
      setGranting(false);
    }
  };

  const handleRevoke = async () => {
    setRevoking(true);
    try {
      await onRevokeFullAccess(selectedUserIds);
    } finally {
      setRevoking(false);
    }
  };

  const disabled = selectedUserIds.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Ações em Lote
        </CardTitle>
        <CardDescription>
          {disabled
            ? "Selecione usuários na lista acima para realizar ações em lote"
            : `${selectedUserIds.length} usuário(s) selecionado(s)`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Button
          variant="default"
          disabled={disabled || granting}
          onClick={handleGrant}
        >
          {granting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
          Dar Acesso Total ao Módulo
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={disabled || revoking}>
              {revoking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldOff className="h-4 w-4 mr-2" />}
              Revogar Acesso Total
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revogar acesso total?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso removerá o acesso ao módulo <strong>{moduleName}</strong> e a todas as suas telas para {selectedUserIds.length} usuário(s). Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleRevoke}>
                Confirmar Revogação
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
