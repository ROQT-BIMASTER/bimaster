import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, Upload, Download, Trash2, File, FileText, Image } from "lucide-react";
import type { MinhaTarefaAnexo } from "@/hooks/useMinhasTarefaDetalhe";

function getFileIcon(tipo: string | null) {
  if (!tipo) return <File className="h-4 w-4 text-muted-foreground" />;
  if (tipo.startsWith("image/")) return <Image className="h-4 w-4 text-primary" />;
  if (tipo.includes("pdf")) return <FileText className="h-4 w-4 text-destructive" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

interface Props {
  anexos: MinhaTarefaAnexo[];
  uploadAnexo: { mutate: (file: File) => void };
  deleteAnexo: { mutate: (anexo: MinhaTarefaAnexo) => void };
  getAnexoUrl: (path: string) => Promise<string>;
}

export function MinhasTarefaAnexos({ anexos, uploadAnexo, deleteAnexo, getAnexoUrl }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(f => uploadAnexo.mutate(f));
    e.target.value = "";
  };

  const handleDownload = async (anexo: MinhaTarefaAnexo) => {
    const url = await getAnexoUrl(anexo.storage_path);
    if (url) window.open(url, "_blank");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
          <Paperclip className="h-3.5 w-3.5" /> Anexos ({anexos.length})
        </h4>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-3.5 w-3.5" /> Anexar
        </Button>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
      </div>

      {anexos.length > 0 ? (
        <div className="space-y-1">
          {anexos.map(a => (
            <div key={a.id} className="flex items-center gap-2 p-1.5 rounded-md bg-muted/30 border border-border/30">
              {getFileIcon(a.tipo_arquivo)}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium truncate">{a.nome}</p>
                <p className="text-[9px] text-muted-foreground">{formatFileSize(a.tamanho)}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDownload(a)}>
                <Download className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteAnexo.mutate(a)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">Nenhum anexo.</p>
      )}
    </div>
  );
}
