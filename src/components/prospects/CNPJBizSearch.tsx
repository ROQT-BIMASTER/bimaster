import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Search, Building2, MapPin, Phone, Mail, Users, TrendingUp, Calendar, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface CNPJBizSearchProps {
  onImportComplete?: () => void;
}

export function CNPJBizSearch({ onImportComplete }: CNPJBizSearchProps) {
  const [cnpj, setCnpj] = useState("");
  const [includeFiliais, setIncludeFiliais] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 14) {
      return numbers.replace(
        /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
        '$1.$2.$3/$4-$5'
      );
    }
    return numbers;
  };

  const handleSearch = async () => {
    if (!cnpj) {
      toast.error("Digite um CNPJ para buscar");
      return;
    }

    const cnpjNumbers = cnpj.replace(/\D/g, '');
    if (cnpjNumbers.length !== 14) {
      toast.error("CNPJ deve ter 14 dígitos");
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('cnpjbiz-consulta', {
        body: {
          operation: 'buscar-cnpj',
          cnpj: cnpjNumbers,
          filial: includeFiliais
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });

      if (response.error) throw response.error;
      
      setResult(response.data);
      toast.success("Empresa encontrada!");
    } catch (error: any) {
      console.error('Erro ao buscar CNPJ:', error);
      toast.error(error.message || "Erro ao buscar empresa");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!result) return;

    try {
      // Buscar ou criar município
      const { data: municipioData } = await supabase
        .from('municipios')
        .select('id')
        .eq('nome', result.endereco?.cidade?.nome || '')
        .eq('uf', result.endereco?.estado?.sigla || '')
        .single();

      let municipioId = municipioData?.id;

      if (!municipioId && result.endereco?.cidade?.nome) {
        const regiaoMap: Record<string, 'Norte' | 'Leste' | 'Centro' | 'Oeste' | 'Sul'> = {
          'AC': 'Norte', 'AM': 'Norte', 'RR': 'Norte', 'PA': 'Norte', 'AP': 'Norte', 'TO': 'Norte', 'RO': 'Norte',
          'MA': 'Leste', 'PI': 'Leste', 'CE': 'Leste', 'RN': 'Leste', 'PB': 'Leste', 'PE': 'Leste', 'AL': 'Leste', 'SE': 'Leste', 'BA': 'Leste',
          'MT': 'Centro', 'MS': 'Centro', 'GO': 'Centro', 'DF': 'Centro',
          'SP': 'Leste', 'RJ': 'Leste', 'MG': 'Leste', 'ES': 'Leste',
          'PR': 'Sul', 'SC': 'Sul', 'RS': 'Sul'
        };

        const { data: newMunicipio } = await supabase
          .from('municipios')
          .insert([{
            nome: result.endereco.cidade.nome,
            uf: result.endereco.estado.sigla,
            regiao: regiaoMap[result.endereco.estado.sigla] || 'Leste'
          }])
          .select('id')
          .single();
        
        municipioId = newMunicipio?.id;
      }

      // Verificar se já existe
      const { data: existingProspect } = await supabase
        .from('prospects')
        .select('id')
        .eq('cnpj', result.cnpj)
        .single();

      const prospectData = {
        nome_empresa: result.razao_social,
        razao_social: result.razao_social,
        nome_fantasia: result.nome_fantasia || result.razao_social,
        cnpj: result.cnpj,
        email: result.email,
        telefone: result.telefones?.[0]?.telefone,
        municipio_id: municipioId,
        endereco: result.endereco ? 
          `${result.endereco.tipo_logradouro} ${result.endereco.logradouro}, ${result.endereco.numero}` : 
          null,
        bairro: result.endereco?.bairro,
        cep: result.endereco?.cep,
        uf: result.endereco?.estado?.sigla,
        cnae_principal: result.atividades?.principal?.[0]?.codigo,
        cnae_secundarios: result.atividades?.secundaria?.map((a: any) => a.codigo),
        natureza_juridica: result.natureza_juridica?.nome,
        capital_social: result.capital_social,
        data_abertura: result.data_abertura,
        situacao_cadastral: result.situacao,
        socios: result.socios
      };

      if (existingProspect) {
        await supabase
          .from('prospects')
          .update(prospectData)
          .eq('id', existingProspect.id);
        toast.success("Prospect atualizado com sucesso!");
      } else {
        await supabase
          .from('prospects')
          .insert([prospectData]);
        toast.success("Prospect importado com sucesso!");
      }

      onImportComplete?.();
      setResult(null);
      setCnpj("");
    } catch (error: any) {
      console.error('Erro ao importar:', error);
      toast.error("Erro ao importar empresa");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Buscar Empresa por CNPJ
          </CardTitle>
          <CardDescription>
            Consulte dados detalhados de uma empresa específica
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                placeholder="00.000.000/0000-00"
                value={cnpj}
                onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
                maxLength={18}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="filiais"
              checked={includeFiliais}
              onCheckedChange={(checked) => setIncludeFiliais(checked as boolean)}
            />
            <Label htmlFor="filiais" className="text-sm font-normal cursor-pointer">
              Incluir lista de filiais (se for matriz)
            </Label>
          </div>

          <Button onClick={handleSearch} disabled={loading} className="w-full">
            <Search className="mr-2 h-4 w-4" />
            {loading ? "Buscando..." : "Buscar Empresa"}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {result.nome_fantasia || result.razao_social}
                </CardTitle>
                <CardDescription className="mt-1">
                  {result.razao_social}
                </CardDescription>
              </div>
              <Button onClick={handleImport}>
                Importar como Prospect
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Dados Básicos */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">CNPJ</Label>
                <p className="font-medium">{formatCNPJ(result.cnpj)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Tipo</Label>
                <p className="font-medium">{result.tipo}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Situação</Label>
                <Badge variant={result.situacao === 'ATIVA' ? 'default' : 'secondary'}>
                  {result.situacao}
                </Badge>
              </div>
              <div>
                <Label className="text-muted-foreground">Porte</Label>
                <p className="font-medium">{result.porte_empresa}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Data de Abertura</Label>
                <p className="font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {new Date(result.data_abertura).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Capital Social</Label>
                <p className="font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(result.capital_social)}
                </p>
              </div>
            </div>

            <Separator />

            {/* Contato */}
            <div>
              <h3 className="font-semibold mb-3">Contato</h3>
              <div className="space-y-2">
                {result.email && (
                  <p className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {result.email}
                  </p>
                )}
                {result.telefones?.map((tel: any, idx: number) => (
                  <p key={idx} className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    {tel.telefone} 
                    <Badge variant="outline" className="text-xs">{tel.tipo}</Badge>
                    {tel.whatsapp && <Badge variant="default" className="text-xs">WhatsApp</Badge>}
                  </p>
                ))}
              </div>
            </div>

            <Separator />

            {/* Endereço */}
            {result.endereco && (
              <>
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Endereço
                  </h3>
                  <p className="text-sm">
                    {result.endereco.tipo_logradouro} {result.endereco.logradouro}, {result.endereco.numero}
                    {result.endereco.complemento && ` - ${result.endereco.complemento}`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {result.endereco.bairro} - {result.endereco.cidade?.nome}/{result.endereco.estado?.sigla}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    CEP: {result.endereco.cep}
                  </p>
                </div>
                <Separator />
              </>
            )}

            {/* Natureza Jurídica */}
            {result.natureza_juridica && (
              <>
                <div>
                  <Label className="text-muted-foreground">Natureza Jurídica</Label>
                  <p className="font-medium">
                    {result.natureza_juridica.nome} ({result.natureza_juridica.codigo})
                  </p>
                </div>
                <Separator />
              </>
            )}

            {/* Atividades */}
            {result.atividades && (
              <Collapsible>
                <CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-80">
                  <h3 className="font-semibold">Atividades Econômicas</h3>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 mt-3">
                  {result.atividades.principal?.length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">Principal</Label>
                      {result.atividades.principal.map((ativ: any, idx: number) => (
                        <p key={idx} className="text-sm">
                          <span className="font-mono">{ativ.codigo}</span> - {ativ.nome}
                        </p>
                      ))}
                    </div>
                  )}
                  {result.atividades.secundaria?.length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">Secundárias</Label>
                      <div className="space-y-1">
                        {result.atividades.secundaria.map((ativ: any, idx: number) => (
                          <p key={idx} className="text-sm">
                            <span className="font-mono">{ativ.codigo}</span> - {ativ.nome}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Sócios */}
            {result.socios?.length > 0 && (
              <>
                <Separator />
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-80">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Quadro Societário ({result.socios.length})
                    </h3>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 mt-3">
                    {result.socios.map((socio: any, idx: number) => (
                      <Card key={idx}>
                        <CardContent className="pt-4 space-y-2">
                          <p className="font-medium">{socio.nome}</p>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <Label className="text-muted-foreground">CPF/CNPJ</Label>
                              <p>{socio.cnpj_cpf_socio}</p>
                            </div>
                            <div>
                              <Label className="text-muted-foreground">Função</Label>
                              <p>{socio.funcao?.descricao}</p>
                            </div>
                            {socio.faixa_etariia && (
                              <div>
                                <Label className="text-muted-foreground">Faixa Etária</Label>
                                <p>{socio.faixa_etariia}</p>
                              </div>
                            )}
                            {socio.data_entrada_sociedade && (
                              <div>
                                <Label className="text-muted-foreground">Entrada</Label>
                                <p>{new Date(socio.data_entrada_sociedade).toLocaleDateString('pt-BR')}</p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              </>
            )}

            {/* Situação Especial */}
            {result.situacao_especial?.status && (
              <>
                <Separator />
                <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <Label className="text-muted-foreground">Situação Especial</Label>
                    <p className="font-medium">{result.situacao_especial.status}</p>
                    <p className="text-sm text-muted-foreground">
                      Data: {new Date(result.situacao_especial.data).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
