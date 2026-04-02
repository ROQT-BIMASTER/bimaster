import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Paperclip, Upload, Download, Trash2, FolderOpen, File, FileText, Image } from "lucide-react";
import { toast } from "sonner";

const COFRE_CATEGORIAS = [
  "briefing", "arte_final", "rotulo", "ficha_tecnica", "laudo", "certificado", "orcamento", "nota_fiscal", "art", "outro"
];

const COFRE_CATEGORIA_LABELS: Record<string, string> = {
  briefing: "Briefing",
  arte_final: "Arte Final",
  rotulo: "Rótulo",
  ficha_tecnica: "Ficha Técnica",
  laudo: "Laudo",
  certificado: "Certificado",
  orcamento: "Orçamento",
  nota_fiscal: "Nota Fiscal",
  art: "ART",
  outro: "Outro",
};

function getFileIcon(tipo: string | null) {
  if (!tipo) return <File className="h-5 w-5" />;
  if (tipo.startsWith("image/")) return <Image className="h-5 w-5 text-blue-400" />;
  if (tipo.includes("pdf")) return <FileText className="h-5 w-5 text-red-400" />;
  return <File className="h-5 w-5 text-muted-foreground" />;
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

interface Anexo {
  id: string;
  nome: string;
  tipo_arquivo: string | null;
  tamanho: number | null;
  storage_path: string;
}

interface TarefaAnexosSectionProps {
  anexos: Anexo[];
  produtoId: string | null;
  uploadAnexo: { mutate: (file: File) => void };
  deleteAnexo: { mutate: (anexo: Anexo) => void };
  getAnexoUrl: (path: string) => Promise<string | null>;
  sendToCofre: { mutate: (data: { anexoIds: string[]; produtoId: string; categoriasPorAnexo: Record<string, string> }) => void; isPending: boolean };
}

export function TarefaAnexosSection({
  anexos, produtoId, uploadAnexo, deleteAnexo, getAnexoUrl, sendToCofre,
}: TarefaAnexosSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedAnexoIds, setSelectedAnexoIds] = useState<string[]>([]);
  const [categoriasPorAnexo, setCategoriasPorAnexo] = useState<Record<string, string>>({});
  const [cofreDialogOpen, setCofreDialogOpen] = useState(false);

  const toggleAnexoSelection = (id: string) => {
    setSelectedAnexoIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(f => uploadAnexo.mutate(f));
    e.target.value = "";
  };

  const handleDownload = async (anexo: Anexo) => {
    const url = await getAnexoUrl(anexo.storage_path);
    if (url) window.open(url, "_blank");
  };

  const handleSendToCofre = () => {
    if (!produtoId) return;
    const allHaveCategory = selectedAnexoIds.every(id => categoriasPorAnexo[id]);
    if (!allHaveCategory) {
      toast.error("Selecione uma categoria para cada documento.");
      return;
    }
    sendToCofre.mutate({
      anexoIds: selectedAnexoIds,
      produtoId,
      categoriasPorAnexo,
    });
    setCofreDialogOpen(false);
    setSelectedAnexoIds([]);
    setCategoriasPorAnexo({});
  };

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium flex items-center gap-1.5">
            <Paperclip className="h-4 w-4" /> Anexos ({anexos.length})
          </h3>
          <div className="flex items-center gap-1">
            {selectedAnexoIds.length > 0 && produtoId && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1 text-emerald-400 border-emerald-500/30"
                onClick={() => setCofreDialogOpen(true)}
              >
                <FolderOpen className="h-3.5 w-3.5" /> Enviar ao Cofre ({selectedAnexoIds.length})
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> Upload
            </Button>
          </div>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
        </div>
        {anexos.length > 0 ? (
          <div className="space-y-1.5">
            {anexos.map(a => (
              <div key={a.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/30 border border-border/30">
                <Checkbox
                  checked={selectedAnexoIds.includes(a.id)}
                  onCheckedChange={() => toggleAnexoSelection(a.id)}
                  className="flex-shrink-0"
                />
                {getFileIcon(a.tipo_arquivo)}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{a.nome}</p>
                  <p className="text-[10px] text-muted-foreground">{formatFileSize(a.tamanho)}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(a)}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteAnexo.mutate(a)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum anexo.</p>
        )}
        {!produtoId && selectedAnexoIds.length > 0 && (
          <p className="text-[10px] text-amber-400 mt-1">
            ⚠ Vincule um produto à tarefa para enviar ao Cofre
          </p>
        )}
      </div>

      {/* Cofre Dialog */}
      <Dialog open={cofreDialogOpen} onOpenChange={setCofreDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-emerald-500" />
              Enviar ao Cofre de Documentos
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm">Documentos selecionados — selecione a categoria de cada um</Label>
              <div className="mt-2 space-y-2">
                {anexos.filter(a => selectedAnexoIds.includes(a.id)).map(a => (
                  <div key={a.id} className="flex items-center gap-2 text-xs p-2 bg-muted/30 rounded-md">
                    {getFileIcon(a.tipo_arquivo)}
                    <span className="truncate flex-1 min-w-0">{a.nome}</span>
                    <Select
                      value={categoriasPorAnexo[a.id] || ""}
                      onValueChange={v => setCategoriasPorAnexo(prev => ({ ...prev, [a.id]: v }))}
                    >
                      <SelectTrigger className="h-7 w-[130px] text-[11px]">
                        <SelectValue placeholder="Categoria..." />
                      </SelectTrigger>
                      <SelectContent>
                        {COFRE_CATEGORIAS.map(c => (
                          <SelectItem key={c} value={c}>{COFRE_CATEGORIA_LABELS[c]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCofreDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSendToCofre} disabled={sendToCofre.isPending} className="gap-1.5">
              <FolderOpen className="h-4 w-4" />
              {sendToCofre.isPending ? "Enviando..." : "Enviar ao Cofre"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
