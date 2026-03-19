import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, Clock, User } from "lucide-react";
import { DESPACHO_MODULOS_PROCESSO } from "@/components/processo/DespachoDialog";
import { useCreateFichaDespacho, useFichaDespachos, useFichaVisibilidade } from "@/hooks/useChinaFichaVisibilidade";
import { format } from "date-fns";

interface Props {
  submissaoId: string;
  produtoNome: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DespachoFichaDialog({ submissaoId, produtoNome, open, onOpenChange }: Props) {
  const [modulo, setModulo] = useState("");
  const [usuarioId, setUsuarioId] = useState("");
  const [observacao, setObservacao] = useState("");

  const { data: visibilidade = [] } = useFichaVisibilidade(submissaoId);
  const { data: despachos = [] } = useFichaDespachos(submissaoId);
  const createDespacho = useCreateFichaDespacho();

  const handleDespachar = () => {
    if (!modulo) return;
    createDespacho.mutate(
      {
        submissao_id: submissaoId,
        modulo_destino: modulo,
        usuario_destino_id: usuarioId || undefined,
        observacao: observacao || undefined,
      },
      {
        onSuccess: () => {
          setModulo("");
          setUsuarioId("");
          setObservacao("");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Despachar Ficha
          </DialogTitle>
          <p className="text-xs text-muted-foreground">{produtoNome}</p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Módulo de Destino</Label>
            <Select value={modulo} onValueChange={setModulo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar módulo..." />
              </SelectTrigger>
              <SelectContent>
                {DESPACHO_MODULOS_PROCESSO.map((m) => (
                  <SelectItem key={m.key} value={m.key}>
                    <span className="flex items-center gap-1.5">
                      <m.icon className={`h-3.5 w-3.5 ${m.color}`} /> {m.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {visibilidade.length > 0 && (
            <div className="space-y-2">
              <Label>Usuário Destino (opcional)</Label>
              <Select value={usuarioId} onValueChange={setUsuarioId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar usuário..." />
                </SelectTrigger>
                <SelectContent>
                  {visibilidade.map((v: any) => (
                    <SelectItem key={v.user_id} value={v.user_id}>
                      {v.user_nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Observação / Instrução</Label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Instruções para o destinatário..."
              rows={3}
            />
          </div>

          <Button
            onClick={handleDespachar}
            disabled={!modulo || createDespacho.isPending}
            className="w-full gap-2"
          >
            {createDespacho.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Despachar
          </Button>

          {/* Histórico de despachos */}
          {despachos.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs text-muted-foreground">Histórico de Despachos</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {despachos.map((d: any) => {
                  const moduloInfo = DESPACHO_MODULOS_PROCESSO.find((m) => m.key === d.modulo_destino);
                  return (
                    <div key={d.id} className="p-2.5 rounded-md border bg-muted/30 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-[10px] gap-1">
                          {moduloInfo?.icon} {moduloInfo?.label || d.modulo_destino}
                        </Badge>
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(d.created_at), "dd/MM HH:mm")}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>Por: {d.despachado_por_nome}</span>
                        {d.usuario_destino_nome && <span>→ {d.usuario_destino_nome}</span>}
                      </div>
                      {d.observacao && <p className="text-foreground">{d.observacao}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
