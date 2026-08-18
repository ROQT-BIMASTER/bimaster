/**
 * ChecklistItemAdminPanel — bloco administrativo compartilhado para qualquer
 * item do checklist China–Brasil. Expõe, em abas:
 *  - Pareceres   : histórico de rodadas + ações Aprovar / Rejeitar / Ciência
 *                  / Substituir-com-parecer (DrawerParecerActions).
 *  - Comentários : conversa administrativa (DrawerComentariosTab) com
 *                  menções (@) bilaterais e anexos complementares.
 *
 * Usado em:
 *  - FlowItemFocusDrawer (Caixa de Entrada Brasil + ChecklistSubmissaoSheet)
 *  - ChinaChecklistFocusMode (Modo Foco lado China)
 *  - ChecklistItemPainel (Status do Checklist)
 *  - ChecklistC2BSheet (Brasil olhando China→Brasil)
 *
 * Garante que pareceres, histórico de rodadas e menções refletem em todos
 * os ambientes em que o checklist é renderizado.
 */
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DrawerParecerActions } from "@/components/china/inbox/ChecklistFlow/DrawerParecerActions";
import { DrawerRevisoesList } from "@/components/china/inbox/ChecklistFlow/DrawerRevisoesList";
import { DrawerComentariosTab } from "@/components/china/inbox/ChecklistFlow/DrawerComentariosTab";
import type { FlowBucket } from "@/lib/china/flowTones";

interface Props {
  documentoId: string;
  submissaoId: string;
  tipoDocumento: string;
  tipoDocumentoLabel?: string;
  bucket: FlowBucket;
  /** Lado do usuário corrente — usado para gravar comentários/pareceres. */
  lado: "brasil" | "china";
  /** Pode dar parecer (aprovar/rejeitar/ciência) — geralmente o lado que recebeu. */
  isReceiver: boolean;
  /** Pode substituir o arquivo com parecer — geralmente o lado que enviou. */
  isSender: boolean;
  /** Restringe quais ações de parecer aparecem (default: todas). */
  allowedActions?: {
    aprovar?: boolean;
    rejeitar?: boolean;
    ciencia?: boolean;
    substituir?: boolean;
  };
  /** Aba inicial. */
  defaultTab?: "parecer" | "comentarios";
  /**
   * Quando o painel já está dentro de outra navegação por abas (ex.:
   * FlowItemFocusDrawer), esconde a barra interna e renderiza apenas a
   * seção de `defaultTab` — evita duas navegações idênticas aninhadas.
   */
  hideTabs?: boolean;
  className?: string;
}

export function ChecklistItemAdminPanel({
  documentoId,
  submissaoId,
  tipoDocumento,
  tipoDocumentoLabel,
  bucket,
  lado,
  isReceiver,
  isSender,
  allowedActions,
  defaultTab = "parecer",
  hideTabs = false,
  className,
}: Props) {
  const parecerSection = (
    <>
      <DrawerParecerActions
        documentoId={documentoId}
        submissaoId={submissaoId}
        tipoDocumento={tipoDocumento}
        tipoDocumentoLabel={tipoDocumentoLabel}
        bucket={bucket}
        isReceiver={isReceiver}
        isSender={isSender}
        allowedActions={allowedActions}
      />
      <DrawerRevisoesList
        submissaoId={submissaoId}
        documentoId={documentoId}
      />
    </>
  );

  const comentariosSection = (
    <DrawerComentariosTab
      documentoId={documentoId}
      submissaoId={submissaoId}
      tipoDocumento={tipoDocumento}
      lado={lado}
    />
  );

  if (hideTabs) {
    return defaultTab === "comentarios" ? (
      <div className={className}>{comentariosSection}</div>
    ) : (
      <div className={className ? `${className} space-y-3` : "space-y-3"}>
        {parecerSection}
      </div>
    );
  }

  return (
    <Tabs defaultValue={defaultTab} className={className}>
      <TabsList className="h-8 grid w-full grid-cols-2">
        <TabsTrigger value="parecer" className="h-7 text-[11px]">
          Pareceres
        </TabsTrigger>
        <TabsTrigger value="comentarios" className="h-7 text-[11px]">
          Comentários
        </TabsTrigger>
      </TabsList>

      <TabsContent value="parecer" className="mt-3 space-y-3">
        {parecerSection}
      </TabsContent>

      <TabsContent value="comentarios" className="mt-3">
        {comentariosSection}
      </TabsContent>
    </Tabs>
  );
}
