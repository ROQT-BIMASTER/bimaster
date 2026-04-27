import { useState } from "react";
import { useProjetoModelos, type ProjetoModelo } from "@/hooks/useProjetoModelos";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trash2, Pencil, FolderTree, User as UserIcon, Users, Globe2, Search, Plus } from "lucide-react";
import { useUserDepartments } from "@/hooks/useUserDepartments";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useAuth } from "@/contexts/AuthContext";

function escopoBadge(esc: ProjetoModelo["escopo"]) {
  if (esc === "pessoal") return { icon: <UserIcon className="h-3 w-3" />, label: "Pessoal" };
  if (esc === "departamento") return { icon: <Users className="h-3 w-3" />, label: "Departamento" };
  return { icon: <Globe2 className="h-3 w-3" />, label: "Organização" };
}

export default function MeusModelosProjeto() {
  const { modelos, updateModelo, deleteModelo, createModelo } = useProjetoModelos();
  const { isAdmin } = usePermissions();
  const { user } = useAuth();
  const { data: userDepartments = [] } = useUserDepartments();
  const [busca, setBusca] = useState("");
  const [editing, setEditing] = useState<ProjetoModelo | null>(null);
  const [deleting, setDeleting] = useState<ProjetoModelo | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);

  const lista = (modelos.data || []).filter((m) =>
    busca.trim() ? m.nome.toLowerCase().includes(busca.toLowerCase()) : true,
  );
  const meus = lista.filter((m) => m.criado_por === user?.id);
  const compartilhados = lista.filter((m) => m.criado_por !== user?.id);

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Modelos de Projeto</h1>
          <p className="text-sm text-muted-foreground">
            Crie e gerencie modelos com seções e tarefas pré-configuradas para reaplicar em novos projetos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar modelo..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-8 w-64"
            />
          </div>
          <Button onClick={() => setCreatingNew(true)}>
            <Plus className="h-4 w-4 mr-1" /> Criar modelo do zero
          </Button>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Meus modelos ({meus.length})</h2>
        {meus.length === 0 ? (
          <p className="text-sm text-muted-foreground p-6 border border-dashed rounded-lg text-center">
            Você ainda não criou modelos. Use "Salvar como modelo" no menu de um projeto, ou crie do zero.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {meus.map((m) => (
              <ModeloCard key={m.id} modelo={m} onEdit={() => setEditing(m)} onDelete={() => setDeleting(m)} canManage />
            ))}
          </div>
        )}
      </section>

      {compartilhados.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Compartilhados comigo ({compartilhados.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {compartilhados.map((m) => (
              <ModeloCard
                key={m.id}
                modelo={m}
                onEdit={() => setEditing(m)}
                onDelete={() => setDeleting(m)}
                canManage={isAdmin}
              />
            ))}
          </div>
        </section>
      )}

      {/* Edit dialog */}
      {editing && (
        <Dialog open onOpenChange={(v) => !v && setEditing(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Editar modelo</DialogTitle></DialogHeader>
            <ModeloMetaForm
              initial={editing}
              departamentos={userDepartments}
              isAdmin={isAdmin}
              onSubmit={async (vals) => {
                await updateModelo.mutateAsync({ id: editing.id, ...vals });
                setEditing(null);
              }}
              onCancel={() => setEditing(null)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Create new */}
      {creatingNew && (
        <Dialog open onOpenChange={(v) => !v && setCreatingNew(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Novo modelo de projeto</DialogTitle></DialogHeader>
            <ModeloMetaForm
              initial={{
                nome: "",
                descricao: "",
                cor: "#6366f1",
                escopo: "pessoal" as const,
                departamento_id: null,
                vinculado_produto: false,
              }}
              departamentos={userDepartments}
              isAdmin={isAdmin}
              onSubmit={async (vals) => {
                await createModelo.mutateAsync({
                  ...vals,
                  estrutura: { secoes: [{ nome: "Backlog", ordem: 0, tarefas: [] }] },
                });
                setCreatingNew(false);
              }}
              onCancel={() => setCreatingNew(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir modelo?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleting?.nome}" será removido permanentemente. Projetos já criados a partir dele não são afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deleting) await deleteModelo.mutateAsync(deleting.id);
                setDeleting(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ModeloCard({
  modelo, onEdit, onDelete, canManage,
}: { modelo: ProjetoModelo; onEdit: () => void; onDelete: () => void; canManage: boolean }) {
  const totalSecoes = modelo.estrutura?.secoes?.length ?? 0;
  const totalTarefas = (modelo.estrutura?.secoes || []).reduce((acc, s: any) => acc + (s.tarefas?.length || 0), 0);
  const eb = escopoBadge(modelo.escopo);
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-md flex-shrink-0" style={{ backgroundColor: modelo.cor || "#6366f1" }} />
            <CardTitle className="text-base truncate">{modelo.nome}</CardTitle>
          </div>
          <Badge variant="secondary" className="text-[10px] gap-1">{eb.icon}{eb.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {modelo.descricao && (
          <p className="text-xs text-muted-foreground line-clamp-2">{modelo.descricao}</p>
        )}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><FolderTree className="h-3.5 w-3.5" />{totalSecoes} seções</span>
          <span>{totalTarefas} tarefas</span>
          {modelo.uso_count > 0 && <span>· usado {modelo.uso_count}×</span>}
          {modelo.vinculado_produto && <Badge variant="outline" className="text-[10px]">Vinc. produto</Badge>}
        </div>
        {canManage && (
          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onEdit}><Pencil className="h-3.5 w-3.5 mr-1" />Editar</Button>
            <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive">
              <Trash2 className="h-3.5 w-3.5 mr-1" />Excluir
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ModeloMetaForm({
  initial, departamentos, isAdmin, onSubmit, onCancel,
}: {
  initial: Partial<ProjetoModelo> & { nome: string; escopo: ProjetoModelo["escopo"] };
  departamentos: any[];
  isAdmin: boolean;
  onSubmit: (vals: { nome: string; descricao?: string; cor?: string; escopo: ProjetoModelo["escopo"]; departamento_id?: string | null }) => Promise<void>;
  onCancel: () => void;
}) {
  const [nome, setNome] = useState(initial.nome || "");
  const [descricao, setDescricao] = useState(initial.descricao || "");
  const [cor, setCor] = useState(initial.cor || "#6366f1");
  const [escopo, setEscopo] = useState<ProjetoModelo["escopo"]>(initial.escopo);
  const [departamentoId, setDepartamentoId] = useState<string>(initial.departamento_id || "");
  const [salvando, setSalvando] = useState(false);

  const submit = async () => {
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      await onSubmit({
        nome: nome.trim(),
        descricao: descricao.trim() || undefined,
        cor,
        escopo,
        departamento_id: escopo === "departamento" ? departamentoId : null,
      });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Nome</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
        </div>
        <div className="space-y-2">
          <Label>Descrição</Label>
          <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Cor</Label>
            <Input type="color" value={cor} onChange={(e) => setCor(e.target.value)} className="h-10 p-1" />
          </div>
          <div className="space-y-2">
            <Label>Quem pode usar</Label>
            <Select value={escopo} onValueChange={(v: any) => setEscopo(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pessoal">Apenas eu</SelectItem>
                <SelectItem value="departamento">Meu departamento</SelectItem>
                {isAdmin && <SelectItem value="organizacao">Toda a organização</SelectItem>}
              </SelectContent>
            </Select>
          </div>
        </div>
        {escopo === "departamento" && (
          <div className="space-y-2">
            <Label>Departamento</Label>
            <Select value={departamentoId} onValueChange={setDepartamentoId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {departamentos.map((d: any) => (
                  <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <DialogFooter className="mt-4">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={submit} disabled={salvando || !nome.trim()}>{salvando ? "Salvando..." : "Salvar"}</Button>
      </DialogFooter>
    </>
  );
}
