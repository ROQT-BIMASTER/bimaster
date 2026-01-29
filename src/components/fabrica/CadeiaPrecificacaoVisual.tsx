import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, Factory, DollarSign } from "lucide-react";
import { useUserPriceTableAccess } from "@/hooks/useUserPriceTableAccess";

interface Props {
  tabelas: any[];
}

export function CadeiaPrecificacaoVisual({ tabelas }: Props) {
  const { filterTablesByAccess, loading } = useUserPriceTableAccess();

  // Filtrar tabelas baseado nas permissões do usuário
  const tabelasFiltradas = filterTablesByAccess(tabelas);

  // Organizar tabelas por hierarquia
  const tabelasRaiz = tabelasFiltradas.filter(t => !t.tabela_base_id && t.ativo);
  
  const construirArvore = (tabelaId: string, nivel = 0): any[] => {
    const filhas = tabelasFiltradas.filter(t => t.tabela_base_id === tabelaId && t.ativo);
    return filhas.map(filha => ({
      ...filha,
      nivel,
      filhas: construirArvore(filha.id, nivel + 1)
    }));
  };

  const renderTabela = (tabela: any, isRaiz = false) => {
    const getTipoMarkupLabel = () => {
      switch (tabela.tipo_markup) {
        case 'percentual':
          return `+${tabela.valor_markup}%`;
        case 'multiplicador':
          return `x${tabela.valor_markup}`;
        case 'valor_fixo':
          return `+R$ ${tabela.valor_markup.toFixed(2)}`;
        default:
          return '';
      }
    };

    return (
      <div key={tabela.id} className="space-y-2">
        {/* Seta */}
        {!isRaiz && (
          <div className="flex justify-center">
            <ArrowDown className="h-6 w-6 text-muted-foreground animate-pulse" />
          </div>
        )}

        {/* Card da Tabela */}
        <Card 
          className="border-l-4 transition-all hover:shadow-md"
          style={{
            borderLeftColor: isRaiz ? 'hsl(var(--primary))' : 'hsl(var(--accent))',
            marginLeft: `${tabela.nivel * 2}rem`
          }}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isRaiz ? (
                  <Factory className="h-5 w-5 text-primary" />
                ) : (
                  <DollarSign className="h-5 w-5 text-accent-foreground" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{tabela.nome}</h4>
                    <Badge variant="outline" className="text-xs">
                      {tabela.codigo}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {isRaiz ? "Base do Sistema" : getTipoMarkupLabel()}
                  </p>
                </div>
              </div>
              <Badge variant={isRaiz ? "default" : "secondary"}>
                {tabela.precos_count?.[0]?.count || 0} produtos
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Renderizar filhas recursivamente */}
        {tabela.filhas?.map((filha: any) => renderTabela(filha))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (tabelasFiltradas.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhuma tabela de preço disponível
      </div>
    );
  }

  if (tabelasRaiz.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Configure uma tabela base para visualizar a cadeia de precificação
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {tabelasRaiz.map((raiz) => {
        const arvore = construirArvore(raiz.id);
        return (
          <div key={raiz.id}>
            {renderTabela({ ...raiz, nivel: 0, filhas: arvore }, true)}
          </div>
        );
      })}
    </div>
  );
}
