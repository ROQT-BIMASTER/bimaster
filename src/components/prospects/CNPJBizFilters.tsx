import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Search, X, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CNPJBizFiltersProps {
  onSearch: (filters: any, count: number) => void;
}

export const CNPJBizFilters = ({ onSearch }: CNPJBizFiltersProps) => {
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    porte_empresa: [] as string[],
    situacao: ['ativa'] as string[],
    regime_tributario: [] as string[],
    cidade: '',
    estado: '',
    ddd: '',
    cep: '',
    capital_minimo: '',
    capital_maximo: '',
    data_abertura_inicio: '',
    data_abertura_fim: '',
  });

  const portes = ['MEI', 'ME', 'EPP', 'DEMAIS'];
  const situacoes = ['ativa', 'baixada', 'suspensa', 'inapta', 'nula'];
  const regimes = ['Simples Nacional', 'Lucro Real', 'Lucro Presumido', 'Lucro Arbitrado', 'Isenta', 'Imune'];

  const handlePorteChange = (porte: string) => {
    setFilters(prev => ({
      ...prev,
      porte_empresa: prev.porte_empresa.includes(porte)
        ? prev.porte_empresa.filter(p => p !== porte)
        : [...prev.porte_empresa, porte]
    }));
  };

  const handleSituacaoChange = (situacao: string) => {
    setFilters(prev => ({
      ...prev,
      situacao: prev.situacao.includes(situacao)
        ? prev.situacao.filter(s => s !== situacao)
        : [...prev.situacao, situacao]
    }));
  };

  const handleRegimeChange = (regime: string) => {
    setFilters(prev => ({
      ...prev,
      regime_tributario: prev.regime_tributario.includes(regime)
        ? prev.regime_tributario.filter(r => r !== regime)
        : [...prev.regime_tributario, regime]
    }));
  };

  const handleSearch = async () => {
    if (filters.situacao.length === 0) {
      toast.error('Selecione pelo menos uma situação');
      return;
    }

    setLoading(true);
    try {
      // Preparar filtros para a API
      const apiFilters: any = {
        situacao: filters.situacao,
      };

      if (filters.porte_empresa.length > 0) {
        apiFilters.porte_empresa = filters.porte_empresa;
      }

      if (filters.regime_tributario.length > 0) {
        apiFilters.regime_tributario = filters.regime_tributario;
      }

      if (filters.cidade && filters.estado) {
        apiFilters.localidades = [{
          tipo: 'cidade',
          cidade: filters.cidade,
          estado: filters.estado,
          pais: 'BR'
        }];
      }

      if (filters.ddd) {
        apiFilters.ddd = [filters.ddd];
      }

      if (filters.cep) {
        apiFilters.cep = [filters.cep.replace(/\D/g, '')];
      }

      if (filters.capital_minimo) {
        apiFilters.capital_minimo = filters.capital_minimo;
      }

      if (filters.capital_maximo) {
        apiFilters.capital_maximo = filters.capital_maximo;
      }

      if (filters.data_abertura_inicio) {
        apiFilters.data_abertura_inicio = new Date(filters.data_abertura_inicio).toLocaleDateString('pt-BR');
      }

      if (filters.data_abertura_fim) {
        apiFilters.data_abertura_fim = new Date(filters.data_abertura_fim).toLocaleDateString('pt-BR');
      }

      const { data, error } = await supabase.functions.invoke('cnpjbiz-consulta', {
        body: {
          operation: 'contar',
          ...apiFilters
        }
      });

      if (error) throw error;

      const count = parseInt(data.count);
      toast.success(`${count.toLocaleString('pt-BR')} empresas encontradas`);
      onSearch(apiFilters, count);

    } catch (error) {
      console.error('Erro ao buscar:', error);
      toast.error('Erro ao buscar empresas');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setFilters({
      porte_empresa: [],
      situacao: ['ativa'],
      regime_tributario: [],
      cidade: '',
      estado: '',
      ddd: '',
      cep: '',
      capital_minimo: '',
      capital_maximo: '',
      data_abertura_inicio: '',
      data_abertura_fim: '',
    });
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <h3 className="font-semibold mb-2">Porte da Empresa</h3>
          <div className="flex flex-wrap gap-2">
            {portes.map(porte => (
              <Badge
                key={porte}
                variant={filters.porte_empresa.includes(porte) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => handlePorteChange(porte)}
              >
                {porte}
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Situação</h3>
          <div className="flex flex-wrap gap-2">
            {situacoes.map(situacao => (
              <Badge
                key={situacao}
                variant={filters.situacao.includes(situacao) ? 'default' : 'outline'}
                className="cursor-pointer capitalize"
                onClick={() => handleSituacaoChange(situacao)}
              >
                {situacao}
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Regime Tributário</h3>
          <div className="flex flex-wrap gap-2">
            {regimes.map(regime => (
              <Badge
                key={regime}
                variant={filters.regime_tributario.includes(regime) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => handleRegimeChange(regime)}
              >
                {regime}
              </Badge>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="cidade">Cidade</Label>
            <Input
              id="cidade"
              value={filters.cidade}
              onChange={(e) => setFilters({ ...filters, cidade: e.target.value })}
              placeholder="Ex: São Paulo"
            />
          </div>
          <div>
            <Label htmlFor="estado">Estado (UF)</Label>
            <Input
              id="estado"
              value={filters.estado}
              onChange={(e) => setFilters({ ...filters, estado: e.target.value.toUpperCase() })}
              placeholder="Ex: SP"
              maxLength={2}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="ddd">DDD</Label>
            <Input
              id="ddd"
              value={filters.ddd}
              onChange={(e) => setFilters({ ...filters, ddd: e.target.value.replace(/\D/g, '') })}
              placeholder="Ex: 11"
              maxLength={2}
            />
          </div>
          <div>
            <Label htmlFor="cep">CEP</Label>
            <Input
              id="cep"
              value={filters.cep}
              onChange={(e) => setFilters({ ...filters, cep: e.target.value })}
              placeholder="Ex: 01310-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="capital_minimo">Capital Mínimo (R$)</Label>
            <Input
              id="capital_minimo"
              value={filters.capital_minimo}
              onChange={(e) => setFilters({ ...filters, capital_minimo: e.target.value })}
              placeholder="Ex: 1.000,00"
            />
          </div>
          <div>
            <Label htmlFor="capital_maximo">Capital Máximo (R$)</Label>
            <Input
              id="capital_maximo"
              value={filters.capital_maximo}
              onChange={(e) => setFilters({ ...filters, capital_maximo: e.target.value })}
              placeholder="Ex: 1.000.000,00"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="data_abertura_inicio">Data de Abertura - Início</Label>
            <Input
              id="data_abertura_inicio"
              type="date"
              value={filters.data_abertura_inicio}
              onChange={(e) => setFilters({ ...filters, data_abertura_inicio: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="data_abertura_fim">Data de Abertura - Fim</Label>
            <Input
              id="data_abertura_fim"
              type="date"
              value={filters.data_abertura_fim}
              onChange={(e) => setFilters({ ...filters, data_abertura_fim: e.target.value })}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleSearch}
            disabled={loading}
            className="flex-1"
          >
            <Search className="h-4 w-4 mr-2" />
            {loading ? 'Contando...' : 'Contar Resultados'}
          </Button>
          <Button
            variant="outline"
            onClick={handleClear}
          >
            <X className="h-4 w-4 mr-2" />
            Limpar
          </Button>
        </div>
      </div>
    </Card>
  );
};
