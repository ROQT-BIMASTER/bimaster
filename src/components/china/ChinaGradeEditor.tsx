import { useMemo } from "react";
import { Plus, Trash2, GripVertical, FolderPlus } from "lucide-react";
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
  /** Show bilingual PT/CN labels. Defaults to true. Set false for PT-only modules. */
  bilingual?: boolean;
}

function SortableRow({
  item,
  displayIndex,
  onUpdate,
  onRemove,
}: {
  item: GradeItem;
  displayIndex: number;
  onUpdate: (id: string, field: keyof GradeItem, value: any) => void;
  onRemove: (id: string) => void;
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
      <TableCell className="py-1 w-10 text-center text-xs text-muted-foreground">{displayIndex}</TableCell>
      <TableCell className="py-1">
        <div className="flex items-center gap-1.5">
          <ColorPickerPopover value={item.cor_hex || ""} onChange={(hex) => onUpdate(item.id, "cor_hex", hex)} />
          <Input
            value={item.cor_nome}
            onChange={(e) => onUpdate(item.id, "cor_nome", e.target.value)}
            className="h-7 text-xs"
            placeholder="Nome 名称"
          />
        </div>
      </TableCell>
      <TableCell className="py-1">
        <Input
          value={item.cor_numero}
          onChange={(e) => onUpdate(item.id, "cor_numero", e.target.value)}
          className="h-7 text-xs"
          placeholder="Nº"
        />
      </TableCell>
      <TableCell className="py-1">
        <Input
          value={item.codigo_produto}
          onChange={(e) => onUpdate(item.id, "codigo_produto", e.target.value)}
          className="h-7 text-xs font-mono"
          placeholder="Código"
        />
      </TableCell>
      <TableCell className="py-1">
        <Input
          value={item.codigo_barras_ean}
          onChange={(e) => onUpdate(item.id, "codigo_barras_ean", e.target.value)}
          className="h-7 text-xs font-mono"
          placeholder="EAN"
        />
      </TableCell>
      <TableCell className="py-1">
        <Input
          type="number"
          min={0}
          value={item.quantidade || ""}
          onChange={(e) => onUpdate(item.id, "quantidade", parseInt(e.target.value) || 0)}
          className="h-7 text-xs text-center w-20"
        />
      </TableCell>
      <TableCell className="py-1 w-8">
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => onRemove(item.id)}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function nextGroupName(existing: string[]): string {
  // A, B, C... then Grupo N
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i);
    if (!existing.includes(letter)) return letter;
  }
  let n = existing.length + 1;
  while (existing.includes(`Grupo ${n}`)) n++;
  return `Grupo ${n}`;
}

export function ChinaGradeEditor({ items, onChange, bilingual = true }: ChinaGradeEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Group items preserving first-appearance order. Items without grupo go into "A".
  const groups = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, GradeItem[]>();
    items.forEach((it) => {
      const g = (it.grupo || "A").trim() || "A";
      if (!map.has(g)) {
        map.set(g, []);
        order.push(g);
      }
      map.get(g)!.push(it);
    });
    if (order.length === 0) order.push("A");
    return order.map((name) => ({ name, items: map.get(name) ?? [] }));
  }, [items]);

  const handleUpdateItem = (id: string, field: keyof GradeItem, value: any) => {
    onChange(items.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  };

  const handleRemoveItem = (id: string) => {
    onChange(items.filter((i) => i.id !== id));
  };

  const handleAddRow = (grupo: string) => {
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
        grupo,
      },
    ]);
  };

  const handleAddGroup = () => {
    const name = nextGroupName(groups.map((g) => g.name));
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
        grupo: name,
      },
    ]);
  };

  const handleRenameGroup = (oldName: string, newName: string) => {
    const trimmed = newName.trim() || oldName;
    onChange(items.map((i) => ((i.grupo || "A") === oldName ? { ...i, grupo: trimmed } : i)));
  };

  const handleRemoveGroup = (grupo: string) => {
    onChange(items.filter((i) => (i.grupo || "A") !== grupo));
  };

  const handleDragEndForGroup = (grupo: string) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const groupItems = items.filter((i) => (i.grupo || "A") === grupo);
    const oldIdx = groupItems.findIndex((i) => i.id === active.id);
    const newIdx = groupItems.findIndex((i) => i.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(groupItems, oldIdx, newIdx);

    // Rebuild full array preserving order of other groups, replacing this group's slice
    const others = items.filter((i) => (i.grupo || "A") !== grupo);
    // Insert reordered group at the position of its first original item
    const firstIdx = items.findIndex((i) => (i.grupo || "A") === grupo);
    const next = [...others];
    next.splice(firstIdx, 0, ...reordered);
    onChange(next);
  };

  const totalQty = items.reduce((sum, i) => sum + (i.quantidade || 0), 0);
  let runningIndex = 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        {bilingual ? (
          <BilingualLabel pt="Grade de Cores" cn="颜色网格" size="md" />
        ) : (
          <span className="text-sm font-semibold">Grade de Cores</span>
        )}
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleAddGroup}>
          <FolderPlus className="h-3 w-3" /> {bilingual ? "Adicionar Grupo 添加分组" : "Adicionar Grupo"}
        </Button>
      </div>

      <div className="space-y-4">
        {groups.map((group) => {
          const groupTotal = group.items.reduce((s, i) => s + (i.quantidade || 0), 0);
          return (
            <div key={group.name} className="border rounded-lg overflow-hidden bg-card/40">
              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/40 border-b">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">
                    {bilingual ? "Grupo 分组" : "Grupo"}
                  </span>
                  <Input
                    value={group.name}
                    onChange={(e) => handleRenameGroup(group.name, e.target.value)}
                    className="h-7 text-xs font-semibold w-32"
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {group.items.length} {bilingual ? "itens 项" : "itens"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => handleAddRow(group.name)}
                  >
                    <Plus className="h-3 w-3" /> {bilingual ? "Adicionar 添加" : "Adicionar"}
                  </Button>
                  {groups.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive"
                      onClick={() => handleRemoveGroup(group.name)}
                      title={bilingual ? "Remover grupo 删除分组" : "Remover grupo"}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-8 h-8" />
                    <TableHead className="w-10 h-8 text-center text-[10px]">#</TableHead>
                    <TableHead className="h-8 text-[10px]">{bilingual ? "Cor 颜色" : "Cor"}</TableHead>
                    <TableHead className="h-8 text-[10px]">{bilingual ? "Nº 编号" : "Nº"}</TableHead>
                    <TableHead className="h-8 text-[10px]">{bilingual ? "Código 编码" : "Código"}</TableHead>
                    <TableHead className="h-8 text-[10px]">EAN</TableHead>
                    <TableHead className="h-8 text-[10px] w-20">{bilingual ? "Qtd 数量" : "Qtd"}</TableHead>
                    <TableHead className="w-8 h-8" />
                  </TableRow>
                </TableHeader>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndForGroup(group.name)}>
                  <SortableContext items={group.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                    <TableBody>
                      {group.items.map((item) => {
                        runningIndex += 1;
                        return (
                          <SortableRow
                            key={item.id}
                            item={item}
                            displayIndex={runningIndex}
                            onUpdate={handleUpdateItem}
                            onRemove={handleRemoveItem}
                          />
                        );
                      })}
                      {group.items.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-xs text-muted-foreground py-4">
                            {bilingual ? "Sem itens neste grupo 该分组无项目" : "Sem itens neste grupo"}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </SortableContext>
                </DndContext>
                {group.items.length > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={6} className="text-right text-xs font-semibold">
                        {bilingual ? "Subtotal 小计" : "Subtotal"}
                      </TableCell>
                      <TableCell className="text-center text-xs font-semibold">
                        {groupTotal.toLocaleString()}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          );
        })}
      </div>

      {items.length > 0 && (
        <div className="flex items-center justify-end gap-3 px-3 py-2 border rounded-lg bg-muted/30">
          <span className="text-xs font-bold">{bilingual ? "Total 总计" : "Total"}</span>
          <span className="text-sm font-bold">{totalQty.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}
