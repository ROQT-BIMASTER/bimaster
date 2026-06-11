import { useState } from "react";
import { Check, AlertCircle, Eye, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCriarRevisao, useDarCiencia } from "@/hooks/useChinaRevisoes";
import { DialogRejeitarDocumento } from "@/components/china/DialogRejeitarDocumento";
import { DialogContestarDocumento } from "@/components/china/DialogContestarDocumento";
import type { FlowBucket } from "@/lib/china/flowTones";

interface Props {
  documentoId: string;
  submissaoId: string;
  tipoDocumento: string;
  tipoDocumentoLabel?: string;
  bucket: FlowBucket;
  /** Lado que recebeu o documento e dá parecer (aprovar/rejeitar/ciência). */
  isReceiver: boolean;
  /** Lado que enviou o documento — pode substituir com parecer quando rejeitado. */
  isSender: boolean;
}

export function DrawerParecerActions({
  documentoId,
  submissaoId,
  tipoDocumento,
  tipoDocumentoLabel,
  bucket,
  isReceiver,
  isSender,
}: Props) {
  const [rejeitarOpen, setRejeitarOpen] = useState(false);
  const [contestarOpen, setContestarOpen] = useState(false);
  const aprovar = useCriarRevisao();
  const ciencia = useDarCiencia();

  const podeReceiver = isReceiver && bucket !== "aprovado";
  const podeSubstituir = isSender && bucket === "rejeitado";

  if (!podeReceiver && !podeSubstituir) return null;

  return (
    <div className="space-y-2 rounded-md border border-border bg-card/40 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Parecer
      </p>
      <div className="flex flex-wrap gap-1.5">
        {podeReceiver && (
          <>
            <Button
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() =>
                aprovar.mutate({
                  documento_id: documentoId,
                  submissao_id: submissaoId,
                  resultado: "aprovado",
                })
              }
              disabled={aprovar.isPending}
            >
              {aprovar.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Aprovar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setRejeitarOpen(true)}
            >
              <AlertCircle className="h-3.5 w-3.5" />
              Rejeitar com laudo
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 text-xs"
              onClick={() =>
                ciencia.mutate({
                  documento_id: documentoId,
                  submissao_id: submissaoId,
                })
              }
              disabled={ciencia.isPending}
            >
              {ciencia.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
              Dar ciência
            </Button>
          </>
        )}
        {podeSubstituir && (
          <Button
            size="sm"
            variant="destructive"
            className="h-7 gap-1.5 text-xs"
            onClick={() => setContestarOpen(true)}
          >
            <Upload className="h-3.5 w-3.5" />
            Substituir com parecer
          </Button>
        )}
      </div>

      <DialogRejeitarDocumento
        open={rejeitarOpen}
        onOpenChange={setRejeitarOpen}
        documentoId={documentoId}
        submissaoId={submissaoId}
        tipoDocumentoLabel={tipoDocumentoLabel}
      />
      <DialogContestarDocumento
        open={contestarOpen}
        onOpenChange={setContestarOpen}
        documentoId={documentoId}
        submissaoId={submissaoId}
        tipoDocumento={tipoDocumento}
        tipoDocumentoLabel={tipoDocumentoLabel}
      />
    </div>
  );
}
