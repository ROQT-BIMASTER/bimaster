import { useMemo, useState } from "react";
import { useSubmissaoDoProjetoEspelho } from "@/hooks/useProjetoEspelhoSubmissao";
import { useChinaMailbox, type MailboxItem } from "@/hooks/useChinaMailbox";
import { useChinaUserContext } from "@/hooks/useChinaUserContext";
import { MailboxKanban } from "@/components/china/inbox/MailboxKanban";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  projetoId: string;
}

/**
 * Aba "Submissão China" do projeto-espelho.
 *
 * Embeda o `MailboxKanban` com `perspective="brasil"` filtrado pela submissão
 * vinculada. Cliques navegam para a Caixa de Entrada da China focada nessa
 * submissão (onde acontecem ações de aprovar/devolver/criar lote).
 */
export function SubmissaoChinaBoardView({ projetoId }: Props) {
  const navigate = useNavigate();
  const { data, isLoading } = useSubmissaoDoProjetoEspelho(projetoId);
  const { isBrasilUser } = useChinaUserContext();
  const mailbox = useChinaMailbox("inbox");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const submissaoId = data?.submissao_id ?? null;

  const filteredItems = useMemo<MailboxItem[]>(
    () => (mailbox.items || []).filter((i) => i.submissao_id === submissaoId),
    [mailbox.items, submissaoId],
  );
  const filteredProgress = useMemo<MailboxItem[]>(
    () => (mailbox.progressItems || []).filter((i) => i.submissao_id === submissaoId),
    [mailbox.progressItems, submissaoId],
  );

  if (isLoading || mailbox.isLoading) {
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

  const openInCaixa = (path?: string) =>
    navigate(`/dashboard/fabrica-china/caixa-entrada?submissao=${submissaoId}${path ?? ""}`);

  return (
    <div className="flex flex-col gap-3 h-[calc(100vh-220px)] min-h-[520px]">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          Submissão <code className="font-mono text-foreground">{submissaoId?.slice(0, 8)}</code>
          {" · "}perspectiva Brasil · {filteredItems.length} item(ns) no checklist
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-7 text-xs"
            onClick={() => openInCaixa()}
          >
            <ExternalLink className="h-3 w-3" /> Abrir na Caixa de Entrada
          </Button>
        </div>
      </div>

      <Card className="flex-1 overflow-hidden p-0">
        {filteredItems.length === 0 && filteredProgress.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground p-6 text-center">
            Nenhum documento desta submissão ainda. Quando a China enviar arquivos, eles aparecerão
            aqui no Kanban e poderão ser aprovados ou devolvidos.
          </div>
        ) : (
          <MailboxKanban
            items={filteredItems}
            progressItems={filteredProgress}
            selectedId={selectedId}
            perspective={isBrasilUser ? "brasil" : "china"}
            onJumpFolder={() => openInCaixa()}
            onSelectGroup={(_g, item) => {
              const id = item?.documento_id ?? item?.submissao_id ?? _g.submissao_id;
              setSelectedId(id);
              openInCaixa();
            }}
          />
        )}
      </Card>
    </div>
  );
}
