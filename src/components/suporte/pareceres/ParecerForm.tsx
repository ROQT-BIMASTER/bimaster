import { useState } from "react";
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
import { Paperclip, X, Send } from "lucide-react";
import { useCriarParecer, type CriarParecerInput } from "@/hooks/suporte/usePareceres";
import { useSuporteFilas } from "@/hooks/suporte/useSuporteFilas";
import { z } from "zod";

const Schema = z.object({
  visibilidade: z.enum(["interno", "externo"]),
  tipo: z.enum(["parecer", "orientacao", "analise_tecnica", "encaminhamento", "conclusao"]),
  titulo: z.string().max(200).optional(),
  conteudo: z.string().trim().min(3, "Conteúdo obrigatório").max(10000),
  acao_tomada: z.string().max(500).optional(),
  encaminhar_para_fila_id: z.string().uuid().optional().nullable(),
}).strict();

interface Props {
  ticketId: string;
  filaAtualId?: string | null;
  onCreated?: () => void;
}

const TIPO_LABEL: Record<string, string> = {
  parecer: "Parecer",
  orientacao: "Orientação",
  analise_tecnica: "Análise técnica",
  encaminhamento: "Encaminhamento",
  conclusao: "Conclusão",
};

export function ParecerForm({ ticketId, filaAtualId, onCreated }: Props) {
  const { data: filas = [] } = useSuporteFilas();
  const criar = useCriarParecer();

  const [visExterno, setVisExterno] = useState(false);
  const [tipo, setTipo] = useState<CriarParecerInput["tipo"]>("parecer");
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [acao, setAcao] = useState("");
  const [encFila, setEncFila] = useState<string>("");
  const [files, setFiles] = useState<File[]>([]);

  const isEncaminhamento = tipo === "encaminhamento";

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    setFiles((prev) => [...prev, ...list]);
    e.target.value = "";
  }

  async function submit() {
    const visibilidade = visExterno ? "externo" : "interno";
    const parsed = Schema.safeParse({
      visibilidade,
      tipo,
      titulo: titulo || undefined,
      conteudo,
      acao_tomada: acao || undefined,
      encaminhar_para_fila_id: isEncaminhamento ? (encFila || undefined) : undefined,
    });
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Dados inválidos";
      // eslint-disable-next-line no-alert
      alert(msg);
      return;
    }
    if (isEncaminhamento && !encFila) {
      alert("Selecione a fila de destino para encaminhamento");
      return;
    }

    await criar.mutateAsync({
      ticket_id: ticketId,
      visibilidade,
      tipo,
      titulo: titulo || null,
      conteudo,
      acao_tomada: acao || null,
      encaminhar_para_fila_id: isEncaminhamento ? encFila : null,
      anexos: files,
    });

    setTitulo("");
    setConteudo("");
    setAcao("");
    setFiles([]);
    setTipo("parecer");
    setVisExterno(false);
    setEncFila("");
    onCreated?.();
  }

  const filasDestino = filas.filter((f) => f.ativo && f.id !== filaAtualId);

  return (
    <div className="rounded-md border bg-card p-3 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TIPO_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Switch checked={visExterno} onCheckedChange={setVisExterno} id="vis-ext" />
          <Label htmlFor="vis-ext" className="text-xs cursor-pointer">
            {visExterno ? "Visível ao solicitante" : "Interno (só equipe)"}
          </Label>
        </div>

        {isEncaminhamento && (
          <Select value={encFila} onValueChange={setEncFila}>
            <SelectTrigger className="w-[220px] h-8 text-xs">
              <SelectValue placeholder="Encaminhar para..." />
            </SelectTrigger>
            <SelectContent>
              {filasDestino.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Input
        placeholder="Título (opcional)"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        className="h-8 text-sm"
      />

      <Textarea
        placeholder="Descreva o parecer, análise ou orientação..."
        value={conteudo}
        onChange={(e) => setConteudo(e.target.value)}
        rows={4}
        className="text-sm"
      />

      <Input
        placeholder="Ação tomada pelo departamento (resumo)"
        value={acao}
        onChange={(e) => setAcao(e.target.value)}
        className="h-8 text-sm"
      />

      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li
              key={i}
              className="flex items-center justify-between text-xs bg-muted rounded px-2 py-1"
            >
              <span className="truncate">{f.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between">
        <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer text-muted-foreground hover:text-foreground">
          <Paperclip className="h-3.5 w-3.5" />
          Anexar documentos
          <input type="file" multiple className="hidden" onChange={onPickFiles} />
        </label>
        <Button
          size="sm"
          onClick={submit}
          disabled={criar.isPending || !conteudo.trim()}
          className="gap-1.5"
        >
          <Send className="h-3.5 w-3.5" />
          Registrar parecer
        </Button>
      </div>
    </div>
  );
}
