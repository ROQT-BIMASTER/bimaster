import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export type ManualScreen =
  | "home"
  | "materias-primas"
  | "produtos-acabados"
  | "displays-kits"
  | "formulas"
  | "ordens-producao"
  | "recebimentos"
  | "fiscal"
  | "tabelas-preco"
  | "ficha-custos"
  | "comunicacao";

interface ManualFabricaDrawerProps {
  screen: ManualScreen;
  triggerVariant?: "icon" | "button";
}

const manualContent: Record<ManualScreen, { title: string; sections: { heading: string; content: string }[] }> = {
  home: {
    title: "📘 Módulo Fábrica — Visão Geral",
    sections: [
      {
        heading: "O que é o Módulo Fábrica?",
        content: "Centraliza toda a gestão de produção industrial: matérias-primas, produtos acabados, fórmulas BOM, ordens de produção, recebimentos de XML e precificação.",
      },
      {
        heading: "Ações Rápidas",
        content: "• Visão Executiva — Dashboard com KPIs de produção\n• Nova OP — Criar ordem de produção\n• Matérias-Primas — Acesso ao cadastro de insumos\n• Fórmulas BOM — Gerenciar estruturas de produto",
      },
      {
        heading: "Seções Expandíveis",
        content: "• Cadastros Básicos (Máquinas, Operadores, Unidades)\n• Produção e Planejamento (Apontamentos, Paradas, MRP)\n• Qualidade e Recebimento (Inspeções, XML de NF-e)\n• Precificação (Tabelas de Preço, Aprovação)",
      },
      {
        heading: "Fluxo Recomendado",
        content: "1️⃣ Cadastre Matérias-Primas\n2️⃣ Cadastre Produtos Acabados\n3️⃣ Crie Fórmulas BOM\n4️⃣ Configure dados Fiscais\n5️⃣ Crie Ordens de Produção\n6️⃣ Importe NF-e de compra\n7️⃣ Monte Fichas de Custos\n8️⃣ Crie Tabelas de Preço",
      },
    ],
  },
  "materias-primas": {
    title: "📦 Manual — Matérias-Primas",
    sections: [
      {
        heading: "Como cadastrar uma matéria-prima",
        content: '1. Clique em "+ Nova Matéria-Prima"\n2. Preencha os campos:\n   • Código: ex. MP-001 (obrigatório)\n   • Nome: ex. Farinha de Trigo (obrigatório)\n   • Unidade: ex. kg (obrigatório)\n   • Categoria: ex. Ingredientes\n   • Custo Unitário: ex. R$ 2,50\n   • Estoque Mínimo: ex. 100\n3. Clique em "Cadastrar"',
      },
      {
        heading: "Editar matéria-prima",
        content: '1. Na lista, clique em "Editar"\n2. Altere os campos desejados\n3. Clique em "Salvar"',
      },
      {
        heading: "Configurar dados fiscais",
        content: '1. Clique no botão "Fiscal" (ícone 📋)\n2. Preencha: NCM, CEST, Origem, CFOP, CST ICMS, Alíquota\n3. Salve as configurações',
      },
      {
        heading: "Inativar / Excluir",
        content: "• Inativar: Desativa sem excluir (pode reativar depois)\n• Excluir: Remove permanentemente (não permite se estiver vinculada a uma fórmula)",
      },
      {
        heading: "Exemplo prático",
        content: "Cadastre 3 MPs para produzir Biscoito de Chocolate:\n\n• MP-001 — Farinha de Trigo | 500kg | R$ 2,50/kg\n• MP-002 — Açúcar | 300kg | R$ 1,80/kg\n• MP-003 — Chocolate em Pó | 150kg | R$ 15,00/kg",
      },
    ],
  },
  "produtos-acabados": {
    title: "📦 Manual — Produtos Acabados",
    sections: [
      {
        heading: "Visões disponíveis",
        content: "• 📊 Tabela — Lista densa com todas as colunas (padrão)\n• 🃏 Cards — Grade visual com thumbnails\n• 📋 Kanban — Organização por status da ficha de custos",
      },
      {
        heading: "Como cadastrar um produto",
        content: '1. Clique em "+ Novo Produto"\n2. Preencha:\n   • Código: ex. PROD-001 (obrigatório)\n   • Nome: ex. Sérum Facial Coco 35ml (obrigatório)\n   • Tipo: ACABADO, INTERMEDIÁRIO ou DISPLAY\n   • Origem: Nacional ou Importado\n   • Marca e Linha (opcionais)\n   • Fórmula: pode vincular depois\n3. Clique em "Cadastrar"',
      },
      {
        heading: "Ações por produto",
        content: "• 💲 Ficha de Custos — Detalha custos de produção\n• ✏️ Editar — Altera dados cadastrais\n• 🗑️ Excluir — Remove o produto (com confirmação)",
      },
      {
        heading: "Agrupamento hierárquico",
        content: '1. Ative o toggle "Agrupar"\n2. Produtos organizados por Marca → Linha\n3. Útil para catálogos grandes',
      },
      {
        heading: "📦 Displays / Kits",
        content: 'Para criar um Display ou Kit, selecione tipo "Display / Kit" no cadastro.\n\nIsso habilita:\n• Aba "Grade" no formulário de cadastro\n• Composição de grade com busca por nome, código ou EAN\n• Campo Nº da Cor e Quantidade por variante\n• Exportação Excel da grade\n• Rastreabilidade reversa ("Usado em Displays")\n\n⚠️ Detalhes completos: veja o manual de Displays/Kits.',
      },
      {
        heading: "Painel Administrativo",
        content: "Acesse fichas de custos pendentes de revisão e acompanhe aprovações.\n\nFluxo:\n1️⃣ Monte a ficha → 2️⃣ Submeta para aprovação → 3️⃣ Diretoria analisa → 4️⃣ Aprovada ✅ ou Revisão 🔄",
      },
    ],
  },
  "displays-kits": {
    title: "📦 Manual — Displays / Kits",
    sections: [
      {
        heading: "O que é um Display / Kit?",
        content: "Um Display (ou Kit) é um produto composto por outros produtos acabados, montado em uma embalagem de apresentação para exposição no ponto de venda.\n\nExemplos:\n• Display de Esmaltes com 12 cores sortidas\n• Kit Presente com Shampoo + Condicionador + Máscara\n• Caixa expositora com 24 unidades mistas\n\nNo sistema, um Display é um produto do tipo DISPLAY que possui uma Composição de Grade — a lista de produtos filhos que o compõem.",
      },
      {
        heading: "Como criar um Display — Passo a passo",
        content: '1. Acesse Produtos Acabados → "+ Novo Produto"\n2. No campo Tipo, selecione "Display / Kit"\n   → A aba "Grade" aparece automaticamente\n3. Preencha dados básicos:\n   • Código: ex. DSP-001\n   • Nome: ex. Display Esmaltes Verão 2026\n   • Marca e Linha (opcionais)\n4. Vá para a aba "Grade"\n5. No campo de busca, digite o nome, código ou EAN do produto\n6. Clique no produto para adicioná-lo\n7. Preencha:\n   • Nº — Número da cor ou variante (ex: "01", "A2")\n   • Qtd — Quantidade daquela variante no display\n8. Repita para todos os itens\n9. Clique em "Cadastrar"\n\n⚠️ Se salvar um Display sem nenhum item na grade, um alerta será exibido.',
      },
      {
        heading: "Tipo de Rotulagem",
        content: "Cada produto pode ter um tipo de rotulagem definido:\n\n• Sticker — Adesivo aplicado sobre a embalagem\n• Label — Rótulo envolvente colado\n• Sleeve — Manga termocontrátil\n• Tag — Etiqueta pendurada/amarrada\n• Sem Rotulagem — Produto sem identificação adicional\n\nO tipo de rotulagem é informado no cadastro do produto e aparece na exportação Excel da grade.",
      },
      {
        heading: "Composição de Grade — Detalhes",
        content: "A grade mostra os produtos que compõem o Display:\n\n📋 Cada linha contém:\n• Nome e Código do produto filho\n• EAN (código de barras), se cadastrado\n• Nº da Cor/Variante — identificador interno\n• Quantidade — quantas unidades desse item no display\n\n🔍 Busca:\n• Busque por nome, código ou EAN\n• Resultados filtram automaticamente produtos já adicionados\n\n🚫 Regras:\n• Não é possível adicionar outro DISPLAY dentro de um Display\n• Matérias-primas (MP) também não aparecem na busca\n• Ao trocar o tipo de produto de DISPLAY para outro, a grade é limpa automaticamente",
      },
      {
        heading: "Exportação Excel",
        content: 'No painel de detalhes do produto (clique no nome), use o botão "Exportar Grade (Excel)".\n\nA planilha gerada contém:\n• Item No. — Código do display (em todas as linhas)\n• Item Name — Nome do display\n• Color No. — Número da cor/variante\n• Color/Commercial Name — Nome do produto filho\n• Barcode (EAN) — Código de barras do produto\n• Qty per box — Quantidade individual da variante\n• Labelling type — Tipo de rotulagem\n• Photo — Link para a foto do produto (se houver)\n\n📊 Linha TOTAL ao final com:\n• Soma total de unidades no display\n• Foto do display (se houver)\n\nFormato: cabeçalho azul escuro, bordas em todas as células, links clicáveis para fotos.',
      },
      {
        heading: "Rastreabilidade Reversa",
        content: 'No painel de detalhes de qualquer produto acabado, a seção "Usado em Displays" mostra todos os Displays que contêm aquele produto.\n\nIsso permite:\n• Saber em quantos displays um produto aparece\n• Ver a quantidade usada em cada display\n• Navegar diretamente para o display pai',
      },
      {
        heading: "Exemplo Prático Completo",
        content: "📦 Display Esmaltes Verão 2026 (DSP-001)\n\nComposição de Grade:\n┌────┬─────────────────────┬────┬─────┐\n│ Nº │ Produto             │ EAN         │ Qtd │\n├────┼─────────────────────┼────┼─────┤\n│ 01 │ Esmalte Rosa Quartzo │ 7891234001  │  4  │\n│ 02 │ Esmalte Coral Vivo   │ 7891234002  │  4  │\n│ 03 │ Esmalte Nude Pérola  │ 7891234003  │  4  │\n└────┴─────────────────────┴────┴─────┘\nTotal: 12 unidades por display\n\nExportação Excel:\n→ 3 linhas de dados + 1 linha TOTAL (12 un)\n→ Cada linha com código DSP-001 e foto linkada",
      },
      {
        heading: "Fluxo Recomendado",
        content: "1️⃣ Cadastre os produtos acabados que farão parte do display\n2️⃣ Crie um novo produto tipo \"Display / Kit\"\n3️⃣ Na aba Grade, busque e adicione cada produto\n4️⃣ Preencha Nº da cor e Quantidade para cada item\n5️⃣ Salve o display\n6️⃣ No painel de detalhes, exporte a grade em Excel\n7️⃣ Configure dados fiscais do display (NCM, CFOP)\n8️⃣ Inclua na Tabela de Preço para precificação",
      },
    ],
  },
  formulas: {
    title: "📋 Manual — Fórmulas BOM",
    sections: [
      {
        heading: "O que é uma Fórmula BOM?",
        content: "Uma Fórmula BOM (Bill of Materials) define a receita de um produto: quais matérias-primas são necessárias, em quais quantidades e proporções.",
      },
      {
        heading: "Como criar uma fórmula",
        content: '1. Clique em "+ Nova Fórmula"\n2. Selecione o Produto Acabado\n3. Preencha:\n   • Rendimento: ex. 1.000 unidades\n   • Tempo de Produção: ex. 60 minutos\n   • Perda Estimada: ex. 5%\n4. Adicione Ingredientes na aba "Ingredientes"',
      },
      {
        heading: "Adicionar ingredientes",
        content: '1. Clique em "Adicionar Item"\n2. Selecione a Matéria-Prima\n3. Informe Quantidade e Percentual\n4. Defina Criticidade (Crítico/Normal)\n\n⚠️ A soma dos percentuais DEVE ser 100%',
      },
      {
        heading: "Exemplo completo",
        content: "Produto: Biscoito Chocolate (PROD-001)\nRendimento: 1.000 unidades | Tempo: 60 min\n\nIngredientes:\n├── Farinha de Trigo: 500 kg (50%) — Crítico\n├── Açúcar: 300 kg (30%) — Normal\n└── Chocolate: 200 kg (20%) — Crítico\nTotal: 1.000 kg → 1.000 unidades",
      },
      {
        heading: "Roteiro de produção",
        content: "Na aba Roteiro, defina o passo a passo:\n\n1. Mistura — Misturador M-01 — 15 min\n2. Homogeneização — Misturador M-01 — 10 min\n3. Moldagem — Moldadora MD-02 — 20 min\n4. Forno — Forno F-01 — 15 min a 180°C",
      },
      {
        heading: "Simular produção",
        content: '1. Clique em "Simular Produção"\n2. Informe a quantidade desejada (ex: 5.000 un)\n3. O sistema calcula:\n   • Necessidade total de cada MP\n   • Custo total estimado\n   • Verificação de estoque',
      },
    ],
  },
  "ordens-producao": {
    title: "🏭 Manual — Ordens de Produção",
    sections: [
      {
        heading: "KPIs",
        content: "• Pendentes — OPs aguardando início\n• Em Produção — OPs em execução\n• Concluídas — OPs finalizadas\n• Taxa Conclusão — % de OPs concluídas",
      },
      {
        heading: "Como criar uma OP",
        content: '1. Clique em "+ Nova Ordem"\n2. Selecione o Produto e a Fórmula\n3. Informe:\n   • Quantidade: ex. 5.000 unidades\n   • Data Prevista: ex. 15/03/2026\n   • Lote: ex. LOTE-2026-001\n   • Prioridade: Alta/Normal/Baixa\n4. Clique em "Salvar"\n\n⚙️ O MRP calcula automaticamente as necessidades de MP!',
      },
      {
        heading: "Exemplo de cálculo MRP",
        content: "OP: 5.000 un de Biscoito Chocolate\nFórmula base: 1.000 un → 1.000 kg\n\nNecessidades (×5):\n├── Farinha: 2.500 kg → R$ 6.250,00\n├── Açúcar: 1.500 kg → R$ 2.700,00\n└── Chocolate: 1.000 kg → R$ 15.000,00\nTotal: R$ 23.950,00",
      },
      {
        heading: "Fluxo de status",
        content: "Pendente → Em Produção → Pausada → Em Produção → Concluída\n\nCada mudança de status pode ser registrada com apontamentos (início, pausas, ocorrências).",
      },
    ],
  },
  recebimentos: {
    title: "📥 Manual — Recebimento de XML",
    sections: [
      {
        heading: "Como importar NF-e",
        content: '1. Clique em "Selecionar Arquivo" ou arraste o XML\n2. O sistema extrai automaticamente:\n   • Número da NF-e e série\n   • Dados do fornecedor (CNPJ, razão social)\n   • Lista de produtos com quantidades e valores\n   • Data de emissão',
      },
      {
        heading: "Mapear produtos",
        content: '1. Clique em "Mapear Produtos" na nota importada\n2. Para cada item da nota:\n   • O sistema sugere vinculação automática\n   • Confirme ou selecione a MP correspondente\n3. Salve o mapeamento',
      },
      {
        heading: "Ver detalhes da nota",
        content: 'Clique em "Ver Detalhes" para visualizar:\n• Todos os itens da nota\n• Valores unitários e totais\n• Impostos (ICMS, IPI, PIS, COFINS)\n• Status de mapeamento',
      },
      {
        heading: "Exemplo",
        content: "NF-e 4166252 | Série 1\nFornecedor: Destro Brasil Distribuição\nData: 04/07/2025 | Valor: R$ 7.230,82\n\nItens:\n├── Farinha 25kg: R$ 45,00 × 50 = R$ 2.250,00\n├── Açúcar 50kg: R$ 90,00 × 20 = R$ 1.800,00\n└── Chocolate 5kg: R$ 63,56 × 50 = R$ 3.180,82",
      },
    ],
  },
  fiscal: {
    title: "📋 Manual — Configuração Fiscal",
    sections: [
      {
        heading: "Como configurar",
        content: '1. Localize o produto ou MP na lista\n2. Clique em "Configurar"\n3. Preencha as abas:\n\n📋 Fiscal: NCM, CEST, Origem, CFOP, CST, Alíquota\n💰 Preços: Custo e Venda\n📦 Estoque: Mínimo e Máximo\n\n4. Clique em "Salvar"',
      },
      {
        heading: "Exemplo",
        content: "Produto: Biscoito Chocolate\n• NCM: 1905.90.90\n• CEST: 17.046.00\n• Origem: 0 - Nacional\n• CFOP: 5102\n• CST ICMS: 00\n• Alíquota ICMS: 18%\n• Preço Custo: R$ 10,00\n• Preço Venda: R$ 15,00",
      },
    ],
  },
  "tabelas-preco": {
    title: "💰 Manual — Tabelas de Preço",
    sections: [
      {
        heading: "Como criar uma tabela",
        content: '1. Clique em "Nova Tabela"\n2. Preencha: Nome, Data Vigência, Markup\n3. Adicione produtos com preços calculados\n4. O sistema aplica: Custo + Impostos + Markup',
      },
      {
        heading: "Fluxo de aprovação",
        content: "Rascunho → Enviada para Aprovação → Aprovada ✅\n                                  → Rejeitada → Revisão → Reenvio",
      },
      {
        heading: "Cadeia de precificação",
        content: "Custo Fábrica → + Margem → Distribuidor → + Margem → Varejo\n   R$ 4,79        30%        R$ 6,23        25%       R$ 7,79",
      },
    ],
  },
  "ficha-custos": {
    title: "💲 Manual — Ficha de Custos",
    sections: [
      {
        heading: "Estrutura da ficha",
        content: "• Custos de NF — Custo dos insumos conforme notas fiscais\n• Custos de Serviço — Mão de obra, energia\n• Custos de Condição — Embalagem, frete\n• Mão de Obra — Custo direto de operadores\n• Markup — Margem de lucro",
      },
      {
        heading: "Vincular XML à ficha",
        content: '1. Na ficha, clique em "Vincular XML"\n2. Selecione a NF-e importada\n3. Custos reais dos insumos são puxados automaticamente',
      },
      {
        heading: "Chat com Diretoria",
        content: "• Mensagens em tempo real dentro da ficha\n• Apontamentos por insumo\n• Requisitos obrigatórios (orçamentos, evidências)\n• Histórico preservado entre versões",
      },
      {
        heading: "📦 Ficha de Custos para Displays / Kits",
        content: "Quando o produto é do tipo DISPLAY (Kit), você tem duas opções para preencher a ficha de custos:\n\n🔹 Opção 1 — Manual (padrão)\nDigite cada insumo manualmente, como faria para qualquer produto. Útil quando o kit não possui fichas de custo individuais nos produtos filhos.\n\n🔹 Opção 2 — Importar Custos dos Produtos do Kit\nClique no botão \"📥 Importar Custos dos Produtos\" acima da tabela de insumos. O sistema irá:\n1. Buscar cada produto da grade do display\n2. Calcular o custo total unitário de cada filho (insumos + M.O. + markup)\n3. Multiplicar pela quantidade da grade\n4. Inserir como linhas editáveis na ficha com o tipo \"Produto do Kit\"\n\n⚠️ Pré-requisito: Os produtos filhos devem ter suas fichas de custo preenchidas.\n\n✏️ Após importar, você pode:\n• Editar os valores importados normalmente\n• Adicionar insumos extras do kit (embalagem terciária, acessórios, montagem)\n• Configurar M.O. e Markup específicos do display\n\n💡 Dica: Use o botão \"👁 Grade\" no cabeçalho para consultar a composição do display a qualquer momento.",
      },
    ],
  },
  "comunicacao": {
    title: "💬 Manual — Comunicação de Revisões",
    sections: [
      {
        heading: "O que é?",
        content: "Canal centralizado de comunicação entre Fábrica e Diretoria sobre fichas de custos.\n• Cada produto tem seu próprio thread de mensagens\n• Histórico preservado entre versões da ficha",
      },
      {
        heading: "Como usar",
        content: '1. Selecione o produto na lista à esquerda\n2. Digite sua mensagem no campo inferior\n3. Envie com Enter ou clicando no botão\n4. Anexe evidências ou orçamentos quando solicitado',
      },
      {
        heading: "Fluxo de Revisão",
        content: "• Fábrica submete a ficha → status 'Em Revisão'\n• Diretoria analisa e pode solicitar ajustes via chat\n• Fábrica corrige e reenvia\n• Diretoria aprova → status 'Aprovada'",
      },
      {
        heading: "Dicas",
        content: "• Use @menções para chamar atenção de colegas\n• Mensagens ficam vinculadas ao produto/ficha\n• Acompanhe fichas pendentes no Painel Administrativo",
      },
    ],
  },
};

export function ManualFabricaDrawer({ screen, triggerVariant = "icon" }: ManualFabricaDrawerProps) {
  const [open, setOpen] = useState(false);
  const content = manualContent[screen];

  if (!content) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {triggerVariant === "icon" ? (
          <Button variant="ghost" size="icon" title="Manual de Uso">
            <BookOpen className="h-5 w-5" />
          </Button>
        ) : (
          <Button variant="outline" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Manual de Uso
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="text-xl">{content.title}</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-120px)] mt-4 pr-4">
          <div className="space-y-6">
            {content.sections.map((section, idx) => (
              <div key={idx} className="space-y-2">
                <h3 className="font-semibold text-foreground text-base border-b border-border pb-1">
                  {section.heading}
                </h3>
                <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
                  {section.content}
                </pre>
              </div>
            ))}

            <div className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground">
                💡 Dica: Use o botão ❓ (tour guiado) para um passo a passo interativo na tela.
              </p>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
