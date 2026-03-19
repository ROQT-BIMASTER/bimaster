import { useState } from "react";
import { Plus, Trash2, Power, PowerOff, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  useAllModulosDespacho,
  useManageModulosDespacho,
  AVAILABLE_ICONS,
  AVAILABLE_COLORS,
  ICON_MAP,
  type ModuloDespacho,
} from "@/hooks/useModulosDespacho";
import { cn } from "@/lib/utils";

export function ModulosDespachoManager() {
  const { data: modulos = [], isLoading } = useAllModulosDespacho();
  const { addModulo, updateModulo, deleteModulo } = useManageModulosDespacho();
  const [showNew, setShowNew] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newIcon, setNewIcon] = useState("file-text");
  const [newColor, setNewColor] = useState("text-primary");

  const handleAdd = () => {
    if (!newKey.trim() || !newLabel.trim()) return;
    const nextOrdem = modulos.length > 0 ? Math.max(...modulos.map((m) => m.ordem)) + 1 : 1;
    addModulo.mutate(
      { key: newKey.trim().toLowerCase().replace(/\s+/g, "_"), label: newLabel.trim(), icon_name: newIcon, color: newColor, ordem: nextOrdem },
      {
        onSuccess: () => {
          setShowNew(false);
          setNewKey("");
          setNewLabel("");
          setNewIcon("file-text");
          setNewColor("text-primary");
        },
      }
    );
  };

  const handleToggle = (m: ModuloDespacho) => {
    updateModulo.mutate({ id: m.id, ativo: !m.ativo });
  };

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>Módulos de Despacho</span>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowNew(true)}>
            <Plus className="h-3.5 w-3.5" /> Novo Módulo
          </Button>
        </CardTitle>
        <p className="text-[11px] text-muted-foreground mt-1">
          Gerencie os módulos disponíveis para despacho de documentos. Módulos inativos não aparecerão nas opções.
        </p>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-1">
        {isLoading && <p className="text-xs text-muted-foreground">Carregando...</p>}
        {modulos.map((m) => {
          const IconComp = ICON_MAP[m.icon_name] || ICON_MAP["file-text"];
          return (
            <div
              key={m.id}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md border text-sm transition-colors",
                m.ativo ? "bg-background" : "bg-muted/50 opacity-60"
              )}
            >
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <IconComp className={`h-4 w-4 ${m.color} shrink-0`} />
              <span className="flex-1 min-w-0">
                <span className="font-medium text-xs">{m.label}</span>
                <span className="text-[10px] text-muted-foreground ml-2 font-mono">{m.key}</span>
              </span>
              <Badge variant={m.ativo ? "success" : "secondary"} className="text-[9px] h-4 px-1.5">
                {m.ativo ? "Ativo" : "Inativo"}
              </Badge>
              <Switch
                checked={m.ativo}
                onCheckedChange={() => handleToggle(m)}
                className="scale-75"
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                onClick={() => {
                  if (confirm(`Remover módulo "${m.label}"?`)) {
                    deleteModulo.mutate(m.id);
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </CardContent>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Novo Módulo de Despacho</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome do Módulo</Label>
              <Input
                value={newLabel}
                onChange={(e) => {
                  setNewLabel(e.target.value);
                  if (!newKey || newKey === newLabel.trim().toLowerCase().replace(/\s+/g, "_")) {
                    setNewKey(e.target.value.trim().toLowerCase().replace(/\s+/g, "_"));
                  }
                }}
                placeholder="Ex: Controle de Qualidade"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Chave (identificador único)</Label>
              <Input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value.trim().toLowerCase().replace(/\s+/g, "_"))}
                placeholder="Ex: controle_qualidade"
                className="h-8 text-xs font-mono"
              />
            </div>
            <div>
              <Label className="text-xs">Ícone</Label>
              <div className="grid grid-cols-8 gap-1 mt-1 p-2 border rounded-md max-h-32 overflow-y-auto">
                {AVAILABLE_ICONS.map(({ name, component: Ic }) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setNewIcon(name)}
                    className={cn(
                      "p-1.5 rounded-md transition-colors flex items-center justify-center",
                      newIcon === name ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-muted"
                    )}
                    title={name}
                  >
                    <Ic className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">Cor</Label>
              <Select value={newColor} onValueChange={setNewColor}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_COLORS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <span className="flex items-center gap-2">
                        <span className={`h-3 w-3 rounded-full bg-current ${c.value}`} />
                        {c.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleAdd} disabled={!newKey.trim() || !newLabel.trim() || addModulo.isPending}>
              Criar Módulo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
