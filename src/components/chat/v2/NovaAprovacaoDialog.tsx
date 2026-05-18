/**
 * NovaAprovacaoDialog — dialog para solicitar aprovação inline no chat.
 *
 * Acionado pelo botão "ClipboardCheck" no MessageInput. Cria via
 * rpc_chat_aprovacao_criar — RPC posta uma mensagem 'sistema' na
 * conversa com metadata.aprovacao_id apontando pra nova aprovação.
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ClipboardCheck } from "lucide-react";
import { useCriarAprovacao } from "@/hooks/chat/useChatAprovacao";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversaId: string;
}

export function NovaAprovacaoDialog({ open, onOpenChange, conversaId }: Props) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const { mutateAsync, isPending } = useCriarAprovacao();

  const submit = async () => {
    if (!titulo.trim()) return toast.error("Defina um título");
    try {
      await mutateAsync({
        conversaId,
        titulo: titulo.trim(),
        descricao: descricao.trim() || undefined,
      });
      setTitulo("");
      setDescricao("");
      onOpenChange(false);
    } catch { /* toast já no hook */ }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isPending) onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" /> Solicitar aprovação
          </DialogTitle>
          <DialogDescription>
            Um card de aprovação será postado nesta conversa. Qualquer participante
            (exceto você) pode aprovar ou rejeitar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Título *</label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Aprovar pagamento de fornecedor X"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Descrição (opcional)</label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              placeholder="Detalhes da solicitação..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={isPending || !titulo.trim()}>
            {isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
            ) : (
              <>Solicitar aprovação</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
