/**
 * NovaAprovacaoDialog — dialog para solicitar aprovação inline no chat.
 *
 * Acionado pelo botão "ClipboardCheck" no MessageInput. Cria via
 * rpc_chat_aprovacao_criar — RPC posta uma mensagem 'sistema' na
 * conversa com metadata.aprovacao_id apontando pra nova aprovação.
 *
 * Suporta anexar documentos: após criar a aprovação, cada arquivo é enviado
 * ao bucket `aprovacao-documentos` e registrado via
 * rpc_chat_aprovacao_anexar_documento.
 */
import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ClipboardCheck, Paperclip, FileText, X, MessageSquare, Inbox } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useCriarAprovacao } from "@/hooks/chat/useChatAprovacao";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { uploadAprovacaoDoc } from "./aprovacaoDocs";
import { formatBytes } from "./utils";
import { toast } from "sonner";

type Destino = "chat" | "central";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversaId: string;
}

const MAX_BYTES = 20 * 1024 * 1024; // casa com o file_size_limit do bucket (20MB, política do projeto)
const ACCEPT = ".pdf,image/*,.doc,.docx,.xls,.xlsx";

export function NovaAprovacaoDialog({ open, onOpenChange, conversaId }: Props) {
  const { user } = useAuth();
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [destino, setDestino] = useState<Destino>("chat");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { mutateAsync, isPending } = useCriarAprovacao();

  const busy = isPending || uploading;

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const picked = Array.from(list);
    const tooBig = picked.find((f) => f.size > MAX_BYTES);
    if (tooBig) {
      toast.error("Arquivo muito grande", { description: `${tooBig.name} excede 20MB.` });
    }
    setFiles((prev) => [...prev, ...picked.filter((f) => f.size <= MAX_BYTES)]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const reset = () => { setTitulo(""); setDescricao(""); setFiles([]); setDestino("chat"); };

  const submit = async () => {
    if (!titulo.trim()) return toast.error("Defina um título");
    if (files.length === 0) return toast.error("Anexe ao menos um documento");
    if (!user?.id) return toast.error("Sessão expirada");
    try {
      const aprovacaoId = await mutateAsync({
        conversaId,
        titulo: titulo.trim(),
        descricao: descricao.trim() || undefined,
      });

      let ok = 0;
      setUploading(true);
      for (const file of files) {
        try {
          const up = await uploadAprovacaoDoc(conversaId, aprovacaoId, user.id, file);
          const { error } = await supabase.rpc("rpc_chat_aprovacao_anexar_documento" as any, {
            p_aprovacao_id: aprovacaoId,
            p_titulo: file.name,
            p_storage_path: up.storage_path,
            p_mime_type: up.mime_type,
            p_size_bytes: up.size_bytes,
            p_hash: up.hash,
          } as any);
          if (error) throw error;
          ok++;
        } catch (e: any) {
          toast.error(`Falha ao anexar ${file.name}`, { description: e?.message ?? "erro" });
        }
      }
      if (ok > 0) toast.success(`${ok} documento(s) anexado(s)`);

      // Só encaminha à Central se houver ao menos 1 documento anexado —
      // uma aprovação na Central sem documento contradiz o anexo obrigatório.
      if (destino === "central") {
        if (ok === 0) {
          toast.error("Aprovação criada sem documentos — não enviada à Central");
        } else {
          const { error } = await supabase.rpc("rpc_chat_aprovacao_enviar_central" as any, {
            p_aprovacao_id: aprovacaoId,
          } as any);
          if (error) {
            toast.error("Falha ao enviar para a Central", { description: error.message });
          } else {
            toast.success("Enviado para a Central de Aprovações");
          }
        }
      }

      reset();
      onOpenChange(false);
    } catch {
      /* toast já no hook de criação */
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" /> Solicitar aprovação
          </DialogTitle>
          <DialogDescription>
            Um card de aprovação será postado nesta conversa. Qualquer participante
            (exceto você) pode aprovar ou rejeitar. É obrigatório anexar ao menos
            um documento.
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

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Documentos *</label>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
            >
              <Paperclip className="h-4 w-4" /> Anexar documentos
            </Button>
            {files.length > 0 && (
              <ul className="space-y-1 rounded-md border p-1.5">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-2 text-xs">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 min-w-0 truncate">{f.name}</span>
                    <span className="text-muted-foreground shrink-0">{formatBytes(f.size)}</span>
                    <button
                      type="button"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeFile(i)}
                      disabled={busy}
                      aria-label={`Remover ${f.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Para onde enviar?</label>
            <RadioGroup
              value={destino}
              onValueChange={(v) => setDestino(v as Destino)}
              className="gap-2"
            >
              <label className="flex items-start gap-2 rounded-md border p-2 cursor-pointer hover:bg-accent/40">
                <RadioGroupItem value="chat" className="mt-0.5" />
                <span className="flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <MessageSquare className="h-3.5 w-3.5" /> Decidir no chat
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Card postado na conversa; qualquer participante decide.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 rounded-md border p-2 cursor-pointer hover:bg-accent/40">
                <RadioGroupItem value="central" className="mt-0.5" />
                <span className="flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <Inbox className="h-3.5 w-3.5" /> Enviar para a Central
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Também aparece na Central de Aprovações para revisão.
                  </span>
                </span>
              </label>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={busy || !titulo.trim() || files.length === 0}>
            {busy ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {uploading ? "Anexando..." : "Enviando..."}</>
            ) : (
              <>{destino === "central" ? "Solicitar e enviar à Central" : "Solicitar aprovação"}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
