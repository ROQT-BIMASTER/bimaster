/**
 * CutucarDialog — chama atenção em uma mensagem/aprovação já enviada.
 *
 * Reutiliza o mesmo canal de mensagens urgentes (banner com tremor, som e
 * notificação), mas referenciando a mensagem alvo via `responde_a_id`.
 *
 * Apenas o autor da mensagem original ou o solicitante da aprovação podem
 * cutucar (validação no backend em `rpc_cutucar_mensagem`).
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AlertOctagon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mensagemAlvoId: string;
  /** Prévia curta da mensagem/aprovação alvo (título ou trecho). */
  alvoResumo?: string;
  onSent?: () => void;
}

export function CutucarDialog({ open, onOpenChange, mensagemAlvoId, alvoResumo, onSent }: Props) {
  const [motivo, setMotivo] = useState("");
  const [sending, setSending] = useState(false);

  const enviar = async () => {
    const m = motivo.trim();
    if (m.length < 8) {
      toast.error("Informe um motivo com ao menos 8 caracteres.");
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.rpc("rpc_cutucar_mensagem" as any, {
        p_mensagem_alvo_id: mensagemAlvoId,
        p_motivo: m,
      } as any);
      if (error) throw error;
      toast.success("Alerta enviado aos participantes.");
      setMotivo("");
      onOpenChange(false);
      onSent?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível chamar atenção.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!sending) onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertOctagon className="h-5 w-5 text-destructive" />
            Chamar atenção
          </DialogTitle>
          <DialogDescription>
            Os participantes da conversa receberão um alerta visual e sonoro destacado,
            mesmo fora da conversa, referenciando a mensagem original. Use somente quando
            o atendimento for realmente prioritário. Limite: 3 alertas por hora.
          </DialogDescription>
        </DialogHeader>

        {alvoResumo && (
          <div className="rounded-md border border-border bg-muted/40 p-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Referência: </span>
            <span className="line-clamp-2 break-words">{alvoResumo}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="motivo-cutucar">Motivo</Label>
          <Textarea
            id="motivo-cutucar"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: aprovação pendente bloqueando envio da submissão"
            rows={3}
            maxLength={500}
            disabled={sending}
          />
          <p className="text-[11px] text-muted-foreground">Mínimo 8 caracteres.</p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={sending || motivo.trim().length < 8} className="gap-1.5">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertOctagon className="h-4 w-4" />}
            Enviar alerta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
