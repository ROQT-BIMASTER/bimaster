

# Upgrade para Melhor IA Disponível — Análises de Influenciadores

## Situação Atual

- `discover-influencers`: usa `google/gemini-2.5-pro` (bom, mas não o melhor disponível)
- `influencer-autopilot`: usa `google/gemini-2.5-flash` para ranking/análise e `google/gemini-2.5-pro` para discovery
- Nenhuma função usa o modelo mais avançado disponível: **`openai/gpt-5.2`** (último lançamento, melhor raciocínio complexo) ou **`google/gemini-3.1-pro-preview`** (última geração Google)

## Plano

Trocar todos os modelos de análise de influenciadores para **`openai/gpt-5.2`** — o modelo mais poderoso disponível, com capacidades avançadas de raciocínio — e habilitar **reasoning** para análises que exigem maior precisão.

### 1. Atualizar `discover-influencers/index.ts`

- Modelo: `openai/gpt-5.2` + Google Search grounding
- Adicionar `reasoning: { effort: "high" }` para garantir análise profunda dos dados encontrados na web
- Manter prompts existentes (já estão bons)

### 2. Atualizar `influencer-autopilot/index.ts`

- `AI_MODEL`: trocar de `google/gemini-2.5-flash` para `openai/gpt-5.2`
- `AI_MODEL_PRO`: remover (não mais necessário — tudo usa o mesmo modelo top)
- Adicionar `reasoning: { effort: "medium" }` nas chamadas de ranking e análise
- Adicionar `reasoning: { effort: "high" }` nas chamadas de discovery e audiência
- Todas as referências a `AI_MODEL` e `AI_MODEL_PRO` passam a usar o modelo único

### 3. Atualizar `analyze-competitor-photo/index.ts`

- Trocar de `google/gemini-2.5-pro` para `openai/gpt-5.2` (suporta visão/imagens)

### 4. Atualizar `ai-filter/index.ts`

- Trocar de `google/gemini-2.5-pro` para `openai/gpt-5.2`

### 5. Atualizar `audit-produto-tarefa/index.ts`

- Trocar de `google/gemini-2.5-flash-lite` para `openai/gpt-5.2`
- Remover `tools`/`tool_choice` antigos e adaptar para o formato correto

## Impacto

- Custo maior por requisição (modelo premium), mas resultados significativamente mais precisos
- Dados de seguidores mais confiáveis com raciocínio avançado + pesquisa web
- Análises de audiência, ranking e competidores com maior profundidade

## Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/discover-influencers/index.ts` | Modelo → `openai/gpt-5.2` + reasoning high |
| `supabase/functions/influencer-autopilot/index.ts` | Modelo → `openai/gpt-5.2` + reasoning |
| `supabase/functions/analyze-competitor-photo/index.ts` | Modelo → `openai/gpt-5.2` |
| `supabase/functions/ai-filter/index.ts` | Modelo → `openai/gpt-5.2` |
| `supabase/functions/audit-produto-tarefa/index.ts` | Modelo → `openai/gpt-5.2` |

