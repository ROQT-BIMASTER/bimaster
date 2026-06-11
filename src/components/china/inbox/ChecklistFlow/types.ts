import type { MailboxItem } from "@/hooks/useChinaMailbox";
import type { MergedChecklistCategory, MergedChecklistDocType } from "@/hooks/useMergedChinaChecklist";
import type { FlowBucket } from "@/lib/china/flowTones";

/** Item selecionado dentro do fluxo do checklist (para drawer focado). */
export interface FlowItemContext {
  submissaoId: string;
  produtoCodigo: string;
  produtoNome: string;
  tipo: string;
  category: MergedChecklistCategory;
  docType?: MergedChecklistDocType;
  /** Documento mais recente desse tipo, quando já existe. */
  doc: MailboxItem | null;
  bucket: FlowBucket;
}
