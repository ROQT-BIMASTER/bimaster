import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Search, X, Plus, ChevronDown, ChevronRight, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CNPJBizFiltersProps {
  onSearch: (filters: any, count: number) => void;
}

export const CNPJBizFilters = ({ onSearch }: CNPJBizFiltersProps) => {
  const [loading, setLoading] = useState(false);
  
  // Estados para filtros
  const [cnaeSearch, setCnaeSearch] = useState("");
  const [selectedCNAEs, setSelectedCNAEs] = useState<any[]>([]);
  const [incluirPrincipal, setIncluirPrincipal] = useState(true);
  const [incluirSecundaria, setIncluirSecundaria] = useState(false);
  
  const [naturezaSearch, setNaturezaSearch] = useState("");
  const [selectedNaturezas, setSelectedNaturezas] = useState<any[]>([]);
  
  const [situacao, setSituacao] = useState<string[]>(["ativa"]);
  
  const [tipoMatriz, setTipoMatriz] = useState(true);
  const [tipoFilial, setTipoFilial] = useState(true);
  
  const [porteMEI, setPorteMEI] = useState(true);
  const [porteME, setPorteME] = useState(true);
  const [porteEPP, setPorteEPP] = useState(true);
  const [porteDEMAIS, setPorteDEMAIS] = useState(true);
  
  const [regimeTributario, setRegimeTributario] = useState("");
  
  const [capitalMinimo, setCapitalMinimo] = useState("");
  const [capitalMaximo, setCapitalMaximo] = useState("");
  
  const [razaoFantasia, setRazaoFantasia] = useState("");
  
  const [localidades, setLocalidades] = useState("");
  const [bairro, setBairro] = useState("");
  const [cep, setCep] = useState("");
  const [ddd, setDdd] = useState("");
  
  const [dataAberturaPeriodo, setDataAberturaPeriodo] = useState("todos");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  
  const [opcaoContato, setOpcaoContato] = useState("todos");
  
  const [removerNumeroRepetido, setRemoverNumeroRepetido] = useState(false);
  const [removerEmailRepetido, setRemoverEmailRepetido] = useState(false);
  const [removerEmailContab, setRemoverEmailContab] = useState(false);
  const [desconsiderarExportados, setDesconsiderarExportados] = useState(false);
  
  const [caracteristicasOpen, setCaracteristicasOpen] = useState(true);
  const [tipoPorteOpen, setTipoPorteOpen] = useState(true);
  const [localizacaoOpen, setLocalizacaoOpen] = useState(true);
  const [datasOpen, setDatasOpen] = useState(false);
  const [contatoOpen, setContatoOpen] = useState(false);

  const handleSearch = async () => {
    if (situacao.length === 0) {
      toast.error('Selecione pelo menos uma situação');
      return;
    }

    setLoading(true);
    try {
      const apiFilters: any = {
        situacao,
      };

      // Atividades (CNAE)
      if (selectedCNAEs.length > 0) {
        apiFilters.atividades = selectedCNAEs.map(c => c.atividade_id);
        const tipos: string[] = [];
        if (incluirPrincipal) tipos.push('principal');
        if (incluirSecundaria) tipos.push('secundaria');
        if (tipos.length > 0) apiFilters.atividade_tipo = tipos;
      }

      // Natureza Jurídica
      if (selectedNaturezas.length > 0) {
        apiFilters.natureza_juridica = selectedNaturezas.map(n => n.natureza_juridica_id);
      }

      // Tipo (Matriz/Filial)
      const tipos: string[] = [];
      if (tipoMatriz) tipos.push('2');
      if (tipoFilial) tipos.push('1');
      if (tipos.length > 0) apiFilters.tipo = tipos;

      // Porte
      const portes: string[] = [];
      if (porteMEI) portes.push('MEI');
      if (porteME) portes.push('ME');
      if (porteEPP) portes.push('EPP');
      if (porteDEMAIS) portes.push('DEMAIS');
      if (portes.length > 0) apiFilters.porte_empresa = portes;

      // Regime Tributário
      if (regimeTributario) {
        apiFilters.regime_tributario = [regimeTributario];
      }

      // Capital Social
      if (capitalMinimo) apiFilters.capital_minimo = capitalMinimo;
      if (capitalMaximo) apiFilters.capital_maximo = capitalMaximo;

      // Razão Social / Nome Fantasia
      if (razaoFantasia.trim()) {
        const palavras = razaoFantasia.split('\n').filter(p => p.trim());
        if (palavras.length > 0) apiFilters.razao_fantasia = palavras;
      }

      // Localidades
      if (localidades.trim()) {
        const partes = localidades.split(',').map(p => p.trim());
        if (partes.length >= 2) {
          apiFilters.localidades = [{
            tipo: 'cidade',
            cidade: partes[0],
            estado: partes[1],
            pais: 'BR'
          }];
        }
      }

      // Bairro
      if (bairro.trim() && localidades.trim()) {
        const partes = localidades.split(',').map(p => p.trim());
        if (partes.length >= 2) {
          apiFilters.bairros = [{
            bairro: bairro.trim(),
            cidade: partes[0],
            estado: partes[1]
          }];
        }
      }

      // CEP e DDD
      if (cep) apiFilters.cep = [cep.replace(/\D/g, '')];
      if (ddd) apiFilters.ddd = [ddd];

      // Data de Abertura
      if (dataAberturaPeriodo !== 'todos') {
        const hoje = new Date();
        let inicio = new Date();
        
        switch (dataAberturaPeriodo) {
          case 'ultimos_5_anos':
            inicio.setFullYear(hoje.getFullYear() - 5);
            break;
          case 'ultimos_3_anos':
            inicio.setFullYear(hoje.getFullYear() - 3);
            break;
          case 'ultimo_1_ano':
            inicio.setFullYear(hoje.getFullYear() - 1);
            break;
          case 'ultimos_6_meses':
            inicio.setMonth(hoje.getMonth() - 6);
            break;
          case 'ultimo_1_mes':
            inicio.setMonth(hoje.getMonth() - 1);
            break;
          case 'ultima_semana':
            inicio.setDate(hoje.getDate() - 7);
            break;
          case 'hoje':
            inicio = hoje;
            break;
          case 'periodo':
            if (dataInicio) inicio = new Date(dataInicio);
            break;
        }
        
        apiFilters.data_abertura_inicio = inicio.toLocaleDateString('pt-BR');
        if (dataAberturaPeriodo === 'periodo' && dataFim) {
          apiFilters.data_abertura_fim = new Date(dataFim).toLocaleDateString('pt-BR');
        } else if (dataAberturaPeriodo !== 'periodo') {
          apiFilters.data_abertura_fim = hoje.toLocaleDateString('pt-BR');
        }
      }

      // Contato
      const contatoMap: Record<string, string> = {
        'email': 'email',
        'celular': 'celular',
        'celular_email': 'celulareemail',
        'telefone': 'telefone',
        'telefone_celular': 'telefoneoucelular',
        'telefone_celular_email': 'telefoneoucelulareemail',
        'telefone_celular_ou_email': 'telefoneoucelularouemail'
      };
      if (opcaoContato !== 'todos' && contatoMap[opcaoContato]) {
        apiFilters.contato = contatoMap[opcaoContato];
      }

      // Opções avançadas
      const avancado: string[] = [];
      if (removerNumeroRepetido) avancado.push('numero');
      if (removerEmailRepetido) avancado.push('email');
      if (removerEmailContab) avancado.push('sememailcontab');
      if (desconsiderarExportados) avancado.push('exportei');
      if (avancado.length > 0) apiFilters.avancado = avancado;

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

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Características da Empresa */}
        <Collapsible open={caracteristicasOpen} onOpenChange={setCaracteristicasOpen}>
          <Card>
            <CardHeader className="cursor-pointer" onClick={() => setCaracteristicasOpen(!caracteristicasOpen)}>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Características da empresa</CardTitle>
                  <CardDescription>
                    Filtre pelas atividades das empresas, natureza jurídica, situação, razão social e/ou nome fantasia que procura.
                  </CardDescription>
                </div>
                {caracteristicasOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Atividades/CNAEs */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="font-semibold">Atividades/CNAEs:</Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-orange-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Opcional - Não selecione nenhuma se desejar todas as atividades/CNAEs</p>
                        </TooltipContent>
                      </Tooltip>
                      <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">Opcional</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Não selecione nenhuma se desejar todas as atividades/CNAEs.</p>
                    
                    <div className="flex items-center gap-2 mt-4">
                      <Checkbox 
                        id="incluir_principal" 
                        checked={incluirPrincipal}
                        onCheckedChange={(checked) => setIncluirPrincipal(checked as boolean)}
                      />
                      <Label htmlFor="incluir_principal" className="text-sm cursor-pointer">Incluir atividade principal</Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-orange-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Filtrar empresas com as atividades selecionadas como principal</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="incluir_secundaria"
                        checked={incluirSecundaria}
                        onCheckedChange={(checked) => setIncluirSecundaria(checked as boolean)}
                      />
                      <Label htmlFor="incluir_secundaria" className="text-sm cursor-pointer">Incluir atividade secundária</Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-orange-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Filtrar empresas com as atividades selecionadas como secundária</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  {/* Natureza Jurídica */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="font-semibold">Natureza Jurídica:</Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-orange-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Opcional - Não selecione nenhuma se desejar todas as naturezas jurídicas</p>
                        </TooltipContent>
                      </Tooltip>
                      <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">Opcional</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Não selecione nenhuma se desejar todas as naturezas jurídicas.</p>
                  </div>
                </div>

                {/* Situações da empresa */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="font-semibold">Situações da empresa:</Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-red-500" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Obrigatório</p>
                      </TooltipContent>
                    </Tooltip>
                    <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">Opcional</span>
                  </div>
                  <Select 
                    value={situacao[0] || ""} 
                    onValueChange={(value) => setSituacao([value])}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativa">Ativas</SelectItem>
                      <SelectItem value="baixada">Baixadas</SelectItem>
                      <SelectItem value="suspensa">Suspensas</SelectItem>
                      <SelectItem value="inapta">Inaptas</SelectItem>
                      <SelectItem value="nula">Nulas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Tipo e Porte */}
        <Collapsible open={tipoPorteOpen} onOpenChange={setTipoPorteOpen}>
          <Card>
            <CardHeader className="cursor-pointer" onClick={() => setTipoPorteOpen(!tipoPorteOpen)}>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Tipo e Porte</CardTitle>
                {tipoPorteOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Tipo de empresas */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Label className="font-semibold">Tipo de empresas:</Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-red-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Obrigatório</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="tipo_matriz"
                        checked={tipoMatriz}
                        onCheckedChange={(checked) => setTipoMatriz(checked as boolean)}
                      />
                      <Label htmlFor="tipo_matriz" className="cursor-pointer">Matriz</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="tipo_filial"
                        checked={tipoFilial}
                        onCheckedChange={(checked) => setTipoFilial(checked as boolean)}
                      />
                      <Label htmlFor="tipo_filial" className="cursor-pointer">Filial</Label>
                    </div>
                  </div>

                  {/* Porte das Empresas */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Label className="font-semibold">Porte das Empresas:</Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-red-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Obrigatório</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="porte_mei"
                        checked={porteMEI}
                        onCheckedChange={(checked) => setPorteMEI(checked as boolean)}
                      />
                      <Label htmlFor="porte_mei" className="cursor-pointer">MEI</Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-orange-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Microempreendedor Individual</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="porte_me"
                        checked={porteME}
                        onCheckedChange={(checked) => setPorteME(checked as boolean)}
                      />
                      <Label htmlFor="porte_me" className="cursor-pointer">ME</Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-orange-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Microempresa</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="porte_epp"
                        checked={porteEPP}
                        onCheckedChange={(checked) => setPorteEPP(checked as boolean)}
                      />
                      <Label htmlFor="porte_epp" className="cursor-pointer">EPP</Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-orange-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Empresa de Pequeno Porte</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="porte_demais"
                        checked={porteDEMAIS}
                        onCheckedChange={(checked) => setPorteDEMAIS(checked as boolean)}
                      />
                      <Label htmlFor="porte_demais" className="cursor-pointer">Sem Enquadramento</Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-orange-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Empresas sem enquadramento específico</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </div>

                {/* Regime Tributário, Capital Social e Razão Social */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="regime">Regime Tributário:</Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-orange-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Opcional</p>
                        </TooltipContent>
                      </Tooltip>
                      <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">Opcional</span>
                    </div>
                    <Select value={regimeTributario} onValueChange={setRegimeTributario}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Todos</SelectItem>
                        <SelectItem value="Simples Nacional">Simples Nacional</SelectItem>
                        <SelectItem value="Lucro Real">Lucro Real</SelectItem>
                        <SelectItem value="Lucro Presumido">Lucro Presumido</SelectItem>
                        <SelectItem value="Lucro Arbitrado">Lucro Arbitrado</SelectItem>
                        <SelectItem value="Isenta">Isenta</SelectItem>
                        <SelectItem value="Imune">Imune</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="capital_minimo">Capital social mínimo:</Label>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-4 w-4 text-orange-500" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Opcional</p>
                          </TooltipContent>
                        </Tooltip>
                        <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">Opcional</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">R$</span>
                        <Input 
                          id="capital_minimo"
                          value={capitalMinimo}
                          onChange={(e) => setCapitalMinimo(e.target.value)}
                          placeholder="1.000,00"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="capital_maximo">Capital social máximo:</Label>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-4 w-4 text-orange-500" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Opcional</p>
                          </TooltipContent>
                        </Tooltip>
                        <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">Opcional</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">R$</span>
                        <Input 
                          id="capital_maximo"
                          value={capitalMaximo}
                          onChange={(e) => setCapitalMaximo(e.target.value)}
                          placeholder="1.000,00"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="razao_fantasia">Razão social ou Nome fantasia:</Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-red-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Obrigatório</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-orange-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Opcional</p>
                        </TooltipContent>
                      </Tooltip>
                      <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">Opcional</span>
                    </div>
                    <Textarea 
                      id="razao_fantasia"
                      value={razaoFantasia}
                      onChange={(e) => setRazaoFantasia(e.target.value)}
                      placeholder="Digite aqui..."
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">Digite uma ou mais palavras e aperte enter.</p>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Localização / Região */}
        <Collapsible open={localizacaoOpen} onOpenChange={setLocalizacaoOpen}>
          <Card>
            <CardHeader className="cursor-pointer" onClick={() => setLocalizacaoOpen(!localizacaoOpen)}>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Localização / Região</CardTitle>
                  <CardDescription>
                    Escolha a cidade(s), estado(s) ou país(es) que deseja filtrar:
                  </CardDescription>
                </div>
                {localizacaoOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="localidades">Localidades:</Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-orange-500" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Opcional</p>
                      </TooltipContent>
                    </Tooltip>
                    <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">Opcional</span>
                  </div>
                  <Input 
                    id="localidades"
                    value={localidades}
                    onChange={(e) => setLocalidades(e.target.value)}
                    placeholder="Digite aqui..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Digite o nome da cidade, estado ou país para selecionar, por exemplo: São Paulo, Campinas, Rio Grande do Sul.
                  </p>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="bairro">Bairro:</Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-orange-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Opcional</p>
                        </TooltipContent>
                      </Tooltip>
                      <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">Opcional</span>
                    </div>
                    <Input 
                      id="bairro"
                      value={bairro}
                      onChange={(e) => setBairro(e.target.value)}
                      placeholder="Digite aqui..."
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="cep">CEP:</Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-orange-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Opcional</p>
                        </TooltipContent>
                      </Tooltip>
                      <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">Opcional</span>
                    </div>
                    <Input 
                      id="cep"
                      value={cep}
                      onChange={(e) => setCep(e.target.value)}
                      placeholder="Digite o CEP completo..."
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="ddd">DDD:</Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-orange-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Opcional</p>
                        </TooltipContent>
                      </Tooltip>
                      <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">Opcional</span>
                    </div>
                    <Input 
                      id="ddd"
                      value={ddd}
                      onChange={(e) => setDdd(e.target.value.replace(/\D/g, ''))}
                      placeholder="Digite aqui..."
                      maxLength={2}
                    />
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Datas */}
        <Collapsible open={datasOpen} onOpenChange={setDatasOpen}>
          <Card>
            <CardHeader className="cursor-pointer" onClick={() => setDatasOpen(!datasOpen)}>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Datas</CardTitle>
                {datasOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>Data de abertura da empresa:</Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-red-500" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Obrigatório</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-orange-500" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Encontre empresas abertas recentemente ou mais antigas</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-sm text-muted-foreground">Encontre empresas abertas recentemente ou mais antigas.</p>

                  <div className="space-y-3 mt-4">
                    <div className="text-sm font-semibold">Filtro por faixa de data</div>
                    <p className="text-xs text-muted-foreground">Selecione um período pré definido que melhor se enquadre na sua necessidade.</p>
                    
                    <div className="flex flex-wrap gap-2">
                      <Button 
                        variant={dataAberturaPeriodo === 'todos' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDataAberturaPeriodo('todos')}
                      >
                        Todos
                      </Button>
                      <Button 
                        variant={dataAberturaPeriodo === 'ultimos_5_anos' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDataAberturaPeriodo('ultimos_5_anos')}
                      >
                        Últimos 5 anos
                      </Button>
                      <Button 
                        variant={dataAberturaPeriodo === 'ultimos_3_anos' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDataAberturaPeriodo('ultimos_3_anos')}
                      >
                        Últimos 3 anos
                      </Button>
                      <Button 
                        variant={dataAberturaPeriodo === 'ultimo_1_ano' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDataAberturaPeriodo('ultimo_1_ano')}
                      >
                        Último 1 ano
                      </Button>
                      <Button 
                        variant={dataAberturaPeriodo === 'ultimos_6_meses' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDataAberturaPeriodo('ultimos_6_meses')}
                      >
                        Últimos 6 meses
                      </Button>
                      <Button 
                        variant={dataAberturaPeriodo === 'ultimo_1_mes' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDataAberturaPeriodo('ultimo_1_mes')}
                      >
                        Último 1 mês
                      </Button>
                      <Button 
                        variant={dataAberturaPeriodo === 'ultima_semana' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDataAberturaPeriodo('ultima_semana')}
                      >
                        Última semana
                      </Button>
                      <Button 
                        variant={dataAberturaPeriodo === 'hoje' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDataAberturaPeriodo('hoje')}
                      >
                        Hoje
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Opções de Contato */}
        <Collapsible open={contatoOpen} onOpenChange={setContatoOpen}>
          <Card>
            <CardHeader className="cursor-pointer" onClick={() => setContatoOpen(!contatoOpen)}>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Opções de contato</CardTitle>
                  <CardDescription>
                    Restrinja sua busca por dados que realmente são essenciais para o seu negócio.
                  </CardDescription>
                </div>
                {contatoOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Apenas empresas que tenham */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Label className="font-semibold">Apenas empresas que tenham:</Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-red-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Obrigatório</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <RadioGroup value={opcaoContato} onValueChange={setOpcaoContato}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="todos" id="contato_todos" />
                        <Label htmlFor="contato_todos" className="cursor-pointer">Com ou sem contato</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="email" id="contato_email" />
                        <Label htmlFor="contato_email" className="cursor-pointer">E-mail</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="celular" id="contato_celular" />
                        <Label htmlFor="contato_celular" className="cursor-pointer">Celular</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="celular_email" id="contato_celular_email" />
                        <Label htmlFor="contato_celular_email" className="cursor-pointer">Celular e E-mail</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="telefone" id="contato_telefone" />
                        <Label htmlFor="contato_telefone" className="cursor-pointer">Telefone Comercial</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="telefone_celular" id="contato_telefone_celular" />
                        <Label htmlFor="contato_telefone_celular" className="cursor-pointer">Telefone Comercial ou Celular</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="telefone_celular_email" id="contato_telefone_celular_email" />
                        <Label htmlFor="contato_telefone_celular_email" className="cursor-pointer">Telefone Comercial ou Celular e E-mail</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="telefone_celular_ou_email" id="contato_telefone_celular_ou_email" />
                        <Label htmlFor="contato_telefone_celular_ou_email" className="cursor-pointer">Telefone Comercial ou Celular ou E-mail</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Opções avançadas */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Label className="font-semibold">Opções avançadas:</Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-red-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Obrigatório</p>
                        </TooltipContent>
                      </Tooltip>
                      <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">Opcional</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="remover_numero"
                        checked={removerNumeroRepetido}
                        onCheckedChange={(checked) => setRemoverNumeroRepetido(checked as boolean)}
                      />
                      <Label htmlFor="remover_numero" className="cursor-pointer">Remover empresas que tem o mesmo número telefônico</Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-orange-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Opção útil para remover duplicatas de telefone</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="remover_email"
                        checked={removerEmailRepetido}
                        onCheckedChange={(checked) => setRemoverEmailRepetido(checked as boolean)}
                      />
                      <Label htmlFor="remover_email" className="cursor-pointer">Remover empresas que tem o mesmo e-mail</Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-orange-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Opção útil para remover duplicatas de e-mail</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="remover_contab"
                        checked={removerEmailContab}
                        onCheckedChange={(checked) => setRemoverEmailContab(checked as boolean)}
                      />
                      <Label htmlFor="remover_contab" className="cursor-pointer">Remover empresas que tem a palavra "contab" no e-mail</Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-orange-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Remove e-mails de escritórios de contabilidade</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="desconsiderar_exportados"
                        checked={desconsiderarExportados}
                        onCheckedChange={(checked) => setDesconsiderarExportados(checked as boolean)}
                      />
                      <Label htmlFor="desconsiderar_exportados" className="cursor-pointer">Desconsiderar empresas que eu já exportei</Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-orange-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Evita duplicatas de exportações anteriores</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Botão Aplicar Filtro */}
        <div className="flex justify-end">
          <Button
            onClick={handleSearch}
            disabled={loading}
            size="lg"
            className="min-w-[200px]"
          >
            <Search className="h-5 w-5 mr-2" />
            {loading ? 'Contando...' : 'Aplicar filtro'}
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
};
