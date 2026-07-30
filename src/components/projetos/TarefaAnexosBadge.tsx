/**
 * Indicador de arquivos no card do quadro (Kanban).
 *
 * - Imagens exibidas em tamanho grande (capa + miniaturas médias).
 * - Qualquer arquivo abre o visualizador (imagem, PDF ou download).
 * - Tarefas de checklist sem arquivo recebem o selo "Aguardando documentos".
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Paperclip, FileText, FileSpreadsheet, Image as ImageIcon, PenTool, FileQuestion } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSignedUrl } from "@/lib/utils/storage-helper";
import { ArquivoPreviewDialog, type ArquivoPreviewItem } from "@/components/comum/ArquivoPreviewDialog";
import type { TarefaArquivo, TarefaArquivosResumo } from "@/hooks/useTarefasAnexos";

function IconePorFamilia({ familia, className }: { familia: TarefaArquivo["familia"]; className?: string }) {
  const props = { className: cn("h-3 w-3", className) };
  switch (familia) {
    case "imagem":
      return <ImageIcon {...props} />;
    case "pdf":
      return <FileText {...props} />;
    case "planilha":
      return <FileSpreadsheet {...props} />;
    case "vetor":
      return <PenTool {...props} />;
    default:
      return <FileQuestion {...props} />;
  }
}

function useThumbUrl(arquivo: TarefaArquivo, enabled: boolean) {
  return useQuery({
    queryKey: ["tarefa-anexo-thumb", arquivo.bucket, arquivo.storage_path],
    enabled: enabled && !!arquivo.storage_path && arquivo.familia === "imagem",
    staleTime: 50 * 60 * 1000,
    gcTime: 55 * 60 * 1000,
    queryFn: async () => {
      const { signedUrl } = await getSignedUrl(arquivo.bucket, arquivo.storage_path as string);
      return signedUrl;
    },
  });
}

function ImagemPreview({
  arquivo,
  className,
  enabled = true,
  onClick,
  overlay,
}: {
  arquivo: TarefaArquivo;
  className?: string;
  enabled?: boolean;
  onClick: () => void;
  overlay?: string;
}) {
  const { data: url } = useThumbUrl(arquivo, enabled);

  return (
    <button
      type="button"
      title={arquivo.nome}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "relative rounded-md border border-border/50 bg-muted overflow-hidden flex items-center justify-center",
        "hover:ring-2 hover:ring-primary/40 transition",
        className,
      )}
    >
      {url ? (
        <img src={url} alt={arquivo.nome} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <ImageIcon className="h-4 w-4 text-muted-foreground/60" />
      )}
      {overlay && (
        <span className="absolute inset-0 flex items-center justify-center bg-background/70 text-xs font-medium text-foreground">
          {overlay}
        </span>
      )}
    </button>
  );
}

interface Props {
  resumo?: TarefaArquivosResumo;
  /** Quando true, exibe "Aguardando documentos" se não houver arquivos. */
  esperaDocumentos?: boolean;
  darkBg?: boolean;
  /** "grande" exibe capa larga de imagem; "compacto" mantém miniaturas pequenas. */
  preview?: "grande" | "compacto";
}

/** Máximo de imagens com URL assinada resolvida por card (evita excesso de requisições). */
const MAX_IMAGENS_RESOLVIDAS = 4;

export function TarefaAnexosBadge({
  resumo,
  esperaDocumentos = false,
  darkBg = false,
  preview = "grande",
}: Props) {
  const [previewAberto, setPreviewAberto] = useState(false);
  const [indice, setIndice] = useState(0);

  const total = resumo?.total ?? 0;

  const abrir = (arquivoId: string) => {
    const idx = (resumo?.arquivos ?? []).findIndex((a) => a.id === arquivoId);
    setIndice(idx >= 0 ? idx : 0);
    setPreviewAberto(true);
  };

  if (total === 0) {
    if (!esperaDocumentos) return null;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 border border-dashed",
          darkBg ? "text-muted-foreground border-border/40" : "text-muted-foreground border-border",
        )}
      >
        <Paperclip className="h-3 w-3" />
        Aguardando documentos
      </span>
    );
  }

  const arquivos = resumo!.arquivos;
  const imagens = arquivos.filter((a) => a.familia === "imagem");
  const outros = arquivos.filter((a) => a.familia !== "imagem");

  const capa = preview === "grande" ? imagens[0] : undefined;
  const secundarias = (capa ? imagens.slice(1) : imagens).slice(0, MAX_IMAGENS_RESOLVIDAS - (capa ? 1 : 0));
  const restantes = imagens.length - (capa ? 1 : 0) - secundarias.length;

  const itensPreview: ArquivoPreviewItem[] = arquivos.map((a) => ({
    id: a.id,
    nome: a.nome,
    bucket: a.bucket,
    storage_path: a.storage_path,
  }));

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setIndice(0);
            setPreviewAberto(true);
          }}
          className={cn(
            "inline-flex items-center gap-1 text-[10px] font-medium rounded px-1.5 py-0.5 hover:opacity-80 transition",
            darkBg ? "bg-primary/20 text-primary-foreground" : "bg-primary/10 text-primary",
          )}
          title={arquivos.map((a) => a.nome).join("\n")}
        >
          <Paperclip className="h-3 w-3" />
          {total} {total === 1 ? "arquivo" : "arquivos"}
        </button>

        {outros.slice(0, 3).map((a) => (
          <button
            key={a.id}
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              abrir(a.id);
            }}
            title={a.nome}
            className={cn(
              "inline-flex items-center gap-1 max-w-[120px] rounded border px-1.5 py-0.5 text-[10px] hover:bg-muted transition",
              "border-border text-muted-foreground",
            )}
          >
            <IconePorFamilia familia={a.familia} />
            <span className="truncate">{a.nome}</span>
          </button>
        ))}
        {outros.length > 3 && (
          <span className="text-[10px] text-muted-foreground">+{outros.length - 3}</span>
        )}
      </div>

      {capa && (
        <ImagemPreview
          arquivo={capa}
          className="w-full h-32"
          onClick={() => abrir(capa.id)}
        />
      )}

      {secundarias.length > 0 && (
        <div className="flex items-center gap-1.5">
          {secundarias.map((a, i) => (
            <ImagemPreview
              key={a.id}
              arquivo={a}
              className={preview === "grande" ? "h-14 w-14" : "h-8 w-8"}
              onClick={() => abrir(a.id)}
              overlay={
                restantes > 0 && i === secundarias.length - 1 ? `+${restantes}` : undefined
              }
            />
          ))}
        </div>
      )}

      {previewAberto && (
        <div onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          <ArquivoPreviewDialog
            open={previewAberto}
            onOpenChange={setPreviewAberto}
            arquivos={itensPreview}
            indiceInicial={indice}
          />
        </div>
      )}
    </div>
  );
}
