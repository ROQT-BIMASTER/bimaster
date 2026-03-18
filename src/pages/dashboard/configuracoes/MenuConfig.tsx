import { useState } from "react";
import { useSidebarConfig, SidebarCategory, SidebarCategoryModule } from "@/hooks/useSidebarConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  GripVertical, Plus, Trash2, Pencil, Check, X, ChevronUp, ChevronDown,
  ArrowUp, ArrowDown, FolderOpen
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";

const ICON_OPTIONS = [
  "Briefcase", "Store", "Factory", "DollarSign", "FolderKanban", "Users",
  "Building2", "Package", "BarChart3", "TrendingUp", "Globe", "Mic",
  "Calendar", "Shield", "Settings", "Palette", "FlaskConical", "Tag",
  "Layers", "Receipt", "Wallet", "Bot", "Sparkles", "PartyPopper",
  "Rocket", "Compass", "Inbox", "Send", "Landmark", "Camera",
];

// Known module codes for display
const MODULE_LABELS: Record<string, string> = {
  prospects: "Prospects",
  comercial: "Comercial",
  precos: "Preços",
  trade: "Trade",
  marketing: "Marketing",
  eventos: "Eventos",
  fabrica: "Fábrica",
  china: "Fábrica China",
  composicao: "Composição",
  amostras: "Amostras",
  analise_embalagem: "Embalagem",
  etiqueta_bula: "Etiqueta/Bula",
  aprovacao_artes: "Aprovação de Artes",
  financeiro: "Financeiro",
  departamentos: "Departamentos",
  estoque: "Estoque",
  projetos: "Projetos",
  reunioes: "Reuniões",
};

export default function MenuConfigPage() {
  const { 
    categories, isLoading, 
    updateCategory, createCategory, deleteCategory,
    updateModuleMapping, moveModule, reorderCategories, reorderModules
  } = useSidebarConfig();
  const { toast } = useToast();

  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("Briefcase");
  const [editingModId, setEditingModId] = useState<string | null>(null);
  const [editModLabel, setEditModLabel] = useState("");
  const [editModIcon, setEditModIcon] = useState("");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleStartEditCat = (cat: SidebarCategory) => {
    setEditingCatId(cat.id);
    setEditLabel(cat.label);
    setEditIcon(cat.icon);
  };

  const handleSaveCat = async () => {
    if (!editingCatId) return;
    try {
      await updateCategory.mutateAsync({ id: editingCatId, label: editLabel, icon: editIcon });
      toast({ title: "Categoria atualizada" });
      setEditingCatId(null);
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
  };

  const handleCreateCat = async () => {
    if (!newCatLabel.trim()) return;
    try {
      const key = newCatLabel.toLowerCase().replace(/[^a-z0-9]/g, "_");
      await createCategory.mutateAsync({
        key,
        label: newCatLabel,
        icon: newCatIcon,
        ordem: categories.length + 1,
      });
      toast({ title: "Categoria criada" });
      setNewCatOpen(false);
      setNewCatLabel("");
    } catch {
      toast({ title: "Erro ao criar", variant: "destructive" });
    }
  };

  const handleDeleteCat = async (id: string) => {
    try {
      await deleteCategory.mutateAsync(id);
      toast({ title: "Categoria removida" });
    } catch {
      toast({ title: "Erro ao remover", variant: "destructive" });
    }
  };

  const handleMoveCatUp = async (idx: number) => {
    if (idx === 0) return;
    const ids = categories.map(c => c.id);
    [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
    await reorderCategories.mutateAsync(ids);
  };

  const handleMoveCatDown = async (idx: number) => {
    if (idx >= categories.length - 1) return;
    const ids = categories.map(c => c.id);
    [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
    await reorderCategories.mutateAsync(ids);
  };

  const handleMoveModUp = async (cat: SidebarCategory, modIdx: number) => {
    if (modIdx === 0) return;
    const ids = cat.modules.map(m => m.id);
    [ids[modIdx - 1], ids[modIdx]] = [ids[modIdx], ids[modIdx - 1]];
    await reorderModules.mutateAsync(ids);
  };

  const handleMoveModDown = async (cat: SidebarCategory, modIdx: number) => {
    if (modIdx >= cat.modules.length - 1) return;
    const ids = cat.modules.map(m => m.id);
    [ids[modIdx], ids[modIdx + 1]] = [ids[modIdx + 1], ids[modIdx]];
    await reorderModules.mutateAsync(ids);
  };

  const handleMoveModToCategory = async (mod: SidebarCategoryModule, newCatId: string) => {
    const targetCat = categories.find(c => c.id === newCatId);
    const newOrdem = (targetCat?.modules.length || 0) + 1;
    await moveModule.mutateAsync({ moduleId: mod.id, newCategoryId: newCatId, newOrdem });
    toast({ title: "Módulo movido" });
  };

  const handleStartEditMod = (mod: SidebarCategoryModule) => {
    setEditingModId(mod.id);
    setEditModLabel(mod.label_override || "");
    setEditModIcon(mod.icon_override || "");
  };

  const handleSaveMod = async () => {
    if (!editingModId) return;
    try {
      await updateModuleMapping.mutateAsync({
        id: editingModId,
        label_override: editModLabel || null,
        icon_override: editModIcon || null,
      });
      toast({ title: "Módulo atualizado" });
      setEditingModId(null);
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
  };

  return (
    <div className="container max-w-4xl mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Configuração do Menu</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure a ordem, agrupamento, ícones e labels do menu lateral. 
            As permissões de acesso não são afetadas.
          </p>
        </div>
        <Dialog open={newCatOpen} onOpenChange={setNewCatOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> Nova Categoria
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Categoria</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Nome</label>
                <Input value={newCatLabel} onChange={e => setNewCatLabel(e.target.value)} placeholder="Nome da categoria" />
              </div>
              <div>
                <label className="text-sm font-medium">Ícone</label>
                <Select value={newCatIcon} onValueChange={setNewCatIcon}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map(ic => (
                      <SelectItem key={ic} value={ic}>{ic}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateCat} disabled={!newCatLabel.trim()}>Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {categories.map((cat, catIdx) => (
        <Card key={cat.id}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              
              {editingCatId === cat.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input 
                    value={editLabel} 
                    onChange={e => setEditLabel(e.target.value)} 
                    className="h-8 max-w-xs" 
                  />
                  <Select value={editIcon} onValueChange={setEditIcon}>
                    <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ICON_OPTIONS.map(ic => (
                        <SelectItem key={ic} value={ic}>{ic}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveCat}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingCatId(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <>
                  <CardTitle className="text-base flex-1 flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                    {cat.label}
                    <Badge variant="outline" className="text-xs font-normal">{cat.icon}</Badge>
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleMoveCatUp(catIdx)} disabled={catIdx === 0}>
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleMoveCatDown(catIdx)} disabled={catIdx === categories.length - 1}>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleStartEditCat(cat)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDeleteCat(cat.id)} disabled={cat.modules.length > 0}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1">
              {cat.modules.map((mod, modIdx) => (
                <div key={mod.id} className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 group">
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
                  
                  {editingModId === mod.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input 
                        value={editModLabel} 
                        onChange={e => setEditModLabel(e.target.value)} 
                        placeholder={MODULE_LABELS[mod.module_code] || mod.module_code}
                        className="h-7 text-sm max-w-xs" 
                      />
                      <Select value={editModIcon || ""} onValueChange={setEditModIcon}>
                        <SelectTrigger className="h-7 w-36 text-sm"><SelectValue placeholder="Ícone padrão" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Padrão</SelectItem>
                          {ICON_OPTIONS.map(ic => (
                            <SelectItem key={ic} value={ic}>{ic}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleSaveMod}>
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingModId(null)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm flex-1">
                        {mod.label_override || MODULE_LABELS[mod.module_code] || mod.module_code}
                        {mod.label_override && (
                          <span className="text-xs text-muted-foreground ml-1">({MODULE_LABELS[mod.module_code]})</span>
                        )}
                      </span>
                      {mod.icon_override && (
                        <Badge variant="outline" className="text-[10px] h-5">{mod.icon_override}</Badge>
                      )}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleMoveModUp(cat, modIdx)} disabled={modIdx === 0}>
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleMoveModDown(cat, modIdx)} disabled={modIdx === cat.modules.length - 1}>
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleStartEditMod(mod)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Select onValueChange={val => handleMoveModToCategory(mod, val)}>
                          <SelectTrigger className="h-6 w-6 p-0 border-0 shadow-none [&>svg]:hidden">
                            <FolderOpen className="h-3 w-3" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.filter(c => c.id !== cat.id).map(c => (
                              <SelectItem key={c.id} value={c.id}>Mover para: {c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </div>
              ))}
              {cat.modules.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Nenhum módulo. Mova módulos de outras categorias para cá.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
      
      <Card className="border-dashed">
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          <p>As alterações são aplicadas automaticamente para todos os usuários.</p>
          <p className="mt-1">O controle de acesso (permissões de módulo/tela) não é afetado por esta configuração.</p>
        </CardContent>
      </Card>
    </div>
  );
}
