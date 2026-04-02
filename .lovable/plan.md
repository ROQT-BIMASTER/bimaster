

# Análise Inteligente do Asana com IA — Leitura Pura + Mapeamento de Campos

## Contexto

A integração atual já importa dados do Asana (projetos, seções, tarefas, comentários). Porém:
1. Ela **modifica** dados no Asana? Não — já é somente leitura via PAT com GET requests
2. O Asana possui **custom_fields** (campos personalizados) que já são buscados na API (`opt_fields: "...custom_fields"`) mas são **ignorados** — não são salvos nem analisados
3. Campos como tags, followers, attachments, dependencies e custom_fields do Asana não têm equivalente no sistema local

## O que será feito

### 1. Nova rota `/analyze-structure` na Edge Function
Uma rota de **leitura pura** que:
- Busca todos os projetos de um workspace com campos detalhados
- Coleta `custom_fields` (campos personalizados criados pelas equipes no Asana)
- Coleta `tags`, `dependencies`, `attachments`, `followers` de uma amostra de tarefas
- Envia tudo para a **IA (Gemini 3 Flash)** com um prompt que pede:
  - Lista de todos os campos encontrados no Asana
  - Quais já têm equivalente no sistema local (`projeto_tarefas` tem: titulo, descricao, status, prioridade, data_prazo, data_inicio, responsavel_id, estagio, codigo, etc.)
  - Quais campos **precisam ser criados** (ex: custom_fields específicos, tags, dependências)
  - Sugestão de SQL para migrations
  - Sugestão de componentes frontend para exibir esses campos

### 2. Tela de Análise no Frontend
Nova seção na página `AsanaIntegracao.tsx`:
- Botão "Analisar Estrutura com IA" (aparece após conexão no Step 2)
- Exibe o relatório da IA em Markdown formatado
- Mostra tabela comparativa: Campo Asana → Campo Local → Status (existe/precisa criar)
- Botão para copiar sugestões de migration SQL

### 3. Garantias de Somente Leitura
- Toda comunicação com Asana continua usando apenas `GET` requests
- Nenhum `POST/PUT/DELETE` para a API do Asana
- O PAT é usado apenas para leitura — as equipes não perceberão nada

## Alterações Técnicas

| Arquivo | Ação |
|---------|------|
| `supabase/functions/asana-sync/index.ts` | Adicionar rota `/analyze-structure` que busca custom_fields, tags, dependencies e envia para IA |
| `src/pages/AsanaIntegracao.tsx` | Adicionar botão "Analisar Estrutura" e seção de exibição do relatório IA |
| `src/hooks/useAsanaSync.ts` | Adicionar função `analyzeStructure()` |

Zero migrations neste passo — a IA apenas **sugere** o que criar. As migrations serão implementadas depois, com base no relatório.

