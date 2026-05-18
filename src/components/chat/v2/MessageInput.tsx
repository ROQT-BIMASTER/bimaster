import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Paperclip, Smile, Send, X, Reply, Loader2, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMensagem } from "@/hooks/chat/types";
import { useChatActions } from "@/hooks/chat/useChatActions";
import { uploadChatAnexo, formatBytes } from "./utils";
import { CameraCaptureButton } from "./CameraCaptureButton";
import { EmojiPicker } from "./EmojiPicker";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  conversaId: string;
  responderA: ChatMensagem | null;
  onClearReply: () => void;
  onTyping: () => void;
}

export function MessageInput({ conversaId, responderA, onClearReply, onTyping }: Props) {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const [txt, setTxt] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const { sendMessage } = useChatActions();

  useEffect(() => { taRef.current?.focus(); }, [conversaId, responderA]);

  const enviar = async () => {
    const conteudo = txt.trim();
    if (!conteudo && files.length === 0) return;
    setUploading(true);
    try {
      const anexosMeta = [];
      for (const f of files) {
        if (f.size > 20 * 1024 * 1024) {
          toast.error(`Arquivo ${f.name} excede 20 MB`);
          continue;
        }
        const meta = await uploadChatAnexo(conversaId, uid, f);
        anexosMeta.push(meta);
      }
      const tipo = anexosMeta.length > 0 && !conteudo
        ? (anexosMeta[0].mime_type.startsWith("image/") ? "imagem"
          : anexosMeta[0].mime_type.startsWith("video/") ? "video"
          : anexosMeta[0].mime_type.startsWith("audio/") ? "audio"
          : "arquivo")
        : "texto";
      await sendMessage.mutateAsync({
        conversaId,
        conteudo,
        tipo: tipo as any,
        responde_a_id: responderA?.id ?? null,
        anexos: anexosMeta,
      });
      setTxt("");
      setFiles([]);
      onClearReply();
    } catch (e: any) {
      toast.error("Falha ao enviar: " + (e?.message ?? ""));
    } finally {
      setUploading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar();
    } else {
      onTyping();
    }
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)].slice(0, 10));
  };

  return (
    <div className="border-t border-border bg-card">
      {responderA && (
        <div className="px-3 py-2 border-b border-border flex items-start gap-2 bg-muted/40">
          <Reply className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 text-xs">
            <p className="font-medium text-primary">Respondendo a {responderA.remetente?.nome ?? "mensagem"}</p>
            <p className="truncate text-muted-foreground">{responderA.conteudo || "Anexo"}</p>
          </div>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onClearReply}><X className="h-3.5 w-3.5" /></Button>
        </div>
      )}

      {files.length > 0 && (
        <div className="px-3 py-2 border-b border-border flex flex-wrap gap-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 bg-muted rounded-md px-2 py-1 text-xs">
              <ImageIcon className="h-3.5 w-3.5" />
              <span className="max-w-[160px] truncate">{f.name}</span>
              <span className="text-muted-foreground">{formatBytes(f.size)}</span>
              <button onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="px-3 py-2 flex items-end gap-2">
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ""; }}
        />
        <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => fileRef.current?.click()} title="Anexar arquivo" aria-label="Anexar arquivo">
          <Paperclip className="h-4 w-4" />
        </Button>
        <CameraCaptureButton onCapture={(file) => setFiles((prev) => [...prev, file].slice(0, 10))} disabled={uploading} />
        <Popover>
          <PopoverTrigger asChild>
            <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0"><Smile className="h-4 w-4" /></Button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-auto p-0">
            <EmojiPicker onPick={(e) => setTxt((t) => t + e)} />
          </PopoverContent>
        </Popover>
        <Textarea
          ref={taRef}
          value={txt}
          onChange={(e) => setTxt(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={(e) => {
            const items = Array.from(e.clipboardData?.files ?? []);
            if (items.length) { e.preventDefault(); addFiles(e.clipboardData.files); }
          }}
          placeholder="Digite uma mensagem..."
          rows={1}
          className={cn("resize-none min-h-[40px] max-h-32 py-2.5 leading-snug")}
        />
        <Button onClick={enviar} disabled={uploading || (!txt.trim() && files.length === 0)} size="icon" className="h-9 w-9 shrink-0 rounded-full">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
