import { useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Forward, Loader2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useRegistrarParecer, useDevolverChina, type DespachoDocumento } from "@/hooks/useDespachoDocumentos";
import { DESPACHO_MODULOS_PROCESSO } from "./DespachoDialog";

interface ParecerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  despacho: DespachoDocumento | null;
  documentoNome?: string;
}

const ACOES = [
  { key: "aprovar", label: "Aprovar", icon: CheckCircle2, color: "text-green-600" },
  { key: "rejeitar", label: "Rejeitar", icon: XCircle, color: "text-destructive" },
  { key: "pendencia", label: "Pendência", icon: AlertTriangle, color: "text-warning" },
  { key: "encaminhar", label: "Encaminhar", icon: Forward, color: "text-primary" },
] as const;

export function ParecerDialog({ open, onOpenChange, despacho, documentoNome }: ParecerDialogProps) {
  const [acao, setAcao] = useState<string>("aprovar");
  const [texto, setTexto] = useState("");
  const [novoModulo, setNovoModulo] = useState("");
  const [devolverChina, setDevolverChina] = useState(false);
  const registrarParecer = useRegistrarParecer();
  const devolverChinaMut = useDevolverChina();

  const handleSubmit = async () => {
    if (!despacho) return;

    await registrarParecer.mutateAsync({
      despacho_id: despacho.id,
      acao: acao as any,
      parecer_texto: texto,
      novo_departamento_id: acao === "encaminhar" ? novoModulo : undefined,
    });

    if (acao === "aprovar" && devolverChina) {
      await devolverChinaMut.mutateAsync({
        despacho_id: despacho.id,
        documento_id: despacho.documento_id,
      });
    }

    onOpenChange(false);
    setTexto("");
    setAcao("aprovar");
    setDevolverChina(false);
  };

  const isPending = registrarParecer.isPending || devolverChinaMut.isPending;
  const requiresText = acao === "rejeitar";

  if (!despacho) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            Emitir Parecer
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 bg-muted/50 rounded-lg text-xs space-y-1">
            <p className="font-medium text-foreground">
              Anexo {String(despacho.numero_anexo).padStart(2, "0")} — {documentoNome || "Documento"}
            </p>
            <Badge variant="secondary" className="text-[9px]">{despacho.status}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {ACOES.map((a) => {
              const Icon = a.icon;
              return (
                <Button
                  key={a.key}
                  variant={acao === a.key ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5 justify-start text-xs"
                  onClick={() => setAcao(a.key)}
                >
                  <Icon className={`h-3.5 w-3.5 ${acao !== a.key ? a.color : ""}`} />
                  {a.label}
                </Button>
              );
            })}
          </div>

          {acao === "encaminhar" && (
            <div>
              <Label className="text-xs">Encaminhar para módulo</Label>
              <Select value={novoModulo} onValueChange={setNovoModulo}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione o módulo..." />
                </SelectTrigger>
                <SelectContent>
                  {DESPACHO_MODULOS_PROCESSO.map((m) => (
                    <SelectItem key={m.key} value={m.key}>
                      <span className="flex items-center gap-1.5">
                        <span>{m.icon}</span> {m.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label className="text-xs">
              Justificativa {requiresText && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={requiresText ? "Obrigatório informar o motivo da rejeição..." : "Observações do parecer..."}
              rows={3}
            />
          </div>

          {acao === "aprovar" && (
            <label className="flex items-center gap-2 text-xs cursor-pointer p-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
              <input
                type="checkbox"
                checked={devolverChina}
                onChange={(e) => setDevolverChina(e.target.checked)}
                className="rounded"
              />
              <Undo2 className="h-3.5 w-3.5 text-green-600" />
              <span>Aprovar e devolver à China</span>
            </label>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || (requiresText && !texto.trim()) || (acao === "encaminhar" && !novoModulo)}
            className="gap-1.5"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
