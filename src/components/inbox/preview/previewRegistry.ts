/**
 * previewRegistry — mapeia origem da inbox para o componente de
 * preview rico correspondente. Origens sem entrada caem no
 * `GenericPreview` (resumo + metadata + "Abrir tela").
 *
 * Hoje cobrimos os emissores reais (`aprovacoes`, `projetos`,
 * `processos`). As demais origens (motor_artes, composicao,
 * embalagens, amostras, china) ainda não geram inbox_items, então
 * permanecem no fallback genérico — quando começarem a emitir,
 * basta adicionar o handler aqui sem mexer no drawer.
 */
import type { ComponentType, ForwardRefExoticComponent, RefAttributes } from "react";
import type { InboxItem, InboxOrigem } from "@/hooks/useInbox";
import { AprovacaoPreview, type AprovacaoPreviewHandle } from "./AprovacaoPreview";
import { ProjetoTarefaPreview, type ProjetoTarefaPreviewHandle } from "./ProjetoTarefaPreview";
import { GenericPreview } from "./GenericPreview";

export interface PreviewHandle {
  triggerPrimary: () => void;
  triggerReject: () => void;
  focusComment: () => void;
}

export interface PreviewProps {
  item: InboxItem;
  onOpen: () => void;
  onResolved?: () => void;
}

type RichPreview = ForwardRefExoticComponent<PreviewProps & RefAttributes<PreviewHandle>>;

const RICH_REGISTRY: Partial<Record<InboxOrigem, RichPreview>> = {
  aprovacoes: AprovacaoPreview as unknown as RichPreview,
  projetos: ProjetoTarefaPreview as unknown as RichPreview,
  processos: ProjetoTarefaPreview as unknown as RichPreview,
};

export function getRichPreview(item: InboxItem): RichPreview | null {
  // Só usa preview rico se o referencia_tipo bater com o esperado
  if (item.origem === "aprovacoes" && item.referencia_tipo === "fluxo_aprovacao_aprovador") {
    return RICH_REGISTRY.aprovacoes ?? null;
  }
  if ((item.origem === "projetos" || item.origem === "processos") &&
      item.referencia_tipo === "projeto_tarefa") {
    return RICH_REGISTRY[item.origem] ?? null;
  }
  return null;
}

export { GenericPreview };
export type { AprovacaoPreviewHandle, ProjetoTarefaPreviewHandle };
export type GenericPreviewType = ComponentType<{ item: InboxItem; onOpen: () => void }>;
