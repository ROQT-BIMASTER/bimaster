/**
 * UrgentSendDialog — captura motivo e confirma envio de mensagem urgente.
 *
 * - Motivo obrigatório (>= 8 chars, validado também no backend).
 * - Lembrete visível sobre o limite de 3/hora e sobre o impacto no destinatário.
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
  conversaId: string;
  conteudoInicial: string;
  respondeAId?: string | null;
  onSent: () => void;
}

export function UrgentSendDialog({ open, onOpenChange, conversaId, conteudoInicial, respondeAId, onSent }: Props) {
  const [conteudo, setConteudo] = useState(conteudoInicial);
  const [motivo, setMotivo] = useState("");
  const [sending, setSending] = useState(false);

  // Sincroniza quando o usuário abre o dialog com texto já digitado
  if (open && conteudo === "" && conteudoInicial) setConteudo(conteudoInicial);

  const enviar = async () => {
    const c = conteudo.trim();
    const m = motivo.trim();
    if (!c) return toast.error("Mensagem vazia");
    if (m.length < 8) return toast.error("Motivo precisa ter ao menos 8 caracteres");
    setSending(true);
    try {
      const { error } = await supabase.rpc("rpc_enviar_mensagem_urgente" as any, {
        p_conversa_id: conversaId,
        p_conteudo: c,
        p_motivo: m,
        p_responde_a_id: respondeAId ?? null,
      } as any);
      if (error) throw error;
      toast.success("Mensagem urgente enviada");
      setMotivo("");
      setConteudo("");
      onOpenChange(false);
      onSent();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertOctagon className="h-5 w-5" /> Chamar atenção da equipe
          </DialogTitle>
          <DialogDescription className="text-xs">
            Será exibido um alerta visual e sonoro destacado para todos os participantes,
            mesmo fora da conversa. Use apenas em situações realmente urgentes.
            Limite: 3 mensagens urgentes por hora.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Mensagem</Label>
            <Textarea
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              placeholder="Descreva a urgência..."
              rows={3}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Motivo (ficará registrado em auditoria)</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: cliente aguardando aprovação para fechar pedido em 10 min"
              rows={2}
            />
            <p className="text-[10px] text-muted-foreground">
              {motivo.trim().length}/8 caracteres mínimos
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={enviar} disabled={sending || motivo.trim().length < 8 || !conteudo.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <AlertOctagon className="h-4 w-4 mr-2" />}
            Enviar urgente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
