import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, ArrowLeft, Building2 } from "lucide-react";

interface CNPJBizPreviewProps {
  filters: any;
  totalCount: number;
  onBack: () => void;
  onComplete: () => void;
}

export const CNPJBizPreview = ({ filters, totalCount, onBack, onComplete }: CNPJBizPreviewProps) => {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState({ imported: 0, errors: 0, updated: 0 });

  const handleImport = async () => {
    setImporting(true);
    setProgress(0);
    setResults({ imported: 0, errors: 0, updated: 0 });

    try {
      const limit = 100;
      const totalPages = Math.ceil(totalCount / limit);
      let importedTotal = 0;
      let errorsTotal = 0;
      let updatedTotal = 0;

      for (let page = 0; page < totalPages; page++) {
        const offset = page * limit;
        setProgress(Math.round((page / totalPages) * 100));

        // Buscar dados da API
        const { data: empresas, error: apiError } = await supabase.functions.invoke('cnpjbiz-consulta', {
          body: {
            operation: 'listar',
            ...filters,
            limit,
            offset
          }
        });

        if (apiError) throw apiError;

        // Processar cada empresa
        for (const empresa of empresas) {
          try {
            // Verificar se CNPJ já existe
            const cnpjFormatado = empresa.cnpj.replace(/[^\d]/g, '');
            const { data: existente } = await supabase
              .from('prospects')
              .select('id')
              .eq('cnpj', cnpjFormatado)
              .maybeSingle();

            // Buscar ou criar município
            let municipioId = null;
            if (empresa.endereco?.cidade?.nome && empresa.endereco?.estado?.sigla) {
              const { data: municipio } = await supabase
                .from('municipios')
                .select('id')
                .eq('nome', empresa.endereco.cidade.nome)
                .eq('uf', empresa.endereco.estado.sigla)
                .maybeSingle();

              if (municipio) {
                municipioId = municipio.id;
              } else {
                // Mapear UF para região
                const regiaoMap: Record<string, 'Norte' | 'Sul' | 'Leste' | 'Oeste' | 'Centro'> = {
                  'SP': 'Centro', 'RJ': 'Centro', 'MG': 'Centro', 'ES': 'Centro',
                  'RS': 'Sul', 'SC': 'Sul', 'PR': 'Sul',
                  'BA': 'Leste', 'SE': 'Leste', 'AL': 'Leste', 'PE': 'Leste',
                  'AM': 'Norte', 'PA': 'Norte', 'AC': 'Norte', 'RO': 'Norte',
                  'GO': 'Oeste', 'MT': 'Oeste', 'MS': 'Oeste'
                };
                
                const { data: novoMunicipio } = await supabase
                  .from('municipios')
                  .insert({
                    nome: empresa.endereco.cidade.nome,
                    uf: empresa.endereco.estado.sigla,
                    regiao: regiaoMap[empresa.endereco.estado.sigla] || 'Centro'
                  } as any)
                  .select('id')
                  .single();
                municipioId = novoMunicipio?.id;
              }
            }

            // Preparar dados do prospect
            const prospectData = {
              nome_empresa: empresa.razao_social,
              cnpj: cnpjFormatado,
              email: empresa.email || null,
              telefone: empresa.telefones?.[0] || null,
              demais_telefones: empresa.telefones || [],
              logradouro: empresa.endereco?.logradouro || null,
              numero: empresa.endereco?.numero || null,
              cep: empresa.endereco?.cep?.replace(/\D/g, '') || null,
              bairro: empresa.endereco?.bairro || null,
              municipio_id: municipioId,
              porte: empresa.porte_empresa || null,
              cnae_principal: empresa.atividades?.principal?.[0] || null,
              cnae_secundarios: empresa.atividades?.secundaria || [],
              natureza_juridica: empresa.natureza_juridica?.nome || null,
              capital_social: empresa.capital_social || null,
              data_abertura: empresa.data_abertura || null,
              situacao_cadastral: empresa.situacao || null,
              socios: empresa.socios || [],
              endereco: [
                empresa.endereco?.tipo_logradouro,
                empresa.endereco?.logradouro,
                empresa.endereco?.numero
              ].filter(Boolean).join(' ')
            };

            if (existente) {
              // Atualizar
              await supabase
                .from('prospects')
                .update(prospectData)
                .eq('id', existente.id);
              updatedTotal++;
            } else {
              // Inserir
              await supabase
                .from('prospects')
                .insert(prospectData as any);
              importedTotal++;
            }

          } catch (error) {
            console.error('Erro ao processar empresa:', error);
            errorsTotal++;
          }
        }

        // Pequeno delay entre páginas
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      setProgress(100);
      setResults({ imported: importedTotal, errors: errorsTotal, updated: updatedTotal });
      
      toast.success(`Importação concluída! ${importedTotal} novos prospects, ${updatedTotal} atualizados`);
      onComplete();

    } catch (error) {
      console.error('Erro na importação:', error);
      toast.error('Erro durante a importação');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={onBack} disabled={importing}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar aos Filtros
          </Button>
          <Badge variant="secondary" className="text-lg px-4 py-2">
            {totalCount.toLocaleString('pt-BR')} empresas encontradas
          </Badge>
        </div>

        <div className="bg-muted p-6 rounded-lg">
          <div className="flex items-start gap-4">
            <Building2 className="h-12 w-12 text-primary" />
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-2">Resumo da Importação</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Total de Empresas</div>
                  <div className="text-2xl font-bold">{totalCount.toLocaleString('pt-BR')}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Créditos Necessários</div>
                  <div className="text-2xl font-bold text-orange-600">{totalCount.toLocaleString('pt-BR')}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Tempo Estimado</div>
                  <div className="text-2xl font-bold">{Math.ceil(totalCount / 100)} min</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {importing && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Importando...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="text-sm text-muted-foreground text-center">
              {results.imported} importados • {results.updated} atualizados • {results.errors} erros
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Button
            onClick={handleImport}
            disabled={importing}
            className="flex-1"
            size="lg"
          >
            <Download className="h-5 w-5 mr-2" />
            {importing ? 'Importando...' : `Importar Todas (${totalCount} créditos)`}
          </Button>
        </div>

        {totalCount > 1000 && (
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-sm text-orange-800">
              ℹ️ Importações grandes podem levar vários minutos. A página pode ser fechada durante o processo.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};
