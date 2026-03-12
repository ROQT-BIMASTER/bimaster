import { useState, useMemo } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Layers, GripVertical, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ColorPickerPopover } from "@/components/fabrica/ColorPickerPopover";
import {
  useAddSku, useDeleteSku, useProdutoBrasilSkus, useUpdateSku, useImportSkusFromChina,
} from "@/hooks/useProdutoBrasil";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ProdutoBrasilSku } from "@/hooks/useProdutoBrasil";

interface Props {
  produtoBrasilId: string;
  submissaoChinaId?: string | null;
}

function SortableSkuRow({
  sku, onUpdate, onDelete,
}: {
  sku: ProdutoBrasilSku;
  onUpdate: (id: string, field: string, value: any) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sku.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell className="py-1 px-1">
        <button type="button" {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground hover:text-foreground">
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      </TableCell>
      <TableCell className="py-1">
        <div className="flex items-center gap-1">
          <ColorPickerPopover
            value={sku.cor_hex || ""}
            onChange={(hex) => onUpdate(sku.id, "cor_hex", hex)}
          />
          <Input
            value={sku.cor || ""}
            onChange={(e) => onUpdate(sku.id, "cor", e.target.value)}
            className="w-24 h-6 text-[11px] px-1"
            placeholder="Nome cor"
          />
        </div>
      </TableCell>
      <TableCell className="py-1">
        <Input
          value={sku.tamanho_grade || ""}
          onChange={(e) => onUpdate(sku.id, "tamanho_grade", e.target.value)}
          className="w-20 h-6 text-[11px] px-1"
          placeholder="Grade"
        />
      </TableCell>
      <TableCell className="py-1">
        <Input
          value={sku.codigo_interno || ""}
          onChange={(e) => onUpdate(sku.id, "codigo_interno", e.target.value)}
          className="w-24 h-6 text-[11px] font-mono px-1"
          placeholder="Código"
        />
      </TableCell>
      <TableCell className="py-1">
        <Input
          value={sku.ean || ""}
          onChange={(e) => onUpdate(sku.id, "ean", e.target.value)}
          className="w-28 h-6 text-[11px] font-mono px-1"
          placeholder="EAN"
        />
      </TableCell>
      <TableCell className="py-1">
        <Input
          type="number"
          min={0}
          value={sku.quantidade_inicial}
          onChange={(e) => onUpdate(sku.id, "quantidade_inicial", parseInt(e.target.value) || 0)}
          className="w-16 h-6 text-[11px] text-center px-1"
        />
      </TableCell>
      <TableCell className="py-1">
        {sku.foto_url && (
          <img src={sku.foto_url} alt="" className="w-6 h-6 rounded object-cover border border-border" />
        )}
      </TableCell>
      <TableCell className="py-1">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onDelete(sku.id)}>
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function SkuTable({ produtoBrasilId, submissaoChinaId }: Props) {
  const { data: skus = [], isLoading } = useProdutoBrasilSkus(produtoBrasilId);
  const addSku = useAddSku();
  const deleteSku = useDeleteSku();
  const updateSku = useUpdateSku();
  const importFromChina = useImportSkusFromChina();

  const totalQty = useMemo(() => skus.reduce((acc, s) => acc + (s.quantidade_inicial || 0), 0), [skus]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = skus.findIndex((s) => s.id === active.id);
    const newIndex = skus.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(skus, oldIndex, newIndex);
    reordered.forEach((s, i) => {
      updateSku.mutate({ id: s.id, produtoBrasilId, updates: { ordem: i } });
    });
  };

  const handleUpdate = (id: string, field: string, value: any) => {
    updateSku.mutate({ id, produtoBrasilId, updates: { [field]: value } });
  };

  const handleDelete = (id: string) => {
    deleteSku.mutate({ id, produtoBrasilId });
  };

  const handleAddEmpty = () => {
    addSku.mutate({
      produto_brasil_id: produtoBrasilId,
      ordem: skus.length,
    });
  };

  const handleImportChina = () => {
    if (!submissaoChinaId) {
      toast.error("Este produto não possui submissão China vinculada.");
      return;
    }
    importFromChina.mutate({ produtoBrasilId, submissaoId: submissaoChinaId });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            Variações / Grade
            {skus.length > 0 && (
              <>
                <Badge variant="secondary" className="text-[10px]">
                  {skus.length} variante{skus.length !== 1 ? "s" : ""}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {totalQty} un. total
                </Badge>
              </>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {submissaoChinaId && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleImportChina}
                disabled={importFromChina.isPending}
              >
                {importFromChina.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5 mr-1" />
                )}
                Importar da China
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleAddEmpty} disabled={addSku.isPending}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Adicionar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : skus.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <Layers className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma variação cadastrada.</p>
            <p className="text-xs text-muted-foreground mt-1">
              {submissaoChinaId
                ? "Clique em \"Importar da China\" para carregar as cores automaticamente."
                : "Clique em \"Adicionar\" para criar variações manualmente."}
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-7 text-[10px] w-[30px]" />
                  <TableHead className="h-7 text-[10px] w-[140px]">Cor</TableHead>
                  <TableHead className="h-7 text-[10px] w-[90px]">Grade</TableHead>
                  <TableHead className="h-7 text-[10px] w-[100px]">Código</TableHead>
                  <TableHead className="h-7 text-[10px] w-[120px]">EAN</TableHead>
                  <TableHead className="h-7 text-[10px] w-[70px] text-center">Qtd</TableHead>
                  <TableHead className="h-7 text-[10px] w-[40px]">Foto</TableHead>
                  <TableHead className="h-7 text-[10px] w-[40px]" />
                </TableRow>
              </TableHeader>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={skus.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                  <TableBody>
                    {skus.map((sku) => (
                      <SortableSkuRow
                        key={sku.id}
                        sku={sku}
                        onUpdate={handleUpdate}
                        onDelete={handleDelete}
                      />
                    ))}
                  </TableBody>
                </SortableContext>
              </DndContext>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
