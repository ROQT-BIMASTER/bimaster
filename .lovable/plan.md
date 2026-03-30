

# Dashboard de Respostas + Análise IA por Formulário

## Resumo

Criar uma página de dashboard para cada formulário dinâmico que exibe:
1. KPIs automáticos (total respostas, por dia, campos mais preenchidos)
2. Tabela de respostas com visualização inline
3. Gráficos de distribuição por campo (select, rating, etc.)
4. Botão "Análise IA" que envia os dados para Lovable AI e gera um relatório generativo em Markdown

## Arquitetura

```text
DynamicFormAdmin (card) → clica "📊 Dashboard" →
  /dashboard/trade/formularios/dashboard?id=FORM_ID →
    DynamicFormDashboard.tsx
      ├─ KPIs (total respostas, média/dia, taxa preenchimento)
      ├─ Gráficos (Recharts: barras para selects, pie para ratings)
      ├─ Tabela de respostas (expansível por linha)
      └─ Botão "Gerar Análise IA"
            → Edge function analyze-form-responses
            → Lovable AI (gemini-3-flash-preview)
            → Retorna relatório Markdown renderizado em dialog
```

## Alterações

### 1. Nova página `src/pages/DynamicFormDashboard.tsx`

- Recebe `?id=FORM_ID` da URL
- Carrega: formulário (nome, campos), respostas + answers (join)
- **KPIs**: Total respostas, respostas hoje, taxa de campos obrigatórios preenchidos
- **Gráficos**: Para cada campo tipo `select`/`radio`/`rating`, gera BarChart/PieChart com contagem de valores. Para campos numéricos, histograma simples
- **Tabela**: Lista respostas com data, expandir para ver todos os campos/valores
- **Análise IA**: Botão que chama edge function, exibe resultado em Dialog com ReactMarkdown

### 2. Nova edge function `supabase/functions/analyze-form-responses/index.ts`

- Recebe `{ formId }` no body
- Busca formulário + campos + todas as respostas/answers do banco
- Monta um resumo textual dos dados (distribuições, totais, padrões)
- Envia para Lovable AI Gateway com system prompt analítico
- Retorna o relatório gerado como texto (sem streaming, via invoke)
- System prompt: "Você é um analista de dados. Analise as respostas deste formulário e gere um relatório com: resumo executivo, principais insights, distribuição por campo, padrões identificados, recomendações."

### 3. Atualizar `src/pages/DynamicFormAdmin.tsx`

- Adicionar botão "Dashboard" em cada FormCard que navega para a nova página

### 4. Atualizar `src/App.tsx`

- Adicionar rota `/dashboard/trade/formularios/dashboard`

## Dados enviados à IA

```text
Formulário: "Pesquisa PDV"
Campos: [Nome da Loja (text), Tipo (select: Mercado/Farmácia/Conveniência), Nota (rating 1-5)]
Total respostas: 47

Distribuição "Tipo": Mercado: 22, Farmácia: 15, Conveniência: 10
Distribuição "Nota": 1★: 2, 2★: 5, 3★: 12, 4★: 18, 5★: 10
Média "Nota": 3.6

Respostas recentes (últimas 10): [...]
```

## Arquivos

| Arquivo | Ação |
|---------|------|
| `src/pages/DynamicFormDashboard.tsx` | Novo — dashboard completo |
| `supabase/functions/analyze-form-responses/index.ts` | Nova — análise IA |
| `src/pages/DynamicFormAdmin.tsx` | Botão dashboard no card |
| `src/App.tsx` | Nova rota |

