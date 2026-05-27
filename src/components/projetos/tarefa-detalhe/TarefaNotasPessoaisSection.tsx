import { useEffect, useState } from "react";
import { Lock, Save, Trash2, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useTarefaNotasPessoais } from "@/hooks/useTarefaNotasPessoais";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useConfirm } from "@/hooks/useConfirm";

interface Props {
  tarefaId: string;
}

/**
 * Anotações pessoais privadas: visíveis apenas para o usuário autenticado,
 * úteis para rascunhos, lembretes e contexto pessoal sobre a tarefa.
 */
export function TarefaNotasPessoaisSection({ tarefaId }: Props) {
  const confirm = useConfirm();
  const { nota, isLoading, save, remove, MAX_LEN } = useTarefaNotasPessoais(tarefaId);
  const [value, setValue] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setValue(nota?.conteudo || "");
    setDirty(false);
  }, [nota?.conteudo, nota?.id]);

  const handleSave = () => {
    save.mutate(value, { onSuccess: () => setDirty(false) });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 text-amber-500" />
          Anotações pessoais
          <span className="text-[10px] font-normal text-muted-foreground">(privadas — só você vê)</span>
        </h3>
        <div className="flex items-center gap-1">
          {nota?.updated_at && (
            <span className="text-[10px] text-muted-foreground mr-1">
              Atualizada {format(new Date(nota.updated_at), "dd MMM, HH:mm", { locale: ptBR })}
            </span>
          )}
          {nota && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] gap-1 text-destructive hover:text-destructive"
              onClick={async () => {
                if ((await confirm({ title: "Remover esta anotação pessoal?", destructive: true }))) remove.mutate();
              }}
              disabled={remove.isPending}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] gap-1 text-primary hover:text-primary"
            onClick={handleSave}
            disabled={!dirty || save.isPending || isLoading}
          >
            {save.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Salvar
          </Button>
        </div>
      </div>
      <Textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setDirty(true);
        }}
        placeholder="Anotações privadas, rascunhos, lembretes..."
        maxLength={MAX_LEN}
        className="min-h-[80px] text-sm bg-amber-500/5 border-amber-500/20 resize-none"
      />
      <div className="flex justify-end mt-1">
        <span className="text-[10px] text-muted-foreground">
          {value.length}/{MAX_LEN}
        </span>
      </div>
    </div>
  );
}
