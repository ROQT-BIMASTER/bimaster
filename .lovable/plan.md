

# Estrategia de Calculo por Linha ou Produto Individual

## Situacao Atual

Hoje, o markup (tipo e valor) e definido **por tabela** na `fabrica_tabelas_preco`. Quando os precos sao gerados, todos os produtos da tabela recebem o mesmo calculo:

```text
Tabela Distribuidor: +35% sobre todos os produtos
Tabela E-commerce: x1.8 sobre todos os produtos
```

Isso funciona bem para o cenario atual, mas nao permite diferenciar estrategias por familia de produto ou produto especifico.

## O Que Sera Feito

Criar uma tabela de **overrides de markup** que permite definir regras de calculo especificas por linha de produto ou por produto individual, sem alterar o funcionamento atual.

### Hierarquia de Prioridade (mais especifico vence)

```text
1. Override por PRODUTO individual (maior prioridade)
2. Override por LINHA de produto
3. Markup da TABELA (comportamento atual - fallback padrao)
```

## Detalhes Tecnicos

### 1. Nova Tabela: `fabrica_markup_overrides`

```text
Colunas:
- id (uuid, PK)
- tabela_id (FK -> fabrica_tabelas_preco) -- para qual tabela se aplica
- linha (text, nullable) -- ex: "Banana", "Melu" (se aplicar por linha)
- produto_id (FK -> fabrica_produtos, nullable) -- se aplicar por produto individual
- tipo_markup (text) -- 'percentual', 'multiplicador', 'valor_fixo'
- valor_markup (numeric)
- ativo (boolean, default true)
- created_at, updated_at
- created_by (FK -> profiles)

Constraint: CHECK (linha IS NOT NULL OR produto_id IS NOT NULL)
Unique: (tabela_id, linha, produto_id) -- evita duplicatas
```

RLS: Acesso restrito a usuarios autenticados com role admin ou acesso ao modulo fabrica.

### 2. Alteracao no `pricing-calculator.ts`

Na funcao `calcularPrecosProdutos`, antes de aplicar o markup da tabela, buscar overrides:

```text
Para cada produto:
  1. Buscar override por produto_id + tabela_id
  2. Se nao encontrar, buscar override por linha + tabela_id
  3. Se nao encontrar, usar markup da tabela (comportamento atual)
```

A mudanca e cirurgica -- apenas no trecho entre as linhas 428-432 onde o markup e aplicado. O restante (limites, margens, cadeia) continua identico.

### 3. Interface de Gerenciamento (nova aba no modulo de Tabelas de Preco)

Um dialog ou painel dentro da tabela de precos onde o admin pode:

- Ver a lista de overrides ativos para aquela tabela
- Adicionar override por Linha (dropdown com linhas existentes)
- Adicionar override por Produto (busca de produto)
- Definir tipo e valor do markup para cada override
- Ativar/desativar overrides individualmente

### 4. Indicadores Visuais

Na tabela de precos gerados, produtos com override terao um badge indicando que usam markup diferenciado:

- Badge "Linha" (azul) -- quando usa override de linha
- Badge "Individual" (roxo) -- quando usa override de produto

## Compatibilidade

- **Zero impacto** no funcionamento atual: se nao existirem overrides, tudo funciona exatamente como hoje
- A cadeia de recalculo (`recalcularCadeiaPrecos`) automaticamente respeita os overrides
- O Simulador de Cenarios pode ser estendido futuramente para simular com overrides
- Os limites de preco (`fabrica_limites_preco_tabela`) continuam sendo aplicados normalmente sobre o preco calculado com override

## Arquivos Afetados

| Arquivo | Alteracao |
|---------|-----------|
| Nova migracao SQL | Criar tabela `fabrica_markup_overrides` com RLS |
| `src/lib/fabrica/pricing-calculator.ts` | Buscar overrides antes de aplicar markup (linhas 428-432) |
| Novo componente `MarkupOverridesManager.tsx` | UI para gerenciar overrides por tabela |
| `src/components/fabrica/GeradorPrecosDialog.tsx` | Badge visual nos produtos com override |
| `src/integrations/supabase/types.ts` | Atualizado automaticamente |

## Resultado

Com essa estrutura voce podera, por exemplo:

- Tabela Distribuidor: +35% geral, mas Linha "Banana" com +28% e produto "Pistache Premium" com +42%
- Tabela E-commerce: x1.8 geral, mas Linha "Clear" com x2.0

Tudo retrocompativel e sem afetar o que ja funciona.

