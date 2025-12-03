import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield, Building2, Layers, Monitor } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Departamento {
  id: string;
  nome: string;
  ativo: boolean;
}

interface Modulo {
  id: string;
  codigo: string;
  nome: string;
}

interface Tela {
  id: string;
  codigo: string;
  nome: string;
  modulo_codigo: string | null;
}

export function GerenciamentoPermissoesDepartamentos() {
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [telas, setTelas] = useState<Tela[]>([]);
  const [selectedDepartamento, setSelectedDepartamento] = useState<string>("");
  const [permissoesModulos, setPermissoesModulos] = useState<Set<string>>(new Set());
  const [permissoesTelas, setPermissoesTelas] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedDepartamento) {
      fetchPermissoes(selectedDepartamento);
    }
  }, [selectedDepartamento]);

  const fetchData = async () => {
    setLoading(true);
    
    const [deptRes, modRes, telaRes] = await Promise.all([
      supabase.from("departamentos").select("id, nome, ativo").eq("ativo", true).order("nome"),
      supabase.from("modulos_sistema").select("id, codigo, nome").eq("ativo", true).order("ordem"),
      supabase.from("telas_sistema").select("id, codigo, nome, modulo_codigo").eq("ativo", true).order("ordem"),
    ]);

    setDepartamentos(deptRes.data || []);
    setModulos(modRes.data || []);
    setTelas(telaRes.data || []);
    setLoading(false);
  };

  const fetchPermissoes = async (departamentoId: string) => {
    const [modPermRes, telaPermRes] = await Promise.all([
      supabase
        .from("departamento_permissoes_modulos")
        .select("modulo_id")
        .eq("departamento_id", departamentoId),
      supabase
        .from("departamento_permissoes_telas")
        .select("tela_id")
        .eq("departamento_id", departamentoId),
    ]);

    setPermissoesModulos(new Set(modPermRes.data?.map(p => p.modulo_id) || []));
    setPermissoesTelas(new Set(telaPermRes.data?.map(p => p.tela_id) || []));
  };

  const handleModuloToggle = (moduloId: string) => {
    const newPermissoes = new Set(permissoesModulos);
    if (newPermissoes.has(moduloId)) {
      newPermissoes.delete(moduloId);
    } else {
      newPermissoes.add(moduloId);
    }
    setPermissoesModulos(newPermissoes);
  };

  const handleTelaToggle = (telaId: string) => {
    const newPermissoes = new Set(permissoesTelas);
    if (newPermissoes.has(telaId)) {
      newPermissoes.delete(telaId);
    } else {
      newPermissoes.add(telaId);
    }
    setPermissoesTelas(newPermissoes);
  };

  const handleSave = async () => {
    if (!selectedDepartamento) return;

    setSaving(true);

    try {
      // Remover permissões antigas de módulos
      await supabase
        .from("departamento_permissoes_modulos")
        .delete()
        .eq("departamento_id", selectedDepartamento);

      // Inserir novas permissões de módulos
      if (permissoesModulos.size > 0) {
        const modulosInsert = Array.from(permissoesModulos).map(moduloId => ({
          departamento_id: selectedDepartamento,
          modulo_id: moduloId,
        }));
        await supabase.from("departamento_permissoes_modulos").insert(modulosInsert);
      }

      // Remover permissões antigas de telas
      await supabase
        .from("departamento_permissoes_telas")
        .delete()
        .eq("departamento_id", selectedDepartamento);

      // Inserir novas permissões de telas
      if (permissoesTelas.size > 0) {
        const telasInsert = Array.from(permissoesTelas).map(telaId => ({
          departamento_id: selectedDepartamento,
          tela_id: telaId,
        }));
        await supabase.from("departamento_permissoes_telas").insert(telasInsert);
      }

      toast({ title: "Permissões salvas com sucesso" });
      
      // Disparar evento para atualizar permissões em toda aplicação
      window.dispatchEvent(new CustomEvent('permissions-updated'));
    } catch (error) {
      toast({ title: "Erro ao salvar permissões", variant: "destructive" });
    }

    setSaving(false);
  };

  const handleSelectAllModulos = () => {
    const allIds = new Set(modulos.map(m => m.id));
    setPermissoesModulos(allIds);
  };

  const handleDeselectAllModulos = () => {
    setPermissoesModulos(new Set());
  };

  const handleSelectAllTelas = () => {
    const allIds = new Set(telas.map(t => t.id));
    setPermissoesTelas(allIds);
  };

  const handleDeselectAllTelas = () => {
    setPermissoesTelas(new Set());
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Agrupar telas por módulo
  const telasPorModulo = telas.reduce((acc, tela) => {
    const key = tela.modulo_codigo || "geral";
    if (!acc[key]) acc[key] = [];
    acc[key].push(tela);
    return acc;
  }, {} as Record<string, Tela[]>);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Permissões por Departamento
        </CardTitle>
        <CardDescription>
          Configure quais módulos e telas cada departamento pode acessar por padrão
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 max-w-xs">
            <Select value={selectedDepartamento} onValueChange={setSelectedDepartamento}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um departamento" />
              </SelectTrigger>
              <SelectContent>
                {departamentos.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      {dept.nome}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {selectedDepartamento && (
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar Permissões
            </Button>
          )}
        </div>

        {selectedDepartamento && (
          <Tabs defaultValue="modulos">
            <TabsList>
              <TabsTrigger value="modulos" className="gap-2">
                <Layers className="h-4 w-4" />
                Módulos
              </TabsTrigger>
              <TabsTrigger value="telas" className="gap-2">
                <Monitor className="h-4 w-4" />
                Telas
              </TabsTrigger>
            </TabsList>

            <TabsContent value="modulos" className="space-y-4">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleSelectAllModulos}>
                  Selecionar Todos
                </Button>
                <Button variant="outline" size="sm" onClick={handleDeselectAllModulos}>
                  Desmarcar Todos
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {modulos.map((modulo) => (
                  <div
                    key={modulo.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      id={`modulo-${modulo.id}`}
                      checked={permissoesModulos.has(modulo.id)}
                      onCheckedChange={() => handleModuloToggle(modulo.id)}
                    />
                    <label
                      htmlFor={`modulo-${modulo.id}`}
                      className="flex-1 cursor-pointer"
                    >
                      <div className="font-medium">{modulo.nome}</div>
                      <div className="text-xs text-muted-foreground">{modulo.codigo}</div>
                    </label>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="telas" className="space-y-4">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleSelectAllTelas}>
                  Selecionar Todas
                </Button>
                <Button variant="outline" size="sm" onClick={handleDeselectAllTelas}>
                  Desmarcar Todas
                </Button>
              </div>

              <div className="space-y-6">
                {Object.entries(telasPorModulo).map(([moduloCodigo, telasDoModulo]) => (
                  <div key={moduloCodigo} className="space-y-2">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                      {moduloCodigo === "geral" ? "Telas Gerais" : modulos.find(m => m.codigo === moduloCodigo)?.nome || moduloCodigo}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {telasDoModulo.map((tela) => (
                        <div
                          key={tela.id}
                          className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                        >
                          <Checkbox
                            id={`tela-${tela.id}`}
                            checked={permissoesTelas.has(tela.id)}
                            onCheckedChange={() => handleTelaToggle(tela.id)}
                          />
                          <label
                            htmlFor={`tela-${tela.id}`}
                            className="flex-1 cursor-pointer"
                          >
                            <div className="font-medium text-sm">{tela.nome}</div>
                            <div className="text-xs text-muted-foreground">{tela.codigo}</div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
