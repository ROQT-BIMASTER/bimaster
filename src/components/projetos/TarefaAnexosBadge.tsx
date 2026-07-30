/**
 * Indicador de arquivos no card do quadro (Kanban).
 *
 * - Mostra contador de arquivos e até 3 miniaturas quando houver imagens.
 * - Ícone por tipo para os demais formatos.
 * - Tarefas de checklist sem arquivo recebem o selo "Aguardando documentos".
 */
import { useQuery } from "@tanstack/react-query";
import { Paperclip, FileText, FileSpreadsheet, Image as ImageIcon, PenTool, FileQuestion } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSignedUrl } from "@/lib/utils/storage-helper";
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

function Miniatura({ arquivo }: { arquivo: TarefaArquivo }) {
  const { data: url } = useQuery({
    queryKey: ["tarefa-anexo-thumb", arquivo.bucket, arquivo.storage_path],
    enabled: !!arquivo.storage_path && arquivo.familia === "imagem",
    staleTime: 50 * 60 * 1000,
    gcTime: 55 * 60 * 1000,
    queryFn: async () => {
      const { signedUrl } = await getSignedUrl(arquivo.bucket, arquivo.storage_path as string);
      return signedUrl;
    },
  });

  return (
    <div className="h-8 w-8 rounded border border-border/50 bg-muted overflow-hidden flex items-center justify-center">
      {url ? (
        <img src={url} alt={arquivo.nome} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <ImageIcon className="h-3.5 w-3.5 text-muted-foreground/60" />
      )}
    </div>
  );
}

interface Props {
  resumo?: TarefaArquivosResumo;
  /** Quando true, exibe "Aguardando documentos" se não houver arquivos. */
  esperaDocumentos?: boolean;
  darkBg?: boolean;
}

export function TarefaAnexosBadge({ resumo, esperaDocumentos = false, darkBg = false }: Props) {
  const total = resumo?.total ?? 0;

  if (total === 0) {
    if (!esperaDocumentos) return null;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 border border-dashed",
          darkBg ? "text-white/50 border-white/20" : "text-muted-foreground border-border",
        )}
      >
        <Paperclip className="h-3 w-3" />
        Aguardando documentos
      </span>
    );
  }

  const imagens = resumo!.arquivos.filter((a) => a.familia === "imagem").slice(0, 3);
  const outros = resumo!.arquivos.filter((a) => a.familia !== "imagem");
  const tiposUnicos = [...new Set(outros.map((a) => a.familia))].slice(0, 3);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span
        className={cn(
          "inline-flex items-center gap-1 text-[10px] font-medium rounded px-1.5 py-0.5",
          darkBg ? "bg-white/10 text-white/80" : "bg-primary/10 text-primary",
        )}
        title={resumo!.arquivos.map((a) => a.nome).join("\n")}
      >
        <Paperclip className="h-3 w-3" />
        {total} {total === 1 ? "arquivo" : "arquivos"}
      </span>

      {tiposUnicos.map((f) => (
        <span
          key={f}
          className={cn(
            "inline-flex items-center rounded p-0.5",
            darkBg ? "text-white/60" : "text-muted-foreground",
          )}
        >
          <IconePorFamilia familia={f} />
        </span>
      ))}

      {imagens.length > 0 && (
        <div className="flex items-center gap-1 mt-1 w-full">
          {imagens.map((a) => (
            <Miniatura key={a.id} arquivo={a} />
          ))}
        </div>
      )}
    </div>
  );
}
