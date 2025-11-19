import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, GripVertical } from "lucide-react";

interface FormulaItemRowProps {
  item: any;
  index: number;
  materiasPrimas: any[];
  onUpdate: (index: number, campo: string, valor: any) => void;
  onRemove: (index: number) => void;
}

export function FormulaItemRow({
  item,
  index,
  materiasPrimas,
  onUpdate,
  onRemove,
}: FormulaItemRowProps) {
  const mpSelecionada = materiasPrimas.find((mp) => mp.id === item.mp_id);

  return (
    <div className="flex items-start gap-3 p-4 border rounded-lg bg-background">
      <div className="cursor-move pt-2">
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>

      <div className="flex-1 grid gap-3 md:grid-cols-12">
        {/* Ordem */}
        <div className="md:col-span-1">
          <Input
            type="number"
            value={item.ordem_adicao}
            onChange={(e) =>
              onUpdate(index, "ordem_adicao", parseInt(e.target.value))
            }
            min="1"
            className="text-center"
          />
        </div>

        {/* Matéria Prima */}
        <div className="md:col-span-4">
          <Select
            value={item.mp_id}
            onValueChange={(value) => onUpdate(index, "mp_id", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a matéria-prima" />
            </SelectTrigger>
            <SelectContent>
              {materiasPrimas.map((mp) => (
                <SelectItem key={mp.id} value={mp.id}>
                  {mp.codigo} - {mp.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Quantidade */}
        <div className="md:col-span-2">
          <div className="relative">
            <Input
              type="number"
              value={item.quantidade}
              onChange={(e) =>
                onUpdate(index, "quantidade", parseFloat(e.target.value))
              }
              step="0.01"
              placeholder="Qtd"
              className="pr-12"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {mpSelecionada?.fabrica_unidades_medida?.sigla || "un"}
            </span>
          </div>
        </div>

        {/* Percentual */}
        <div className="md:col-span-2">
          <div className="relative">
            <Input
              type="number"
              value={item.percentual}
              onChange={(e) =>
                onUpdate(index, "percentual", parseFloat(e.target.value))
              }
              step="0.01"
              placeholder="%"
              className="pr-8"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              %
            </span>
          </div>
        </div>

        {/* Criticidade */}
        <div className="md:col-span-2">
          <Select
            value={item.criticidade}
            onValueChange={(value) => onUpdate(index, "criticidade", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="critico">
                <Badge variant="destructive" className="text-xs">
                  Crítico
                </Badge>
              </SelectItem>
              <SelectItem value="importante">
                <Badge className="text-xs">Importante</Badge>
              </SelectItem>
              <SelectItem value="opcional">
                <Badge variant="secondary" className="text-xs">
                  Opcional
                </Badge>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Remover */}
        <div className="md:col-span-1 flex items-start">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(index)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
