import { useState } from "react";
import { Check, AlertCircle, Eye, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogRejeitarDocumento } from "@/components/china/DialogRejeitarDocumento";
import { DialogContestarDocumento } from "@/components/china/DialogContestarDocumento";
import { DialogAprovarDocumento } from "@/components/china/DialogAprovarDocumento";
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
  /**
   * Ações permitidas neste contexto. Por padrão tudo é permitido. A Caixa
   * de Entrada China passa `{ aprovar: false, ciencia: false, rejeitar: false }`
   * para impedir que a China dê parecer final em documentos que ainda não
   * passaram pelo Brasil — lá ela só envia ou substitui.
   */
  allowedActions?: {
    aprovar?: boolean;
    rejeitar?: boolean;
    ciencia?: boolean;
    substituir?: boolean;
  };
}

export function DrawerParecerActions({
  documentoId,
  submissaoId,
  tipoDocumento,
  tipoDocumentoLabel,
  bucket,
  isReceiver,
  isSender,
  allowedActions,
}: Props) {
  const [rejeitarOpen, setRejeitarOpen] = useState(false);
  const [contestarOpen, setContestarOpen] = useState(false);
  const [aprovarOpen, setAprovarOpen] = useState(false);
  const [cienciaOpen, setCienciaOpen] = useState(false);

  const allow = {
    aprovar: allowedActions?.aprovar ?? true,
    rejeitar: allowedActions?.rejeitar ?? true,
    ciencia: allowedActions?.ciencia ?? true,
    substituir: allowedActions?.substituir ?? true,
  };

  const podeReceiver =
    isReceiver && bucket !== "aprovado" && (allow.aprovar || allow.rejeitar || allow.ciencia);
  const podeSubstituir = isSender && bucket === "rejeitado" && allow.substituir;

  if (!podeReceiver && !podeSubstituir) return null;

  return (
    <div className="space-y-2 rounded-md border border-border bg-card/40 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Parecer
      </p>
      <p className="text-[10.5px] text-muted-foreground/80">
        Toda decisão exige um parecer técnico — ele fica registrado na trilha
        de auditoria e pode mencionar colegas com <code className="rounded bg-muted px-1">@</code>.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {podeReceiver && allow.aprovar && (
          <Button
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => setAprovarOpen(true)}
          >
            <Check className="h-3.5 w-3.5" />
            Aprovar com parecer
          </Button>
        )}
        {podeReceiver && allow.rejeitar && (
          <Button
            size="sm"
            variant="destructive"
            className="h-7 gap-1.5 text-xs"
            onClick={() => setRejeitarOpen(true)}
          >
            <AlertCircle className="h-3.5 w-3.5" />
            Rejeitar com laudo
          </Button>
        )}
        {podeReceiver && allow.ciencia && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-xs"
            onClick={() => setCienciaOpen(true)}
          >
            <Eye className="h-3.5 w-3.5" />
            Dar ciência
          </Button>
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

      <DialogAprovarDocumento
        open={aprovarOpen}
        onOpenChange={setAprovarOpen}
        documentoId={documentoId}
        submissaoId={submissaoId}
        tipoDocumentoLabel={tipoDocumentoLabel}
        modo="aprovar"
      />
      <DialogAprovarDocumento
        open={cienciaOpen}
        onOpenChange={setCienciaOpen}
        documentoId={documentoId}
        submissaoId={submissaoId}
        tipoDocumentoLabel={tipoDocumentoLabel}
        modo="ciencia"
      />
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
