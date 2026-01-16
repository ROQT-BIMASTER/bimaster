import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Package,
  Globe,
  Home,
  Calculator,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Info,
  Layers,
  DollarSign,
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManualTabelasPrecoDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Manual de Tabelas de Preços
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[70vh] pr-4">
          <Tabs defaultValue="visao-geral" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
              <TabsTrigger value="nacional">Produtos Nacionais</TabsTrigger>
              <TabsTrigger value="importado">Produtos Importados</TabsTrigger>
              <TabsTrigger value="passo-a-passo">Passo a Passo</TabsTrigger>
            </TabsList>

            {/* Visão Geral */}
            <TabsContent value="visao-geral" className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Layers className="h-5 w-5 text-primary" />
                    O que são Tabelas de Preço?
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    As tabelas de preço são estruturas que definem como os preços dos produtos acabados 
                    são calculados. Elas podem ser encadeadas (uma tabela usa outra como base) e aplicam 
                    markups automáticos.
                  </p>

                  <div className="grid md:grid-cols-2 gap-4 mt-6">
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Home className="h-4 w-4 text-blue-500" />
                        Produto Nacional
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Produto fabricado no Brasil. O custo base é calculado a partir do 
                        <strong> custo de produção</strong> ou <strong>custo médio</strong> nacional.
                      </p>
                    </div>

                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Globe className="h-4 w-4 text-green-500" />
                        Produto Importado
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Produto adquirido de fora do país. O custo considera: 
                        <strong> FOB + Frete + Seguro + Impostos</strong>, 
                        convertidos pela taxa de câmbio.
                      </p>
                    </div>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-4 mt-6">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Calculator className="h-4 w-4" />
                      Tipos de Markup
                    </h4>
                    <ul className="space-y-2 text-sm">
                      <li><Badge variant="outline" className="mr-2">Percentual</Badge> Ex: +30% sobre o custo base</li>
                      <li><Badge variant="outline" className="mr-2">Multiplicador</Badge> Ex: x2.5 (custo × 2.5)</li>
                      <li><Badge variant="outline" className="mr-2">Valor Fixo</Badge> Ex: +R$ 50,00 por unidade</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <ArrowRight className="h-5 w-5 text-primary" />
                    Cadeia de Precificação
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Você pode criar tabelas encadeadas, onde uma tabela usa o preço de outra como base:
                  </p>
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    <Badge>Custo Produção</Badge>
                    <ArrowRight className="h-4 w-4" />
                    <Badge variant="secondary">Tabela Atacado (+30%)</Badge>
                    <ArrowRight className="h-4 w-4" />
                    <Badge variant="secondary">Tabela Varejo (+50%)</Badge>
                    <ArrowRight className="h-4 w-4" />
                    <Badge variant="secondary">Tabela Premium (+80%)</Badge>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Produtos Nacionais */}
            <TabsContent value="nacional" className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Home className="h-5 w-5 text-blue-500" />
                    Configurando Preços para Produtos Nacionais
                  </h3>

                  <div className="space-y-4">
                    <div className="border-l-4 border-blue-500 pl-4">
                      <h4 className="font-medium">1. Cadastrar o Custo de Origem Nacional</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Acesse <strong>Fábrica → Saída → Produtos Acabados</strong>, selecione o produto 
                        e clique em <Badge variant="outline">Custos Origem</Badge>. Preencha o custo base nacional.
                      </p>
                    </div>

                    <div className="border-l-4 border-blue-500 pl-4">
                      <h4 className="font-medium">2. Criar a Tabela de Preços</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Crie uma nova tabela com <strong>Tipo Base = "Custo de Origem"</strong> e selecione 
                        <Badge variant="outline" className="ml-1">Nacional</Badge>
                      </p>
                    </div>

                    <div className="border-l-4 border-blue-500 pl-4">
                      <h4 className="font-medium">3. Definir Markup</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Configure o tipo e valor do markup que será aplicado sobre o custo nacional.
                      </p>
                    </div>

                    <div className="border-l-4 border-blue-500 pl-4">
                      <h4 className="font-medium">4. Gerar Preços</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Clique em <Badge variant="outline">Gerar</Badge>, selecione os produtos e escolha 
                        <strong> "Custo por Origem"</strong> como fonte de custo.
                      </p>
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4 mt-6">
                    <h4 className="font-medium mb-2 flex items-center gap-2 text-blue-700 dark:text-blue-400">
                      <Info className="h-4 w-4" />
                      Fontes de Custo para Nacional
                    </h4>
                    <ul className="text-sm space-y-1 text-blue-700 dark:text-blue-300">
                      <li>• <strong>Ordem de Produção:</strong> Custo da última OP concluída</li>
                      <li>• <strong>Custo Médio:</strong> Média ponderada de custos</li>
                      <li>• <strong>Custo por Origem:</strong> Custo cadastrado em "Custos Origem" → Nacional</li>
                      <li>• <strong>Manual:</strong> Você digita o custo na hora de gerar</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Produtos Importados */}
            <TabsContent value="importado" className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Globe className="h-5 w-5 text-green-500" />
                    Configurando Preços para Produtos Importados
                  </h3>

                  <div className="space-y-4">
                    <div className="border-l-4 border-green-500 pl-4">
                      <h4 className="font-medium">1. Cadastrar os Custos de Importação</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Acesse <strong>Fábrica → Saída → Produtos Acabados</strong>, selecione o produto 
                        e clique em <Badge variant="outline">Custos Origem</Badge>. Na aba "Importado", preencha:
                      </p>
                      <ul className="text-sm text-muted-foreground mt-2 ml-4 list-disc">
                        <li>Valor FOB (preço na origem)</li>
                        <li>Frete Internacional</li>
                        <li>Seguro</li>
                        <li>Impostos (II, IPI, ICMS, etc.)</li>
                        <li>Taxa de Câmbio</li>
                        <li>Moeda (USD, EUR, etc.)</li>
                      </ul>
                    </div>

                    <div className="border-l-4 border-green-500 pl-4">
                      <h4 className="font-medium">2. Criar a Tabela de Preços</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Crie uma nova tabela com <strong>Tipo Base = "Custo de Origem"</strong> e selecione 
                        <Badge variant="outline" className="ml-1">Importado</Badge>
                      </p>
                    </div>

                    <div className="border-l-4 border-green-500 pl-4">
                      <h4 className="font-medium">3. Definir Markup</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Configure o markup considerando que o custo já inclui todos os custos de importação.
                      </p>
                    </div>

                    <div className="border-l-4 border-green-500 pl-4">
                      <h4 className="font-medium">4. Gerar Preços</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Clique em <Badge variant="outline">Gerar</Badge>, selecione os produtos importados 
                        e escolha <strong>"Custo por Origem"</strong> como fonte.
                      </p>
                    </div>
                  </div>

                  <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4 mt-6">
                    <h4 className="font-medium mb-2 flex items-center gap-2 text-green-700 dark:text-green-400">
                      <Calculator className="h-4 w-4" />
                      Cálculo do Custo Importado
                    </h4>
                    <div className="text-sm text-green-700 dark:text-green-300 font-mono bg-green-100 dark:bg-green-900/30 p-3 rounded">
                      Custo Total = (FOB + Frete + Seguro + Impostos) × Taxa de Câmbio
                    </div>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                      O sistema calcula automaticamente o custo total em Reais com base nos valores informados.
                    </p>
                  </div>

                  <div className="bg-yellow-50 dark:bg-yellow-950/20 rounded-lg p-4 mt-4">
                    <h4 className="font-medium mb-2 flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                      <AlertTriangle className="h-4 w-4" />
                      Atenção
                    </h4>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      Lembre-se de atualizar a taxa de câmbio regularmente para manter os preços corretos.
                      Você pode definir uma data de referência para o câmbio em cada cadastro de custo.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Passo a Passo */}
            <TabsContent value="passo-a-passo" className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    Guia Rápido: Criando sua Primeira Tabela
                  </h3>

                  <div className="space-y-6">
                    {/* Passo 1 */}
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                        1
                      </div>
                      <div>
                        <h4 className="font-medium">Prepare os Custos</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Antes de criar tabelas, certifique-se de que os produtos têm custos cadastrados:
                        </p>
                        <ul className="text-sm text-muted-foreground mt-2 list-disc ml-4">
                          <li>Para usar "Ordem de Produção": ter OPs finalizadas</li>
                          <li>Para usar "Custo Médio": ter movimentações de estoque</li>
                          <li>Para usar "Custo Origem": cadastrar em "Custos Origem"</li>
                        </ul>
                      </div>
                    </div>

                    {/* Passo 2 */}
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                        2
                      </div>
                      <div>
                        <h4 className="font-medium">Crie a Tabela Base</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Clique em <Badge>Nova Tabela</Badge> e configure:
                        </p>
                        <ul className="text-sm text-muted-foreground mt-2 list-disc ml-4">
                          <li><strong>Código e Nome:</strong> Identificação da tabela</li>
                          <li><strong>Tipo Base:</strong> De onde virá o custo (produção, origem, etc.)</li>
                          <li><strong>Markup:</strong> Percentual, multiplicador ou valor fixo</li>
                        </ul>
                      </div>
                    </div>

                    {/* Passo 3 */}
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                        3
                      </div>
                      <div>
                        <h4 className="font-medium">Gere os Preços</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Na tabela criada, clique em <Badge variant="outline">Gerar</Badge>:
                        </p>
                        <ul className="text-sm text-muted-foreground mt-2 list-disc ml-4">
                          <li>Selecione a fonte de custo</li>
                          <li>Marque os produtos desejados</li>
                          <li>Clique em "Calcular Preços"</li>
                          <li>Revise e salve</li>
                        </ul>
                      </div>
                    </div>

                    {/* Passo 4 */}
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                        4
                      </div>
                      <div>
                        <h4 className="font-medium">Crie Tabelas Derivadas (Opcional)</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Para criar variações (atacado, varejo, premium):
                        </p>
                        <ul className="text-sm text-muted-foreground mt-2 list-disc ml-4">
                          <li>Crie nova tabela</li>
                          <li>Selecione "Tabela Anterior" como base</li>
                          <li>Escolha a tabela de referência</li>
                          <li>Defina o markup adicional</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Exemplo Prático
                  </h3>

                  <div className="bg-muted/50 rounded-lg p-4">
                    <h4 className="font-medium mb-3">Cenário: Empresa com Nacional e Importado</h4>
                    
                    <div className="space-y-3 text-sm">
                      <div className="flex items-start gap-2">
                        <Package className="h-4 w-4 mt-0.5 text-blue-500" />
                        <div>
                          <strong>Tabela "Preço Custo Nacional"</strong>
                          <p className="text-muted-foreground">Base: Custo Origem (Nacional) | Markup: 0%</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <Package className="h-4 w-4 mt-0.5 text-green-500" />
                        <div>
                          <strong>Tabela "Preço Custo Importado"</strong>
                          <p className="text-muted-foreground">Base: Custo Origem (Importado) | Markup: 0%</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <Package className="h-4 w-4 mt-0.5 text-orange-500" />
                        <div>
                          <strong>Tabela "Atacado Nacional"</strong>
                          <p className="text-muted-foreground">Base: Tabela Anterior (Preço Custo Nacional) | Markup: +35%</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <Package className="h-4 w-4 mt-0.5 text-purple-500" />
                        <div>
                          <strong>Tabela "Varejo Nacional"</strong>
                          <p className="text-muted-foreground">Base: Tabela Anterior (Atacado Nacional) | Markup: +25%</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
