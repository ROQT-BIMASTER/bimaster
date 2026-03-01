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
  | "formulas"
  | "ordens-producao"
  | "recebimentos"
  | "fiscal"
  | "tabelas-preco"
  | "ficha-custos";

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
        content: '1. Clique em "+ Novo Produto"\n2. Preencha:\n   • Código: ex. PROD-001 (obrigatório)\n   • Nome: ex. Sérum Facial Coco 35ml (obrigatório)\n   • Tipo: ACABADO ou INTERMEDIÁRIO\n   • Origem: Nacional ou Importado\n   • Marca e Linha (opcionais)\n   • Fórmula: pode vincular depois\n3. Clique em "Cadastrar"',
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
        heading: "Painel Administrativo",
        content: "Acesse fichas de custos pendentes de revisão e acompanhe aprovações.\n\nFluxo:\n1️⃣ Monte a ficha → 2️⃣ Submeta para aprovação → 3️⃣ Diretoria analisa → 4️⃣ Aprovada ✅ ou Revisão 🔄",
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
