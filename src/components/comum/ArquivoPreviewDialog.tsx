/**
 * Visualizador genérico de arquivos (qualquer bucket).
 *
 * - Imagens em tamanho grande (com zoom por clique).
 * - PDF em iframe.
 * - Demais formatos: aviso + download autenticado (blob).
 * - Navegação anterior/próximo quando recebe uma lista de arquivos.
 */
import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getSignedUrl } from "@/lib/utils/storage-helper";
import { useRenderMetrics } from "@/hooks/useRenderMetrics";
import { measureAsync, perfMark, startTimer } from "@/lib/debug/perfMetrics";
import { downloadStorageBlob, triggerBlobDownload } from "@/lib/utils/storage-download";
import { toast } from "sonner";

export interface ArquivoPreviewItem {
  id?: string;
  nome: string;
  bucket: string;
  storage_path: string | null;
  /** URL direta (opcional) quando não houver caminho no storage. */
  url?: string | null;
  descricao?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  arquivos: ArquivoPreviewItem[];
  /** Índice inicial dentro da lista. */
  indiceInicial?: number;
}

function isImagem(nome: string) {
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg|heic|tiff)$/i.test(nome);
}

function isPdf(nome: string) {
  return /\.pdf$/i.test(nome);
}

type Status = "idle" | "loading" | "ready" | "error";

export function ArquivoPreviewDialog({ open, onOpenChange, arquivos, indiceInicial = 0 }: Props) {
  useRenderMetrics("ArquivoPreviewDialog", {
    open,
    indiceInicial,
    totalArquivos: arquivos.length,
  });
  const [indice, setIndice] = useState(indiceInicial);
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [erro, setErro] = useState<string | null>(null);
  const [baixando, setBaixando] = useState(false);
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    if (open) setIndice(indiceInicial);
  }, [open, indiceInicial]);

  const atual = arquivos[indice];
  const nome = atual?.nome || atual?.storage_path?.split("/").pop() || "arquivo";
  const mostrarImagem = isImagem(nome);
  const mostrarPdf = isPdf(nome);

  const resolver = useCallback(async () => {
    if (!atual) return;
    setStatus("loading");
    setErro(null);
    setUrl(null);
    setZoom(false);
    try {
      if (atual.storage_path) {
        const { signedUrl, error } = await getSignedUrl(atual.bucket, atual.storage_path, 3600);
        if (error || !signedUrl) {
          setStatus("error");
          setErro(error?.message ?? "Não foi possível carregar o arquivo.");
          return;
        }
        setUrl(signedUrl);
        setStatus("ready");
      } else if (atual.url) {
        setUrl(atual.url);
        setStatus("ready");
      } else {
        setStatus("error");
        setErro("Arquivo indisponível.");
      }
    } catch (e: any) {
      setStatus("error");
      setErro(e?.message ?? "Não foi possível carregar o arquivo.");
    }
  }, [atual]);

  useEffect(() => {
    if (!open) {
      setUrl(null);
      setStatus("idle");
      setErro(null);
      return;
    }
    resolver();
  }, [open, resolver]);

  const handleDownload = async () => {
    if (!atual) return;
    setBaixando(true);
    try {
      const result = await downloadStorageBlob(
        atual.storage_path || atual.url || "",
        nome,
        atual.bucket,
      );
      if (result.blobUrl) {
        triggerBlobDownload(result.blobUrl, result.filename);
      } else {
        toast.error(result.error || "Não foi possível baixar o arquivo.");
      }
    } finally {
      setBaixando(false);
    }
  };

  const temNavegacao = arquivos.length > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm font-medium truncate pr-8">
            {nome}
            {temNavegacao && (
              <span className="text-muted-foreground font-normal ml-2">
                ({indice + 1}/{arquivos.length})
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-auto">
          {status === "loading" ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : status === "error" || !url ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
              <AlertTriangle className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium">Não foi possível carregar o arquivo.</p>
              {erro && <p className="text-xs text-muted-foreground max-w-md break-words">{erro}</p>}
              <Button size="sm" variant="outline" onClick={resolver} className="gap-1.5 mt-2">
                <RefreshCw className="h-3.5 w-3.5" />
                Tentar novamente
              </Button>
            </div>
          ) : mostrarImagem ? (
            <img
              src={url}
              alt={nome}
              onClick={() => setZoom((z) => !z)}
              className={cn(
                "mx-auto rounded-md cursor-zoom-in",
                zoom ? "w-auto max-w-none cursor-zoom-out" : "w-full h-auto object-contain max-h-[70vh]",
              )}
              onError={() => {
                setStatus("error");
                setErro("Não foi possível carregar a imagem.");
              }}
            />
          ) : mostrarPdf ? (
            <iframe
              src={url}
              className="w-full h-[70vh] rounded-md border"
              title={nome}
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <FileText className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Pré-visualização não disponível para este formato.
              </p>
              <p className="text-xs text-muted-foreground">Use o botão abaixo para baixar o arquivo.</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t">
          <div className="flex items-center gap-1">
            {temNavegacao && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIndice((i) => (i - 1 + arquivos.length) % arquivos.length)}
                  className="gap-1"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIndice((i) => (i + 1) % arquivos.length)}
                  className="gap-1"
                >
                  Próximo
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={baixando || !atual}
              className="gap-1.5"
            >
              {baixando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Baixar
            </Button>
            {url && (
              <Button variant="outline" size="sm" asChild>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  Abrir
                </a>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
