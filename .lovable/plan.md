

# Salvar Análises na Galeria ou Vincular a Projetos

## Objetivo

Após qualquer análise gerada no painel de Inteligência de Conteúdo (patterns, sugestões, posts), exibir um dialog perguntando ao usuário se deseja:
1. **Salvar na Galeria** — persiste como asset na tabela `marketing_assets` (Creative Hub)
2. **Vincular a Projeto** — salva e vincula ao módulo de Projetos via `modulo_vinculos`

## Alterações

### 1. Adicionar `"content_intelligence"` como ModuloType

**Arquivo:** `src/hooks/useModuloVinculos.ts`
- Adicionar `"content_intelligence"` ao type `ModuloType`
- Adicionar entrada em `MODULO_LABELS` com label "Inteligência de Conteúdo"

### 2. Criar dialog `SaveAnalysisDialog`

**Arquivo:** `src/components/marketing/influencers/SaveAnalysisDialog.tsx` (novo)

Dialog com duas opções:
- **"Salvar na Galeria"** — Insere na `marketing_assets` com tipo `"analise_conteudo"`, nome descritivo e conteúdo JSON no campo de metadados
- **"Vincular a Projeto"** — Primeiro salva na galeria, depois abre o `VincularProjetoDialog` existente para linkar ao projeto

O dialog recebe: `type` (patterns/suggestions/post), `data` (o JSON da análise), callbacks `onSave`/`onClose`.

### 3. Integrar no `ContentIntelligencePanel.tsx`

**Arquivo:** `src/components/marketing/influencers/ContentIntelligencePanel.tsx`

Após cada análise bem-sucedida (patterns, sugestões, post gerado), exibir botão "💾 Salvar" que abre o `SaveAnalysisDialog`. O dialog aparece com as duas opções. Ao salvar na galeria, gera um registro com nome automático (ex: "Análise de Performance - 08/04/2026") e o JSON completo.

### 4. Migração — Adicionar tipo ao enum de marketing_assets (se necessário)

Se a tabela `marketing_assets` usar enum restrito para `tipo`, adicionar `analise_conteudo` como valor válido. Caso contrário (text livre), nenhuma migração necessária.

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/hooks/useModuloVinculos.ts` | Modificar — adicionar `"content_intelligence"` ao ModuloType |
| `src/components/marketing/influencers/SaveAnalysisDialog.tsx` | Criar — dialog com opções Galeria / Projeto |
| `src/components/marketing/influencers/ContentIntelligencePanel.tsx` | Modificar — botões "Salvar" após cada resultado + integração do dialog |

