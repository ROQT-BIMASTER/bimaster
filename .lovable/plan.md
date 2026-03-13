

# Fluxo Completo de Ciclo de Vida do Produto — Análise e Proposta

## O que já existe no sistema

| Fase do fluxo real | O que o sistema já tem | Lacuna |
|---|---|---|
| 1. Origem da demanda | Projeto com template "Desenvolvimento de Produto" (6 seções: Criação, Embalagem, Regulatório, etc.) | Falta campos de **Marca, Categoria, Origem, Linha** no projeto |
| 2. Planejamento / Pré-cadastro | `produtos_brasil` com 50+ campos (nome comercial, SKU, composição, EAN, marca, linha, etc.) | Falta campos: **modo de uso, precauções, ativos, fragrância, aplicador** |
| 3. Desenvolvimento e Amostras | Estágio da tarefa tem "briefing → em_criação → revisão → aprovado → produção → lançamento" | **Não existe módulo de testes/amostras** com status próprio |
| 4. Embalagem | Seção "Desenvolvimento de Embalagem" no template + Cofre de documentos | Falta **checklist estruturado de embalagem** (faca primária, display, cartucho, tester, etiquetas, medidas) |
| 5. Regulatório | `produtos_brasil` tem campos ANVISA (status_anvisa, processo_anvisa, categoria_regulatória, responsável técnico) + checklist 7 itens | Falta **pipeline visual ANVISA** (Dossiê → Enviado → Em aprovação → Aprovado) |
| 6. Cadastro Final | Campos EAN (unitário, display, caixa master), código Brasil, NCM | Falta **validação de completude** para transição |
| 7. Aprovação do Produto | Fluxo de validação com papéis (9 estágios de dev) | Falta **checklist de aprovação física** (cor, textura, fragrância, conformidade) + RNC |
| 8. Produção/Lançamento | Estágio "produção" e "lançamento" nas tarefas | Falta **integração com pedido e tracking de importação** |

## O que o usuário identificou como problema crítico

> "O processo começa com uma planilha enviada por produto — o sistema não é o ponto de origem"

**Isso é verdade parcialmente.** O sistema já permite criar projetos e vincular produtos, mas o fluxo de "Ideia → Projeto → Produto nasce dentro do sistema" não é guiado. Falta um **wizard de criação** que conecte as fases automaticamente.

---

## Proposta de Implementação (em ordem de impacto)

### Fase 1 — Pipeline Visual do Produto (alto impacto, baixo esforço)

Expandir o `StatusPipeline` de 6 para 12 estágios, refletindo o fluxo real:

```text
IDEIA → PROJETO → PRÉ-CADASTRO → DESENVOLVIMENTO → TESTES → EMBALAGEM → REGULATÓRIO → CADASTRO FINAL → APROVAÇÃO → PRODUÇÃO → LANÇAMENTO
```

- Atualizar `PRODUCT_STATUS_LABELS` e `PIPELINE_STEPS` em `useProdutoBrasil.ts` e `StatusPipeline.tsx`
- Migração BD: adicionar novos valores ao campo `status` de `produtos_brasil`
- Cada transição valida pré-requisitos (ex: não avança para REGULATÓRIO sem checklist de embalagem concluído)

### Fase 2 — Wizard "Novo Produto" integrado ao Projeto

Criar um fluxo guiado em `NovoProjetoDialog.tsx` para o template "Desenvolvimento de Produto":

1. **Step 1**: Dados do projeto (nome da linha, marca, categoria, origem: China/Brasil/Collab/Recompra)
2. **Step 2**: Produtos iniciais (criar N produtos Brasil já vinculados)
3. **Step 3**: Equipe (atribuir responsáveis por seção)
4. Sistema cria automaticamente: projeto + seções + tarefas template + produtos vinculados

Adicionar campos `marca`, `categoria_linha`, `origem_projeto` na tabela `projetos`.

### Fase 3 — Módulo de Testes e Amostras

Criar tabela `produto_testes` vinculada a `produtos_brasil`:

| Campo | Tipo |
|---|---|
| tipo_teste | enum: cor, fragrância, textura, aplicador, estabilidade |
| status | enum: amostra_solicitada, amostra_recebida, em_teste, aprovada, reprovada, ajuste_solicitado |
| responsavel_id | UUID |
| resultado | text |
| fotos | array de URLs |
| data_solicitacao / data_resultado | timestamps |

Interface: aba "Testes" dentro da ficha do produto Brasil, com cards por tipo de teste e status visual.

### Fase 4 — Checklist de Embalagem Estruturado

Expandir o checklist de `produtos_brasil_checklist` com itens específicos de embalagem:

- Faca primária / Faca display / Faca cartucho / Faca tester
- Etiqueta fundo / Etiqueta bula / Etiqueta tester
- Medidas display / Peso embalagem
- Arte aprovada / Mockup aprovado
- Foto final

Cada item com: status (pendente/em_andamento/aprovado), responsável, arquivo vinculado (link ao Cofre).

### Fase 5 — Pipeline Regulatório ANVISA

Expandir `status_anvisa` para um pipeline visual próprio:

```text
Análise Regulatória → Dossiê em Elaboração → Enviado ANVISA → Em Aprovação → Aprovado
```

Com campos: número do processo, data envio, data aprovação, taxa paga (bool), observações.

### Fase 6 — Aprovação Física do Produto + RNC

Criar tabela `produto_aprovacoes_fisicas`:
- Checklist: cor conforme, textura conforme, fragrância conforme, rotulagem conforme, peso conforme
- Resultado: Aprovado / Não Conforme
- Se não conforme → gera RNC (Registro de Não Conformidade) com: descrição, fotos, ação corretiva, prazo, fornecedor notificado

---

## Resumo de Escopo

| Fase | Esforço | Impacto |
|---|---|---|
| 1. Pipeline 12 estágios | Baixo | Alto — visibilidade imediata |
| 2. Wizard integrado | Médio | Alto — resolve o problema de "planilha como origem" |
| 3. Módulo Testes | Médio | Alto — fase crítica sem cobertura |
| 4. Checklist Embalagem | Baixo | Médio — estrutura o que hoje é informal |
| 5. Pipeline ANVISA | Baixo | Médio — visibilidade regulatória |
| 6. Aprovação + RNC | Médio | Alto — governança de qualidade |

### Recomendação

Começar pelas **Fases 1 e 2** juntas — o pipeline expandido dá visibilidade imediata, e o wizard garante que o produto nasce dentro do sistema (resolvendo o problema arquitetural que você identificou). As demais fases podem ser implementadas incrementalmente.

