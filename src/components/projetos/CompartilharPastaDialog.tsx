/**
 * Compartilhar uma pasta inteira: adiciona as pessoas selecionadas como
 * membros de todos os projetos que estão dentro da pasta, em um único passo.
 * Não altera a pasta em si (que continua sendo apenas organização) — o que é
 * compartilhado é o acesso aos projetos contidos nela.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Users } from "lucide-react";

interface DirectoryUser {
  id: string;
  nome: string | null;
  avatar_url: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pastaNome: string;
  /** Projetos que estão na pasta. */
  projetos: { id: string; nome: string }[];
}

export function CompartilharPastaDialog({ open, onOpenChange, pastaNome, projetos }: Props) {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ["chat_directory_all", "compartilhar-pasta"],
    enabled: open,
    queryFn: async (): Promise<DirectoryUser[]> => {
      const { data, error } = await (supabase.rpc as any)("get_chat_directory");
      if (error) throw error;
      return (data ?? []) as DirectoryUser[];
    },
  });

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter((u) => (u.nome || "").toLowerCase().includes(q));
  }, [usuarios, busca]);

  const toggle = (id: string) =>
    setSelecionados((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const compartilhar = async () => {
    if (selecionados.length === 0 || projetos.length === 0) return;
    setSalvando(true);
    try {
      const projetoIds = projetos.map((p) => p.id);
      const { data: existentes, error: errExist } = await supabase
        .from("projeto_membros")
        .select("projeto_id, user_id")
        .in("projeto_id", projetoIds)
        .in("user_id", selecionados);
      if (errExist) throw errExist;

      const jaMembro = new Set((existentes || []).map((m) => `${m.projeto_id}:${m.user_id}`));
      const novos = projetoIds.flatMap((projetoId) =>
        selecionados
          .filter((userId) => !jaMembro.has(`${projetoId}:${userId}`))
          .map((userId) => ({ projeto_id: projetoId, user_id: userId, papel: "membro" })),
      );

      if (novos.length === 0) {
        toast.info("As pessoas selecionadas já têm acesso a todos os projetos da pasta.");
      } else {
        const { error } = await supabase.from("projeto_membros").insert(novos);
        if (error) throw error;
        toast.success(
          `Pasta "${pastaNome}" compartilhada: ${novos.length} acesso${novos.length === 1 ? "" : "s"} concedido${novos.length === 1 ? "" : "s"}.`,
        );
      }

      queryClient.invalidateQueries({ queryKey: ["projetos"] });
      queryClient.invalidateQueries({ queryKey: ["projeto_membros"] });
      setSelecionados([]);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível compartilhar a pasta.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Compartilhar pasta "{pastaNome}"
          </DialogTitle>
          <DialogDescription>
            As pessoas selecionadas serão adicionadas como membros dos {projetos.length} projeto
            {projetos.length === 1 ? "" : "s"} desta pasta.
          </DialogDescription>
        </DialogHeader>

        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar pessoa..."
        />

        <ScrollArea className="h-64 rounded-md border border-border/60">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : (
            <div className="p-1">
              {filtrados.map((u) => (
                <label
                  key={u.id}
                  className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    checked={selecionados.includes(u.id)}
                    onCheckedChange={() => toggle(u.id)}
                  />
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={u.avatar_url || undefined} />
                    <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                      {(u.nome || "?").substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{u.nome || "Sem nome"}</span>
                </label>
              ))}
              {filtrados.length === 0 && (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  Nenhuma pessoa encontrada.
                </p>
              )}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={compartilhar}
            disabled={salvando || selecionados.length === 0 || projetos.length === 0}
          >
            {salvando ? "Compartilhando..." : `Compartilhar (${selecionados.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
