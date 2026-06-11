import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Undo2, Loader2, ShieldCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { verifyCurrentUserPassword } from "@/lib/auth/verifyCurrentUserPassword";
import { toast } from "sonner";

interface ProjetoLixeira {
  id: string;
  nome: string;
  deleted_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function ProjetosLixeiraDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [pendente, setPendente] = useState<ProjetoLixeira | null>(null);
  const [senha, setSenha] = useState("");
  const [verificando, setVerificando] = useState(false);

  const { data: trashed = [], isLoading } = useQuery({
    queryKey: ["projetos-lixeira"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("projetos")
        .select("id, nome, deleted_at")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProjetoLixeira[];
    },
  });

  const restaurar = useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      const ok = await verifyCurrentUserPassword(password);
      if (!ok) throw new Error("Senha incorreta");
      const { error } = await (supabase as any).rpc("rpc_restaurar_projeto", { _projeto_id: id });
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["projetos-lixeira"] }),
        qc.invalidateQueries({ queryKey: ["projetos"] }),
        qc.invalidateQueries({ queryKey: ["projetos-metrics"] }),
        qc.invalidateQueries({ queryKey: ["projetos-membros"] }),
        qc.invalidateQueries({ queryKey: ["projetos-team-data"] }),
        qc.invalidateQueries({ queryKey: ["projetos-list-filter"] }),
        qc.invalidateQueries({ queryKey: ["projetos-list-simple"] }),
        qc.invalidateQueries({ queryKey: ["projetos-colaboradores"] }),
      ]);
      toast.success("Projeto restaurado");
      setPendente(null);
      setSenha("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleRestaurar = async () => {
    if (!pendente || !senha) return;
    setVerificando(true);
    try {
      await restaurar.mutateAsync({ id: pendente.id, password: senha });
    } finally {
      setVerificando(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-muted-foreground" />
              Lixeira de Projetos
            </DialogTitle>
            <DialogDescription>
              Projetos excluídos permanecem por 30 dias antes da remoção definitiva.
              Apenas administradores podem restaurar, mediante revalidação de senha.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : trashed.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              Nenhum projeto na lixeira.
            </p>
          ) : (
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {trashed.map((p) => {
                const excluidoEm = new Date(p.deleted_at);
                const restaEm = new Date(excluidoEm.getTime() + 30 * 24 * 60 * 60 * 1000);
                const diasRestantes = Math.max(
                  0,
                  Math.ceil((restaEm.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
                );
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted/50 border border-transparent hover:border-border"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        Excluído {formatDistanceToNow(excluidoEm, { locale: ptBR, addSuffix: true })}
                        {" • "}
                        {diasRestantes} dia{diasRestantes === 1 ? "" : "s"} até remoção definitiva
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => setPendente(p)}
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                      Restaurar
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!pendente}
        onOpenChange={(o) => { if (!o && !verificando) { setPendente(null); setSenha(""); } }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Confirmar restauração
            </DialogTitle>
            <DialogDescription>
              Para restaurar <strong>{pendente?.nome}</strong>, confirme com sua senha de
              administrador.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="pw-restaurar">Senha</Label>
            <Input
              id="pw-restaurar"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleRestaurar(); }}
              autoFocus
              disabled={verificando}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setPendente(null); setSenha(""); }}
              disabled={verificando}
            >
              Cancelar
            </Button>
            <Button onClick={handleRestaurar} disabled={!senha || verificando}>
              {verificando ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Validando…</>
              ) : (
                <><Undo2 className="h-4 w-4 mr-2" /> Restaurar projeto</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
