import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useErpAccessProfiles } from "@/hooks/useErpAccessProfiles";
import { useErpUserProfiles, useAssignUserProfile } from "@/hooks/useErpUserProfiles";

interface Profile {
  id: string;
  nome: string | null;
  email: string | null;
}

export default function UserProfileAssignment() {
  const { data: accessProfiles } = useErpAccessProfiles();
  const { data: userAssignments } = useErpUserProfiles();
  const assignProfile = useAssignUserProfile();
  const [users, setUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .order("nome", { ascending: true });
      if (!error) setUsers(data || []);
      setLoading(false);
    };
    fetchUsers();
  }, []);

  const getAssignedProfile = (userId: string) => {
    return userAssignments?.find(a => a.user_id === userId)?.profile_id || null;
  };

  const filteredUsers = users.filter(u => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (u.nome?.toLowerCase().includes(q)) || (u.email?.toLowerCase().includes(q));
  });

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Vincular Perfis a Usuários</CardTitle>
            <CardDescription>
              Defina qual perfil de acesso cada usuário terá ao acessar o portal
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome ou email..."
            className="pl-10"
          />
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Carregando usuários...</div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Perfil de Acesso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      Nenhum usuário encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map(user => {
                    const currentProfile = getAssignedProfile(user.id);
                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.nome || "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{user.email || "—"}</TableCell>
                        <TableCell>
                          <Select
                            value={currentProfile || "none"}
                            onValueChange={(val) => {
                              assignProfile.mutate({
                                userId: user.id,
                                profileId: val === "none" ? null : val,
                              });
                            }}
                          >
                            <SelectTrigger className="h-8 w-[200px] text-xs">
                              <SelectValue placeholder="Sem restrição" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-[10px]">Completo</Badge>
                                  Acesso Total
                                </div>
                              </SelectItem>
                              {accessProfiles?.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
