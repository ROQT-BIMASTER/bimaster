import { secureDownload } from "@/lib/utils/secure-download";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2, XCircle, ArrowRightCircle, ExternalLink, FileText, Workflow, Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAvancarItem, type KanbanItem } from "@/hooks/useKanbanAprovacoes";

interface Props {
  item: KanbanItem | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ItemAprovacaoDrawer({ item, open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const avancar = useAvancarItem();
  const [comentario, setComentario] = useState("");

  if (!item) return null;

  const isResponsavel = item.responsavel_atual_id === user?.id;
  const aberto = item.status === "em_andamento";
  const isEncaminhamento = item.etapa_tipo === "encaminhamento";

  async function decidir(decisao: "aprovado" | "rejeitado" | "encaminhado") {
    if (!item) return;
    await avancar.mutateAsync({ itemId: item.id, decisao, comentario: comentario || undefined });
    setComentario("");
    onOpenChange(false);
  }

  const breadcrumb = [item.projeto_nome, item.secao_nome, item.tarefa_titulo].filter(Boolean).join(" › ");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-1">
          <SheetTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            {item.documento_nome || item.documento_tipo || "Documento"}
          </SheetTitle>
          {breadcrumb && <SheetDescription className="text-xs">{breadcrumb}</SheetDescription>}
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {item.pipeline_nome && (
              <Badge variant="outline" className="text-[10px]">
                <Workflow className="h-3 w-3 mr-1" /> {item.pipeline_nome}
              </Badge>
            )}
            {item.etapa_nome && (
              <Badge variant="secondary" className="text-[10px]">{item.etapa_nome}</Badge>
            )}
            {item.lote_nome && (
              <Badge variant="outline" className="text-[10px]">Lote: {item.lote_nome}</Badge>
            )}
            <Badge
              variant={item.status === "aprovado" ? "default" : item.status === "rejeitado" ? "destructive" : "outline"}
              className="text-[10px]"
            >
              {item.status}
            </Badge>
          </div>

          {item.responsavel_nome && (
            <p className="text-xs text-muted-foreground">
              Responsável atual: <span className="font-medium text-foreground">{item.responsavel_nome}</span>
            </p>
          )}

          {item.documento_url && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => secureDownload(item.documento_url!, undefined, "projeto-anexos")}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-2" /> Abrir documento
            </Button>
          )}

          {aberto && isResponsavel && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-medium">Decidir</p>
                <Textarea
                  placeholder="Comentário (opcional)"
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  className="text-xs min-h-[64px]"
                />
                <div className="grid grid-cols-1 gap-2">
                  {isEncaminhamento ? (
                    <Button
                      onClick={() => decidir("encaminhado")}
                      disabled={avancar.isPending}
                      size="sm"
                    >
                      {avancar.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                      ) : (
                        <ArrowRightCircle className="h-3.5 w-3.5 mr-2" />
                      )}
                      Encaminhar para próximo pipeline
                    </Button>
                  ) : (
                    <Button
                      onClick={() => decidir("aprovado")}
                      disabled={avancar.isPending}
                      size="sm"
                    >
                      {avancar.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
                      )}
                      Aprovar e avançar
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    onClick={() => decidir("rejeitado")}
                    disabled={avancar.isPending}
                    size="sm"
                  >
                    <XCircle className="h-3.5 w-3.5 mr-2" /> Rejeitar
                  </Button>
                </div>
              </div>
            </>
          )}

          {aberto && !isResponsavel && (
            <p className="text-xs text-muted-foreground border border-dashed rounded p-2">
              Apenas o responsável atual pode decidir. Você pode acompanhar a evolução aqui.
            </p>
          )}

          {item.tarefa_id && item.projeto_id && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                onOpenChange(false);
                navigate(`/dashboard/projetos/${item.projeto_id}?tarefa=${item.tarefa_id}`);
              }}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-2" /> Abrir tarefa no projeto
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
