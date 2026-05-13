import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardCheck, AlertTriangle, CheckCircle2 } from "lucide-react";
import { BilingualLabel } from "./BilingualLabel";
import { useChinaOrdemItens } from "@/hooks/useChinaOrdemItens";
import { useCriarRecebimento } from "@/hooks/useChinaRecebimentos";
import { useChinaI18n } from "@/hooks/useChinaI18n";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordemId: string;
  numeroOC: string;
  embarqueId?: string;
}

interface LinhaConferencia {
  qty_recebida: number;
  qty_avariada: number;
  motivo: string;
}

export function RecebimentoConferenciaDialog({
  open,
  onOpenChange,
  ordemId,
  numeroOC,
  embarqueId,
}: Props) {
  const { data: itens = [] } = useChinaOrdemItens(ordemId);
  const criar = useCriarRecebimento();
  const [numeroDi, setNumeroDi] = useState("");
  const [dataChegada, setDataChegada] = useState("");
  const [dataDesemb, setDataDesemb] = useState("");
  const [dataReceb, setDataReceb] = useState(new Date().toISOString().slice(0, 10));
  const [obs, setObs] = useState("");
  const [linhas, setLinhas] = useState<Record<string, LinhaConferencia>>({});

  const linhasParaConferir = useMemo(() => {
    return itens
      .filter((i) => i.qty_embarcada - i.qty_recebida > 0)
      .map((i) => ({
        ...i,
        esperada: Math.max(0, i.qty_embarcada - i.qty_recebida),
      }));
  }, [itens]);

  const totalDiv = useMemo(
    () =>
      linhasParaConferir.reduce((s, l) => {
        const lc = linhas[l.id];
        if (!lc) return s;
        return s + Math.max(0, l.esperada - (lc.qty_recebida || 0)) + (lc.qty_avariada || 0);
      }, 0),
    [linhas, linhasParaConferir],
  );

  const handleSubmit = async () => {
    const itensPayload = linhasParaConferir.map((l) => {
      const lc = linhas[l.id] || ({} as LinhaConferencia);
      const recebida = lc.qty_recebida ?? l.esperada;
      const avariada = lc.qty_avariada ?? 0;
      return {
        ordem_item_id: l.id,
        qty_esperada: l.esperada,
        qty_recebida: recebida,
        qty_avariada: avariada,
        qty_faltante: Math.max(0, l.esperada - recebida),
        motivo_divergencia: lc.motivo,
      };
    });

    await criar.mutateAsync({
      ordem_compra_id: ordemId,
      embarque_id: embarqueId,
      numero_di: numeroDi,
      data_chegada_porto: dataChegada || undefined,
      data_desembaraco: dataDesemb || undefined,
      data_recebimento_cd: dataReceb || undefined,
      itens: itensPayload,
      observacoes: obs,
    });
    onOpenChange(false);
    setLinhas({});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-success" />
            <BilingualLabel pt="Conferência de recebimento" cn="收货确认" size="md" />
          </DialogTitle>
          <DialogDescription>
            OC <strong>{numeroOC}</strong> — registre o que efetivamente chegou no Brasil.
            Divergências geram não-conformidade automática.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">DI</Label>
            <Input value={numeroDi} onChange={(e) => setNumeroDi(e.target.value)} placeholder="00/000000-0" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Chegada porto</Label>
            <Input type="date" value={dataChegada} onChange={(e) => setDataChegada(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Desembaraço</Label>
            <Input type="date" value={dataDesemb} onChange={(e) => setDataDesemb(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Recebimento CD</Label>
            <Input type="date" value={dataReceb} onChange={(e) => setDataReceb(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Itens a conferir</Label>
            {totalDiv > 0 && (
              <span className="text-xs text-warning flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                Divergência total: {totalDiv}
              </span>
            )}
          </div>
          {linhasParaConferir.length === 0 ? (
            <div className="p-4 border border-dashed rounded-lg text-center text-sm text-muted-foreground">
              Nada pendente para receber
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {linhasParaConferir.map((l) => {
                const lc = linhas[l.id] || ({} as LinhaConferencia);
                const recebida = lc.qty_recebida ?? l.esperada;
                const avariada = lc.qty_avariada ?? 0;
                const ok = recebida === l.esperada && avariada === 0;
                return (
                  <div key={l.id} className="p-3 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{l.cor_nome || l.sku || "Único"}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Esperado: <strong>{l.esperada}</strong>
                        </p>
                      </div>
                      {ok ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-warning" />
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-[10px]">Recebida</Label>
                        <Input
                          type="number"
                          min={0}
                          value={recebida}
                          onChange={(e) =>
                            setLinhas((p) => ({
                              ...p,
                              [l.id]: { ...lc, qty_recebida: Math.max(0, Number(e.target.value) || 0) },
                            }))
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">Avariada</Label>
                        <Input
                          type="number"
                          min={0}
                          value={avariada}
                          onChange={(e) =>
                            setLinhas((p) => ({
                              ...p,
                              [l.id]: { ...lc, qty_avariada: Math.max(0, Number(e.target.value) || 0) },
                            }))
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">Motivo</Label>
                        <Input
                          value={lc.motivo || ""}
                          onChange={(e) =>
                            setLinhas((p) => ({
                              ...p,
                              [l.id]: { ...lc, motivo: e.target.value },
                            }))
                          }
                          className="h-8 text-sm"
                          placeholder="Divergência..."
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Observações gerais</Label>
          <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={criar.isPending || linhasParaConferir.length === 0}>
            {criar.isPending ? "Registrando..." : "Registrar recebimento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
