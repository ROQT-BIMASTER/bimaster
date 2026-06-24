import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CalendarDays, Sparkles, FolderPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCriarProjetoEspelho } from "@/hooks/useProjetoEspelhoSubmissao";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const REGIMES = [
  { value: "dias_uteis", label: "Apenas dias úteis", desc: "Pula sábado, domingo e feriados" },
  { value: "uteis_com_sabado", label: "Dias úteis + sábado", desc: "Pula apenas domingo e feriados" },
  { value: "corridos", label: "Dias corridos", desc: "Conta todos os dias do calendário" },
] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissaoId: string | null;
  produtoCodigo?: string;
  produtoNome?: string;
  /** Quando true, o usuário já confirmou que quer substituir um espelho existente. */
  onCreated?: (projetoId: string) => void;
}

export function ConfigurarProjetoEspelhoDialog({
  open, onOpenChange, submissaoId, produtoCodigo, produtoNome, onCreated,
}: Props) {
  const navigate = useNavigate();
  const criar = useCriarProjetoEspelho();

  const defaultNome = produtoCodigo || produtoNome
    ? `Submissão ${produtoCodigo ?? ""}${produtoCodigo && produtoNome ? " — " : ""}${produtoNome ?? ""}`.trim()
    : "Projeto da Submissão China";

  const [nome, setNome] = useState(defaultNome);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFimAlvo, setDataFimAlvo] = useState("");
  const [prazoPadraoTarefa, setPrazoPadraoTarefa] = useState(5);
  const [alertaAntecipacaoDias, setAlertaAntecipacaoDias] = useState(2);
  const [regimeCalendario, setRegimeCalendario] = useState<"corridos" | "dias_uteis" | "uteis_com_sabado">("dias_uteis");
  const [usaFeriados, setUsaFeriados] = useState(true);

  const [confirmSubstituir, setConfirmSubstituir] = useState(false);

  useEffect(() => {
    if (open) {
      setNome(defaultNome);
      setDataInicio("");
      setDataFimAlvo("");
      setPrazoPadraoTarefa(5);
      setAlertaAntecipacaoDias(2);
      setRegimeCalendario("dias_uteis");
      setUsaFeriados(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, submissaoId]);

  const executar = async (substituir: boolean) => {
    if (!submissaoId) return;
    try {
      const res = await criar.mutateAsync({
        submissaoId,
        projetoNome: nome.trim() || null,
        dataInicio: dataInicio || null,
        dataFimAlvo: dataFimAlvo || null,
        prazoPadraoTarefa,
        alertaAntecipacaoDias,
        regimeCalendario,
        usaFeriados,
        substituir,
      });

      // Sem substituir, o backend devolve already_existed=true se já houver espelho.
      if (!substituir && res.already_existed) {
        setConfirmSubstituir(true);
        return;
      }

      onCreated?.(res.projeto_id);
      onOpenChange(false);
      navigate(`/dashboard/projetos/${res.projeto_id}?tab=submissao_board`);
    } catch (e: any) {
      // toast já é exibido no hook
    }
  };

  const handleSubmit = () => executar(false);
  const handleConfirmSubstituir = () => {
    setConfirmSubstituir(false);
    executar(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => onOpenChange(o)}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FolderPlus className="h-4 w-4 text-primary" />
              Criar projeto a partir desta submissão
            </DialogTitle>
            <DialogDescription className="text-xs">
              O sistema vai criar um projeto novo, gerar uma seção para cada categoria do
              checklist e uma tarefa para cada item, anexando os documentos enviados.
              Configure as regras de prazo abaixo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Nome do projeto</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <CalendarDays className="h-4 w-4 text-primary mt-0.5" />
              <div className="text-xs">
                <p className="font-medium text-foreground">Regras de prazo</p>
                <p className="text-muted-foreground mt-0.5">
                  Define como o sistema calcula prazos das tarefas e quando enviar alertas
                  de cobrança aos responsáveis.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Regime de cálculo de prazos</Label>
              <RadioGroup
                value={regimeCalendario}
                onValueChange={(v: any) => setRegimeCalendario(v)}
                className="space-y-1.5"
              >
                {REGIMES.map((r) => (
                  <label
                    key={r.value}
                    className="flex items-start gap-3 p-2 rounded-lg border border-border/50 cursor-pointer hover:bg-muted/30 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                  >
                    <RadioGroupItem value={r.value} className="mt-0.5" />
                    <div>
                      <p className="text-xs font-medium">{r.label}</p>
                      <p className="text-[11px] text-muted-foreground">{r.desc}</p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/50">
              <div>
                <Label className="text-xs">Considerar feriados nacionais</Label>
                <p className="text-[11px] text-muted-foreground">
                  Sincronizados via calendário corporativo.
                </p>
              </div>
              <Switch
                checked={usaFeriados}
                onCheckedChange={setUsaFeriados}
                disabled={regimeCalendario === "corridos"}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Data de início</Label>
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Entrega-alvo</Label>
                <Input type="date" value={dataFimAlvo} onChange={(e) => setDataFimAlvo(e.target.value)} className="h-9" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Prazo padrão por tarefa (dias)</Label>
                <Input
                  type="number"
                  min={1}
                  value={prazoPadraoTarefa}
                  onChange={(e) => setPrazoPadraoTarefa(parseInt(e.target.value) || 5)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Alerta de antecipação (dias)</Label>
                <Input
                  type="number"
                  min={0}
                  value={alertaAntecipacaoDias}
                  onChange={(e) => setAlertaAntecipacaoDias(parseInt(e.target.value) || 0)}
                  className="h-9"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={!nome.trim() || criar.isPending} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              {criar.isPending ? "Criando..." : "Criar projeto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmSubstituir} onOpenChange={setConfirmSubstituir}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir vínculo de projeto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta submissão já está vinculada a um projeto-espelho. Ao continuar, o vínculo
              anterior será desativado e um novo projeto será criado com as regras informadas.
              O projeto antigo permanece, mas deixa de ser o espelho oficial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSubstituir}>
              Desvincular e criar novo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
