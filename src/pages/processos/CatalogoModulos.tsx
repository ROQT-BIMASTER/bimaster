import { useState } from "react";
import { Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { BookOpen, Plus, Trash2, Pencil } from "lucide-react";
import { useModuloCatalogo, type ModuloCatalogo } from "@/hooks/useModuloCatalogo";
import { useUserRole } from "@/hooks/useUserRole";

const ENTIDADES = [
  { value: "produto", label: "Produto Brasil" },
  { value: "produto_china", label: "Produto China" },
  { value: "projeto", label: "Projeto" },
  { value: "tarefa", label: "Tarefa" },
];

const emptyForm: Partial<ModuloCatalogo> = {
  codigo: "",
  label: "",
  descricao: "",
  icone: "",
  cor: "blue",
  rota: "/dashboard/",
  entidade_alvo: "produto",
  param_template: "?produto={entidade_id}",
  cria_registro_automatico: false,
  ativo: true,
  ordem: 999,
};

export default function CatalogoModulos() {
  const { isAdmin } = useUserRole();
  const { catalogo, isLoading, upsert, remove } = useModuloCatalogo(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<ModuloCatalogo>>(emptyForm);
  const [editing, setEditing] = useState(false);

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const abrirNovo = () => {
    setForm(emptyForm);
    setEditing(false);
    setOpen(true);
  };

  const abrirEdicao = (m: ModuloCatalogo) => {
    setForm(m);
    setEditing(true);
    setOpen(true);
  };

  const salvar = async () => {
    if (!form.codigo || !form.label || !form.rota) return;
    await upsert.mutateAsync(form as any);
    setOpen(false);
    setForm(emptyForm);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <BookOpen className="h-7 w-7 text-primary" />
              Catálogo de Módulos
            </h1>
            <p className="text-muted-foreground mt-1">
              Módulos disponíveis para vincular às etapas dos perfis de processo (Composição, Etiqueta/Bula, Aprovação de Artes, etc.).
            </p>
          </div>
          <Button onClick={abrirNovo}>
            <Plus className="h-4 w-4 mr-2" />Novo Módulo
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Módulos cadastrados ({catalogo.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
            <div className="grid gap-2">
              {catalogo.map((m) => (
                <div key={m.codigo} className="flex items-center gap-3 p-3 border rounded-md">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="font-mono text-[10px]">{m.codigo}</Badge>
                      <span className="font-medium text-sm">{m.label}</span>
                      {!m.ativo && <Badge variant="destructive" className="text-[9px]">inativo</Badge>}
                      {m.cria_registro_automatico && <Badge variant="secondary" className="text-[9px]">auto</Badge>}
                      <Badge variant="outline" className="text-[9px]">{m.entidade_alvo}</Badge>
                    </div>
                    {m.descricao && <p className="text-xs text-muted-foreground mt-1">{m.descricao}</p>}
                    <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{m.rota}{m.param_template}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => abrirEdicao(m)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm(`Remover módulo "${m.label}" do catálogo?`)) remove.mutate(m.codigo);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
              {!isLoading && catalogo.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum módulo cadastrado.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar módulo" : "Novo módulo"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 grid-cols-2">
              <div>
                <Label>Código *</Label>
                <Input
                  value={form.codigo ?? ""}
                  onChange={(e) => setForm({ ...form, codigo: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
                  disabled={editing}
                  placeholder="ex: etiqueta_bula"
                />
              </div>
              <div>
                <Label>Rótulo *</Label>
                <Input value={form.label ?? ""} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="ex: Etiqueta / Bula" />
              </div>
              <div className="col-span-2">
                <Label>Descrição</Label>
                <Textarea value={form.descricao ?? ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={2} />
              </div>
              <div>
                <Label>Rota *</Label>
                <Input value={form.rota ?? ""} onChange={(e) => setForm({ ...form, rota: e.target.value })} placeholder="/dashboard/etiqueta-bula" />
              </div>
              <div>
                <Label>Param template</Label>
                <Input value={form.param_template ?? ""} onChange={(e) => setForm({ ...form, param_template: e.target.value })} placeholder="?produto={entidade_id}" />
              </div>
              <div>
                <Label>Ícone (Lucide)</Label>
                <Input value={form.icone ?? ""} onChange={(e) => setForm({ ...form, icone: e.target.value })} placeholder="Tag" />
              </div>
              <div>
                <Label>Cor</Label>
                <Input value={form.cor ?? ""} onChange={(e) => setForm({ ...form, cor: e.target.value })} placeholder="orange" />
              </div>
              <div>
                <Label>Entidade alvo</Label>
                <Select value={form.entidade_alvo ?? "produto"} onValueChange={(v) => setForm({ ...form, entidade_alvo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ENTIDADES.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ordem</Label>
                <Input type="number" value={form.ordem ?? 0} onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) })} />
              </div>
              <div className="flex items-center gap-2 col-span-2">
                <Switch checked={!!form.ativo} onCheckedChange={(b) => setForm({ ...form, ativo: b })} />
                <Label>Ativo</Label>
                <div className="w-4" />
                <Switch checked={!!form.cria_registro_automatico} onCheckedChange={(b) => setForm({ ...form, cria_registro_automatico: b })} />
                <Label>Criar registro automaticamente ao entrar na etapa</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={salvar} disabled={!form.codigo || !form.label || !form.rota || upsert.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
