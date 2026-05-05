import { Sparkles, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import {
  useResponseTemplates,
  useSaveResponseTemplate,
  useDeleteResponseTemplate,
} from "@/hooks/useChinaResponseTemplates";

interface Props {
  tipo: "aprovar" | "rejeitar";
  onPick: (text: string) => void;
}

export function ResponseTemplatePicker({ tipo, onPick }: Props) {
  const { data: templates = [], isLoading } = useResponseTemplates(tipo);
  const save = useSaveResponseTemplate();
  const del = useDeleteResponseTemplate();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [conteudoCn, setConteudoCn] = useState("");

  const reset = () => {
    setCreating(false);
    setTitulo("");
    setConteudo("");
    setConteudoCn("");
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
          <Sparkles className="h-3.5 w-3.5" />
          Modelos
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-xs font-semibold">
            Respostas rápidas — {tipo === "aprovar" ? "Aprovar" : "Pedir ajuste"}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px]"
            onClick={() => setCreating((v) => !v)}
          >
            <Plus className="mr-1 h-3 w-3" />
            Novo
          </Button>
        </div>

        {creating && (
          <div className="space-y-2 border-b border-border bg-muted/20 p-3">
            <Input
              placeholder="Título"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="h-7 text-xs"
            />
            <Textarea
              placeholder="Mensagem em português"
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              rows={2}
              className="text-xs"
            />
            <Textarea
              placeholder="中文 (opcional)"
              value={conteudoCn}
              onChange={(e) => setConteudoCn(e.target.value)}
              rows={2}
              className="text-xs"
            />
            <div className="flex justify-end gap-1.5">
              <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={reset}>
                Cancelar
              </Button>
              <Button
                size="sm"
                className="h-6 text-[11px]"
                disabled={!titulo.trim() || !conteudo.trim() || save.isPending}
                onClick={async () => {
                  await save.mutateAsync({
                    tipo,
                    titulo: titulo.trim(),
                    conteudo: conteudo.trim(),
                    conteudo_cn: conteudoCn.trim() || null,
                  });
                  reset();
                }}
              >
                Salvar
              </Button>
            </div>
          </div>
        )}

        <ScrollArea className="max-h-[280px]">
          <ul className="divide-y divide-border/60">
            {isLoading && (
              <li className="px-3 py-4 text-center text-xs text-muted-foreground">Carregando…</li>
            )}
            {!isLoading && templates.length === 0 && (
              <li className="px-3 py-4 text-center text-xs text-muted-foreground">
                Nenhum modelo. Crie o primeiro acima.
              </li>
            )}
            {templates.map((t) => (
              <li key={t.id} className="group flex items-start gap-2 px-3 py-2 hover:bg-muted/40">
                <button
                  type="button"
                  className="flex-1 text-left"
                  onClick={() => {
                    const text = t.conteudo_cn
                      ? `${t.conteudo}\n\n${t.conteudo_cn}`
                      : t.conteudo;
                    onPick(text);
                    setOpen(false);
                  }}
                >
                  <p className="text-xs font-medium text-foreground">{t.titulo}</p>
                  <p className="line-clamp-2 text-[11px] text-muted-foreground">{t.conteudo}</p>
                </button>
                {t.usuario_id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={() => del.mutate(t.id)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
