import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CenarioSimulacao } from "@/hooks/useSimuladorPrecos";
import { Beaker, Database } from "lucide-react";

interface SimuladorCenarioConfigProps {
  titulo: string;
  cenario: CenarioSimulacao | null;
  onChange: (cenario: CenarioSimulacao | null) => void;
  isBase?: boolean;
}

export function SimuladorCenarioConfig({
  titulo,
  cenario,
  onChange,
  isBase = false,
}: SimuladorCenarioConfigProps) {
  const { data: tabelas = [] } = useQuery({
    queryKey: ['simulador-tabelas-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fabrica_tabelas_preco')
        .select('id, nome, tipo_markup, valor_markup, ordem')
        .eq('ativo', true)
        .order('ordem');
      
      if (error) throw error;
      return data || [];
    },
  });

  const handleTabelaChange = (tabelaId: string) => {
    const tabela = tabelas.find(t => t.id === tabelaId);
    if (tabela) {
      onChange({
        nome: tabela.nome,
        tabela_base_id: tabela.id,
        tipo_markup: tabela.tipo_markup as CenarioSimulacao['tipo_markup'],
        valor_markup: Number(tabela.valor_markup),
        origem: cenario?.origem,
      });
    }
  };

  const handleFieldChange = (field: keyof CenarioSimulacao, value: any) => {
    onChange({
      nome: cenario?.nome || 'Nova Simulação',
      tipo_markup: cenario?.tipo_markup || 'percentual',
      valor_markup: cenario?.valor_markup || 0,
      ...cenario,
      [field]: value,
    });
  };

  return (
    <Card className={isBase ? 'border-muted' : 'border-primary/30'}>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          {isBase ? (
            <Database className="h-5 w-5 text-muted-foreground" />
          ) : (
            <Beaker className="h-5 w-5 text-primary" />
          )}
          <CardTitle className="text-lg">{titulo}</CardTitle>
        </div>
        <CardDescription>
          {isBase
            ? 'Selecione uma tabela existente para comparação'
            : 'Configure os parâmetros da simulação'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Nome (apenas para simulação) */}
        {!isBase && (
          <div className="space-y-2">
            <Label>Nome do Cenário</Label>
            <Input
              placeholder="Ex: Simulação Black Friday"
              value={cenario?.nome || ''}
              onChange={(e) => handleFieldChange('nome', e.target.value)}
            />
          </div>
        )}

        {/* Tabela Base */}
        <div className="space-y-2">
          <Label>Tabela {isBase ? 'de Referência' : 'Base'}</Label>
          <Select
            value={cenario?.tabela_base_id || ''}
            onValueChange={handleTabelaChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma tabela" />
            </SelectTrigger>
            <SelectContent>
              {tabelas.map((tabela) => (
                <SelectItem key={tabela.id} value={tabela.id}>
                  {tabela.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Configurações de Markup (apenas para simulação) */}
        {!isBase && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Markup</Label>
                <Select
                  value={cenario?.tipo_markup || 'percentual'}
                  onValueChange={(value) => handleFieldChange('tipo_markup', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentual">Percentual (%)</SelectItem>
                    <SelectItem value="multiplicador">Multiplicador (x)</SelectItem>
                    <SelectItem value="valor_fixo">Valor Fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>
                  Valor do Markup
                  {cenario?.tipo_markup === 'percentual' && ' (%)'}
                  {cenario?.tipo_markup === 'multiplicador' && ' (x)'}
                  {cenario?.tipo_markup === 'valor_fixo' && ' (R$)'}
                </Label>
                <Input
                  type="number"
                  step={cenario?.tipo_markup === 'percentual' ? '1' : '0.01'}
                  placeholder={cenario?.tipo_markup === 'percentual' ? '25' : '1.25'}
                  value={cenario?.valor_markup || ''}
                  onChange={(e) => handleFieldChange('valor_markup', Number(e.target.value))}
                />
              </div>
            </div>
          </>
        )}

        {/* Origem */}
        <div className="space-y-2">
          <Label>Origem dos Produtos</Label>
          <Select
            value={cenario?.origem || 'ambos'}
            onValueChange={(value) => handleFieldChange('origem', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ambos">Todos</SelectItem>
              <SelectItem value="nacional">Nacional</SelectItem>
              <SelectItem value="importado">Importado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Preview do cálculo */}
        {!isBase && cenario?.tipo_markup && cenario?.valor_markup > 0 && (
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground">
              <strong>Exemplo:</strong>{' '}
              {cenario.tipo_markup === 'percentual' && (
                <>Custo R$ 100 → Preço R$ {(100 * (1 + cenario.valor_markup / 100)).toFixed(2)}</>
              )}
              {cenario.tipo_markup === 'multiplicador' && (
                <>Custo R$ 100 → Preço R$ {(100 * cenario.valor_markup).toFixed(2)}</>
              )}
              {cenario.tipo_markup === 'valor_fixo' && (
                <>Custo R$ 100 → Preço R$ {(100 + cenario.valor_markup).toFixed(2)}</>
              )}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
