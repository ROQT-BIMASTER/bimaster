import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

import { toast } from "sonner";
interface Usuario {
  id: string;
  nome: string | null;
  avatar_url: string | null;
}

interface NovaConversaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (conversaId: string) => void;
}

export const NovaConversaDialog = ({ open, onOpenChange, onSuccess }: NovaConversaDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<string>("");
  const [busca, setBusca] = useState("");
  useEffect(() => {
    if (open) {
      setBusca("");
      setUsuarioSelecionado("");
      fetchUsuarios();
    }
  }, [open]);

  const fetchUsuarios = async () => {
    setLoadingUsers(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Diretório SECURITY DEFINER — bypassa RLS estrita de profiles
      // e expõe apenas id+nome+avatar de usuários ativos não-honeytoken.
      const { data, error } = await supabase
        .from("chat_directory" as any)
        .select("id, nome, avatar_url")
        .neq("id", user.id)
        .order("nome");

      if (error) throw error;
      setUsuarios((data as unknown as Usuario[]) || []);
    } catch (error) {
      logger.error("Erro ao carregar usuários:", error);
      toast.error("Erro", { description: "Não foi possível carregar os usuários" });
    } finally {
      setLoadingUsers(false);
    }
  };

  const usuariosFiltrados = useMemo(() => {
    // Suporte a menção @nome
    const termo = busca.trim().replace(/^@/, "").toLowerCase();
    if (!termo) return usuarios;
    return usuarios.filter((u) => (u.nome || "").toLowerCase().includes(termo));
  }, [usuarios, busca]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioSelecionado) {
      toast.error("Selecione um usuário", { description: "Escolha alguém da lista para iniciar a conversa." });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: conversaId, error: conversaError } = await supabase.rpc(
        "rpc_chat_criar_conversa_privada" as any,
        { p_outro_user_id: usuarioSelecionado } as any,
      );

      if (conversaError) throw conversaError;
      if (!conversaId) throw new Error("Não foi possível localizar a conversa criada");

      toast.success("Conversa criada", { description: "Sua nova conversa foi iniciada." });

      setUsuarioSelecionado("");
      onSuccess(conversaId as string);
    } catch (error: any) {
      logger.error("Erro ao criar conversa:", error);
      toast.error("Erro", { description: error.message || "Não foi possível criar a conversa" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Conversa</DialogTitle>
          <DialogDescription>
            Busque por nome, e-mail ou use @ para mencionar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="busca-usuario">Usuário *</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="busca-usuario"
                autoFocus
                placeholder="Buscar por nome, e-mail ou @menção..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="rounded-md border bg-muted/20">
              <ScrollArea className="h-72">
                {loadingUsers ? (
                  <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Carregando usuários...
                  </div>
                ) : usuariosFiltrados.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    Nenhum usuário encontrado
                  </div>
                ) : (
                  <ul className="p-1">
                    {usuariosFiltrados.map((u) => {
                      const selecionado = usuarioSelecionado === u.id;
                      const inicial = (u.nome || "?").charAt(0).toUpperCase();
                      return (
                        <li key={u.id}>
                          <button
                            type="button"
                            onClick={() => setUsuarioSelecionado(u.id)}
                            className={cn(
                              "w-full flex items-center gap-3 rounded-md px-2 py-2 text-left transition-colors",
                              "hover:bg-accent hover:text-accent-foreground",
                              selecionado && "bg-accent text-accent-foreground"
                            )}
                          >
                            <Avatar className="h-9 w-9 shrink-0">
                              <AvatarImage src={u.avatar_url || undefined} />
                              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                {inicial}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">
                                {u.nome || "Sem nome"}
                              </div>
                            </div>
                            {selecionado && <Check className="h-4 w-4 text-primary shrink-0" />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !usuarioSelecionado}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                "Criar Conversa"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
