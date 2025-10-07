import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Link2, Users, Search, Filter, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Usuario {
  id: string;
  nome: string;
  email: string;
}

interface Prospect {
  id: string;
  nome_empresa: string;
  municipio: string;
  zona: string;
  status: string;
}

export const VinculacaoUsuarioProspects = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [selectedUsuario, setSelectedUsuario] = useState<string>("");
  const [linkedProspects, setLinkedProspects] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [zonaFilter, setZonaFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchUsuarios();
    fetchProspects();
  }, []);

  useEffect(() => {
    if (selectedUsuario) {
      fetchLinkedProspects(selectedUsuario);
    }
  }, [selectedUsuario]);

  const fetchUsuarios = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nome, email")
      .eq("aprovado", true);

    if (error) {
      console.error("Error fetching users:", error);
      return;
    }

    setUsuarios(data || []);
  };

  const fetchProspects = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("prospects")
      .select("id, nome_empresa, municipio, zona, status")
      .order("nome_empresa");

    if (error) {
      console.error("Error fetching prospects:", error);
      setLoading(false);
      return;
    }

    setProspects(data || []);
    setLoading(false);
  };

  const fetchLinkedProspects = async (userId: string) => {
    const { data, error } = await supabase
      .from("usuario_prospects")
      .select("prospect_id")
      .eq("usuario_id", userId);

    if (error) {
      console.error("Error fetching linked prospects:", error);
      return;
    }

    setLinkedProspects(new Set(data?.map(p => p.prospect_id) || []));
  };

  const handleToggleProspect = (prospectId: string) => {
    const newLinked = new Set(linkedProspects);
    if (newLinked.has(prospectId)) {
      newLinked.delete(prospectId);
    } else {
      newLinked.add(prospectId);
    }
    setLinkedProspects(newLinked);
  };

  const handleSave = async () => {
    if (!selectedUsuario) return;

    setSaving(true);
    try {
      // Remove all existing links
      await supabase
        .from("usuario_prospects")
        .delete()
        .eq("usuario_id", selectedUsuario);

      // Insert new links
      if (linkedProspects.size > 0) {
        const linksToInsert = Array.from(linkedProspects).map(prospectId => ({
          usuario_id: selectedUsuario,
          prospect_id: prospectId
        }));

        const { error } = await supabase
          .from("usuario_prospects")
          .insert(linksToInsert);

        if (error) throw error;
      }

      toast({
        title: "Vinculações atualizadas",
        description: "Os clientes foram vinculados ao usuário com sucesso",
      });
    } catch (error) {
      console.error("Error saving links:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível atualizar as vinculações",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredProspects = prospects.filter(p => {
    const matchesSearch = p.nome_empresa.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.municipio?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesZona = zonaFilter === "all" || p.zona === zonaFilter;
    return matchesSearch && matchesZona;
  });

  const zonas = Array.from(new Set(prospects.map(p => p.zona).filter(Boolean)));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Vinculação de Usuários a Clientes
        </CardTitle>
        <CardDescription>
          Defina quais clientes cada usuário pode visualizar e gerenciar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Selecionar Usuário
          </label>
          <Select value={selectedUsuario} onValueChange={setSelectedUsuario}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha um usuário" />
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

        {selectedUsuario && (
          <>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Badge variant="secondary">
                {linkedProspects.size} cliente(s) vinculado(s)
              </Badge>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou município..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={zonaFilter} onValueChange={setZonaFilter}>
                  <SelectTrigger className="w-40">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Zona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as zonas</SelectItem>
                    {zonas.map((zona) => (
                      <SelectItem key={zona} value={zona}>
                        {zona}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredProspects.map((prospect) => (
                    <div
                      key={prospect.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={linkedProspects.has(prospect.id)}
                          onCheckedChange={() => handleToggleProspect(prospect.id)}
                        />
                        <div>
                          <div className="font-medium">{prospect.nome_empresa}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <span>{prospect.municipio}</span>
                            {prospect.zona && (
                              <Badge variant="outline" className="text-xs">
                                {prospect.zona}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <Badge variant="secondary">{prospect.status}</Badge>
                    </div>
                  ))}

                  {filteredProspects.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhum cliente encontrado
                    </div>
                  )}
                </div>
              )}
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar Vinculações
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};
