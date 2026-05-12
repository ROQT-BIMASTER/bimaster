import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, ShieldQuestion, PlayCircle } from "lucide-react";
import { useFabricaPhotoDiagnostics, type PermissionProbe } from "@/hooks/useFabricaPhotoDiagnostics";

const ACTION_LABEL: Record<PermissionProbe["action"], string> = {
  select: "Visualizar foto",
  insert: "Enviar foto (upload)",
  update: "Substituir foto",
  delete: "Excluir foto",
};

function StatusIcon({ status }: { status: PermissionProbe["status"] }) {
  if (status === "running") return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (status === "ok") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === "fail") return <XCircle className="h-4 w-4 text-destructive" />;
  return <ShieldQuestion className="h-4 w-4 text-muted-foreground" />;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PhotoPermissionDiagnosticsDialog({ open, onOpenChange }: Props) {
  const { probes, running, run } = useFabricaPhotoDiagnostics();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Diagnóstico de permissões — Fotos de Produtos</DialogTitle>
          <DialogDescription>
            Executa testes reais de upload, leitura, atualização e exclusão para validar suas
            permissões no momento. Um arquivo temporário é criado e removido em seguida.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {probes.map((p) => (
            <div key={p.action} className="flex items-start gap-3 rounded-lg border p-3">
              <StatusIcon status={p.status} />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{ACTION_LABEL[p.action]}</span>
                  <Badge variant={p.status === "ok" ? "default" : p.status === "fail" ? "destructive" : "secondary"}>
                    {p.status === "ok" ? "Permitido" : p.status === "fail" ? "Bloqueado" : p.status === "running" ? "Testando" : "Aguardando"}
                  </Badge>
                </div>
                {p.message && (
                  <p className="text-xs text-muted-foreground mt-1 break-words">{p.message}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={running}>
            Fechar
          </Button>
          <Button onClick={run} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-2" />}
            Executar diagnóstico
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
