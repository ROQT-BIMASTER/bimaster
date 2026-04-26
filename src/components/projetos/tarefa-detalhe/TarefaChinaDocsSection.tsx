import { useChinaDocsDaTarefa } from "@/hooks/useChinaDocsDaTarefa";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download, Ship, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  tarefaId: string;
}

export function TarefaChinaDocsSection({ tarefaId }: Props) {
  const { data: docs = [], isLoading } = useChinaDocsDaTarefa(tarefaId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Ship className="h-4 w-4 text-primary" />
          Documentos da China
        </h3>
        <p className="text-xs text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Ship className="h-4 w-4 text-primary" />
          Documentos da China
        </h3>
        <p className="text-xs text-muted-foreground">
          Nenhum documento da China vinculado a esta tarefa ainda.
        </p>
      </div>
    );
  }

  const handleOpen = async (path: string | null, url: string | null, nome: string) => {
    try {
      if (path) {
        const { data, error } = await supabase.storage
          .from("china-documentos")
          .createSignedUrl(path, 3600);
        if (error) throw error;
        if (data?.signedUrl) {
          window.open(data.signedUrl, "_blank", "noopener,noreferrer");
          return;
        }
      }
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
      toast.error("Documento sem arquivo associado");
    } catch (err: any) {
      toast.error("Erro ao abrir documento: " + (err?.message || "desconhecido"));
    }
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Ship className="h-4 w-4 text-primary" />
        Documentos da China
        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{docs.length}</Badge>
      </h3>

      <div className="space-y-2">
        {docs.map((d) => (
          <div
            key={d.vinculo_id}
            className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-card hover:bg-muted/30 transition-colors"
          >
            <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="h-4 w-4 text-primary" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium truncate">
                  {d.nome_arquivo || d.tipo_documento}
                </p>
                <Badge variant="outline" className="text-[10px] h-4">
                  {d.tipo_documento}
                </Badge>
                {d.status && (
                  <Badge variant="secondary" className="text-[10px] h-4">
                    {d.status}
                  </Badge>
                )}
              </div>

              {(d.produto_codigo || d.produto_nome) && (
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {d.produto_codigo} · {d.produto_nome}
                </p>
              )}

              <div className="flex items-center gap-2 mt-1.5">
                <Avatar className="h-4 w-4">
                  <AvatarImage src={d.vinculado_por_avatar || undefined} />
                  <AvatarFallback className="text-[8px] bg-muted">
                    {(d.vinculado_por_nome || "?").substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-[10px] text-muted-foreground">
                  Anexado por {d.vinculado_por_nome || "Sistema"} ·{" "}
                  {format(new Date(d.created_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
              </div>
            </div>

            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 shrink-0"
              onClick={() => handleOpen(d.arquivo_path, d.arquivo_url, d.nome_arquivo || d.tipo_documento)}
              title="Abrir documento"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
