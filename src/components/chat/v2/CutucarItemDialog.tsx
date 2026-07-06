/**
 * CutucarItemDialog — chama atenção em um comentário/documento publicado
 * dentro de Briefings, Projetos ou Submissões China.
 *
 * Esses módulos têm tabelas próprias de comentários (não vivem em
 * `public.mensagens`), então `rpc_cutucar_mensagem` não se aplica
 * diretamente. Aqui usamos a infraestrutura de **conversa vinculada**:
 *
 *  1. `rpc_get_or_create_conversa_vinculada(tipo, refId, titulo)`
 *     garante a conversa de Pessoas associada ao item e adiciona o caller
 *     como participante (RLS já cobre o resto).
 *  2. Inserimos uma mensagem `tipo='urgente'` nessa conversa, referenciando
 *     o item via `metadata.vinculo_*` e `metadata.item_*`. Os participantes
 *     da conversa vinculada recebem o mesmo banner/tremor/som já existente
 *     para mensagens urgentes em Pessoas.
 *
 * Rate-limit (3 urgentes/hora) espelha o critério de `rpc_cutucar_mensagem`
 * e é verificado client-side com toast claro antes do insert. O insert
 * continua sujeito às policies de `mensagens`.
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AlertOctagon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type VinculoTipo = "briefing" | "projeto" | "submissao";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tipo: VinculoTipo;
  refId: string;
  /** Título do escopo (ex.: nome do briefing/projeto/submissão). */
  tituloEscopo: string;
  /** Resumo curto do item alvo (trecho do comentário ou nome do doc). */
  itemResumo: string;
  /** Id do item alvo (comentário/documento) — apenas para auditoria/UI. */
  itemId?: string | null;
  itemTipo?: "comentario" | "documento";
  docNome?: string | null;
  /** Autor do item alvo — garante que ele receba o alerta em tempo real. */
  itemAutorId?: string | null;
  onSent?: (conversaId: string) => void;
}

const escopoLabel = (t: VinculoTipo) =>
  t === "briefing" ? "briefing" : t === "projeto" ? "projeto" : "submissão";

export function CutucarItemDialog({
  open,
  onOpenChange,
  tipo,
  refId,
  tituloEscopo,
  itemResumo,
  itemId,
  itemTipo = "comentario",
  docNome,
  itemAutorId,
  onSent,
}: Props) {
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
      // RPC única: rate-limit, re-sync de participantes do escopo, garantia
      // de que o autor do item alvo entra na conversa vinculada e insert
      // da mensagem urgente — tudo server-side.
      const { data, error } = await (supabase.rpc as any)("rpc_cutucar_item", {
        p_tipo: tipo,
        p_ref_id: refId,
        p_titulo_escopo: tituloEscopo,
        p_item_id: itemId ?? null,
        p_item_tipo: itemTipo,
        p_doc_nome: docNome ?? null,
        p_motivo: m,
        p_item_autor_id: itemAutorId ?? null,
      });
      if (error) throw error;
      const conversaId = data as string;

      toast.success(`Alerta enviado na conversa vinculada ao ${escopoLabel(tipo)}.`, {
        action: {
          label: "Abrir chat",
          onClick: () =>
            window.location.assign(`/dashboard/chat?conversaId=${encodeURIComponent(conversaId)}`),
        },
      });
      setMotivo("");
      onOpenChange(false);
      onSent?.(conversaId);
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
            Os participantes da conversa vinculada ao {escopoLabel(tipo)} receberão um
            alerta destacado, com som e banner, mesmo fora da conversa. Use somente
            quando o atendimento for realmente prioritário. Limite: 3 alertas por hora.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-border bg-muted/40 p-2 text-xs text-muted-foreground space-y-0.5">
          <div>
            <span className="font-medium text-foreground">Escopo: </span>
            {tituloEscopo}
          </div>
          {(itemResumo || docNome) && (
            <div className="line-clamp-2 break-words">
              <span className="font-medium text-foreground">Referência: </span>
              {docNome ? <span className="italic">{docNome} — </span> : null}
              {itemResumo}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="motivo-cutucar-item">Motivo</Label>
          <Textarea
            id="motivo-cutucar-item"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: revisão pendente bloqueando publicação"
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
