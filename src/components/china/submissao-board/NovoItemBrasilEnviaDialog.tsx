import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMergedChinaChecklist } from "@/hooks/useMergedChinaChecklist";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  submissaoId: string;
}

/**
 * Permite ao Brasil adicionar um novo item ao checklist Brasil → China.
 * Escreve direto em `china_checklist_custom_itens` (criando categoria custom
 * em `china_checklist_custom_categorias` se necessário) — mesma fonte de
 * verdade usada pela Caixa de Entrada China e pelo Modo Foco.
 */
export function NovoItemBrasilEnviaDialog({ open, onOpenChange, submissaoId }: Props) {
  const qc = useQueryClient();
  const merged = useMergedChinaChecklist(submissaoId);

  const categoriasBrasil = merged.categoriesBrasilEnvia;
  const [catChoice, setCatChoice] = useState<string>("");
  const [novaCategoriaPt, setNovaCategoriaPt] = useState("");
  const [labelPt, setLabelPt] = useState("");
  const [labelCn, setLabelCn] = useState("");

  useEffect(() => {
    if (open) {
      setCatChoice(categoriasBrasil[0]?.key ?? "__new__");
      setNovaCategoriaPt("");
      setLabelPt("");
      setLabelCn("");
    }
  }, [open, categoriasBrasil.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const criar = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id;

      let categoria_custom_id: string | null = null;
      let categoria_default_key: string | null = null;

      if (catChoice === "__new__") {
        if (!novaCategoriaPt.trim()) throw new Error("Informe o nome da categoria");
        const { data: cat, error: catErr } = await (supabase
          .from("china_checklist_custom_categorias" as any)
          .insert({
            submissao_id: submissaoId,
            label_pt: novaCategoriaPt.trim(),
            label_cn: novaCategoriaPt.trim(),
            fluxo: "brasil_envia",
            ordem: categoriasBrasil.length,
            created_by: uid,
          })
          .select("id")
          .single() as any);
        if (catErr) throw catErr;
        categoria_custom_id = cat.id;
      } else {
        const cat = categoriasBrasil.find((c) => c.key === catChoice);
        if (cat?.isCustom && cat.customId) {
          categoria_custom_id = cat.customId;
        } else {
          categoria_default_key = catChoice;
        }
      }

      if (!labelPt.trim()) throw new Error("Informe o nome do item");

      const tipoKey = `custom_${Date.now()}_${labelPt
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .slice(0, 40)}`;

      const { error: itErr } = await (supabase
        .from("china_checklist_custom_itens" as any)
        .insert({
          submissao_id: submissaoId,
          categoria_custom_id,
          categoria_default_key,
          tipo_key: tipoKey,
          label_pt: labelPt.trim(),
          label_cn: labelCn.trim() || labelPt.trim(),
          accept: null,
          multiple: false,
          created_by: uid,
        }) as any);
      if (itErr) throw itErr;
    },
    onSuccess: () => {
      toast.success("Item adicionado ao checklist Brasil → China");
      qc.invalidateQueries({ queryKey: ["checklist-custom-cats", submissaoId] });
      qc.invalidateQueries({ queryKey: ["checklist-custom-items", submissaoId] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao adicionar item"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!criar.isPending) onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" /> Novo item Brasil → China
          </DialogTitle>
          <DialogDescription className="text-xs">
            Esse item será visível para a China (mesmo checklist) e poderá ser anexado e aprovado
            internamente pelo Brasil antes do envio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Categoria</Label>
            <Select value={catChoice} onValueChange={setCatChoice}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {categoriasBrasil.map((c) => (
                  <SelectItem key={c.key} value={c.key} className="text-xs">
                    {c.labelPt}
                  </SelectItem>
                ))}
                <SelectItem value="__new__" className="text-xs">+ Nova categoria</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {catChoice === "__new__" && (
            <div className="space-y-1">
              <Label className="text-xs">Nome da nova categoria</Label>
              <Input
                className="h-8 text-xs"
                value={novaCategoriaPt}
                onChange={(e) => setNovaCategoriaPt(e.target.value.slice(0, 80))}
                placeholder="Ex.: Embalagem secundária"
              />
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Nome do item (PT)</Label>
            <Input
              className="h-8 text-xs"
              value={labelPt}
              onChange={(e) => setLabelPt(e.target.value.slice(0, 120))}
              placeholder="Ex.: Mockup final"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Nome (CN) — opcional</Label>
            <Input
              className="h-8 text-xs"
              value={labelCn}
              onChange={(e) => setLabelCn(e.target.value.slice(0, 120))}
              placeholder="中文名称"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={criar.isPending}>
            Cancelar
          </Button>
          <Button size="sm" disabled={criar.isPending || !labelPt.trim()} onClick={() => criar.mutate()}>
            {criar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
