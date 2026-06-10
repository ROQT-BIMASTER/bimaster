/**
 * ChatAttachmentChip — exibe um anexo do chat (imagem inline ou
 * card de PDF). Download via blob (StoragePreviewDialog/triggerBlobDownload).
 *
 * Quando `mensagemId` + `submissaoId` são fornecidos, aparece também o
 * botão "Promover ao Checklist" (move o anexo pro Cofre oficial — RPC
 * rpc_china_promover_anexo_ao_checklist). Se o anexo já foi promovido,
 * mostra badge "📋 No checklist" e esconde o botão.
 */
import { useEffect, useState } from "react";
import { FileText, Download, Loader2, MoreVertical, ClipboardList, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadStorageBlob, triggerBlobDownload } from "@/lib/utils/storage-download";
import { toast } from "sonner";
import { PromoverChecklistDialog } from "./PromoverChecklistDialog";

export interface ChatAnexo {
  path: string;
  nome: string;
  mime: string;
  size: number;
  /** Preenchido pela RPC rpc_china_promover_anexo_ao_checklist quando o
   *  anexo é promovido a item oficial do checklist. */
  promovido_documento_id?: string | null;
}

interface Props {
  anexo: ChatAnexo;
  isLightBg?: boolean;
  /** Quando fornecido junto com `submissaoId`, habilita o menu
   *  "Promover ao Checklist". */
  mensagemId?: string;
  submissaoId?: string;
}

export function ChatAttachmentChip({ anexo, isLightBg, mensagemId, submissaoId }: Props) {
  const isImage = detectFileKind(anexo.nome, anexo.mime) === "image";
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [promoverOpen, setPromoverOpen] = useState(false);
  const [promovido, setPromovido] = useState<boolean>(!!anexo.promovido_documento_id);

  // habilita botão de promover se temos contexto suficiente
  const podePromover = !!mensagemId && !!submissaoId && !promovido;

  useEffect(() => {
    if (!isImage) return;
    let alive = true;
    let revoke: string | null = null;
    (async () => {
      const { data } = await supabase.storage.from("china-chat-anexos").createSignedUrl(anexo.path, 60 * 30);
      if (alive && data?.signedUrl) {
        setImgUrl(data.signedUrl);
        revoke = data.signedUrl;
      }
    })();
    return () => { alive = false; if (revoke) { /* signed URL, nada a revogar */ } };
  }, [anexo.path, isImage]);

  // Mantém promovido sincronizado se o pai re-renderizar com anexos atualizados
  useEffect(() => {
    setPromovido(!!anexo.promovido_documento_id);
  }, [anexo.promovido_documento_id]);

  const baixar = async () => {
    setDownloading(true);
    try {
      const r = await downloadStorageBlob(anexo.path, "china-chat-anexos");
      if (!r) throw new Error("Falha ao baixar arquivo");
      triggerBlobDownload(r.blobUrl, anexo.nome);
    } catch (err: any) {
      toast.error(err.message || "Falha ao baixar arquivo");
    } finally {
      setDownloading(false);
    }
  };

  const renderBadge = () => promovido && (
    <Badge variant="secondary" className="text-[10px] gap-1 px-1.5 py-0 h-4 mt-1">
      <CheckCircle2 className="h-2.5 w-2.5" /> No checklist
    </Badge>
  );

  const renderMenu = () => (podePromover || true) && (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`shrink-0 ml-1 hover:opacity-80 ${isLightBg ? "text-muted-foreground" : "text-white/90"}`}
          title="Mais ações"
          aria-label="Mais ações do anexo"
        >
          <MoreVertical className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={baixar} disabled={downloading}>
          <Download className="h-3.5 w-3.5 mr-2" /> Baixar
        </DropdownMenuItem>
        {podePromover && (
          <DropdownMenuItem onSelect={() => setTimeout(() => setPromoverOpen(true), 0)}>
            <ClipboardList className="h-3.5 w-3.5 mr-2" /> Promover ao Checklist
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (isImage) {
    return (
      <>
        <div className="mt-1 rounded-lg overflow-hidden border max-w-[260px]">
          {imgUrl ? (
            <a href={imgUrl} target="_blank" rel="noopener noreferrer">
              <img src={imgUrl} alt={anexo.nome} className="w-full h-auto block" loading="lazy" />
            </a>
          ) : (
            <div className="aspect-video bg-muted flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
          <div className={`px-2 py-1 text-[10px] flex items-center justify-between ${
            isLightBg ? "bg-muted text-muted-foreground" : "bg-black/20 text-white/90"
          }`}>
            <span className="truncate">{anexo.nome}</span>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <button onClick={baixar} disabled={downloading} className="hover:underline">
                {downloading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Download className="h-2.5 w-2.5" />}
              </button>
              {renderMenu()}
            </div>
          </div>
          {renderBadge()}
        </div>
        {podePromover && mensagemId && submissaoId && (
          <PromoverChecklistDialog
            open={promoverOpen}
            onOpenChange={setPromoverOpen}
            anexo={anexo}
            mensagemId={mensagemId}
            submissaoId={submissaoId}
            onPromoted={() => setPromovido(true)}
          />
        )}
      </>
    );
  }

  // PDF / outros
  return (
    <>
      <div className={`mt-1 flex items-center gap-2 rounded-lg border px-2 py-1.5 max-w-[280px] ${
        isLightBg ? "bg-muted/50" : "bg-black/20 border-white/20"
      }`}>
        <FileText className="h-4 w-4 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{anexo.nome}</p>
          <p className="text-[10px] opacity-70">{(anexo.size / 1024).toFixed(0)} KB</p>
          {renderBadge()}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={baixar}
          disabled={downloading}
          title="Baixar"
        >
          {downloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
        </Button>
        {renderMenu()}
      </div>
      {podePromover && mensagemId && submissaoId && (
        <PromoverChecklistDialog
          open={promoverOpen}
          onOpenChange={setPromoverOpen}
          anexo={anexo}
          mensagemId={mensagemId}
          submissaoId={submissaoId}
          onPromoted={() => setPromovido(true)}
        />
      )}
    </>
  );
}
