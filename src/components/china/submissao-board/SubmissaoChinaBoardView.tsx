import { useSubmissaoDoProjetoEspelho } from "@/hooks/useProjetoEspelhoSubmissao";
import { Card } from "@/components/ui/card";
import { Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface Props {
  projetoId: string;
}

/**
 * Aba "Submissão China" do projeto-espelho.
 *
 * Hoje resolve a submissão vinculada e oferece atalhos para os fluxos
 * existentes (Caixa de Entrada da China filtrada por essa submissão e Mesa
 * China). A versão Kanban embarcada (drag-and-drop com Central de Aprovações)
 * será conectada nas próximas iterações reutilizando o `MailboxKanban` com
 * `perspective="brasil"` escopado por `submissao_id`.
 */
export function SubmissaoChinaBoardView({ projetoId }: Props) {
  const navigate = useNavigate();
  const { data, isLoading } = useSubmissaoDoProjetoEspelho(projetoId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando submissão vinculada…
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="p-6 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
        <div>
          <p className="text-sm font-medium">Sem submissão vinculada</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Este projeto está marcado como "projeto-espelho" mas a submissão China original não
            foi encontrada. Acesse a Mesa China para vincular ou criar a partir de uma submissão.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3 gap-1.5 h-7 text-xs"
            onClick={() => navigate("/dashboard/projetos/vincular-china")}
          >
            <ExternalLink className="h-3 w-3" /> Abrir Mesa China
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="text-sm font-medium">Submissão vinculada</p>
        <p className="text-xs text-muted-foreground mt-1">
          ID: <code className="font-mono">{data.submissao_id}</code>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-7 text-xs"
            onClick={() =>
              navigate(`/dashboard/fabrica-china/caixa-entrada?submissao=${data.submissao_id}`)
            }
          >
            <ExternalLink className="h-3 w-3" /> Abrir na Caixa de Entrada
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-7 text-xs"
            onClick={() => navigate("/dashboard/projetos/vincular-china")}
          >
            <ExternalLink className="h-3 w-3" /> Abrir Mesa China
          </Button>
        </div>
      </Card>

      <Card className="p-4 border-dashed">
        <p className="text-sm font-medium">Kanban embarcado da submissão</p>
        <p className="text-xs text-muted-foreground mt-1">
          A visão Kanban com colunas <strong>Recebidos da China · Em Aprovação · Aprovados ·
          Devolvidos · Vinculados</strong> será embarcada aqui em breve, ligada à Central de
          Aprovações por realtime. Por enquanto, use os atalhos acima para acompanhar o fluxo
          completo nas telas dedicadas.
        </p>
      </Card>
    </div>
  );
}
