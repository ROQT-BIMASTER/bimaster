import { useState } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BilingualLabel } from "./BilingualLabel";
import { ColorPickerPopover } from "@/components/fabrica/ColorPickerPopover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface GradeItem {
  id: string;
  cor_nome: string;
  cor_hex: string;
  cor_numero: string;
  codigo_produto: string;
  codigo_barras_ean: string;
  quantidade: number;
  grupo: string;
}

interface ChinaGradeEditorProps {
  items: GradeItem[];
  onChange: (items: GradeItem[]) => void;
}

function SortableRow({
  item,
  index,
  onUpdate,
  onRemove,
}: {
  item: GradeItem;
  index: number;
  onUpdate: (index: number, field: keyof GradeItem, value: any) => void;
  onRemove: (index: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell className="py-1 w-8">
        <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
          <GripVertical className="h-4 w-4" />
        </button>
      </TableCell>
      <TableCell className="py-1 w-10 text-center text-xs text-muted-foreground">{index + 1}</TableCell>
      <TableCell className="py-1">
        <div className="flex items-center gap-1.5">
          <ColorPickerPopover value={item.cor_hex || ""} onChange={(hex) => onUpdate(index, "cor_hex", hex)} />
          <Input
            value={item.cor_nome}
            onChange={(e) => onUpdate(index, "cor_nome", e.target.value)}
            className="h-7 text-xs"
            placeholder="Nome 名称"
          />
        </div>
      </TableCell>
      <TableCell className="py-1">
        <Input
          value={item.cor_numero}
          onChange={(e) => onUpdate(index, "cor_numero", e.target.value)}
          className="h-7 text-xs"
          placeholder="Nº"
        />
      </TableCell>
      <TableCell className="py-1">
        <Input
          value={item.codigo_produto}
          onChange={(e) => onUpdate(index, "codigo_produto", e.target.value)}
          className="h-7 text-xs font-mono"
          placeholder="Código"
        />
      </TableCell>
      <TableCell className="py-1">
        <Input
          value={item.codigo_barras_ean}
          onChange={(e) => onUpdate(index, "codigo_barras_ean", e.target.value)}
          className="h-7 text-xs font-mono"
          placeholder="EAN"
        />
      </TableCell>
      <TableCell className="py-1">
        <Input
          type="number"
          min={0}
          value={item.quantidade || ""}
          onChange={(e) => onUpdate(index, "quantidade", parseInt(e.target.value) || 0)}
          className="h-7 text-xs text-center w-20"
        />
      </TableCell>
      <TableCell className="py-1 w-8">
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => onRemove(index)}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function ChinaGradeEditor({ items, onChange }: ChinaGradeEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      onChange(arrayMove(items, oldIndex, newIndex));
    }
  };

  const handleUpdate = (index: number, field: keyof GradeItem, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const handleRemove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    onChange([
      ...items,
      {
        id: crypto.randomUUID(),
        cor_nome: "",
        cor_hex: "",
        cor_numero: "",
        codigo_produto: "",
        codigo_barras_ean: "",
        quantidade: 0,
        grupo: "A",
      },
    ]);
  };

  const totalQty = items.reduce((sum, i) => sum + (i.quantidade || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <BilingualLabel pt="Grade de Cores" cn="颜色网格" size="md" />
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleAdd}>
          <Plus className="h-3 w-3" /> Adicionar 添加
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-8 h-8" />
              <TableHead className="w-10 h-8 text-center text-[10px]">#</TableHead>
              <TableHead className="h-8 text-[10px]">Cor 颜色</TableHead>
              <TableHead className="h-8 text-[10px]">Nº 编号</TableHead>
              <TableHead className="h-8 text-[10px]">Código 编码</TableHead>
              <TableHead className="h-8 text-[10px]">EAN</TableHead>
              <TableHead className="h-8 text-[10px] w-20">Qtd 数量</TableHead>
              <TableHead className="w-8 h-8" />
            </TableRow>
          </TableHeader>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <TableBody>
                {items.map((item, index) => (
                  <SortableRow key={item.id} item={item} index={index} onUpdate={handleUpdate} onRemove={handleRemove} />
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">
                      Nenhuma cor adicionada 未添加颜色
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </SortableContext>
          </DndContext>
          {items.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={6} className="text-right text-xs font-bold">
                  Total 总计
                </TableCell>
                <TableCell className="text-center text-xs font-bold">{totalQty.toLocaleString()}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  );
}
