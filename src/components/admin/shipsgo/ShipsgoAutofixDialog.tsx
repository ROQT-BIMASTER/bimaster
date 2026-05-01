import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (password: string) => Promise<void>;
  totalAcoes: number;
}

export function ShipsgoAutofixDialog({ open, onOpenChange, onConfirm, totalAcoes }: Props) {
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);

  async function handle() {
    if (!pw) return;
    setLoading(true);
    try { await onConfirm(pw); setPw(""); }
    finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) { onOpenChange(v); if (!v) setPw(""); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Confirmar aplicação</DialogTitle>
          <DialogDescription>
            Você está prestes a executar <strong>{totalAcoes} ações</strong> de auto-fix sobre a integração ShipsGo.
            Confirme com sua senha para prosseguir.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="pw-shipsgo">Senha</Label>
          <Input id="pw-shipsgo" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handle} disabled={!pw || loading}>
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Aplicando…</> : "Aplicar plano"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
