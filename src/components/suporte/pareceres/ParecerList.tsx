import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Eye, EyeOff, FileText, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  useTicketPareceres,
  useTicketParecerAnexos,
  baixarAnexoParecer,
  type SuportePareceRow,
} from "@/hooks/suporte/usePareceres";
import { useSuporteFilas } from "@/hooks/suporte/useSuporteFilas";
import { toast } from "sonner";

const TIPO_LABEL: Record<SuportePareceRow["tipo"], string> = {
  parecer: "Parecer",
  orientacao: "Orientação",
  analise_tecnica: "Análise técnica",
  encaminhamento: "Encaminhamento",
  conclusao: "Conclusão",
};

interface Props {
  ticketId: string;
  onlyExterno?: boolean;
}

export function ParecerList({ ticketId, onlyExterno = false }: Props) {
  const { data: pareceres = [], isLoading } = useTicketPareceres(ticketId);
  const { data: anexos = [] } = useTicketParecerAnexos(ticketId);
  const { data: filas = [] } = useSuporteFilas();

  const rows = onlyExterno
    ? pareceres.filter((p) => p.visibilidade === "externo")
    : pareceres;

  if (isLoading) {
    return <p className="text-xs text-muted-foreground">Carregando pareceres...</p>;
  }

  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-6">
        {onlyExterno
          ? "Nenhum retorno da equipe até o momento."
          : "Ainda não há pareceres neste chamado."}
      </p>
    );
  }

  const filaNome = (id: string | null) =>
    id ? filas.find((f) => f.id === id)?.nome ?? "—" : "—";

  async function onDownload(anexoId: string) {
    const a = anexos.find((x) => x.id === anexoId);
    if (!a) return;
    try {
      await baixarAnexoParecer(a);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no download");
    }
  }

  return (
    <ul className="space-y-2">
      {rows.map((p) => {
        const parecerAnexos = anexos.filter((a) => a.parecer_id === p.id);
        return (
          <li key={p.id} className="rounded-md border bg-card p-3 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-[10px]">
                {TIPO_LABEL[p.tipo]}
              </Badge>
              <Badge
                variant={p.visibilidade === "externo" ? "default" : "secondary"}
                className="text-[10px] gap-1"
              >
                {p.visibilidade === "externo" ? (
                  <><Eye className="h-3 w-3" /> Externo</>
                ) : (
                  <><EyeOff className="h-3 w-3" /> Interno</>
                )}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {filaNome(p.fila_id)}
              </span>
              <span className="text-xs text-muted-foreground ml-auto">
                {format(new Date(p.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </span>
            </div>

            {p.titulo && <p className="text-sm font-medium">{p.titulo}</p>}
            <p className="text-sm whitespace-pre-wrap">{p.conteudo}</p>

            {p.acao_tomada && (
              <div className="text-xs bg-muted rounded px-2 py-1">
                <span className="font-medium">Ação:</span> {p.acao_tomada}
              </div>
            )}

            {p.encaminhado_para_fila_id && (
              <div className="text-xs inline-flex items-center gap-1 text-muted-foreground">
                <ArrowRight className="h-3 w-3" />
                Encaminhado para {filaNome(p.encaminhado_para_fila_id)}
              </div>
            )}

            {parecerAnexos.length > 0 && (
              <ul className="space-y-1 pt-1 border-t">
                {parecerAnexos.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 text-xs">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate flex-1">{a.nome}</span>
                    {a.tamanho != null && (
                      <span className="text-muted-foreground">
                        {(a.tamanho / 1024).toFixed(0)} KB
                      </span>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => onDownload(a.id)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
