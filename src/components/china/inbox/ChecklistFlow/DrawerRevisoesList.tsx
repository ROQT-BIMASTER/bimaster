/**
 * DrawerRevisoesList — wrapper que delega ao novo `ChinaRevisaoTimeline`
 * para padronizar o visual de rodadas com o histórico de briefing
 * (cards com bullet, badge tipo, parecer, anexos colapsáveis).
 */
import { ChinaRevisaoTimeline } from "@/components/china/ChinaRevisaoTimeline";

interface Props {
  submissaoId: string;
  documentoId: string;
}

export function DrawerRevisoesList({ submissaoId, documentoId }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Histórico de rodadas
      </p>
      <ChinaRevisaoTimeline
        submissaoId={submissaoId}
        documentoId={documentoId}
      />
    </div>
  );
}
