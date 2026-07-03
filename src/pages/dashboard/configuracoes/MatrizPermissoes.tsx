import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, X, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useState } from "react";

type AppRole = "admin" | "supervisor" | "vendedor" | "suporte";

const ROLES: { code: AppRole; label: string }[] = [
  { code: "admin", label: "Administrador" },
  { code: "supervisor", label: "Supervisor" },
  { code: "vendedor", label: "Vendedor" },
  { code: "suporte", label: "Suporte TI" },
];

interface Modulo { id: string; codigo: string; nome: string; ativo: boolean | null }
interface Tela { id: string; codigo: string; nome: string }
interface RoleModulo { role: AppRole; modulo_id: string }
interface RoleTela { role: AppRole; tela_id: string }

const useMatrizData = () => {
  const modulos = useQuery({
    queryKey: ["matriz-modulos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modulos_sistema")
        .select("id, codigo, nome, ativo")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Modulo[];
    },
  });
  const telas = useQuery({
    queryKey: ["matriz-telas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("telas_sistema")
        .select("id, codigo, nome")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Tela[];
    },
  });
  const roleModulos = useQuery({
    queryKey: ["matriz-role-modulos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_permissoes_modulos")
        .select("role, modulo_id");
      if (error) throw error;
      return (data ?? []) as RoleModulo[];
    },
  });
  const roleTelas = useQuery({
    queryKey: ["matriz-role-telas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_permissoes_telas")
        .select("role, tela_id");
      if (error) throw error;
      return (data ?? []) as RoleTela[];
    },
  });
  return { modulos, telas, roleModulos, roleTelas };
};

const CellIcon = ({ granted }: { granted: boolean }) =>
  granted ? (
    <Check className="h-4 w-4 text-emerald-600 mx-auto" aria-label="Permitido" />
  ) : (
    <X className="h-4 w-4 text-muted-foreground/40 mx-auto" aria-label="Sem acesso" />
  );

export default function MatrizPermissoes() {
  const { modulos, telas, roleModulos, roleTelas } = useMatrizData();
  const [filter, setFilter] = useState("");

  const modulosSet = useMemo(() => {
    const m = new Map<AppRole, Set<string>>();
    ROLES.forEach((r) => m.set(r.code, new Set()));
    (roleModulos.data ?? []).forEach((r) => {
      if (m.has(r.role)) m.get(r.role)!.add(r.modulo_id);
    });
    return m;
  }, [roleModulos.data]);

  const telasSet = useMemo(() => {
    const m = new Map<AppRole, Set<string>>();
    ROLES.forEach((r) => m.set(r.code, new Set()));
    (roleTelas.data ?? []).forEach((r) => {
      if (m.has(r.role)) m.get(r.role)!.add(r.tela_id);
    });
    return m;
  }, [roleTelas.data]);

  const modulosFiltered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = (modulos.data ?? []).filter((m) => m.ativo !== false);
    if (!q) return list;
    return list.filter((m) => m.nome.toLowerCase().includes(q) || m.codigo.toLowerCase().includes(q));
  }, [modulos.data, filter]);

  const telasFiltered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = telas.data ?? [];
    if (!q) return list;
    return list.filter((t) => t.nome.toLowerCase().includes(q) || t.codigo.toLowerCase().includes(q));
  }, [telas.data, filter]);

  const loading = modulos.isLoading || telas.isLoading || roleModulos.isLoading || roleTelas.isLoading;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Matriz de Permissões</h1>
          <p className="text-muted-foreground">
            Visualização somente-leitura dos módulos e telas acessíveis por cada tipo de usuário padrão.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base">Perfis do sistema</CardTitle>
            <Input
              placeholder="Filtrar por nome ou código..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="max-w-xs"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="modulos">
            <TabsList>
              <TabsTrigger value="modulos">Módulos</TabsTrigger>
              <TabsTrigger value="telas">Telas</TabsTrigger>
            </TabsList>

            <TabsContent value="modulos" className="mt-4">
              {loading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <div className="overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[240px]">Módulo</TableHead>
                        {ROLES.map((r) => (
                          <TableHead key={r.code} className="text-center">{r.label}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {modulosFiltered.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell>
                            <div className="font-medium">{m.nome}</div>
                            <div className="text-xs text-muted-foreground font-mono">{m.codigo}</div>
                          </TableCell>
                          {ROLES.map((r) => (
                            <TableCell key={r.code}>
                              <CellIcon granted={modulosSet.get(r.code)!.has(m.id)} />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                      {modulosFiltered.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={ROLES.length + 1} className="text-center text-muted-foreground py-6">
                            Nenhum módulo encontrado.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="telas" className="mt-4">
              {loading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <div className="overflow-auto rounded-md border max-h-[70vh]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead className="min-w-[260px]">Tela</TableHead>
                        {ROLES.map((r) => (
                          <TableHead key={r.code} className="text-center">{r.label}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {telasFiltered.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell>
                            <div className="font-medium">{t.nome}</div>
                            <div className="text-xs text-muted-foreground font-mono">{t.codigo}</div>
                          </TableCell>
                          {ROLES.map((r) => (
                            <TableCell key={r.code}>
                              <CellIcon granted={telasSet.get(r.code)!.has(t.id)} />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                      {telasFiltered.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={ROLES.length + 1} className="text-center text-muted-foreground py-6">
                            Nenhuma tela encontrada.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <p className="text-xs text-muted-foreground mt-4">
            Esta matriz reflete as permissões padrão associadas ao tipo de usuário. Concessões individuais
            (por usuário) podem estender esse acesso e são gerenciadas em Configurações de Acesso.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
