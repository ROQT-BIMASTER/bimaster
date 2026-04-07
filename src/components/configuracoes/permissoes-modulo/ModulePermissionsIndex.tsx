import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Shield, Users, ChevronRight, Loader2, ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { getModuleIcon } from "@/config/module-screens-map";
import * as LucideIcons from "lucide-react";

interface ModuleWithCount {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  icone: string | null;
  ordem: number | null;
  userCount: number;
}

export function ModulePermissionsIndex() {
  const [modules, setModules] = useState<ModuleWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchModules();
  }, []);

  const fetchModules = async () => {
    setLoading(true);
    try {
      // Fetch active modules
      const { data: mods, error: modError } = await supabase
        .from("modulos_sistema")
        .select("id, codigo, nome, descricao, icone, ordem")
        .eq("ativo", true)
        .order("ordem");

      if (modError) throw modError;

      // Fetch permission counts per module
      const { data: perms, error: permError } = await supabase
        .from("usuario_permissoes_modulos")
        .select("modulo_id");

      if (permError) throw permError;

      const countMap: Record<string, number> = {};
      perms?.forEach(p => {
        countMap[p.modulo_id] = (countMap[p.modulo_id] || 0) + 1;
      });

      setModules(
        (mods || []).map(m => ({
          ...m,
          userCount: countMap[m.id] || 0,
        }))
      );
    } catch (err) {
      console.error("Erro ao carregar módulos:", err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return modules.filter(m =>
      m.nome.toLowerCase().includes(q) || m.codigo.toLowerCase().includes(q)
    );
  }, [modules, search]);

  const renderIcon = (moduleCode: string, dbIcon: string | null) => {
    const iconName = getModuleIcon(moduleCode, dbIcon);
    const Icon = (LucideIcons as any)[iconName] || LucideIcons.Box;
    return <Icon className="h-6 w-6" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Permissões por Módulo
        </h2>
        <p className="text-muted-foreground mt-1">
          Gerencie as permissões de acesso de cada módulo individualmente
        </p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar módulo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map(mod => (
          <Card key={mod.id} className="group">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    {renderIcon(mod.codigo, mod.icone)}
                  </div>
                  <div>
                    <CardTitle className="text-base">{mod.nome}</CardTitle>
                    <p className="text-xs text-muted-foreground font-mono">{mod.codigo}</p>
                  </div>
                </div>
                <Badge variant={mod.userCount > 0 ? "default" : "secondary"} className="shrink-0">
                  <Users className="h-3 w-3 mr-1" />
                  {mod.userCount}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {mod.descricao && (
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {mod.descricao}
                </p>
              )}
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link to={`/dashboard/configuracoes/permissoes-modulo/${mod.codigo}`}>
                  Gerenciar Permissões
                  <ChevronRight className="h-4 w-4 ml-auto" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          Nenhum módulo encontrado
        </p>
      )}
    </div>
  );
}
