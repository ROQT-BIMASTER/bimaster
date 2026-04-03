

# Reclassificar Contas a Pagar com IA — Estratégia em Lote por Categoria

## Problema

- **47.566 títulos** em `contas_pagar` com `plano_contas_id = NULL`
- **248 categorias distintas** importadas do ERP (ex: "COMPRA DE MERCADORIA PARA REVENDA", "SALARIOS", "TRIBUTOS ESTADUAIS")
- A abordagem atual classifica **1 conta por vez** via IA — inviável para 47k registros (custaria ~47k chamadas de IA)

## Solução: Classificar por Categoria (não por título)

Em vez de classificar 47.566 títulos individualmente, classificar as **248 categorias únicas** do ERP. Depois, aplicar o mapeamento em massa via UPDATE SQL.

```text
Etapa 1: IA classifica 248 categorias → plano de contas v2
Etapa 2: UPDATE em massa vincula os 47.566 títulos
```

### Fluxo

1. **Edge Function `classificar-contas-lote`** (nova):
   - Recebe um lote de categorias (até 30 por vez)
   - Envia para IA com contexto completo: plano de contas v2, exemplos de fornecedores por categoria, valores médios
   - IA retorna o mapeamento `categoria_nome → código do plano de contas`
   - Salva resultado na tabela `plano_contas_mapeamento_categorias` (nova)

2. **Tabela `plano_contas_mapeamento_categorias`** (nova):
   - `categoria_nome` (unique) — nome da categoria do ERP
   - `plano_contas_id` — conta v2 mapeada
   - `confianca` — score da IA
   - `justificativa` — explicação da IA
   - `revisado_manualmente` — flag para correções do usuário

3. **Aplicação em massa** (via SQL/RPC):
   - `UPDATE contas_pagar SET plano_contas_id, plano_contas_codigo, plano_contas_nome` com base no mapeamento

4. **Interface atualizada** (`ClassificarContasEmLoteDialog`):
   - Fase 1: Mostra "248 categorias a classificar", botão iniciar
   - Fase 2: Progresso por lotes de 30 categorias (~9 chamadas de IA)
   - Fase 3: Tabela de revisão — usuário vê o mapeamento proposto, pode corrigir antes de aplicar
   - Fase 4: Botão "Aplicar classificação" executa o UPDATE em massa

### Detalhes Técnicos da IA

A edge function enviará para cada lote:
- Lista completa do plano de contas v2 (110 contas analíticas)
- Para cada categoria: nome, top 3 fornecedores, valor médio, quantidade de títulos
- Exemplos de campos do ERP: `categoria_nome`, `fornecedor_nome`, `tipo_documento`, `operacao`

Isso permite classificação profissional porque a IA verá o contexto completo, não apenas o nome da categoria.

### Contas a Receber

As 374.800 contas a receber não possuem categorias do ERP — serão classificadas automaticamente como grupo 1 (RECEITA BRUTA) com base no tipo de recebimento, sem necessidade de IA.

## Resultado Esperado

| Antes | Depois |
|---|---|
| 47.566 títulos sem classificação | 47.566 classificados |
| 248 categorias ERP soltas | 248 mapeadas para plano v2 |
| ~47k chamadas IA | ~9 chamadas IA (lotes de 30) |
| Classificação 1-a-1 lenta | Mapeamento em massa instantâneo |

## Arquivos

| Arquivo | Mudança |
|---|---|
| Nova migração SQL | Criar tabela `plano_contas_mapeamento_categorias` |
| `supabase/functions/classificar-contas-lote/index.ts` | Nova edge function para classificação em lote |
| `src/components/configuracoes/ClassificarContasEmLoteDialog.tsx` | Reescrever com fluxo por categorias + revisão + aplicação em massa |

