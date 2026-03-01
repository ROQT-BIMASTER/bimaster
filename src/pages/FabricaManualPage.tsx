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
    id: "displays-kits",
    icon: Package,
    title: "Displays / Kits",
    badge: "Tipo DISPLAY no cadastro",
    items: [
      {
        q: "O que é um Display / Kit?",
        a: "Um Display (ou Kit) é um produto composto por outros produtos acabados, montado em uma embalagem de apresentação para exposição no ponto de venda.\n\nExemplos:\n• Display de Esmaltes com 12 cores sortidas\n• Kit Presente com Shampoo + Condicionador + Máscara\n• Caixa expositora com 24 unidades mistas\n\nNo sistema, é um produto do tipo DISPLAY com uma Composição de Grade.",
      },
      {
        q: "Como criar um Display?",
        a: '1. Acesse Produtos Acabados → "+ Novo Produto"\n2. No campo Tipo, selecione "Display / Kit"\n   → A aba "Grade" aparece automaticamente\n3. Preencha dados básicos (Código, Nome, Marca, Linha)\n4. Vá para a aba "Grade"\n5. Busque produtos por nome, código ou EAN\n6. Clique no produto para adicioná-lo à grade\n7. Preencha Nº (cor/variante) e Qtd (quantidade)\n8. Repita para todos os itens → "Cadastrar"\n\n⚠️ Se salvar sem itens na grade, um alerta será exibido.',
      },
      {
        q: "Tipo de Rotulagem?",
        a: "Cada produto pode ter um tipo de rotulagem:\n\n• Sticker — Adesivo sobre a embalagem\n• Label — Rótulo envolvente colado\n• Sleeve — Manga termocontrátil\n• Tag — Etiqueta pendurada/amarrada\n• Sem Rotulagem — Sem identificação adicional\n\nDefinido no cadastro do produto e exibido na exportação Excel.",
      },
      {
        q: "Como funciona a busca na Grade?",
        a: "O campo de busca aceita:\n• Nome do produto (ex: \"Esmalte Rosa\")\n• Código do produto (ex: \"PROD-005\")\n• Código de barras EAN (ex: \"7891234001\")\n\nResultados filtram automaticamente:\n✗ Produtos já adicionados à grade\n✗ Outros Displays (não permite DISPLAY dentro de DISPLAY)\n✗ Matérias-primas",
      },
      {
        q: "Campos da Grade: Nº e Qtd?",
        a: "• Nº (Número da Cor/Variante): Identificador interno da variante no display. Pode ser número (01, 02, 03) ou código alfanumérico (A1, B2). Aparece como \"Color No.\" no Excel.\n\n• Qtd (Quantidade): Quantas unidades daquele produto compõem o display. Ex: 4 unidades de cada cor.\n\nO sistema exibe badges com o total de variantes e unidades.",
      },
      {
        q: "Exportação Excel — como usar?",
        a: 'No painel de detalhes do produto (clique no nome), use o botão "Exportar Grade (Excel)".\n\nA planilha contém:\n• Item No. — Código do display (todas as linhas)\n• Item Name — Nome do display\n• Color No. — Número da cor/variante\n• Color/Commercial Name — Nome do produto filho\n• Barcode (EAN) — Código de barras\n• Qty per box — Quantidade individual\n• Labelling type — Tipo de rotulagem\n• Photo — Link clicável para a foto\n\n📊 Linha TOTAL ao final com soma das quantidades.\nFormato: cabeçalho azul escuro, bordas, links clicáveis.',
      },
      {
        q: "Rastreabilidade reversa?",
        a: 'No painel de detalhes de qualquer produto acabado, a seção "Usado em Displays" mostra:\n• Todos os Displays que contêm aquele produto\n• A quantidade usada em cada display\n• Link para navegar ao display pai\n\nÚtil para saber o impacto ao alterar ou descontinuar um produto.',
      },
      {
        q: "Regras e validações?",
        a: "• Não é possível adicionar DISPLAY dentro de outro DISPLAY\n• Matérias-primas (MP) não aparecem na busca da grade\n• Ao trocar o tipo de DISPLAY para ACABADO, a grade é limpa automaticamente\n• Salvar DISPLAY sem grade exibe alerta (mas permite salvar)\n• O produto pai não aparece na própria busca de grade",
      },
      {
        q: "Exemplo prático completo",
        a: "📦 Display Esmaltes Verão 2026 (DSP-001)\n\nGrade:\n┌────┬─────────────────────┬─────────────┬─────┐\n│ Nº │ Produto             │ EAN         │ Qtd │\n├────┼─────────────────────┼─────────────┼─────┤\n│ 01 │ Esmalte Rosa Quartzo │ 7891234001  │  4  │\n│ 02 │ Esmalte Coral Vivo   │ 7891234002  │  4  │\n│ 03 │ Esmalte Nude Pérola  │ 7891234003  │  4  │\n└────┴─────────────────────┴─────────────┴─────┘\nTotal: 12 unidades por display\n\nExcel gerado:\n→ 3 linhas de dados + 1 linha TOTAL (12 un)\n→ Código DSP-001 em todas as linhas\n→ Fotos linkadas quando disponíveis",
      },
      {
        q: "Fluxo recomendado",
        a: "1️⃣ Cadastre os produtos acabados individuais\n2️⃣ Crie um produto tipo \"Display / Kit\"\n3️⃣ Na aba Grade, busque e adicione cada produto\n4️⃣ Preencha Nº da cor e Quantidade\n5️⃣ Salve o display\n6️⃣ Exporte a grade em Excel (painel de detalhes)\n7️⃣ Configure dados fiscais (NCM, CFOP)\n8️⃣ Inclua na Tabela de Preço",
      },
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
                "9. Criar Displays/Kits",
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Badge variant="secondary" className="whitespace-nowrap">{step}</Badge>
                  {i < 8 && <span className="text-muted-foreground">→</span>}
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
