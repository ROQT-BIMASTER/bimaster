import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useChatActions } from "@/hooks/chat/useChatActions";
import { initials } from "./utils";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (conversaId: string) => void;
}

interface User { id: string; nome: string | null }

export function GroupCreateDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [busca, setBusca] = useState("");
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const { criarGrupo } = useChatActions();

  useEffect(() => {
    if (!open) {
      setNome(""); setDescricao(""); setBusca(""); setSelecionados(new Set());
      return;
    }
    (async () => {
      // Diretório SECURITY DEFINER — bypassa RLS estrita de profiles.
      const { data } = await supabase
        .from("chat_directory" as any)
        .select("id, nome")
        .neq("id", user?.id ?? "")
        .order("nome");
      setUsuarios((data ?? []) as unknown as User[]);
    })();
  }, [open, user?.id]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter((u) => (u.nome ?? "").toLowerCase().includes(q));
  }, [usuarios, busca]);

  const toggle = (id: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    if (!nome.trim()) return toast.error("Defina um nome para o grupo");
    if (selecionados.size === 0) return toast.error("Selecione ao menos um participante");
    setLoading(true);
    try {
      const id = await criarGrupo.mutateAsync({
        nome: nome.trim(),
        descricao: descricao.trim() || undefined,
        participantes: Array.from(selecionados),
      });
      onCreated(id);
    } catch { /* toast já no hook */ }
    finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Novo grupo</DialogTitle>
          <DialogDescription>Crie um grupo para conversar com várias pessoas.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Nome do grupo *" value={nome} onChange={(e) => setNome(e.target.value)} />
          <Textarea placeholder="Descrição (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} />
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar pessoas..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-8" />
          </div>
          <p className="text-xs text-muted-foreground">{selecionados.size} selecionado(s)</p>
          <ScrollArea className="h-64 rounded-md border border-border">
            <ul className="py-1">
              {filtrados.map((u) => {
                const checked = selecionados.has(u.id);
                return (
                  <li
                    key={u.id}
                    className="px-3 py-2 flex items-center gap-3 hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggle(u.id)}
                  >
                    <Checkbox checked={checked} onCheckedChange={() => toggle(u.id)} />
                    <Avatar className="h-8 w-8"><AvatarFallback>{initials(u.nome)}</AvatarFallback></Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{u.nome ?? "Sem nome"}</p>
                    </div>
                  </li>
                );
              })}
              {filtrados.length === 0 && <li className="px-3 py-6 text-center text-xs text-muted-foreground">Nenhum usuário</li>}
            </ul>
          </ScrollArea>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>{loading ? "Criando..." : "Criar grupo"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
