
# Plano: Módulo de Simulação de Preços (Admin)

## Objetivo
Criar um módulo independente para simulação de cenários de preços, permitindo testar markups, comparar cenários e analisar impacto na cadeia **antes** de criar tabelas reais. Acesso restrito a administradores ou usuários autorizados.

---

## Visão Geral do Módulo

Este será um módulo **separado e independente**, acessível somente por administradores. Não altera nada do sistema atual de tabelas de preços.

```text
Dashboard
└── Simulador de Preços (novo módulo admin)
    ├── Criar Cenário
    ├── Comparar Cenários
    ├── Visualizar Impacto na Cadeia
    └── Exportar/Aplicar Cenário
```

---

## Estrutura de Arquivos

| Tipo | Arquivo | Descrição |
|------|---------|-----------|
| Página | `src/pages/SimuladorPrecosModule.tsx` | Landing page do módulo |
| Página | `src/pages/SimuladorCenariosPrecos.tsx` | Tela de criação/edição de cenários |
| Hook | `src/hooks/useSimuladorPrecos.ts` | Lógica de cálculos e estado |
| Componente | `src/components/simulador/SimuladorCenarioConfig.tsx` | Configurador de cenário |
| Componente | `src/components/simulador/SimuladorComparativo.tsx` | Tabela comparativa lado a lado |
| Componente | `src/components/simulador/SimuladorGraficos.tsx` | Gráficos de impacto |
| Componente | `src/components/simulador/SimuladorCadeiaImpacto.tsx` | Visualização cascata |
| Componente | `src/components/simulador/SimuladorProdutoSelector.tsx` | Seletor de produtos |

---

## Layout da Tela Principal

```text
+------------------------------------------------------------------+
|  [<- Voltar] SIMULADOR DE CENÁRIOS DE PREÇOS                     |
|  Módulo exclusivo para análise de precificação                   |
+------------------------------------------------------------------+
|                                                                  |
|  SEÇÃO 1: CONFIGURAÇÃO DO CENÁRIO                                |
|  +-----------------------------+  +---------------------------+  |
|  | CENÁRIO BASE                |  | CENÁRIO SIMULAÇÃO         |  |
|  | Tabela: [Dropdown]          |  | Modo: [Nova] [Editar]     |  |
|  | Produtos: 45 selecionados   |  | Markup: [____%]           |  |
|  | Origem: Nacional/Importado  |  | Tipo: [percentual ▼]      |  |
|  +-----------------------------+  | Base: [Tabela Fábrica ▼]  |  |
|                                   +---------------------------+  |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  SEÇÃO 2: FILTROS DE PRODUTOS                                    |
|  [Categoria: ▼] [Pesquisar: ___] [Selecionar Todos]              |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  SEÇÃO 3: TABELA COMPARATIVA                                     |
|  +------------------------------------------------------------+  |
|  | Produto     | Custo  | Preço Base | Simulado | Var % | Δ   |  |
|  |-------------|--------|------------|----------|-------|-----|  |
|  | Produto A   | R$ 50  | R$ 65      | R$ 72    | +10%  | +7  |  |
|  | Produto B   | R$ 80  | R$ 104     | R$ 112   | +8%   | +8  |  |
|  +------------------------------------------------------------+  |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  SEÇÃO 4: GRÁFICOS DE ANÁLISE                                    |
|  +---------------------------+  +-----------------------------+  |
|  | Distribuição de Margens   |  | Variação por Categoria      |  |
|  | [Histograma]              |  | [Barras horizontais]        |  |
|  +---------------------------+  +-----------------------------+  |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  SEÇÃO 5: IMPACTO NA CADEIA (Cascata)                            |
|  Fábrica ──► Clear (+25%) ──► Mude (+20%) ──► Cliente (+15%)    |
|              └── E-commerce (+300%)                              |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  AÇÕES: [Salvar Cenário] [Exportar Excel] [Aplicar como Tabela]  |
|                                                                  |
+------------------------------------------------------------------+
```

---

## Funcionalidades

### 1. Configurador de Cenário
- Selecionar tabela base existente como referência
- Criar nova simulação com parâmetros customizados
- Tipos de markup: percentual, multiplicador, valor fixo
- Escolher origem: nacional, importado ou ambos

### 2. Seletor de Produtos
- Filtrar por categoria
- Pesquisa por nome/código
- Seleção múltipla
- Selecionar todos/nenhum

### 3. Tabela Comparativa
- Colunas: Produto, Custo Base, Preço Atual, Preço Simulado, Variação %, Diferença R$
- Ordenação por qualquer coluna
- Destaque visual para variações positivas/negativas
- Margem de lucro calculada em tempo real

### 4. Gráficos de Análise
- **Histograma de Margens**: Distribuição antes vs depois
- **Barras por Categoria**: Impacto médio por grupo de produtos

### 5. Cascata de Impacto
- Visualização das tabelas dependentes
- Propagação simulada do reajuste
- Alerta sobre tabelas que seriam afetadas

### 6. Ações
- **Salvar Cenário**: Armazenar para comparação futura
- **Exportar Excel**: Download do comparativo
- **Aplicar como Tabela**: Criar tabela real a partir da simulação

---

## Modelo de Dados

### Nova Tabela: `simulacao_cenarios_preco`
```sql
CREATE TABLE simulacao_cenarios_preco (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  criado_por UUID REFERENCES auth.users(id),
  tabela_base_id UUID REFERENCES fabrica_tabelas_preco(id),
  tipo_markup TEXT NOT NULL DEFAULT 'percentual',
  valor_markup NUMERIC(10,4) NOT NULL,
  origem TEXT, -- 'nacional', 'importado', 'ambos'
  produtos_ids UUID[] NOT NULL,
  resultados JSONB, -- Cache dos resultados calculados
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Nova Tela no Sistema
```sql
INSERT INTO telas_sistema (codigo, nome, modulo_codigo, rota, icone, ordem, ativo)
VALUES ('precos_simulador', 'Simulador de Preços', 'precos', '/dashboard/precos/simulador', 'FlaskConical', 0, true);
```

---

## Lógica de Cálculo

O hook `useSimuladorPrecos` reutiliza funções existentes:

```typescript
// Funções existentes que serão reaproveitadas
import {
  calcularPrecoComMarkup,
  calcularMargemLucro,
  buscarCadeiaTabelas,
  buscarPrecoTabelaBase
} from '@/lib/fabrica/pricing-calculator';

// Novas funções do hook
function simularPrecos(config: ConfigCenario): ResultadoSimulacao[]
function calcularImpactoCadeia(resultados: ResultadoSimulacao[]): ImpactoCadeia[]
function compararCenarios(cenarioA: ResultadoSimulacao[], cenarioB: ResultadoSimulacao[]): Comparacao[]
```

---

## Controle de Acesso

### Permissão Dedicada
- Código da tela: `precos_simulador`
- Acesso inicial: apenas administradores
- Admin pode liberar para usuários específicos via painel de permissões existente

### Proteção da Rota
```typescript
<Route 
  path="precos/simulador" 
  element={
    <ScreenProtectedRoute screenCode="precos_simulador">
      <SimuladorCenariosPrecos />
    </ScreenProtectedRoute>
  }
/>
```

---

## Integração com Sistema Atual

### O que NÃO muda
- Tabelas de preço existentes continuam inalteradas
- Fluxo de aprovação permanece igual
- Matriz comparativa não é afetada

### O que é NOVO
- Módulo isolado para simulações
- Cenários salvos em tabela separada
- Acesso restrito por permissão

---

## Tecnologias

| Recurso | Biblioteca |
|---------|------------|
| Gráficos | Recharts (já instalado) |
| UI | Shadcn/ui (já instalado) |
| Estado | TanStack Query (já instalado) |
| Exportação | xlsx (já instalado) |
| Cálculos | pricing-calculator.ts existente |

---

## Rota de Acesso

- **URL**: `/dashboard/precos/simulador`
- **Acesso via**: Menu lateral (para admins) ou link direto
- **Proteção**: `ScreenProtectedRoute` com código `precos_simulador`

---

## Resumo de Entregas

1. **Migração SQL**: Criar tabela `simulacao_cenarios_preco` + registro em `telas_sistema`
2. **Hook**: `useSimuladorPrecos.ts` com lógica de cálculo
3. **Página**: `SimuladorCenariosPrecos.tsx` com layout completo
4. **Componentes**: 5 componentes de visualização
5. **Rota**: Registrar em App.tsx com proteção
6. **Menu**: Adicionar link no módulo Preços (visível só para quem tem permissão)
