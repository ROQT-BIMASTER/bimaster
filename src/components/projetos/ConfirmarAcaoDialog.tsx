import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, ArrowRight } from "lucide-react";
import type { CopilotProposal } from "@/hooks/useProjetoCopilot";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  proposal: CopilotProposal | null;
  onConfirm: (password: string) => Promise<boolean>;
}

export function ConfirmarAcaoDialog({ open, onOpenChange, proposal, onConfirm }: Props) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (!proposal) return null;

  const handleConfirm = async () => {
    if (!password.trim()) return;
    setLoading(true);
    const ok = await onConfirm(password);
    setLoading(false);
    if (ok) {
      setPassword("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) { onOpenChange(v); if (!v) setPassword(""); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" />
            Confirmar ação
          </DialogTitle>
          <DialogDescription>
            Para aplicar esta ação no projeto, confirme com sua senha. Você pode revisar a proposta abaixo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="font-medium">{proposal.resumo}</div>
            {proposal.diff && proposal.diff.length > 0 && (
              <div className="mt-2 space-y-1">
                {proposal.diff.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">{d.campo}:</span>
                    <span className="line-through text-muted-foreground">{String(d.de ?? "—")}</span>
                    <ArrowRight className="size-3 text-muted-foreground" />
                    <span className="font-medium">{String(d.para ?? "—")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="copilot-pw">Sua senha</Label>
            <Input
              id="copilot-pw"
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(); }}
              disabled={loading}
              placeholder="••••••••"
            />
            <p className="text-[11px] text-muted-foreground">
              Após 5 tentativas incorretas, o copiloto bloqueia novas confirmações por 30 minutos.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={loading || !password.trim()}>
            {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <ShieldCheck className="size-4 mr-2" />}
            Confirmar e aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
