import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, Upload, Trash2, Download, Eye, 
  CheckCircle, Clock, XCircle, Loader2, Image, Film, File
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TaskFile {
  id: string;
  nome: string;
  url: string;
  tipo?: string | null;
  tamanho_bytes?: number | null;
  versao: number;
  status: string;
  created_at: string;
}

interface TaskFilesProps {
  tarefaId: string;
  files: TaskFile[];
}

const statusConfig: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  pendente: { label: 'Pendente', icon: Clock, color: 'text-amber-500' },
  aprovado: { label: 'Aprovado', icon: CheckCircle, color: 'text-green-500' },
  rejeitado: { label: 'Rejeitado', icon: XCircle, color: 'text-red-500' }
};

function getFileIcon(tipo?: string | null) {
  if (!tipo) return File;
  if (tipo.startsWith('image/')) return Image;
  if (tipo.startsWith('video/')) return Film;
  return FileText;
}

function formatFileSize(bytes?: number | null): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TaskFiles({ tarefaId, files }: TaskFilesProps) {
  const [isUploading, setIsUploading] = useState(false);
  const queryClient = useQueryClient();

  const uploadFile = useMutation({
    mutationFn: async (file: File) => {
      setIsUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      // Upload to storage
      const fileName = `${Date.now()}-${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('marketing-files')
        .upload(`tasks/${tarefaId}/${fileName}`, file);
      
      if (uploadError) {
        // Se o bucket não existe, salva só a referência
        const { error } = await supabase
          .from('marketing_task_files')
          .insert({
            tarefa_id: tarefaId,
            nome: file.name,
            url: `pending://${fileName}`,
            tipo: file.type,
            tamanho_bytes: file.size,
            created_by: user?.id
          });
        if (error) throw error;
        return;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('marketing-files')
        .getPublicUrl(uploadData.path);

      // Save to database
      const { error } = await supabase
        .from('marketing_task_files')
        .insert({
          tarefa_id: tarefaId,
          nome: file.name,
          url: publicUrl,
          tipo: file.type,
          tamanho_bytes: file.size,
          created_by: user?.id
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-detail', tarefaId] });
      toast.success('Arquivo enviado!');
    },
    onError: () => toast.error('Erro ao enviar arquivo'),
    onSettled: () => setIsUploading(false)
  });

  const deleteFile = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('marketing_task_files')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-detail', tarefaId] });
      toast.success('Arquivo removido');
    },
    onError: () => toast.error('Erro ao remover arquivo')
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile.mutate(file);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Arquivos ({files.length})
        </h4>
      </div>

      {/* Files list */}
      <div className="space-y-2">
        {files.map(file => {
          const FileIcon = getFileIcon(file.tipo);
          const status = statusConfig[file.status] || statusConfig.pendente;
          const StatusIcon = status.icon;

          return (
            <div 
              key={file.id}
              className="flex items-center gap-3 p-2 rounded-lg border bg-card hover:bg-muted/50 transition-colors group"
            >
              <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
                <FileIcon className="h-5 w-5 text-muted-foreground" />
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.nome}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatFileSize(file.tamanho_bytes)}</span>
                  <span>•</span>
                  <span>v{file.versao}</span>
                  <span>•</span>
                  <span>{format(new Date(file.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                </div>
              </div>

              <Badge variant="outline" className={cn("text-xs shrink-0", status.color)}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {status.label}
              </Badge>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!file.url.startsWith('pending://') && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      asChild
                    >
                      <a href={file.url} target="_blank" rel="noopener noreferrer">
                        <Eye className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      asChild
                    >
                      <a href={file.url} download={file.nome}>
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => deleteFile.mutate(file.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          );
        })}

        {files.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-lg">
            Nenhum arquivo enviado
          </p>
        )}
      </div>

      {/* Upload button */}
      <label className="block">
        <input
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          disabled={isUploading}
        />
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs cursor-pointer"
          disabled={isUploading}
          asChild
        >
          <span>
            {isUploading ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Upload className="h-3 w-3 mr-1" />
            )}
            {isUploading ? 'Enviando...' : 'Enviar Arquivo'}
          </span>
        </Button>
      </label>
    </div>
  );
}