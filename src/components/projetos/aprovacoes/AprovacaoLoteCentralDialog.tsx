/**
 * AprovacaoLoteCentralDialog
 * ------------------------------------------------------------------
 * Ação em lote na Central de Aprovações: aplica a mesma decisão
 * (aprovar, reprovar ou devolver para revisão) a vários itens.
 *
 * Confirmação de senha obrigatória — um único token de step-up é emitido
 * para o lote e validado no servidor; cada item registra sua própria trilha.
 */
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { requestStepUpWithPassword } from "@/lib/security/stepUpPassword";
import { useAvancarItensLote, type KanbanItem } from "@/hooks/useKanbanAprovacoes";

export type DecisaoLote = "aprovado" | "rejeitado" | "em_revisao";

const LABELS: Record<DecisaoLote, { titulo: string; verbo: string; placeholder: string; required: boolean }> = {
  aprovado: {
    titulo: "Aprovar documentos em lote",
    verbo: "Aprovar",
    placeholder: "Parecer (opcional)",
    required: false,
  },
  rejeitado: {
    titulo: "Reprovar documentos em lote",
    verbo: "Reprovar",
    placeholder: "Justifique a reprovação",
    required: true,
  },
  em_revisao: {
    titulo: "Devolver documentos para revisão",
    verbo: "Devolver",
    placeholder: "O que precisa ser ajustado?",
    required: true,
  },
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  itens: KanbanItem[];
  decisao: DecisaoLote | null;
  onConcluido?: () => void;
}

export const APROVACOES_LOTE_SCOPE = "aprovacoes.lote";

export function AprovacaoLoteCentralDialog({ open, onOpenChange, itens, decisao, onConcluido }: Props) {
  const [comentario, setComentario] = useState("");
  const [senha, setSenha] = useState("");
  const [autenticando, setAutenticando] = useState(false);
  const lote = useAvancarItensLote();

  useEffect(() => {
    if (!open) {
      setComentario("");
      setSenha("");
    }
  }, [open]);

  if (!decisao) return null;
  const cfg = LABELS[decisao];
  const bloqueado =
    itens.length === 0 ||
    !senha.trim() ||
    (cfg.required && !comentario.trim()) ||
    autenticando ||
    lote.isPending;

  async function confirmar() {
    if (!decisao || bloqueado) return;
    setAutenticando(true);
    try {
      const { token } = await requestStepUpWithPassword(APROVACOES_LOTE_SCOPE, senha);
      await lote.mutateAsync({
        itemIds: itens.map((i) => i.id),
        decisao,
        comentario: comentario.trim() || undefined,
        stepUpToken: token,
      });
      onOpenChange(false);
      onConcluido?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível concluir a ação em lote.");
    } finally {
      setAutenticando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg flex flex-col max-h-[85dvh]">
        <DialogHeader>
          <DialogTitle className="text-base">{cfg.titulo}</DialogTitle>
          <DialogDescription className="text-xs">
            {itens.length} item(ns) selecionado(s). A decisão respeita as permissões de cada item.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          <div className="rounded-md border border-border divide-y divide-border">
            {itens.slice(0, 30).map((i) => (
              <div key={i.id} className="flex items-center gap-2 px-2 py-1.5 text-xs">
                <span className="truncate flex-1">{i.documento_nome || i.documento_tipo || "Documento"}</span>
                {i.etapa_nome && (
                  <Badge variant="secondary" className="text-[10px] shrink-0">{i.etapa_nome}</Badge>
                )}
              </div>
            ))}
            {itens.length > 30 && (
              <p className="px-2 py-1.5 text-[11px] text-muted-foreground">
                + {itens.length - 30} item(ns)
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Parecer</Label>
            <Textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder={cfg.placeholder}
              className="text-xs min-h-[70px]"
            />
            {cfg.required && !comentario.trim() && (
              <p className="text-[10px] text-muted-foreground">Parecer obrigatório.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Confirme sua senha</Label>
            <Input
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Senha de acesso"
              className="h-9 text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              A confirmação identifica o autor da decisão na trilha de auditoria.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={confirmar}
            disabled={bloqueado}
            variant={decisao === "rejeitado" ? "destructive" : "default"}
          >
            {(autenticando || lote.isPending) && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            {cfg.verbo} ({itens.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
