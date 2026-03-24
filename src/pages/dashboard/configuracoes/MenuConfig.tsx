import { useState } from "react";
import { useSidebarConfig, SidebarCategory, SidebarCategoryModule } from "@/hooks/useSidebarConfig";
import { useSidebarMenuItems, SidebarMenuItem } from "@/hooks/useSidebarMenuItems";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  GripVertical, Plus, Trash2, Pencil, Check, X, ChevronUp, ChevronDown,
  ArrowUp, ArrowDown, FolderOpen, Eye, EyeOff, Settings, ChevronRight,
  Brain, Shield, Download
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import * as LucideIcons from "lucide-react";

const ICON_OPTIONS = [
  "Briefcase", "Store", "Factory", "DollarSign", "FolderKanban", "Users",
  "Building2", "Package", "BarChart3", "TrendingUp", "Globe", "Mic",
  "Calendar", "Shield", "Settings", "Palette", "FlaskConical", "Tag",
  "Layers", "Receipt", "Wallet", "Bot", "Sparkles", "PartyPopper",
  "Rocket", "Compass", "Inbox", "Send", "Landmark", "Camera",
  "Home", "FileText", "Activity", "CheckSquare", "Brain", "Target",
  "CreditCard", "Upload", "Network", "Key", "UserCheck", "Scale",
  "LayoutGrid", "Ticket", "Megaphone", "BarChart2", "Image",
];

const MODULE_LABELS: Record<string, string> = {
  central_inteligencia: "Central de Inteligência",
  prospects: "Prospects",
  comercial: "Comercial",
  precos: "Preços",
  trade: "Trade Marketing",
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
  processos: "Processos",
  admin: "Administração (Footer)",
  geral: "Geral",
};

const SPECIAL_MODULES = ["central_inteligencia", "admin", "geral"];

function renderIcon(iconName: string | null) {
  if (!iconName) return null;
  const Icon = (LucideIcons as any)[iconName];
  if (!Icon) return null;
  return <Icon className="h-4 w-4 text-muted-foreground" />;
}

// Sub-item row component
function SubItemRow({ item, onToggle, onEdit }: { 
  item: SidebarMenuItem; 
  onToggle: (id: string, ativo: boolean) => void;
  onEdit: (item: SidebarMenuItem) => void;
}) {
  return (
    <div className={cn(
      "flex items-center gap-2 py-1.5 px-3 rounded-md group transition-colors",
      item.ativo ? "hover:bg-muted/50" : "opacity-50"
    )}>
      {renderIcon(item.icon_override || item.icon)}
      <span className={cn("text-sm flex-1", !item.ativo && "line-through")}>
        {item.label_override || item.label}
        {item.label_override && (
          <span className="text-xs text-muted-foreground ml-1">({item.label})</span>
        )}
      </span>
      {item.parent_group && (
        <Badge variant="outline" className="text-[10px] h-5">{item.parent_group}</Badge>
      )}
      {item.screen_code && (
        <Badge variant="secondary" className="text-[10px] h-5 font-mono">{item.screen_code}</Badge>
      )}
      {item.require_admin && (
        <Badge variant="destructive" className="text-[10px] h-5">Admin</Badge>
      )}
      {item.require_admin_or_supervisor && (
        <Badge className="text-[10px] h-5 bg-warning text-warning-foreground">Sup+</Badge>
      )}
      <span className="text-[10px] text-muted-foreground font-mono">#{item.ordem}</span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onEdit(item)}>
          <Pencil className="h-3 w-3" />
        </Button>
        <Switch
          checked={item.ativo}
          onCheckedChange={(checked) => onToggle(item.id, checked)}
          className="h-4 w-7 data-[state=checked]:bg-primary"
        />
      </div>
    </div>
  );
}

// Module section with its sub-items
function ModuleSection({ moduleCode, items, onToggle, onEdit }: {
  moduleCode: string;
  items: SidebarMenuItem[];
  onToggle: (id: string, ativo: boolean) => void;
  onEdit: (item: SidebarMenuItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const activeCount = items.filter(i => i.ativo).length;
  const groups = [...new Set(items.filter(i => i.parent_group).map(i => i.parent_group!))];
  const ungrouped = items.filter(i => !i.parent_group);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center gap-2 w-full px-2 py-2 rounded-md hover:bg-muted/50 transition-colors">
          <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-90")} />
          <span className="text-sm font-medium flex-1 text-left">
            {MODULE_LABELS[moduleCode] || moduleCode}
          </span>
          <Badge variant={activeCount === items.length ? "default" : "secondary"} className="text-[10px]">
            {activeCount}/{items.length}
          </Badge>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-4 border-l border-border pl-2 space-y-0.5 pb-2">
          {ungrouped.map(item => (
            <SubItemRow key={item.id} item={item} onToggle={onToggle} onEdit={onEdit} />
          ))}
          {groups.map(group => {
            const groupItems = items.filter(i => i.parent_group === group);
            return (
              <div key={group} className="mt-2">
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {group}
                </div>
                {groupItems.map(item => (
                  <SubItemRow key={item.id} item={item} onToggle={onToggle} onEdit={onEdit} />
                ))}
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function MenuConfigPage() {
  const { 
    categories, isLoading: catLoading, 
    updateCategory, createCategory, deleteCategory,
    updateModuleMapping, moveModule, reorderCategories, reorderModules
  } = useSidebarConfig();
  const { itemsByModule, isLoading: itemsLoading, updateItem, toggleItemActive } = useSidebarMenuItems();
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
  
  // Sub-item editing
  const [editingItem, setEditingItem] = useState<SidebarMenuItem | null>(null);
  const [editItemLabel, setEditItemLabel] = useState("");
  const [editItemIcon, setEditItemIcon] = useState("");

  const isLoading = catLoading || itemsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Category handlers
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
      await createCategory.mutateAsync({ key, label: newCatLabel, icon: newCatIcon, ordem: categories.length + 1 });
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

  // Sub-item handlers
  const handleToggleItem = async (id: string, ativo: boolean) => {
    try {
      await toggleItemActive.mutateAsync({ id, ativo });
      toast({ title: ativo ? "Item ativado" : "Item desativado" });
    } catch {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    }
  };

  const handleStartEditItem = (item: SidebarMenuItem) => {
    setEditingItem(item);
    setEditItemLabel(item.label_override || "");
    setEditItemIcon(item.icon_override || "");
  };

  const handleSaveItem = async () => {
    if (!editingItem) return;
    try {
      await updateItem.mutateAsync({
        id: editingItem.id,
        label_override: editItemLabel || null,
        icon_override: editItemIcon || null,
      });
      toast({ title: "Item atualizado" });
      setEditingItem(null);
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
  };

  // Collect all module codes from categories
  const categoryModuleCodes = new Set<string>();
  categories.forEach(cat => cat.modules.forEach(m => categoryModuleCodes.add(m.module_code)));

  // Modules that have items but aren't in any category
  const uncategorizedModules = Object.keys(itemsByModule).filter(
    code => !categoryModuleCodes.has(code) && !SPECIAL_MODULES.includes(code)
  );

  const totalItems = Object.values(itemsByModule).flat().length;
  const activeItems = Object.values(itemsByModule).flat().filter(i => i.ativo).length;

  return (
    <div className="container max-w-5xl mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Configuração do Menu</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure categorias, módulos, sub-itens, visibilidade e ordem do menu lateral.
          </p>
          <div className="flex gap-2 mt-2">
            <Badge variant="outline">{totalItems} itens totais</Badge>
            <Badge variant="default">{activeItems} ativos</Badge>
            <Badge variant="secondary">{categories.length} categorias</Badge>
          </div>
        </div>
        <Dialog open={newCatOpen} onOpenChange={setNewCatOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Categoria</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Categoria</DialogTitle></DialogHeader>
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
                    {ICON_OPTIONS.map(ic => <SelectItem key={ic} value={ic}>{ic}</SelectItem>)}
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

      {/* Special sections: Central de Inteligência */}
      {itemsByModule["central_inteligencia"] && (
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Central de Inteligência
              <Badge variant="outline" className="text-xs">Seção especial — topo do menu</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ModuleSection
              moduleCode="central_inteligencia"
              items={itemsByModule["central_inteligencia"]}
              onToggle={handleToggleItem}
              onEdit={handleStartEditItem}
            />
          </CardContent>
        </Card>
      )}

      {/* Categories with modules and sub-items */}
      {categories.map((cat, catIdx) => (
        <Card key={cat.id}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              
              {editingCatId === cat.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input value={editLabel} onChange={e => setEditLabel(e.target.value)} className="h-8 max-w-xs" />
                  <Select value={editIcon} onValueChange={setEditIcon}>
                    <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ICON_OPTIONS.map(ic => <SelectItem key={ic} value={ic}>{ic}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveCat}><Check className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingCatId(null)}><X className="h-3.5 w-3.5" /></Button>
                </div>
              ) : (
                <>
                  <CardTitle className="text-base flex-1 flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                    {cat.label}
                    <Badge variant="outline" className="text-xs font-normal">{cat.icon}</Badge>
                    <Badge variant="secondary" className="text-xs">{cat.modules.length} módulos</Badge>
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleMoveCatUp(catIdx)} disabled={catIdx === 0}><ChevronUp className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleMoveCatDown(catIdx)} disabled={catIdx === categories.length - 1}><ChevronDown className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleStartEditCat(cat)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDeleteCat(cat.id)} disabled={cat.modules.length > 0}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1">
              {cat.modules.map((mod, modIdx) => (
                <div key={mod.id} className="border rounded-lg p-2">
                  {/* Module header row */}
                  <div className="flex items-center gap-2 py-1 group">
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
                            {ICON_OPTIONS.map(ic => <SelectItem key={ic} value={ic}>{ic}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleSaveMod}><Check className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingModId(null)}><X className="h-3 w-3" /></Button>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm font-medium flex-1">
                          {mod.label_override || MODULE_LABELS[mod.module_code] || mod.module_code}
                          {mod.label_override && (
                            <span className="text-xs text-muted-foreground ml-1">({MODULE_LABELS[mod.module_code]})</span>
                          )}
                        </span>
                        {itemsByModule[mod.module_code] && (
                          <Badge variant="outline" className="text-[10px]">
                            {itemsByModule[mod.module_code].filter(i => i.ativo).length}/{itemsByModule[mod.module_code].length} sub-itens
                          </Badge>
                        )}
                        {mod.icon_override && (
                          <Badge variant="outline" className="text-[10px] h-5">{mod.icon_override}</Badge>
                        )}
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleMoveModUp(cat, modIdx)} disabled={modIdx === 0}><ArrowUp className="h-3 w-3" /></Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleMoveModDown(cat, modIdx)} disabled={modIdx === cat.modules.length - 1}><ArrowDown className="h-3 w-3" /></Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleStartEditMod(mod)}><Pencil className="h-3 w-3" /></Button>
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

                  {/* Sub-items for this module */}
                  {itemsByModule[mod.module_code] && itemsByModule[mod.module_code].length > 0 && (
                    <ModuleSection
                      moduleCode={mod.module_code}
                      items={itemsByModule[mod.module_code]}
                      onToggle={handleToggleItem}
                      onEdit={handleStartEditItem}
                    />
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

      {/* Uncategorized modules */}
      {uncategorizedModules.length > 0 && (
        <Card className="border-dashed border-warning/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="h-4 w-4 text-warning" />
              Módulos sem Categoria
              <Badge variant="secondary" className="text-xs">{uncategorizedModules.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-1">
            {uncategorizedModules.map(code => (
              <ModuleSection
                key={code}
                moduleCode={code}
                items={itemsByModule[code]}
                onToggle={handleToggleItem}
                onEdit={handleStartEditItem}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Admin footer section */}
      {itemsByModule["admin"] && (
        <Card className="border-destructive/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-5 w-5 text-destructive" />
              Administração (Footer)
              <Badge variant="outline" className="text-xs">Links do rodapé — apenas admins</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ModuleSection
              moduleCode="admin"
              items={itemsByModule["admin"]}
              onToggle={handleToggleItem}
              onEdit={handleStartEditItem}
            />
          </CardContent>
        </Card>
      )}

      {/* Geral section */}
      {itemsByModule["geral"] && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Download className="h-5 w-5 text-muted-foreground" />
              Geral
              <Badge variant="outline" className="text-xs">Itens avulsos</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ModuleSection
              moduleCode="geral"
              items={itemsByModule["geral"]}
              onToggle={handleToggleItem}
              onEdit={handleStartEditItem}
            />
          </CardContent>
        </Card>
      )}

      {/* Info footer */}
      <Card className="border-dashed">
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          <p>As alterações são aplicadas automaticamente para todos os usuários.</p>
          <p className="mt-1">O controle de acesso (permissões de módulo/tela) não é afetado por esta configuração.</p>
        </CardContent>
      </Card>

      {/* Edit sub-item dialog */}
      <Dialog open={!!editingItem} onOpenChange={(open) => { if (!open) setEditingItem(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Item: {editingItem?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Label personalizado</label>
              <Input 
                value={editItemLabel} 
                onChange={e => setEditItemLabel(e.target.value)} 
                placeholder={editingItem?.label || "Label padrão"} 
              />
              <p className="text-xs text-muted-foreground mt-1">Deixe vazio para usar o label padrão</p>
            </div>
            <div>
              <label className="text-sm font-medium">Ícone personalizado</label>
              <Select value={editItemIcon || ""} onValueChange={setEditItemIcon}>
                <SelectTrigger><SelectValue placeholder="Ícone padrão" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Padrão ({editingItem?.icon})</SelectItem>
                  {ICON_OPTIONS.map(ic => <SelectItem key={ic} value={ic}>{ic}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {editingItem && (
              <div className="text-xs text-muted-foreground space-y-1 bg-muted/50 rounded-md p-3">
                <p><strong>Código:</strong> {editingItem.item_code}</p>
                <p><strong>Rota:</strong> {editingItem.route}</p>
                <p><strong>Permissão:</strong> {editingItem.screen_code || "Nenhuma"}</p>
                <p><strong>Grupo:</strong> {editingItem.parent_group || "Nenhum"}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>Cancelar</Button>
            <Button onClick={handleSaveItem}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
