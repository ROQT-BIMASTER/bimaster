import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Package, Layers, Factory, FileText, Receipt, DollarSign, ClipboardList, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const sections = [
  {
    id: "materias-primas",
    icon: Package,
    title: "Matérias-Primas",
    badge: "/dashboard/fabrica/materias-primas",
    items: [
      { q: "Como cadastrar?", a: 'Clique em "+ Nova Matéria-Prima" → preencha Código, Nome, Unidade (obrigatórios), Categoria, Custo e Estoque Mínimo (opcionais) → "Cadastrar".' },
      { q: "Como editar?", a: 'Na lista, clique em "Editar" → altere os campos → "Salvar".' },
      { q: "Como configurar fiscal?", a: 'Clique no botão "Fiscal" → preencha NCM, CEST, Origem, CFOP, CST ICMS, Alíquota → salve.' },
      { q: "Posso excluir?", a: "Sim, se a MP não estiver vinculada a nenhuma fórmula. Caso contrário, apenas inative." },
      { q: "Exemplo prático", a: "MP-001: Farinha de Trigo | kg | R$ 2,50/kg\nMP-002: Açúcar | kg | R$ 1,80/kg\nMP-003: Chocolate em Pó | kg | R$ 15,00/kg" },
    ],
  },
  {
    id: "produtos-acabados",
    icon: Layers,
    title: "Produtos Acabados",
    badge: "/dashboard/fabrica/produtos-acabados",
    items: [
      { q: "Visões disponíveis?", a: "Tabela (lista densa), Cards (visual com thumbnails) e Kanban (por status da ficha de custos)." },
      { q: "Como cadastrar?", a: 'Clique em "+ Novo Produto" → preencha Código, Nome, Tipo (obrigatórios) → a Fórmula pode ser vinculada depois → "Cadastrar".' },
      { q: "O que é Agrupamento?", a: 'Ative o toggle "Agrupar" para organizar por Marca → Linha. Útil para catálogos grandes.' },
      { q: "O que faz o ícone 💲?", a: "Abre a Ficha de Custos do produto, onde você detalha todos os custos de produção." },
      { q: "Painel Administrativo?", a: "Mostra fichas pendentes de revisão pela Diretoria. Acompanhe aprovações e comunicações." },
    ],
  },
  {
    id: "formulas",
    icon: ClipboardList,
    title: "Fórmulas BOM",
    badge: "/dashboard/fabrica/formulas",
    items: [
      { q: "O que é uma Fórmula BOM?", a: "Define a receita de um produto: quais matérias-primas, quantidades e proporções. Ex: 500kg farinha (50%) + 300kg açúcar (30%) + 200kg chocolate (20%) = 1.000 un." },
      { q: "Como criar?", a: 'Clique "+ Nova Fórmula" → selecione Produto → informe Rendimento e Tempo → adicione Ingredientes com Quantidade e Percentual → os percentuais DEVEM somar 100% → "Salvar".' },
      { q: "Roteiro de produção?", a: "Na aba Roteiro, defina o passo a passo: máquinas, tempos, temperaturas e instruções para cada etapa." },
      { q: "Simulação?", a: 'Use "Simular Produção" para calcular necessidades de MP e custo total para qualquer quantidade.' },
    ],
  },
  {
    id: "ordens-producao",
    icon: Factory,
    title: "Ordens de Produção",
    badge: "/dashboard/fabrica/ordens-producao",
    items: [
      { q: "Como criar uma OP?", a: 'Clique "+ Nova Ordem" → selecione Produto e Fórmula → informe Quantidade, Data Prevista e Lote → "Salvar". O MRP calcula automaticamente as necessidades de MP.' },
      { q: "Exemplo de cálculo MRP", a: "OP: 5.000 un de Biscoito Chocolate\n→ Farinha: 2.500 kg (R$ 6.250)\n→ Açúcar: 1.500 kg (R$ 2.700)\n→ Chocolate: 1.000 kg (R$ 15.000)\nTotal: R$ 23.950,00" },
      { q: "Fluxo de status?", a: "Pendente → Em Produção → Pausada → Em Produção → Concluída (ou Cancelada)" },
      { q: "Apontamentos?", a: "Registre início/fim de cada etapa, paradas e ocorrências. Acompanhe o progresso em tempo real." },
    ],
  },
  {
    id: "recebimentos",
    icon: Receipt,
    title: "Recebimento de XML (NF-e)",
    badge: "/dashboard/fabrica/recebimentos",
    items: [
      { q: "Como importar NF-e?", a: 'Clique "Selecionar Arquivo" ou arraste o XML. O sistema extrai automaticamente fornecedor, itens e valores.' },
      { q: "Mapear produtos?", a: 'Clique "Mapear Produtos" → confirme ou selecione a MP correspondente para cada item → salve o mapeamento.' },
      { q: "Ver detalhes?", a: 'Clique "Ver Detalhes" para ver itens, valores, impostos e status de mapeamento.' },
      { q: "Exemplo", a: "NF-e 4166252 | Destro Brasil\nValor: R$ 7.230,82\n→ Farinha 25kg: R$ 45 × 50 = R$ 2.250\n→ Açúcar 50kg: R$ 90 × 20 = R$ 1.800\n→ Chocolate 5kg: R$ 63,56 × 50 = R$ 3.181" },
    ],
  },
  {
    id: "fiscal",
    icon: FileText,
    title: "Configuração Fiscal",
    badge: "/dashboard/fabrica/fiscal",
    items: [
      { q: "Como configurar?", a: 'Localize o produto/MP → "Configurar" → preencha Fiscal (NCM, CFOP, ICMS), Preços (Custo, Venda), Estoque (Mín, Máx) → "Salvar".' },
      { q: "Exemplo", a: "NCM: 1905.90.90 | CEST: 17.046.00\nOrigem: Nacional | CFOP: 5102\nCST ICMS: 00 | Alíquota: 18%\nCusto: R$ 10,00 | Venda: R$ 15,00" },
    ],
  },
  {
    id: "tabelas-preco",
    icon: DollarSign,
    title: "Tabelas de Preço",
    badge: "/dashboard/fabrica/tabelas-preco",
    items: [
      { q: "Como criar?", a: '"Nova Tabela" → nome, data, markup → adicione produtos → sistema calcula Custo + Impostos + Markup.' },
      { q: "Aprovação?", a: "Rascunho → Enviada → Aprovada ✅ ou Rejeitada → Revisão → Reenvio." },
      { q: "Cadeia de precificação?", a: "Fábrica R$ 4,79 → +30% → Distribuidor R$ 6,23 → +25% → Varejo R$ 7,79" },
    ],
  },
  {
    id: "ficha-custos",
    icon: DollarSign,
    title: "Ficha de Custos",
    badge: "Via ícone 💲 no produto",
    items: [
      { q: "Estrutura?", a: "Custos de NF, Custos de Serviço, Custos de Condição, Mão de Obra e Markup." },
      { q: "Vincular XML?", a: '"Vincular XML" → selecione a NF-e → custos reais puxados automaticamente.' },
      { q: "Chat com Diretoria?", a: "Mensagens em tempo real, apontamentos por insumo, requisitos obrigatórios. Histórico preservado entre versões." },
    ],
  },
];

export default function FabricaManualPage() {
  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/fabrica")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                <BookOpen className="h-7 w-7" />
                Manual do Módulo Fábrica
              </h1>
              <p className="text-muted-foreground mt-1">
                Guia completo com exemplos práticos para todas as funcionalidades
              </p>
            </div>
          </div>
        </div>

        {/* Fluxo recomendado */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">🎯 Fluxo Recomendado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {[
                "1. Cadastrar MPs",
                "2. Cadastrar Produtos",
                "3. Criar Fórmulas BOM",
                "4. Configurar Fiscal",
                "5. Criar Ordens de Produção",
                "6. Importar NF-e (XML)",
                "7. Montar Ficha de Custos",
                "8. Criar Tabela de Preço",
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Badge variant="secondary" className="whitespace-nowrap">{step}</Badge>
                  {i < 7 && <span className="text-muted-foreground">→</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Seções do manual */}
        {sections.map((section) => (
          <Card key={section.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <section.icon className="h-5 w-5 text-primary" />
                {section.title}
                <Badge variant="outline" className="ml-auto text-xs font-normal">
                  {section.badge}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                {section.items.map((item, idx) => (
                  <AccordionItem key={idx} value={`${section.id}-${idx}`}>
                    <AccordionTrigger className="text-sm font-medium">
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent>
                      <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
                        {item.a}
                      </pre>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        ))}

        {/* Dicas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">📌 Dicas Importantes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• Sempre cadastre MPs <strong>antes</strong> de criar fórmulas.</p>
            <p>• Configure dados fiscais <strong>antes</strong> de criar tabelas de preço.</p>
            <p>• Use o <strong>tour guiado (❓)</strong> em cada tela para um passo a passo interativo.</p>
            <p>• Use o <strong>botão 📘</strong> em cada tela para abrir o manual contextual.</p>
            <p>• O <strong>MRP calcula automaticamente</strong> as necessidades ao criar uma OP.</p>
            <p>• Importe <strong>XMLs de NF-e</strong> para ter custos reais atualizados.</p>
            <p>• O <strong>chat na ficha de custos</strong> permite comunicação direta com a Diretoria.</p>
          </CardContent>
        </Card>

        {/* Permissões */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">🔐 Permissões por Departamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <p className="font-medium">Fábrica</p>
                <p className="text-muted-foreground">Acesso total ao módulo</p>
              </div>
              <div className="space-y-1">
                <p className="font-medium">Compras e Faturamento</p>
                <p className="text-muted-foreground">Matérias-Primas e Recebimentos</p>
              </div>
              <div className="space-y-1">
                <p className="font-medium">Diretoria</p>
                <p className="text-muted-foreground">Aprovação de fichas e tabelas de preço</p>
              </div>
              <div className="space-y-1">
                <p className="font-medium">Comercial</p>
                <p className="text-muted-foreground">Visualização de tabelas aprovadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
