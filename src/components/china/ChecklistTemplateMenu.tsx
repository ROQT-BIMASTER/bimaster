import { useState } from "react";
import { Bookmark, BookmarkPlus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useChecklistTemplates,
  useSaveTemplate,
  useDeleteTemplate,
  type ChecklistColuna,
  type ChecklistTemplate,
} from "@/hooks/useChinaProdutoChecklist";
import { useChinaI18n } from "@/hooks/useChinaI18n";

interface Props {
  marca: string | null;
  colunasAtuais: ChecklistColuna[];
  onApply: (cols: ChecklistColuna[]) => void;
}

export function ChecklistTemplateMenu({ marca, colunasAtuais, onApply }: Props) {
  const { data: templates = [], isLoading } = useChecklistTemplates(marca);
  const save = useSaveTemplate();
  const del = useDeleteTemplate();
  const [saveOpen, setSaveOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [scopeMarca, setScopeMarca] = useState(true);

  const handleSave = async () => {
    if (!nome.trim()) return;
    await save.mutateAsync({
      nome: nome.trim(),
      marca: scopeMarca ? marca : null,
      colunas: colunasAtuais,
    });
    setSaveOpen(false);
    setNome("");
  };

  return (
    <>
      <div className="flex gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Bookmark className="h-4 w-4" />
              Carregar template 加载模板
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[320px] max-h-[400px] overflow-y-auto">
            <DropdownMenuLabel>Templates salvos</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {isLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
            {!isLoading && templates.length === 0 && (
              <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                Nenhum template salvo ainda
              </div>
            )}
            {templates.map((t: ChecklistTemplate) => (
              <DropdownMenuItem
                key={t.id}
                onSelect={(e) => e.preventDefault()}
                className="flex items-start justify-between gap-2 py-2"
              >
                <button
                  className="flex-1 text-left"
                  onClick={() => onApply(t.colunas)}
                >
                  <div className="font-medium text-sm">{t.nome}</div>
                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                    {t.marca ? (
                      <Badge variant="secondary" className="text-[10px] h-4">{t.marca}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] h-4">Global</Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {t.colunas.length} colunas
                    </span>
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Excluir template "${t.nome}"?`)) del.mutate(t.id);
                  }}
                  className="text-destructive hover:text-destructive/70 shrink-0"
                  title="Excluir"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="outline" size="sm" className="gap-2" onClick={() => setSaveOpen(true)}>
          <BookmarkPlus className="h-4 w-4" />
          Salvar como template
        </Button>
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar checklist como template 保存为模板</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome do template *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Padrão Hello Kitty" />
            </div>
            {marca && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="scope-marca"
                  checked={scopeMarca}
                  onCheckedChange={(v) => setScopeMarca(!!v)}
                />
                <Label htmlFor="scope-marca" className="cursor-pointer text-sm">
                  Disponibilizar apenas para a marca <strong>{marca}</strong>
                </Label>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {colunasAtuais.length} colunas serão salvas. As marcações das células não são incluídas.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={save.isPending || !nome.trim()}>
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
