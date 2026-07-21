import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import {
  useTarefaModelos,
  useEditarTarefaModelo,
  useExcluirTarefaModelo,
  type TarefaModelo,
} from "@/hooks/useTarefaModelos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, Pencil, Search, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

function escopoLabel(e: TarefaModelo["escopo"]) {
  return e === "pessoal" ? "Pessoal" : e === "departamento" ? "Departamento" : "Organização";
}

export default function MeusModelosTarefa() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { data: modelos = [], isLoading } = useTarefaModelos();
  const editar = useEditarTarefaModelo();
  const excluir = useExcluirTarefaModelo();

  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<TarefaModelo | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return modelos;
    return modelos.filter((m) => m.nome.toLowerCase().includes(term));
  }, [modelos, q]);

  const canEdit = (m: TarefaModelo) => isAdmin || m.created_by === user?.id;

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Meus modelos de tarefa</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Modelos reutilizáveis para criar tarefas rapidamente. Os que aparecem aqui incluem os seus
          modelos pessoais, os do seu departamento e os da organização.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Buscar modelo..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Nenhum modelo salvo. Abra uma tarefa em um projeto e use "Salvar como modelo".
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((m) => (
            <Card key={m.id} className={cn("hover:shadow-md transition-shadow")}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm truncate">{m.nome}</CardTitle>
                  <Badge variant="outline" className="text-[10px] h-5 flex-shrink-0">
                    {escopoLabel(m.escopo)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {m.descricao_curta && (
                  <p className="text-xs text-muted-foreground line-clamp-3">{m.descricao_curta}</p>
                )}
                <div className="text-[10px] text-muted-foreground">
                  {m.uso_count} uso(s) • criado em {new Date(m.created_at).toLocaleDateString("pt-BR")}
                </div>
                {canEdit(m) && (
                  <div className="flex items-center gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => setEditing(m)}>
                      <Pencil className="h-3 w-3 mr-1" /> Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeletingId(m.id)}
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Excluir
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <EditarModeloDialog
          modelo={editing}
          open={!!editing}
          onOpenChange={(v) => !v && setEditing(null)}
          onSave={async (patch) => {
            await editar.mutateAsync({ id: editing.id, ...patch });
            setEditing(null);
          }}
        />
      )}

      <AlertDialog open={!!deletingId} onOpenChange={(v) => !v && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir modelo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Tarefas já criadas a partir deste modelo continuam intactas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deletingId) await excluir.mutateAsync(deletingId);
                setDeletingId(null);
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

function EditarModeloDialog({
  modelo,
  open,
  onOpenChange,
  onSave,
}: {
  modelo: TarefaModelo;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (patch: { nome: string; descricao_curta: string | null; escopo: TarefaModelo["escopo"] }) => Promise<void>;
}) {
  const [nome, setNome] = useState(modelo.nome);
  const [descricao, setDescricao] = useState(modelo.descricao_curta || "");
  const [escopo, setEscopo] = useState<TarefaModelo["escopo"]>(modelo.escopo);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar modelo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label>Descrição curta</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={500} />
          </div>
          <div className="space-y-2">
            <Label>Escopo</Label>
            <RadioGroup value={escopo} onValueChange={(v) => setEscopo(v as any)}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="pessoal" id="e-pes" /> <Label htmlFor="e-pes" className="font-normal">Pessoal</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="departamento" id="e-dep" /> <Label htmlFor="e-dep" className="font-normal">Departamento</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="organizacao" id="e-org" /> <Label htmlFor="e-org" className="font-normal">Organização</Label>
              </div>
            </RadioGroup>
            <p className="text-[10px] text-muted-foreground">
              Alterar para "Departamento" exige que você esteja vinculado a um departamento.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={async () => {
              const trimmed = nome.trim();
              if (!trimmed) return;
              await onSave({ nome: trimmed, descricao_curta: descricao.trim() || null, escopo });
            }}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
