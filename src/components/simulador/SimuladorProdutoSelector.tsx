import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Package, CheckSquare, Square } from "lucide-react";

interface Produto {
  id: string;
  codigo: string;
  nome: string;
  categoria: string | null;
}

interface SimuladorProdutoSelectorProps {
  produtosSelecionados: string[];
  onChange: (produtos: string[]) => void;
  origem?: string;
}

export function SimuladorProdutoSelector({
  produtosSelecionados,
  onChange,
  origem,
}: SimuladorProdutoSelectorProps) {
  const [busca, setBusca] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todas');

  // Buscar produtos
  const { data: produtos = [] } = useQuery<Produto[]>({
    queryKey: ['simulador-produtos-selector'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fabrica_produtos')
        .select('id, codigo, nome, categoria')
        .eq('ativo', true)
        .order('nome');
      
      if (error) throw error;
      return (data || []) as Produto[];
    },
  });

  // Extrair categorias únicas dos produtos
  const categorias = useMemo(() => {
    const cats = new Set<string>();
    produtos.forEach(p => {
      if (p.categoria) cats.add(p.categoria);
    });
    return Array.from(cats).sort();
  }, [produtos]);

  // Filtrar produtos
  const produtosFiltrados = useMemo(() => {
    return produtos.filter(produto => {
      const matchBusca = busca === '' || 
        produto.nome.toLowerCase().includes(busca.toLowerCase()) ||
        produto.codigo.toLowerCase().includes(busca.toLowerCase());
      
      const matchCategoria = categoriaFiltro === 'todas' || 
        produto.categoria === categoriaFiltro;
      
      return matchBusca && matchCategoria;
    });
  }, [produtos, busca, categoriaFiltro]);

  const handleToggleProduto = (produtoId: string) => {
    if (produtosSelecionados.includes(produtoId)) {
      onChange(produtosSelecionados.filter(id => id !== produtoId));
    } else {
      onChange([...produtosSelecionados, produtoId]);
    }
  };

  const handleSelecionarTodos = () => {
    const todosFiltrados = produtosFiltrados.map(p => p.id);
    const novaSeleção = [...new Set([...produtosSelecionados, ...todosFiltrados])];
    onChange(novaSeleção);
  };

  const handleLimparSeleção = () => {
    const idsFiltrados = produtosFiltrados.map(p => p.id);
    onChange(produtosSelecionados.filter(id => !idsFiltrados.includes(id)));
  };

  const todosSelecionados = produtosFiltrados.length > 0 && 
    produtosFiltrados.every(p => produtosSelecionados.includes(p.id));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-lg">Produtos</CardTitle>
              <CardDescription>
                Selecione os produtos para simular
              </CardDescription>
            </div>
          </div>
          <Badge variant="secondary">
            {produtosSelecionados.length} selecionado{produtosSelecionados.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou código..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as categorias</SelectItem>
              {categorias.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelecionarTodos}
              disabled={todosSelecionados}
            >
              <CheckSquare className="h-4 w-4 mr-1" />
              Selecionar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLimparSeleção}
              disabled={produtosSelecionados.length === 0}
            >
              <Square className="h-4 w-4 mr-1" />
              Limpar
            </Button>
          </div>
        </div>

        {/* Lista de Produtos */}
        <ScrollArea className="h-[300px] border rounded-lg">
          <div className="p-2 space-y-1">
            {produtosFiltrados.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum produto encontrado
              </div>
            ) : (
              produtosFiltrados.map((produto) => (
                <div
                  key={produto.id}
                  className={`flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer transition-colors ${
                    produtosSelecionados.includes(produto.id) ? 'bg-accent/50' : ''
                  }`}
                  onClick={() => handleToggleProduto(produto.id)}
                >
                  <Checkbox
                    checked={produtosSelecionados.includes(produto.id)}
                    onCheckedChange={() => handleToggleProduto(produto.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{produto.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {produto.codigo}
                      {produto.categoria && (
                        <> • {produto.categoria}</>
                      )}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Resumo */}
        <div className="text-sm text-muted-foreground">
          Mostrando {produtosFiltrados.length} de {produtos.length} produtos
        </div>
      </CardContent>
    </Card>
  );
}
