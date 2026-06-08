/**
 * ChatAnexoCard — bolha de anexo dentro de uma mensagem do chat da
 * tarefa. Mostra preview inline para imagens e card de download para
 * outros formatos, com ações:
 *  - Baixar (via Blob signed URL)
 *  - Promover ao Cofre (gated por papel + produto vinculado)
 *  - Ver na tarefa (deep-link para o detalhe com o anexo selecionado)
 *
 * O upload em si segue passando por `useProjetoTarefaDetalhe.uploadAnexo`,
 * ou seja, o anexo já está salvo na tarefa automaticamente. Esta card
 * apenas oferece a promoção opcional ao Cofre.
 */
import { useEffect, useState } from "react";
import { Download, ExternalLink, FileText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { TarefaMessageAnexo } from "@/hooks/useProjetoTarefaDetalhe";
import { PromoverAnexoCofreDialog } from "./PromoverAnexoCofreDialog";

interface Props {
  anexo: TarefaMessageAnexo;
  getUrl: (path: string) => Promise<string | undefined>;
  onOpenInTask?: () => void;
  /** Renderiza com cores compatíveis quando a bolha for do próprio usuário. */
  ownVariant?: boolean;
  /** Compact = tipografia menor (usar em painéis estreitos). */
  compact?: boolean;

  // ----- Cofre -----
  /** Habilita botão "Promover ao Cofre". */
  canPromoteToCofre?: boolean;
  /** Produto vinculado à tarefa (obrigatório para promover). */
  produtoId?: string | null;
  projetoId?: string | null;
  sendToCofre?: {
    mutateAsync: (args: {
      anexoIds: string[];
      produtoId: string;
      categoriasPorAnexo: Record<string, string>;
      projetoId?: string;
    }) => Promise<unknown>;
    isPending?: boolean;
  };
}

export function ChatAnexoCard({
  anexo,
  getUrl,
  onOpenInTask,
  ownVariant = false,
  compact = false,
  canPromoteToCofre = false,
  produtoId,
  projetoId,
  sendToCofre,
}: Props) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [promoted, setPromoted] = useState(false);
  const isImage = (anexo.tipo_arquivo ?? "").startsWith("image/");

  useEffect(() => {
    let cancel = false;
    if (!isImage) return;
    getUrl(anexo.storage_path).then((u) => {
      if (!cancel && u) setImgUrl(u);
    });
    return () => {
      cancel = true;
    };
  }, [anexo.storage_path, isImage, getUrl]);

  const handleDownload = async () => {
    try {
      const u = await getUrl(anexo.storage_path);
      if (!u) {
        toast.error("Não foi possível obter o arquivo.");
        return;
      }
      const res = await fetch(u);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = anexo.nome;
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objUrl), 1500);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no download.");
    }
  };

  const sizeKb = anexo.tamanho ? (anexo.tamanho / 1024).toFixed(0) : null;
  const showPromote = canPromoteToCofre && !!sendToCofre && !promoted;
  const promoteDisabled = !produtoId;

  return (
    <>
      <div
        className={cn(
          "rounded-lg overflow-hidden border",
          ownVariant
            ? "border-primary-foreground/30 bg-primary-foreground/10"
            : "border-border bg-background",
        )}
      >
        {isImage && imgUrl ? (
          <button
            type="button"
            onClick={onOpenInTask}
            className="block w-full max-w-[260px]"
          >
            <img
              src={imgUrl}
              alt={anexo.nome}
              loading="lazy"
              className="w-full h-auto max-h-[220px] object-cover"
            />
          </button>
        ) : (
          <div className="flex items-center gap-2 p-2">
            <FileText className={cn("shrink-0 opacity-70", compact ? "h-4 w-4" : "h-5 w-5")} />
            <div className="flex-1 min-w-0">
              <div className={cn("font-medium truncate", compact ? "text-[11px]" : "text-xs")}>
                {anexo.nome}
              </div>
              {sizeKb && (
                <div className={cn("opacity-70", compact ? "text-[9px]" : "text-[10px]")}>
                  {sizeKb} KB
                </div>
              )}
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={handleDownload}
              title="Baixar"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        <div
          className={cn(
            "flex items-center gap-1 px-1 py-0.5 border-t flex-wrap",
            ownVariant
              ? "border-primary-foreground/20"
              : "border-border",
          )}
        >
          {onOpenInTask && (
            <button
              type="button"
              onClick={onOpenInTask}
              className={cn(
                "px-1.5 py-1 text-[10px] flex items-center gap-1 rounded",
                ownVariant
                  ? "hover:bg-primary-foreground/10"
                  : "hover:bg-muted",
              )}
              title="Abrir anexo no detalhe da tarefa"
            >
              <ExternalLink className="h-3 w-3" /> Ver na tarefa
            </button>
          )}

          {isImage && (
            <button
              type="button"
              onClick={handleDownload}
              className={cn(
                "px-1.5 py-1 text-[10px] flex items-center gap-1 rounded",
                ownVariant ? "hover:bg-primary-foreground/10" : "hover:bg-muted",
              )}
              title="Baixar"
            >
              <Download className="h-3 w-3" /> Baixar
            </button>
          )}

          {showPromote && (
            <button
              type="button"
              onClick={() => {
                if (promoteDisabled) {
                  toast.info("Vincule um produto à tarefa para usar o Cofre.");
                  return;
                }
                setPromoteOpen(true);
              }}
              disabled={promoteDisabled}
              className={cn(
                "px-1.5 py-1 text-[10px] flex items-center gap-1 rounded ml-auto",
                promoteDisabled && "opacity-50 cursor-not-allowed",
                ownVariant ? "hover:bg-primary-foreground/10" : "hover:bg-muted",
              )}
              title={
                promoteDisabled
                  ? "Vincule um produto à tarefa"
                  : "Promover este documento ao Cofre"
              }
            >
              <ShieldCheck className="h-3 w-3" /> Promover ao Cofre
            </button>
          )}

          {promoted && (
            <span className="ml-auto px-1.5 py-1 text-[10px] flex items-center gap-1 text-emerald-500">
              <ShieldCheck className="h-3 w-3" /> No Cofre
            </span>
          )}
        </div>
      </div>

      {showPromote && produtoId && sendToCofre && (
        <PromoverAnexoCofreDialog
          open={promoteOpen}
          onOpenChange={setPromoteOpen}
          anexoId={anexo.id}
          anexoNome={anexo.nome}
          produtoId={produtoId}
          projetoId={projetoId}
          sendToCofre={sendToCofre}
          onPromoted={() => setPromoted(true)}
        />
      )}
    </>
  );
}
