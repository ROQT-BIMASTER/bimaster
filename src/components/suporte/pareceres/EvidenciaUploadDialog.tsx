import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ShieldAlert } from "lucide-react";
import { z } from "zod";
import {
  useUploadEvidencia,
  CATEGORIA_LABEL,
  type EvidenciaCategoria,
} from "@/hooks/suporte/useEvidencias";
import { useTicketPareceres, useTicketTrilhaDepartamentos } from "@/hooks/suporte/usePareceres";
import { useSuporteFilas } from "@/hooks/suporte/useSuporteFilas";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const Schema = z
  .object({
    categoria: z.enum([
      "prova_juridica",
      "contrato",
      "email",
      "print",
      "audio",
      "video",
      "documento",
      "outro",
    ]),
    descricao: z.string().max(500).optional(),
  })
  .strict();

const NONE = "__none__";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ticketId: string;
  parecerId?: string | null;
}

export function EvidenciaUploadDialog({
  open,
  onOpenChange,
  ticketId,
  parecerId = null,
}: Props) {
  const upload = useUploadEvidencia();
  const { data: pareceres = [] } = useTicketPareceres(ticketId);
  const { data: trilha = [] } = useTicketTrilhaDepartamentos(ticketId);
  const { data: filas = [] } = useSuporteFilas();

  const [file, setFile] = useState<File | null>(null);
  const [categoria, setCategoria] = useState<EvidenciaCategoria>("documento");
  const [descricao, setDescricao] = useState("");
  const [marcarProva, setMarcarProva] = useState(false);
  const [vincularParecer, setVincularParecer] = useState<string>(parecerId ?? NONE);
  const [vincularTrilha, setVincularTrilha] = useState<string>(NONE);

  function reset() {
    setFile(null);
    setCategoria("documento");
    setDescricao("");
    setMarcarProva(false);
    setVincularParecer(parecerId ?? NONE);
    setVincularTrilha(NONE);
  }

  async function submit() {
    if (!file) {
      toast.error("Selecione um arquivo");
      return;
    }
    const parsed = Schema.safeParse({
      categoria,
      descricao: descricao || undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    await upload.mutateAsync({
      ticket_id: ticketId,
      parecer_id: vincularParecer === NONE ? null : vincularParecer,
      trilha_id: vincularTrilha === NONE ? null : vincularTrilha,
      categoria,
      descricao: descricao || null,
      file,
      marcar_como_prova: marcarProva,
    });
    reset();
    onOpenChange(false);
  }

  const nomeFila = (id: string | null) =>
    id ? filas.find((f) => f.id === id)?.nome ?? "—" : "—";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar documento ao cofre de provas</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Arquivo (até 20 MB)</Label>
            <Input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="h-9 text-sm"
            />
            {file && (
              <p className="text-xs text-muted-foreground">
                {file.name} · {(file.size / 1024).toFixed(0)} KB
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Categoria</Label>
            <Select
              value={categoria}
              onValueChange={(v) => setCategoria(v as EvidenciaCategoria)}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CATEGORIA_LABEL) as EvidenciaCategoria[]).map(
                  (k) => (
                    <SelectItem key={k} value={k}>
                      {CATEGORIA_LABEL[k]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Descrição / contexto (opcional)</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Ex.: contrato assinado antes da ocorrência, print da conversa..."
              className="text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Vincular a parecer</Label>
              <Select value={vincularParecer} onValueChange={setVincularParecer}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nenhum</SelectItem>
                  {pareceres.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.tipo}
                      {p.titulo ? ` — ${p.titulo}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Vincular a etapa da trilha</Label>
              <Select value={vincularTrilha} onValueChange={setVincularTrilha}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nenhuma</SelectItem>
                  {trilha.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {nomeFila(t.fila_id)} ·{" "}
                      {format(new Date(t.entrou_em), "dd/MM HH:mm", { locale: ptBR })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2.5">
            <ShieldAlert className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Switch
                  id="prova-jur"
                  checked={marcarProva}
                  onCheckedChange={setMarcarProva}
                />
                <Label htmlFor="prova-jur" className="text-xs cursor-pointer font-medium">
                  Marcar como prova jurídica (retenção legal)
                </Label>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Uma vez marcado, o documento não poderá ser editado ou apagado.
                O acesso fica registrado em log de auditoria.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={upload.isPending}
          >
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!file || upload.isPending}>
            {upload.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Salvar no cofre
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
