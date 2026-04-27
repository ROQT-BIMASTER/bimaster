import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, FileText, ListChecks, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { avancarEtapa, podeAvancarEtapa } from "@/hooks/useProcessoPerfis";

interface Pendencia {
  tipo: string;
  label: string;
  codigo?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  instanciaId: string;
  etapaId: string;
  etapaLabel: string;
  requerAprovacao?: boolean;
  onAdvanced?: () => void;
}

const tipoIcon = (tipo: string) => {
  if (tipo === "documento") return <FileText className="h-3.5 w-3.5" />;
  if (tipo === "tarefa") return <ListChecks className="h-3.5 w-3.5" />;
  if (tipo === "aprovacao") return <ShieldCheck className="h-3.5 w-3.5" />;
  return <AlertTriangle className="h-3.5 w-3.5" />;
};

export function AvancarEtapaDialog({ open, onOpenChange, instanciaId, etapaId, etapaLabel, requerAprovacao, onAdvanced }: Props) {
  const qc = useQueryClient();
  const [pendencias, setPendencias] = useState<Pendencia[] | null>(null);
  const [validando, setValidando] = useState(false);
  const [avancando, setAvancando] = useState(false);
  const [obs, setObs] = useState("");
  const [validado, setValidado] = useState(false);

  const validar = async () => {
    setValidando(true);
    try {
      const res = await podeAvancarEtapa(instanciaId, etapaId);
      setPendencias(res.pendencias ?? []);
      setValidado(true);
      if (res.pode) {
        toast.success("Etapa pronta para avançar");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao validar");
    } finally {
      setValidando(false);
    }
  };

  const confirmar = async () => {
    setAvancando(true);
    try {
      const res = await avancarEtapa(instanciaId, etapaId, obs.trim() || undefined);
      if (!res.success) {
        setPendencias((res as any).pendencias ?? []);
        toast.error("Existem pendências bloqueando o avanço");
        return;
      }
      toast.success((res as any).concluida ? "Processo concluído" : "Etapa avançada com sucesso");
      qc.invalidateQueries({ queryKey: ["processo-instancia"] });
      qc.invalidateQueries({ queryKey: ["processo-instancia-etapa-status"] });
      onAdvanced?.();
      onOpenChange(false);
      setObs("");
      setValidado(false);
      setPendencias(null);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao avançar");
    } finally {
      setAvancando(false);
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setObs("");
      setValidado(false);
      setPendencias(null);
    }
    onOpenChange(v);
  };

  const liberado = validado && pendencias && pendencias.length === 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Avançar etapa</DialogTitle>
          <DialogDescription>
            Etapa atual: <span className="font-medium text-foreground">{etapaLabel}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!validado && (
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>Validação prévia</AlertTitle>
              <AlertDescription>
                Antes de avançar, vamos verificar se todos os documentos obrigatórios, tarefas e aprovações da etapa estão concluídos.
              </AlertDescription>
            </Alert>
          )}

          {validado && pendencias && pendencias.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Avanço bloqueado — {pendencias.length} pendência(s)</AlertTitle>
              <AlertDescription>
                <ul className="mt-2 space-y-1.5">
                  {pendencias.map((p, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className="gap-1 capitalize">
                        {tipoIcon(p.tipo)}
                        {p.tipo}
                      </Badge>
                      <span>{p.label}</span>
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {liberado && (
            <Alert variant="success">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Tudo certo</AlertTitle>
              <AlertDescription>
                Nenhuma pendência. {requerAprovacao ? "Sua aprovação será registrada." : "Você pode avançar a etapa."}
              </AlertDescription>
            </Alert>
          )}

          {liberado && (
            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                placeholder="Adicione um comentário sobre o avanço desta etapa..."
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={avancando}>
            Cancelar
          </Button>
          {!validado ? (
            <Button onClick={validar} disabled={validando}>
              {validando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Validar pendências
            </Button>
          ) : liberado ? (
            <Button onClick={confirmar} disabled={avancando}>
              {avancando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar e avançar
            </Button>
          ) : (
            <Button onClick={validar} disabled={validando} variant="secondary">
              {validando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Re-validar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
