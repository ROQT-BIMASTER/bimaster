import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Search, Save, Sparkles, Filter, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";

interface ChartOfAccount {
  id: string;
  code: string;
  name: string;
  account_type: string;
  categoria_dre: string | null;
}

const CATEGORIAS_DRE = [
  { value: '', label: 'Automático (IA)' },
  { value: 'receita_bruta', label: 'Receita Bruta' },
  { value: 'deducoes', label: 'Deduções e Abatimentos' },
  { value: 'custo_vendas', label: 'Custo de Vendas' },
  { value: 'despesas_fixas', label: 'Despesas Fixas' },
  { value: 'impostos_lucro', label: 'Impostos s/ Lucro' },
];

const CATEGORIA_COLORS: Record<string, string> = {
  'receita_bruta': 'bg-emerald-500/20 text-emerald-700 border-emerald-500/30',
  'deducoes': 'bg-orange-500/20 text-orange-700 border-orange-500/30',
  'custo_vendas': 'bg-red-500/20 text-red-700 border-red-500/30',
  'despesas_fixas': 'bg-blue-500/20 text-blue-700 border-blue-500/30',
  'impostos_lucro': 'bg-purple-500/20 text-purple-700 border-purple-500/30',
};

export default function ConfigurarCategoriasDRE() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategoria, setFilterCategoria] = useState<string>('todas');
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Buscar contas do plano de contas
  const { data: contas, isLoading } = useQuery({
    queryKey: ['chart-of-accounts-dre-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trade_chart_of_accounts')
        .select('id, code, name, account_type, categoria_dre')
        .eq('is_active', true)
        .order('code');
      
      if (error) throw error;
      return data as ChartOfAccount[];
    }
  });

  // Filtrar contas
  const contasFiltradas = useMemo(() => {
    if (!contas) return [];
    
    return contas.filter(conta => {
      const matchSearch = searchTerm === '' || 
        conta.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conta.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchCategoria = filterCategoria === 'todas' ||
        (filterCategoria === 'nao_classificadas' && !conta.categoria_dre) ||
        (filterCategoria !== 'nao_classificadas' && conta.categoria_dre === filterCategoria);
      
      return matchSearch && matchCategoria;
    });
  }, [contas, searchTerm, filterCategoria]);

  // Mutation para salvar alterações
  const saveMutation = useMutation({
    mutationFn: async (changes: Record<string, string>) => {
      const updates = Object.entries(changes).map(([id, categoria_dre]) => ({
        id,
        categoria_dre: categoria_dre === '' ? null : categoria_dre
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('trade_chart_of_accounts')
          .update({ categoria_dre: update.categoria_dre })
          .eq('id', update.id);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts-dre-config'] });
      setPendingChanges({});
      toast.success('Categorias salvas com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao salvar categorias: ' + (error as Error).message);
    }
  });

  // Alterar categoria de uma conta
  const handleCategoriaChange = (contaId: string, novaCategoria: string) => {
    setPendingChanges(prev => ({
      ...prev,
      [contaId]: novaCategoria
    }));
  };

  // Salvar todas as alterações pendentes
  const handleSaveAll = async () => {
    if (Object.keys(pendingChanges).length === 0) {
      toast.info('Nenhuma alteração pendente');
      return;
    }
    
    setIsSaving(true);
    await saveMutation.mutateAsync(pendingChanges);
    setIsSaving(false);
  };

  // Obter categoria atual (considerando alterações pendentes)
  const getCategoriaAtual = (conta: ChartOfAccount): string => {
    if (pendingChanges[conta.id] !== undefined) {
      return pendingChanges[conta.id];
    }
    return conta.categoria_dre || '';
  };

  // Estatísticas
  const stats = useMemo(() => {
    if (!contas) return { total: 0, classificadas: 0, naoClassificadas: 0 };
    
    const classificadas = contas.filter(c => c.categoria_dre).length;
    return {
      total: contas.length,
      classificadas,
      naoClassificadas: contas.length - classificadas
    };
  }, [contas]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Categorias DRE
            </CardTitle>
            <CardDescription>
              Configure como cada conta aparece na DRE. Contas não classificadas usam regras automáticas.
            </CardDescription>
          </div>
          <Button 
            onClick={handleSaveAll} 
            disabled={Object.keys(pendingChanges).length === 0 || isSaving}
            className="gap-2"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Alterações ({Object.keys(pendingChanges).length})
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Estatísticas */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total de Contas</div>
          </div>
          <div className="p-3 rounded-lg bg-emerald-500/10 text-center">
            <div className="text-2xl font-bold text-emerald-600">{stats.classificadas}</div>
            <div className="text-xs text-muted-foreground">Classificadas</div>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 text-center">
            <div className="text-2xl font-bold text-amber-600">{stats.naoClassificadas}</div>
            <div className="text-xs text-muted-foreground">Automáticas</div>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-4">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código ou nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="w-64">
            <Label className="text-xs text-muted-foreground">Filtrar por Categoria</Label>
            <Select value={filterCategoria} onValueChange={setFilterCategoria}>
              <SelectTrigger>
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as contas</SelectItem>
                <SelectItem value="nao_classificadas">Não classificadas</SelectItem>
                {CATEGORIAS_DRE.filter(c => c.value).map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabela de contas */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="border rounded-lg max-h-[500px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-24">Código</TableHead>
                  <TableHead>Nome da Conta</TableHead>
                  <TableHead className="w-48">Tipo</TableHead>
                  <TableHead className="w-56">Categoria DRE</TableHead>
                  <TableHead className="w-24 text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contasFiltradas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhuma conta encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  contasFiltradas.map(conta => {
                    const categoriaAtual = getCategoriaAtual(conta);
                    const temAlteracao = pendingChanges[conta.id] !== undefined;
                    const categoriaInfo = CATEGORIAS_DRE.find(c => c.value === categoriaAtual);
                    
                    return (
                      <TableRow key={conta.id} className={temAlteracao ? 'bg-amber-500/5' : ''}>
                        <TableCell className="font-mono text-sm">{conta.code}</TableCell>
                        <TableCell className="font-medium">{conta.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {conta.account_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Select 
                            value={categoriaAtual} 
                            onValueChange={(v) => handleCategoriaChange(conta.id, v)}
                          >
                            <SelectTrigger className={`h-8 text-xs ${
                              categoriaAtual && CATEGORIA_COLORS[categoriaAtual] 
                                ? CATEGORIA_COLORS[categoriaAtual] 
                                : ''
                            }`}>
                              <SelectValue placeholder="Automático (IA)" />
                            </SelectTrigger>
                            <SelectContent>
                              {CATEGORIAS_DRE.map(cat => (
                                <SelectItem key={cat.value} value={cat.value}>
                                  {cat.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-center">
                          {categoriaAtual ? (
                            <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-amber-500 mx-auto" />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Legenda */}
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <span className="text-xs text-muted-foreground">Legenda:</span>
          {CATEGORIAS_DRE.filter(c => c.value).map(cat => (
            <Badge 
              key={cat.value} 
              variant="outline" 
              className={`text-xs ${CATEGORIA_COLORS[cat.value]}`}
            >
              {cat.label}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
