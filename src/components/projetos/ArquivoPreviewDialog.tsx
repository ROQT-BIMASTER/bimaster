import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, FileText, File as FileIcon, Loader2 } from "lucide-react";
import { secureDownload } from "@/lib/utils/secure-download";
import { useSignedThumbUrl } from "@/hooks/useSignedThumbUrl";
import { detectKind } from "./ProjetoArquivosView";
import { buildReturnToTarget } from "@/lib/navigation/withReturnTo";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  arquivo: {
    nome: string;
    tipo: string | null;
    storage_path: string;
    tarefa_id: string;
    tarefa_titulo?: string;
  } | null;
  projetoId: string;
}

export function ArquivoPreviewDialog({ open, onOpenChange, arquivo, projetoId }: Props) {
  const navigate = useNavigate();
  const kind = arquivo ? detectKind(arquivo.nome, arquivo.tipo) : "other";
  const isImage = kind === "image";
  const isPdf = kind === "pdf";

  const { data: url, isLoading } = useSignedThumbUrl(
    "projeto-anexos",
    arquivo?.storage_path ?? null,
    open && (isImage || isPdf),
  );

  if (!arquivo) return null;

  const handleDownload = () => secureDownload(arquivo.storage_path, arquivo.nome, "projeto-anexos");
  const handleOpenTarefa = () => {
    const { url: target, state } = buildReturnToTarget(
      `/dashboard/projetos/${projetoId}?tarefa=${arquivo.tarefa_id}`,
      `/dashboard/projetos/${projetoId}?tab=arquivos`,
      { fromLabel: "Arquivos do projeto" },
    );
    navigate(target, { state });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden">
        <DialogHeader className="px-5 py-3 border-b border-border/40">
          <DialogTitle className="text-sm truncate pr-8">{arquivo.nome}</DialogTitle>
          {arquivo.tarefa_titulo && (
            <p className="text-xs text-muted-foreground truncate">✓ {arquivo.tarefa_titulo}</p>
          )}
        </DialogHeader>

        <div className="bg-muted/30 flex items-center justify-center min-h-[60vh] max-h-[75vh] overflow-auto">
          {isLoading && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
          {!isLoading && isImage && url && (
            <img
              src={url}
              alt={arquivo.nome}
              className="max-w-full max-h-[75vh] object-contain"
            />
          )}
          {!isLoading && isPdf && url && (
            <iframe
              src={url}
              title={arquivo.nome}
              className="w-full h-[75vh] border-0 bg-background"
            />
          )}
          {!isLoading && !isImage && !isPdf && (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <FileIcon className="h-14 w-14 opacity-40" />
              <p className="text-sm">Pré-visualização não disponível para este tipo.</p>
              <Button size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-1.5" />
                Baixar arquivo
              </Button>
            </div>
          )}
          {!isLoading && (isImage || isPdf) && !url && (
            <div className="flex flex-col items-center gap-2 text-muted-foreground py-16">
              <FileText className="h-10 w-10 opacity-40" />
              <p className="text-sm">Não foi possível carregar a pré-visualização.</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border/40">
          <Button variant="outline" size="sm" onClick={handleOpenTarefa}>
            <ExternalLink className="h-4 w-4 mr-1.5" />
            Abrir tarefa
          </Button>
          <Button size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-1.5" />
            Baixar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
