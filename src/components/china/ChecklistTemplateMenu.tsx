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
  const { t } = useChinaI18n();
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
              {t("documento.templateMenu.carregar")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[320px] max-h-[400px] overflow-y-auto">
            <DropdownMenuLabel>{t("documento.templateMenu.salvos")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {isLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
            {!isLoading && templates.length === 0 && (
              <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                {t("documento.templateMenu.nenhum")}
              </div>
            )}
            {templates.map((t2: ChecklistTemplate) => (
              <DropdownMenuItem
                key={t2.id}
                onSelect={(e) => e.preventDefault()}
                className="flex items-start justify-between gap-2 py-2"
              >
                <button
                  className="flex-1 text-left"
                  onClick={() => onApply(t2.colunas)}
                >
                  <div className="font-medium text-sm">{t2.nome}</div>
                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                    {t2.marca ? (
                      <Badge variant="secondary" className="text-[10px] h-4">{t2.marca}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] h-4">{t("documento.templateMenu.global")}</Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {t("documento.templateMenu.colunas", { count: t2.colunas.length })}
                    </span>
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(t("documento.templateMenu.confirmExcluir", { nome: t2.nome }))) del.mutate(t2.id);
                  }}
                  className="text-destructive hover:text-destructive/70 shrink-0"
                  title={t("documento.templateMenu.excluir")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="outline" size="sm" className="gap-2" onClick={() => setSaveOpen(true)}>
          <BookmarkPlus className="h-4 w-4" />
          {t("documento.templateMenu.salvar")}
        </Button>
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("documento.templateMenu.dialogTitulo")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("documento.templateMenu.nomeLabel")}</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder={t("documento.templateMenu.nomePlaceholder")} />
            </div>
            {marca && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="scope-marca"
                  checked={scopeMarca}
                  onCheckedChange={(v) => setScopeMarca(!!v)}
                />
                <Label htmlFor="scope-marca" className="cursor-pointer text-sm">
                  <span dangerouslySetInnerHTML={{ __html: t("documento.templateMenu.escopoMarca", { marca }) }} />
                </Label>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {t("documento.templateMenu.explicacao", { count: colunasAtuais.length })}
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveOpen(false)}>{t("documento.templateMenu.cancelar")}</Button>
            <Button onClick={handleSave} disabled={save.isPending || !nome.trim()}>
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t("documento.templateMenu.salvarBtn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
