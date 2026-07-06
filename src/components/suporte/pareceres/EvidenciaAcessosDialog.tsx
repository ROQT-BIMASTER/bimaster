import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Download, Eye } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEvidenciaAcessos } from "@/hooks/suporte/useEvidencias";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  evidenciaId: string | null;
  nomeArquivo?: string;
}

export function EvidenciaAcessosDialog({
  open,
  onOpenChange,
  evidenciaId,
  nomeArquivo,
}: Props) {
  const { data: acessos = [], isLoading } = useEvidenciaAcessos(
    open ? evidenciaId : null,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            Cadeia de custódia
            {nomeArquivo && (
              <span className="block text-xs text-muted-foreground font-normal mt-0.5 truncate">
                {nomeArquivo}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : acessos.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            Nenhum acesso registrado ainda.
          </p>
        ) : (
          <ul className="space-y-2">
            {acessos.map((a) => (
              <li
                key={a.id}
                className="text-xs rounded border bg-card p-2 flex items-start gap-2"
              >
                {a.acao === "download" ? (
                  <Download className="h-3.5 w-3.5 text-primary mt-0.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono truncate">{a.user_id.slice(0, 8)}...</span>
                    <span className="text-muted-foreground">
                      {format(new Date(a.created_at), "dd/MM/yyyy HH:mm:ss", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                  {a.user_agent && (
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                      {a.user_agent}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
