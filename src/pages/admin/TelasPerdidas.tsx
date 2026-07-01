import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SearchX, Link2, ExternalLink, Loader2 } from "lucide-react";
// Ler o source do App.tsx em build-time via Vite (?raw)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - import raw string
import appSource from "@/App.tsx?raw";

interface MenuRow {
  id: string;
  module_code: string;
  route: string | null;
  label: string;
  ativo: boolean;
}

function normalize(route: string): string {
  let r = route.trim();
  if (!r.startsWith("/")) r = "/" + r;
  r = r.replace(/\/:[^/]+/g, "").replace(/\/\*$/, "").replace(/\*$/, "");
  if (r.length > 1 && r.endsWith("/")) r = r.slice(0, -1);
  return r || "/";
}

function extractAppRoutes(src: string): string[] {
  const rx = /<Route\s+[^>]*\bpath=["']([^"']+)["']/g;
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = rx.exec(src))) {
    const raw = m[1];
    if (raw === "*" || raw === "/") continue;
    set.add(normalize(raw));
  }
  return Array.from(set).sort();
}

function topSegment(route: string): string {
  const s = route.split("/").filter(Boolean)[0] ?? "raiz";
  return s;
}

export default function TelasPerdidas() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [somenteInativas, setSomenteInativas] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const { data: menuItems = [], isLoading } = useQuery({
    queryKey: ["sidebar-menu-items-all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sidebar_menu_items")
        .select("id, module_code, route, label, ativo");
      if (error) throw error;
      return (data || []) as MenuRow[];
    },
  });

  const appRoutes = useMemo(() => extractAppRoutes(appSource as string), []);

  const { routesInMenu, activeRoutes, modules } = useMemo(() => {
    const inMenu = new Set<string>();
    const active = new Set<string>();
    const mods = new Set<string>();
    for (const it of menuItems) {
      if (it.route) {
        const n = normalize(it.route);
        inMenu.add(n);
        if (it.ativo) active.add(n);
      }
      mods.add(it.module_code);
    }
    return {
      routesInMenu: inMenu,
      activeRoutes: active,
      modules: Array.from(mods).sort(),
    };
  }, [menuItems]);

  const orphans = useMemo(() => {
    return appRoutes.filter((r) => {
      if (somenteInativas) {
        // rota existe no menu porém está inativa em todos os itens
        return routesInMenu.has(r) && !activeRoutes.has(r);
      }
      return !routesInMenu.has(r);
    });
  }, [appRoutes, routesInMenu, activeRoutes, somenteInativas]);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return orphans;
    return orphans.filter((r) => r.toLowerCase().includes(q));
  }, [orphans, busca]);

  const grouped = useMemo(() => {
    const g: Record<string, string[]> = {};
    for (const r of filtered) {
      const k = topSegment(r);
      (g[k] ||= []).push(r);
    }
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <header className="flex items-center gap-3">
        <SearchX className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-lg font-semibold">Telas perdidas</h1>
          <p className="text-xs text-muted-foreground">
            Rotas registradas no aplicativo que não estão vinculadas a nenhum item
            do menu. Selecione uma rota e vincule ao módulo desejado.
          </p>
        </div>
      </header>

      <Card className="p-3 flex flex-wrap items-center gap-3">
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Filtrar por rota (ex.: /admin, /financeiro...)"
          className="max-w-sm"
        />
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={somenteInativas}
            onCheckedChange={(v) => setSomenteInativas(v === true)}
          />
          Somente rotas com item de menu inativo
        </label>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">{appRoutes.length} rotas no App</Badge>
          <Badge variant="secondary">{routesInMenu.size} vinculadas</Badge>
          <Badge variant="destructive">{orphans.length} perdidas</Badge>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando itens do menu...
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhuma rota perdida encontrada.
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(([segmento, rotas]) => (
            <Card key={segmento} className="overflow-hidden">
              <div className="px-3 py-2 bg-muted/50 border-b flex items-center gap-2">
                <span className="font-medium text-sm">/{segmento}</span>
                <Badge variant="outline" className="text-xs">
                  {rotas.length}
                </Badge>
              </div>
              <ScrollArea className="max-h-[420px]">
                <ul className="divide-y">
                  {rotas.map((r) => (
                    <li
                      key={r}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30"
                    >
                      <code className="text-xs font-mono flex-1 truncate">{r}</code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(r, "_blank")}
                        title="Abrir rota em nova aba"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelected(r)}
                      >
                        <Link2 className="h-3.5 w-3.5 mr-1" />
                        Vincular
                      </Button>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </Card>
          ))}
        </div>
      )}

      <VincularDialog
        route={selected}
        modules={modules}
        onClose={() => setSelected(null)}
        onSaved={() => {
          setSelected(null);
          qc.invalidateQueries({ queryKey: ["sidebar-menu-items-all"] });
          qc.invalidateQueries({ queryKey: ["sidebar-menu-items"] });
        }}
      />
    </div>
  );
}

function slugify(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60);
}

function VincularDialog({
  route,
  modules,
  onClose,
  onSaved,
}: {
  route: string | null;
  modules: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [moduleCode, setModuleCode] = useState<string>("");
  const [novoModulo, setNovoModulo] = useState("");
  const [label, setLabel] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [icon, setIcon] = useState("");
  const [parentGroup, setParentGroup] = useState("");
  const [ordem, setOrdem] = useState(999);
  const [requireAdmin, setRequireAdmin] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset ao abrir com nova rota
  useMemo(() => {
    if (route) {
      const segs = route.split("/").filter(Boolean);
      const guessLabel = (segs[segs.length - 1] || route)
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      setLabel(guessLabel);
      setItemCode(slugify(segs.join("_") || "item"));
      setModuleCode(segs[0] && modules.includes(segs[0]) ? segs[0] : "");
      setNovoModulo("");
      setIcon("");
      setParentGroup("");
      setOrdem(999);
      setRequireAdmin(segs[0] === "admin");
    }
  }, [route, modules]);

  const finalModule = novoModulo.trim() ? slugify(novoModulo) : moduleCode;

  const handleSave = async () => {
    if (!route) return;
    if (!finalModule) {
      toast.error("Selecione um módulo ou informe um novo código de módulo.");
      return;
    }
    if (!label.trim()) {
      toast.error("Informe um rótulo.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("sidebar_menu_items")
        .insert({
          module_code: finalModule,
          item_code: itemCode || slugify(label),
          label: label.trim(),
          icon: icon.trim() || null,
          route,
          parent_group: parentGroup.trim() || null,
          ordem,
          ativo: true,
          require_admin: requireAdmin,
        });
      if (error) throw error;
      toast.success("Rota vinculada ao menu.");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao vincular rota.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!route} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Vincular rota ao menu</DialogTitle>
          <DialogDescription>
            <code className="font-mono text-xs">{route}</code>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Módulo existente</Label>
              <Select value={moduleCode} onValueChange={setModuleCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {modules.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ou novo módulo</Label>
              <Input
                value={novoModulo}
                onChange={(e) => setNovoModulo(e.target.value)}
                placeholder="ex.: novo_modulo"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Rótulo *</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">item_code</Label>
              <Input
                value={itemCode}
                onChange={(e) => setItemCode(slugify(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ícone (lucide)</Label>
              <Input
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="ex.: FileText"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Grupo (opcional)</Label>
              <Input
                value={parentGroup}
                onChange={(e) => setParentGroup(e.target.value)}
                placeholder="ex.: Relatórios"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ordem</Label>
              <Input
                type="number"
                value={ordem}
                onChange={(e) => setOrdem(Number(e.target.value) || 0)}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs">
            <Checkbox
              checked={requireAdmin}
              onCheckedChange={(v) => setRequireAdmin(v === true)}
            />
            Requer admin
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
            Vincular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
