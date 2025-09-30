import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Usuario {
  id: string;
  nome: string;
  email: string;
}

interface NovaConversaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (conversaId: string) => void;
}

export const NovaConversaDialog = ({ open, onOpenChange, onSuccess }: NovaConversaDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchUsuarios();
    }
  }, [open]);

  const fetchUsuarios = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .neq("id", user.id)
        .order("nome");

      if (error) throw error;
      setUsuarios(data || []);
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os usuários",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioSelecionado) {
      toast({
        title: "Erro",
        description: "Selecione um usuário",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Verificar se já existe conversa entre os dois usuários
      const { data: conversasExistentes } = await supabase
        .from("conversas_participantes")
        .select("conversa_id")
        .eq("usuario_id", user.id);

      if (conversasExistentes) {
        for (const part of conversasExistentes) {
          const { data: outroParticipante } = await supabase
            .from("conversas_participantes")
            .select("usuario_id")
            .eq("conversa_id", part.conversa_id)
            .eq("usuario_id", usuarioSelecionado)
            .single();

          if (outroParticipante) {
            toast({
              title: "Conversa já existe",
              description: "Você já tem uma conversa com este usuário",
            });
            onSuccess(part.conversa_id);
            return;
          }
        }
      }

      // Criar nova conversa
      const { data: conversa, error: conversaError } = await supabase
        .from("conversas")
        .insert([{ tipo: "privada" }])
        .select()
        .single();

      if (conversaError) throw conversaError;

      // Adicionar participantes
      const { error: participantesError } = await supabase
        .from("conversas_participantes")
        .insert([
          { conversa_id: conversa.id, usuario_id: user.id },
          { conversa_id: conversa.id, usuario_id: usuarioSelecionado }
        ]);

      if (participantesError) throw participantesError;

      toast({
        title: "Sucesso",
        description: "Conversa criada com sucesso",
      });

      setUsuarioSelecionado("");
      onSuccess(conversa.id);
    } catch (error: any) {
      console.error("Erro ao criar conversa:", error);
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Conversa</DialogTitle>
          <DialogDescription>
            Selecione um usuário para iniciar uma conversa
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="usuario">Usuário *</Label>
            <Select value={usuarioSelecionado} onValueChange={setUsuarioSelecionado} required>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um usuário" />
              </SelectTrigger>
              <SelectContent>
                {usuarios.map((usuario) => (
                  <SelectItem key={usuario.id} value={usuario.id}>
                    {usuario.nome} ({usuario.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Criando..." : "Criar Conversa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
