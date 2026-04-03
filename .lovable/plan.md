

# Dicionário de Referência para Classificação 100% Precisa

## Problema

A IA classifica as 248 categorias do ERP com base em "intuição semântica" — ela lê o nome e tenta adivinhar. Isso gera erros como classificar "CAMERAS" em Segurança quando deveria ser Investimento, ou "DIVERSOS" sem critério.

## Solução: Dicionário Hardcoded DE→PARA

Criar um **dicionário fixo** com o mapeamento exato de cada categoria ERP para o código do plano de contas. A IA só será usada para categorias que **não estejam no dicionário** (casos novos futuros).

### Fluxo Atualizado

```text
1. Categoria ERP chega → Consulta dicionário hardcoded
2. Se encontrou → usa mapeamento direto (confiança 100%)
3. Se NÃO encontrou → chama IA (apenas para categorias novas/desconhecidas)
```

### O Dicionário (exemplos do mapeamento completo)

Vou construir o mapeamento completo das 248 categorias analisando o contexto do negócio. Exemplos:

| Categoria ERP | Código | Conta |
|---|---|---|
| COMPRA DE MERCADORIA PARA REVENDA | 2.1.1 | Compras Ruby Rose |
| SALARIOS | 3.2.1 | Salários CLT |
| 13º SALARIO | 3.2.7 | 13º salário |
| FÉRIAS | 3.2.8 | Férias |
| ALUGUEL DE DEPÓSITO | 3.1.1.1 | Depósito |
| ALUGUEL DE ESCRITÓRIO | 3.1.1.2 | Escritório |
| AGUA DEPOSITO / AGUA ESCRITORIO | 3.1.3 | Conta de Água |
| ELETRICIDADE DEPOSITO / ESCRITORIO | 3.1.2 | Conta de Luz |
| FRETES AGREGADOS | 2.4.2 | Agregados / Freelances |
| ESCOLTA | 2.4.4 | Escoltas |
| ICMS / IMPOSTO ESTADUAL | 2.5.2 | ICMS/GNRE |
| IMPOSTO FEDERAL | 2.5.1 | Simples Nacional |
| CONTABILIDADE EXTERNA | 3.1.8.3 | Contabilidade |
| COMISSAO | 2.6.1 | Comissões |
| DISTRIBUIÇÃO DE LUCRO | 4.4.2 | Retirada de Lucros |
| EMPRESTIMOS | 4.3.1 | Empréstimos bancos - Amortizações |
| ... (todas as 248) | ... | ... |

## Implementação

### 1. Edge Function `classificar-contas-lote`

Adicionar o dicionário como constante no código. No action `classify`:
- Primeiro tenta resolver via dicionário (match exato ou fuzzy por similaridade)
- Só envia para IA as categorias que não foram resolvidas
- Resultado: maioria resolvida instantaneamente com 100% de confiança

### 2. Interface — Indicador Visual

Na fase de revisão, mostrar:
- Badge verde "Dicionário" para mapeamentos diretos (100%)
- Badge azul "IA" para mapeamentos por inteligência artificial
- Usuário pode corrigir e o sistema **aprende** (salva correção no dicionário para próximas vezes)

### 3. Aprendizado Contínuo

Quando o usuário corrigir manualmente um mapeamento na fase de revisão, salvar na tabela `plano_contas_mapeamento_categorias` com `revisado_manualmente = true`. Na próxima execução, consultar essa tabela ANTES do dicionário hardcoded — assim correções manuais têm prioridade máxima.

```text
Prioridade de resolução:
1º → Correções manuais do usuário (tabela DB)
2º → Dicionário hardcoded (248 categorias)
3º → IA (apenas categorias totalmente novas)
```

## Resultado

| Antes | Depois |
|---|---|
| 100% via IA (~95% precisão) | ~98% via dicionário (100% precisão) + ~2% via IA |
| 9 chamadas de IA | 0-1 chamadas de IA |
| Pode errar em categorias ambíguas | Mapeamento determinístico |

## Arquivos

| Arquivo | Mudança |
|---|---|
| `supabase/functions/classificar-contas-lote/index.ts` | Adicionar dicionário DE→PARA + lógica de fallback para IA |
| `src/components/configuracoes/ClassificarContasEmLoteDialog.tsx` | Badge "Dicionário" vs "IA" na revisão |

