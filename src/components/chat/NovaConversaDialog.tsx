import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

interface Usuario {
  id: string;
  nome: string | null;
  email: string | null;
  avatar_url?: string | null;
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
  const { toast } = useToast();

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

      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email, avatar_url")
        .neq("id", user.id)
        .order("nome");

      if (error) throw error;
      setUsuarios(data || []);
    } catch (error) {
      logger.error("Erro ao carregar usuários:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os usuários",
        variant: "destructive",
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  const usuariosFiltrados = useMemo(() => {
    // Suporte a menção @nome
    const termo = busca.trim().replace(/^@/, "").toLowerCase();
    if (!termo) return usuarios;
    return usuarios.filter((u) => {
      const nome = (u.nome || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      const cargo = ("").toLowerCase();
      return nome.includes(termo) || email.includes(termo) || cargo.includes(termo);
    });
  }, [usuarios, busca]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioSelecionado) {
      toast({
        title: "Selecione um usuário",
        description: "Escolha alguém da lista para iniciar a conversa.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Verificar se já existe conversa privada entre os dois usuários
      const { data: minhasConversas } = await supabase
        .from("conversas_participantes")
        .select("conversa_id")
        .eq("usuario_id", user.id);

      if (minhasConversas?.length) {
        const ids = minhasConversas.map((c) => c.conversa_id);
        const { data: outroParticipante } = await supabase
          .from("conversas_participantes")
          .select("conversa_id")
          .in("conversa_id", ids)
          .eq("usuario_id", usuarioSelecionado)
          .maybeSingle();

        if (outroParticipante) {
          toast({
            title: "Conversa já existe",
            description: "Você já tem uma conversa com este usuário",
          });
          onSuccess(outroParticipante.conversa_id);
          return;
        }
      }

      // Criar nova conversa (criado_por é obrigatório pela RLS)
      const { data: conversa, error: conversaError } = await supabase
        .from("conversas")
        .insert([{ tipo: "privada", criado_por: user.id }])
        .select()
        .single();

      if (conversaError) throw conversaError;

      // Adicionar participantes
      const { error: participantesError } = await supabase
        .from("conversas_participantes")
        .insert([
          { conversa_id: conversa.id, usuario_id: user.id },
          { conversa_id: conversa.id, usuario_id: usuarioSelecionado },
        ]);

      if (participantesError) throw participantesError;

      toast({
        title: "Conversa criada",
        description: "Sua nova conversa foi iniciada.",
      });

      setUsuarioSelecionado("");
      onSuccess(conversa.id);
    } catch (error: any) {
      logger.error("Erro ao criar conversa:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível criar a conversa",
        variant: "destructive",
      });
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
                      const inicial = (u.nome || u.email || "?").charAt(0).toUpperCase();
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
                              <div className="text-xs text-muted-foreground truncate">
                                {""}{u.email}
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
